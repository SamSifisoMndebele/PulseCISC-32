// PulseCISC-32 Two-Pass MASM & x86 Variable-Length CISC Assembler
import type {
  AssembledProgram,
  AssemblyError,
  Mnemonic,
  Operand,
  RegisterId,
  SegmentRegisterName,
} from './types';
import {
  OPCODES,
  REGISTER_LOOKUP,
  encodeInstructionToBytes,
  formatMemoryOperand,
} from './isa';
import type { ParsedRegisterToken, InstructionToEncode } from './isa';
import { CODE_START, CODE_END, DATA_START, DATA_END } from './memory';
import { MASMPreprocessor } from './masmPreprocessor';
import type { DataSymbolInfo } from './masmPreprocessor';

interface DataDirective {
  type: 'DB' | 'DW' | 'DD';
  argsStr: string;
}

interface ParsedLine {
  lineIndex: number; // 0-indexed line in original user source
  original: string;
  clean: string;
  labels: string[];
  isDataDirective?: boolean;
  dataDirective?: DataDirective;
  instruction: {
    repPrefix?: 'REP' | 'REPE' | 'REPNE';
    mnemonic: string;
    args: string[];
  } | null;
}

export class Assembler {
  /**
   * Assembles MASM / x86 assembly source code into variable-length x86 machine code bytes and data bytes.
   */
  public static assemble(
    source: string,
    config?: { codeStart?: number; codeEnd?: number; dataStart?: number; dataEnd?: number }
  ): AssembledProgram {
    const rawLines = source.split(/\r?\n/);
    const preprocessed = MASMPreprocessor.preprocess(source);
    const dataSymbols = preprocessed.dataSymbols;

    const parsedLines: ParsedLine[] = [];
    const labels = new Map<string, number>();
    const lineAddresses = new Map<number, number>();
    const addressToLine = new Map<number, number>();
    const errors: AssemblyError[] = [];
    const warnings: string[] = [];

    const codeStart = config?.codeStart ?? CODE_START;
    const codeEnd = config?.codeEnd ?? CODE_END;
    const dataStart = config?.dataStart ?? DATA_START;
    const dataEnd = config?.dataEnd ?? DATA_END;

    let currentCodeAddress = codeStart;
    let currentDataAddress = dataStart;
    let currentSection: 'CODE' | 'DATA' = 'CODE';
    const pendingLabels: { name: string; lineIndex: number }[] = [];

    // Pass 1: Extract labels and calculate exact byte addresses
    for (let idx = 0; idx < preprocessed.lines.length; idx++) {
      const { text: rawClean, originLine } = preprocessed.lines[idx];
      const originalLineText = rawLines[originLine] ?? rawClean;
      let clean = this.stripComments(rawClean);
      const extractedLabels: string[] = [];

      // Extract leading labels ending with colon (e.g. "loop:", "msg:")
      let matchLabel: RegExpExecArray | null;
      while ((matchLabel = /^([a-zA-Z_@][a-zA-Z0-9_@]*)\s*:(?!\s*\[)(.*)$/.exec(clean)) !== null) {
        const labelName = matchLabel[1].trim();
        // Make sure it's not a segment override prefix like ES:[EDI]
        if (/^(CS|DS|SS|ES|FS|GS)$/i.test(labelName) && matchLabel[2].trim().startsWith('[')) {
          break;
        }
        clean = matchLabel[2].trim();

        if (labelName.length > 0) {
          if (
            labels.has(labelName.toLowerCase()) ||
            pendingLabels.some((p) => p.name.toLowerCase() === labelName.toLowerCase())
          ) {
            errors.push({
              line: originLine + 1,
              message: `Duplicate label definition: "${labelName}"`,
            });
          } else {
            pendingLabels.push({ name: labelName, lineIndex: originLine });
            extractedLabels.push(labelName);
          }
        }
      }

      // Section headers (.data, .text, .code)
      if (/^(section\s+\.(data|text|code)|\.(data|text|code))$/i.test(clean)) {
        if (/data/i.test(clean)) {
          for (const p of pendingLabels) {
            labels.set(p.name.toLowerCase(), currentCodeAddress);
          }
          pendingLabels.length = 0;
          currentSection = 'DATA';
        } else {
          for (const p of pendingLabels) {
            labels.set(p.name.toLowerCase(), currentDataAddress);
          }
          pendingLabels.length = 0;
          currentSection = 'CODE';
        }
        parsedLines.push({
          lineIndex: originLine,
          original: originalLineText,
          clean,
          labels: extractedLabels,
          instruction: null,
        });
        continue;
      }

      if (clean.length === 0) {
        parsedLines.push({
          lineIndex: originLine,
          original: originalLineText,
          clean,
          labels: extractedLabels,
          instruction: null,
        });
        continue;
      }

      // Data Directives (DB, DW, DD, BYTE, WORD, DWORD)
      const dataMatch = clean.match(/^(DB|DW|DD|BYTE|SBYTE|WORD|SWORD|DWORD|SDWORD)\s+(?!PTR\b)(.*)$/i);
      if (dataMatch) {
        const rawDir = dataMatch[1].toUpperCase();
        let dirType: 'DB' | 'DW' | 'DD' = 'DD';
        if (rawDir === 'DB' || rawDir === 'BYTE' || rawDir === 'SBYTE') dirType = 'DB';
        else if (rawDir === 'DW' || rawDir === 'WORD' || rawDir === 'SWORD') dirType = 'DW';
        const argsStr = dataMatch[2].trim();

        for (const p of pendingLabels) {
          labels.set(p.name.toLowerCase(), currentDataAddress);
        }
        pendingLabels.length = 0;

        if (!lineAddresses.has(originLine)) {
          lineAddresses.set(originLine, currentDataAddress);
        }
        addressToLine.set(currentDataAddress, originLine);

        const byteCount = this.calculateDirectiveByteCount(dirType, argsStr, originLine + 1);
        currentDataAddress += byteCount;

        parsedLines.push({
          lineIndex: originLine,
          original: originalLineText,
          clean,
          labels: extractedLabels,
          isDataDirective: true,
          dataDirective: { type: dirType, argsStr },
          instruction: null,
        });
        continue;
      }

      // Executable instruction: assign pending labels to currentCodeAddress (or currentDataAddress if inside .data before data directive)
      if (currentSection === 'DATA' && pendingLabels.length > 0) {
        // Check if this is actually an instruction (switched implicitly to code)
        currentSection = 'CODE';
      }
      for (const p of pendingLabels) {
        labels.set(p.name.toLowerCase(), currentCodeAddress);
      }
      pendingLabels.length = 0;

      // Optional REP / REPE / REPZ / REPNE / REPNZ prefix
      let repPrefix: 'REP' | 'REPE' | 'REPNE' | undefined = undefined;
      const repMatch = clean.match(/^(REP|REPE|REPZ|REPNE|REPNZ)\s+(.+)$/i);
      if (repMatch) {
        const rp = repMatch[1].toUpperCase();
        repPrefix = rp === 'REPNE' || rp === 'REPNZ' ? 'REPNE' : rp === 'REPE' || rp === 'REPZ' ? 'REPE' : 'REP';
        clean = repMatch[2].trim();
      }

      const firstSpace = clean.search(/\s/);
      let mnemonic = '';
      let argsStr = '';

      if (firstSpace === -1) {
        mnemonic = clean.toUpperCase();
      } else {
        mnemonic = clean.substring(0, firstSpace).toUpperCase();
        argsStr = clean.substring(firstSpace + 1).trim();
      }

      const args = this.splitArgs(argsStr);
      const instruction = { repPrefix, mnemonic, args };

      if (!lineAddresses.has(originLine)) {
        lineAddresses.set(originLine, currentCodeAddress);
      }
      addressToLine.set(currentCodeAddress, originLine);

      // Compute exact byte length in Pass 1
      let instByteLen = 4;
      try {
        const dummyEncoded = this.buildInstructionToEncode(
          mnemonic,
          args,
          repPrefix,
          currentCodeAddress,
          undefined,
          dataSymbols,
          originLine + 1
        );
        instByteLen = encodeInstructionToBytes(dummyEncoded).length;
      } catch {
        instByteLen = 4;
      }

      currentCodeAddress += instByteLen;

      parsedLines.push({
        lineIndex: originLine,
        original: originalLineText,
        clean,
        labels: extractedLabels,
        instruction,
      });
    }

    for (const p of pendingLabels) {
      labels.set(
        p.name.toLowerCase(),
        currentSection === 'DATA' ? currentDataAddress : currentCodeAddress
      );
    }
    pendingLabels.length = 0;

    // Multi-pass label convergence check: recompute exact addresses now that all label names are known
    currentCodeAddress = codeStart;
    addressToLine.clear();
    lineAddresses.clear();

    for (const parsed of parsedLines) {
      for (const lbl of parsed.labels) {
        if (!parsed.isDataDirective && !dataSymbols.has(lbl.toLowerCase())) {
          labels.set(lbl.toLowerCase(), currentCodeAddress);
        }
      }
      if (parsed.isDataDirective) {
        const addr = labels.get(parsed.labels[0]?.toLowerCase() ?? '') ?? dataStart;
        if (!lineAddresses.has(parsed.lineIndex)) {
          lineAddresses.set(parsed.lineIndex, addr);
        }
        addressToLine.set(addr, parsed.lineIndex);
        continue;
      }
      if (parsed.instruction) {
        if (!lineAddresses.has(parsed.lineIndex)) {
          lineAddresses.set(parsed.lineIndex, currentCodeAddress);
        }
        addressToLine.set(currentCodeAddress, parsed.lineIndex);
        try {
          const enc = this.buildInstructionToEncode(
            parsed.instruction.mnemonic,
            parsed.instruction.args,
            parsed.instruction.repPrefix,
            currentCodeAddress,
            labels,
            dataSymbols,
            parsed.lineIndex + 1
          );
          currentCodeAddress += encodeInstructionToBytes(enc).length;
        } catch {
          currentCodeAddress += 4;
        }
      }
    }

    const codeCap = codeEnd - codeStart + 1;
    const dataCap = dataEnd - dataStart + 1;

    if (currentCodeAddress > codeEnd + 1) {
      errors.push({
        line: 1,
        message: `Program code size (${currentCodeAddress - codeStart} bytes) exceeds Code Segment capacity (${codeCap} bytes).`,
      });
    }

    if (currentDataAddress > dataEnd + 1) {
      errors.push({
        line: 1,
        message: `Program data size (${currentDataAddress - dataStart} bytes) exceeds Data Segment capacity (${dataCap} bytes).`,
      });
    }

    // Pass 2: Encode instructions into variable-length x86 bytes and data into dataBytes
    const codeBytes = new Uint8Array(Math.max(2048, codeCap));
    const dataBytes = new Uint8Array(Math.max(2048, dataCap));
    let codePointer = 0;
    let dataPointer = 0;

    for (const parsed of parsedLines) {
      const lineNum = parsed.lineIndex + 1;

      if (parsed.isDataDirective && parsed.dataDirective) {
        try {
          const bytes = this.encodeDataDirective(
            parsed.dataDirective.type,
            parsed.dataDirective.argsStr,
            labels,
            lineNum
          );
          for (const b of bytes) {
            if (dataPointer < dataBytes.length) {
              dataBytes[dataPointer++] = b & 0xff;
            }
          }
        } catch (err: unknown) {
          errors.push({
            line: lineNum,
            message: err instanceof Error ? err.message : String(err),
          });
        }
        continue;
      }

      if (parsed.instruction) {
        const { mnemonic, args, repPrefix } = parsed.instruction;
        const pc = codeStart + codePointer;

        try {
          const instToEncode = this.buildInstructionToEncode(
            mnemonic,
            args,
            repPrefix,
            pc,
            labels,
            dataSymbols,
            lineNum
          );
          const encodedBytes = encodeInstructionToBytes(instToEncode);
          addressToLine.set(pc, parsed.lineIndex);
          if (!lineAddresses.has(parsed.lineIndex)) {
            lineAddresses.set(parsed.lineIndex, pc);
          }
          for (const b of encodedBytes) {
            codeBytes[codePointer++] = b & 0xff;
          }
        } catch (err: unknown) {
          errors.push({
            line: lineNum,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    let entryPoint: number | undefined = undefined;
    if (preprocessed.entryLabel && labels.has(preprocessed.entryLabel.toLowerCase())) {
      entryPoint = labels.get(preprocessed.entryLabel.toLowerCase());
    }

    return {
      codeBytes: codeBytes.subarray(0, codePointer),
      dataBytes: dataBytes.subarray(0, dataPointer),
      entryPoint,
      sourceLines: rawLines,
      lineAddresses,
      addressToLine,
      labels,
      errors,
      warnings,
    };
  }

  private static stripComments(line: string): string {
    let inDouble = false;
    let inSingle = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inSingle && (i === 0 || line[i - 1] !== '\\')) {
        inDouble = !inDouble;
      } else if (ch === "'" && !inDouble && (i === 0 || line[i - 1] !== '\\')) {
        inSingle = !inSingle;
      } else if (!inDouble && !inSingle) {
        if (ch === ';' || ch === '#') {
          return line.substring(0, i).trim();
        }
        if (ch === '/' && i + 1 < line.length && line[i + 1] === '/') {
          return line.substring(0, i).trim();
        }
      }
    }
    return line.trim();
  }

  private static splitArgs(argsStr: string): string[] {
    const args: string[] = [];
    if (!argsStr) return args;

    let currentArg = '';
    let bracketDepth = 0;
    let inDouble = false;
    let inSingle = false;

    for (let c = 0; c < argsStr.length; c++) {
      const ch = argsStr[c];
      if (ch === '"' && !inSingle && (c === 0 || argsStr[c - 1] !== '\\')) inDouble = !inDouble;
      if (ch === "'" && !inDouble && (c === 0 || argsStr[c - 1] !== '\\')) inSingle = !inSingle;
      if (ch === '[' && !inDouble && !inSingle) bracketDepth++;
      if (ch === ']' && !inDouble && !inSingle) bracketDepth = Math.max(0, bracketDepth - 1);

      if (ch === ',' && bracketDepth === 0 && !inDouble && !inSingle) {
        args.push(currentArg.trim());
        currentArg = '';
      } else {
        currentArg += ch;
      }
    }
    if (currentArg.trim().length > 0) {
      args.push(currentArg.trim());
    }
    return args;
  }

  private static calculateDirectiveByteCount(
    type: 'DB' | 'DW' | 'DD',
    argsStr: string,
    lineNum: number
  ): number {
    try {
      const bytes = this.encodeDataDirective(type, argsStr, undefined, lineNum);
      return bytes.length;
    } catch {
      return 1;
    }
  }

  private static encodeDataDirective(
    type: 'DB' | 'DW' | 'DD',
    argsStr: string,
    labels?: Map<string, number>,
    lineNum: number = 1
  ): number[] {
    const bytes: number[] = [];
    const tokens = this.splitArgs(argsStr);

    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;

      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
      ) {
        const raw = trimmed.substring(1, trimmed.length - 1);
        let i = 0;
        while (i < raw.length) {
          if (raw[i] === '\\' && i + 1 < raw.length) {
            i++;
            const esc = raw[i];
            let val = 0;
            switch (esc) {
              case 'n': val = 10; break;
              case 'r': val = 13; break;
              case 't': val = 9; break;
              case '0': val = 0; break;
              case '\\': val = 92; break;
              case '"': val = 34; break;
              case "'": val = 39; break;
              default: val = esc.charCodeAt(0); break;
            }
            this.pushBytes(bytes, type, val);
          } else {
            this.pushBytes(bytes, type, raw.charCodeAt(i));
          }
          i++;
        }
      } else {
        let val = 0;
        try {
          val = this.parseImmediate(trimmed, lineNum, labels);
        } catch (e) {
          if (!labels) {
            val = 0;
          } else {
            throw e;
          }
        }
        this.pushBytes(bytes, type, val);
      }
    }

    return bytes;
  }

  private static pushBytes(bytes: number[], type: 'DB' | 'DW' | 'DD', val: number): void {
    if (type === 'DB') {
      bytes.push(val & 0xff);
    } else if (type === 'DW') {
      bytes.push(val & 0xff);
      bytes.push((val >>> 8) & 0xff);
    } else if (type === 'DD') {
      bytes.push(val & 0xff);
      bytes.push((val >>> 8) & 0xff);
      bytes.push((val >>> 16) & 0xff);
      bytes.push((val >>> 24) & 0xff);
    }
  }

  private static isRegister(str: string): boolean {
    return str.trim().toLowerCase() in REGISTER_LOOKUP;
  }

  private static parseRegister(regStr: string, lineNum: number): ParsedRegisterToken {
    const clean = regStr.trim().toLowerCase();
    if (clean in REGISTER_LOOKUP) {
      return REGISTER_LOOKUP[clean];
    }
    throw new Error(`Line ${lineNum}: Unknown register '${regStr}'`);
  }

  private static toRegOperand(token: ParsedRegisterToken): Operand {
    return {
      type: 'REG',
      reg: token.id,
      is16Bit: token.is16Bit,
      is8Bit: token.is8Bit,
      is8BitHigh: token.is8BitHigh,
      segReg: token.segReg,
      rawString: token.name,
    };
  }

  private static parseImmediate(
    immStr: string,
    lineNum: number,
    labels?: Map<string, number>
  ): number {
    let clean = immStr.trim();

    // Strip leading OFFSET / ADDR keyword
    if (/^(OFFSET|ADDR)\s+/i.test(clean)) {
      clean = clean.replace(/^(OFFSET|ADDR)\s+/i, '').trim();
    }

    if (labels && labels.has(clean.toLowerCase())) {
      return labels.get(clean.toLowerCase())!;
    }

    // Handle simple constant arithmetic like "label + 4" or "10 * 4"
    const arithMatch = clean.match(/^([a-zA-Z_@][a-zA-Z0-9_@]*|\d+)\s*([+\-*])\s*(\d+)$/);
    if (arithMatch) {
      const left = this.parseImmediate(arithMatch[1], lineNum, labels);
      const op = arithMatch[2];
      const right = parseInt(arithMatch[3], 10);
      if (op === '+') return left + right;
      if (op === '-') return left - right;
      if (op === '*') return left * right;
    }

    // Character literal
    if (clean.startsWith("'") && clean.endsWith("'") && clean.length >= 3) {
      const inner = clean.substring(1, clean.length - 1);
      if (inner.startsWith('\\') && inner.length >= 2) {
        switch (inner[1]) {
          case 'n': return 10;
          case 'r': return 13;
          case 't': return 9;
          case '0': return 0;
          case '\\': return 92;
          case "'": return 39;
          default: return inner.charCodeAt(1);
        }
      }
      return inner.charCodeAt(0);
    }

    let val: number;
    if (/^[+-]?[0-9][0-9a-fA-F]*h$/i.test(clean)) {
      val = parseInt(clean.substring(0, clean.length - 1), 16);
    } else if (/^[+-]?0x[0-9a-fA-F]+$/i.test(clean)) {
      val = parseInt(clean, 16);
    } else if (/^[+-]?0b[01]+$/i.test(clean)) {
      const sign = clean.startsWith('-') ? -1 : 1;
      const bits = clean.replace(/^[+-]?0b/i, '');
      val = sign * parseInt(bits, 2);
    } else if (/^[+-]?[01]+b$/i.test(clean)) {
      const sign = clean.startsWith('-') ? -1 : 1;
      const bits = clean.replace(/^[+-]?/, '').slice(0, -1);
      val = sign * parseInt(bits, 2);
    } else if (/^[+-]?[0-9]+d?$/i.test(clean)) {
      val = parseInt(clean.replace(/d$/i, ''), 10);
    } else {
      val = NaN;
    }

    if (isNaN(val)) {
      // During Pass 1 when labels map is undefined, return dummy 32-bit address 0x4000
      if (!labels && /^[a-zA-Z_@][a-zA-Z0-9_@]*$/.test(clean)) {
        return 0x4000;
      }
      throw new Error(`Line ${lineNum}: Invalid number or undefined symbol '${immStr}'`);
    }
    return val;
  }

  /**
   * Determines whether an operand string represents a memory reference:
   * - Explicit bracket `[...]`
   * - Indexed label `array[esi*4]` or `[ebx][esi]`
   * - Explicit pointer qualifier `BYTE PTR ...`, `WORD PTR ...`, `DWORD PTR ...`
   * - Segment override `ES:[...]`
   * - Bare MASM data variable (when `isDest` is true, or when symbol is a WORD/DWORD variable in `.data` without `OFFSET`)
   */
  private static isMemoryOperand(
    str: string,
    dataSymbols: Map<string, DataSymbolInfo>,
    isDest: boolean = false,
    otherOperandIs8Bit: boolean = false
  ): boolean {
    const s = str.trim();
    if (/^(OFFSET|ADDR)\s+/i.test(s)) return false;
    if (this.isRegister(s)) return false;
    if (s.includes('[') && s.endsWith(']')) return true;
    if (/^(BYTE|SBYTE|WORD|SWORD|DWORD|SDWORD)\s+(?:PTR\s+)?/i.test(s)) return true;
    if (/^(CS|DS|SS|ES|FS|GS)\s*:/i.test(s)) return true;

    const lower = s.toLowerCase();
    if (dataSymbols.has(lower)) {
      const info = dataSymbols.get(lower)!;
      // If used as destination (e.g. `MOV sum, EAX`), or if it's a WORD/DWORD MASM variable, or 8-bit load into AL..DH
      if (isDest || info.type === 'DW' || info.type === 'DD' || otherOperandIs8Bit) {
        return true;
      }
    }
    return false;
  }

  /**
   * Parses complex x86/MASM memory operands including Full SIB `[Base + Index*Scale + Disp]`,
   * outside-bracket indexing `array[ESI*4]`, `matrix[EBX][ESI*4]`, `PTR` qualifiers, and segment overrides.
   */
  private static parseMemoryOperand(
    memStr: string,
    lineNum: number,
    labels: Map<string, number> | undefined,
    dataSymbols: Map<string, DataSymbolInfo>
  ): Operand {
    let s = memStr.trim();
    let isByte = false;
    let isWord = false;
    let segmentOverride: SegmentRegisterName | undefined = undefined;

    // 1. Parse optional size prefix: BYTE PTR, WORD PTR, DWORD PTR, BYTE, WORD, DWORD
    const sizeMatch = s.match(/^(BYTE|SBYTE|WORD|SWORD|DWORD|SDWORD)\s+(?:PTR\s+)?(.*)$/i);
    if (sizeMatch) {
      const sz = sizeMatch[1].toUpperCase();
      if (sz === 'BYTE' || sz === 'SBYTE') isByte = true;
      else if (sz === 'WORD' || sz === 'SWORD') isWord = true;
      s = sizeMatch[2].trim();
    }

    // 2. Parse optional segment override prefix: CS:, DS:, SS:, ES:, FS:, GS:
    const segMatch = s.match(/^(CS|DS|SS|ES|FS|GS)\s*:\s*(.*)$/i);
    if (segMatch) {
      segmentOverride = segMatch[1].toUpperCase() as SegmentRegisterName;
      s = segMatch[2].trim();
    }

    // 3. Handle bare MASM variable name without brackets (e.g. `mov eax, val1`)
    if (!s.includes('[')) {
      const symLower = s.toLowerCase();
      const symInfo = dataSymbols.get(symLower);
      if (symInfo && !isByte && !isWord) {
        if (symInfo.type === 'DB') isByte = true;
        else if (symInfo.type === 'DW') isWord = true;
      }
      const addr = this.parseImmediate(s, lineNum, labels);
      const op: Operand = {
        type: 'MEM',
        memBaseReg: 0,
        memOffset: addr,
        isDirect: true,
        isByte,
        isWord,
        segmentOverride,
        rawString: '',
      };
      op.rawString = formatMemoryOperand(op);
      return op;
    }

    // 4. Normalize outside-bracket prefix and multiple brackets:
    // e.g. `array[ESI*4]` -> `[array + ESI*4]`
    // e.g. `matrix[EBX][ESI*4]` -> `[matrix + EBX + ESI*4]`
    const firstBracket = s.indexOf('[');
    const leadingPrefix = s.substring(0, firstBracket).trim();
    const bracketPortion = s.substring(firstBracket).trim();

    if (leadingPrefix) {
      const symInfo = dataSymbols.get(leadingPrefix.toLowerCase());
      if (symInfo && !isByte && !isWord) {
        if (symInfo.type === 'DB') isByte = true;
        else if (symInfo.type === 'DW') isWord = true;
      }
    }

    // Extract all `[...]` contents and combine with `+`
    const bracketMatches = [...bracketPortion.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
    if (bracketMatches.length === 0) {
      throw new Error(`Line ${lineNum}: Invalid memory operand '${memStr}'`);
    }
    if (leadingPrefix) {
      bracketMatches.unshift(leadingPrefix);
    }
    const combinedInner = bracketMatches.join(' + ');

    // 5. Tokenize `combinedInner` into signed additive terms (+ or -)
    const terms: { sign: 1 | -1; expr: string }[] = [];
    let current = '';
    let currentSign: 1 | -1 = 1;

    for (let i = 0; i < combinedInner.length; i++) {
      const ch = combinedInner[i];
      if (ch === '+' || ch === '-') {
        if (current.trim().length > 0) {
          terms.push({ sign: currentSign, expr: current.trim() });
          current = '';
        }
        currentSign = ch === '-' ? -1 : 1;
      } else {
        current += ch;
      }
    }
    if (current.trim().length > 0) {
      terms.push({ sign: currentSign, expr: current.trim() });
    }

    let baseReg: RegisterId | undefined = undefined;
    let indexReg: RegisterId | undefined = undefined;
    let scale: 1 | 2 | 4 | 8 = 1;
    let offset = 0;

    for (const term of terms) {
      const { sign, expr } = term;

      // Case A: Scaled index `reg * scale` or `scale * reg`
      const scaleMatch =
        expr.match(/^([a-zA-Z]+)\s*\*\s*([1248])$/) ||
        expr.match(/^([1248])\s*\*\s*([a-zA-Z]+)$/);
      if (scaleMatch) {
        const isFirstReg = isNaN(Number(scaleMatch[1]));
        const regName = isFirstReg ? scaleMatch[1] : scaleMatch[2];
        const scaleVal = parseInt(isFirstReg ? scaleMatch[2] : scaleMatch[1], 10) as 1 | 2 | 4 | 8;
        const regTok = this.parseRegister(regName, lineNum);
        indexReg = regTok.id;
        scale = scaleVal;
        continue;
      }

      // Case B: Plain register
      if (this.isRegister(expr)) {
        const regTok = this.parseRegister(expr, lineNum);
        if (baseReg === undefined && sign === 1) {
          baseReg = regTok.id;
        } else if (indexReg === undefined && sign === 1) {
          indexReg = regTok.id;
          scale = 1;
        } else {
          throw new Error(`Line ${lineNum}: Too many registers in memory operand '${memStr}'`);
        }
        continue;
      }

      // Case C: Displacement / label / constant
      const val = this.parseImmediate(expr, lineNum, labels);
      offset += sign * val;
    }

    const isDirect = baseReg === undefined;
    const op: Operand = {
      type: 'MEM',
      memBaseReg: baseReg,
      memIndexReg: indexReg,
      memScale: indexReg !== undefined ? scale : undefined,
      memOffset: offset,
      isDirect,
      isByte,
      isWord,
      segmentOverride,
      rawString: '',
    };
    op.rawString = formatMemoryOperand(op);
    return op;
  }

  private static parseGeneralOperand(
    str: string,
    lineNum: number,
    labels: Map<string, number> | undefined,
    dataSymbols: Map<string, DataSymbolInfo>,
    isDest: boolean = false,
    otherOperandIs8Bit: boolean = false
  ): Operand {
    const trimmed = str.trim();
    if (this.isRegister(trimmed)) {
      return this.toRegOperand(this.parseRegister(trimmed, lineNum));
    }
    if (this.isMemoryOperand(trimmed, dataSymbols, isDest, otherOperandIs8Bit)) {
      return this.parseMemoryOperand(trimmed, lineNum, labels, dataSymbols);
    }
    const imm = this.parseImmediate(trimmed, lineNum, labels);
    return {
      type: 'IMM',
      imm,
      rawString: String(imm),
    };
  }

  private static buildInstructionToEncode(
    rawMnemonic: string,
    args: string[],
    repPrefix: 'REP' | 'REPE' | 'REPNE' | undefined,
    _pc: number,
    labels: Map<string, number> | undefined,
    dataSymbols: Map<string, DataSymbolInfo>,
    lineNum: number
  ): InstructionToEncode {
    const mnemonic = rawMnemonic.toUpperCase() as Mnemonic;
    const noneOp: Operand = { type: 'NONE', rawString: '' };

    // 1. Zero-Operand Instructions
    switch (mnemonic) {
      case 'NOP':
        return { opcode: OPCODES.NOP, mnemonic: 'NOP', dest: noneOp, src: noneOp };
      case 'HLT':
      case 'HALT' as Mnemonic:
        return { opcode: OPCODES.HLT, mnemonic: 'HLT', dest: noneOp, src: noneOp };
      case 'LEAVE':
        return { opcode: OPCODES.LEAVE, mnemonic: 'LEAVE', dest: noneOp, src: noneOp };
      case 'PUSHAD':
      case 'PUSHA':
        return { opcode: OPCODES.PUSHAD, mnemonic: 'PUSHAD', dest: noneOp, src: noneOp };
      case 'POPAD':
      case 'POPA':
        return { opcode: OPCODES.POPAD, mnemonic: 'POPAD', dest: noneOp, src: noneOp };
      case 'PUSHFD':
      case 'PUSHF':
        return { opcode: OPCODES.PUSHFD, mnemonic: 'PUSHFD', dest: noneOp, src: noneOp };
      case 'POPFD':
      case 'POPF':
        return { opcode: OPCODES.POPFD, mnemonic: 'POPFD', dest: noneOp, src: noneOp };
      case 'CBW':
        return { opcode: OPCODES.CBW, mnemonic: 'CBW', dest: noneOp, src: noneOp };
      case 'CWDE':
        return { opcode: OPCODES.CWDE, mnemonic: 'CWDE', dest: noneOp, src: noneOp };
      case 'CWD':
        return { opcode: OPCODES.CWD, mnemonic: 'CWD', dest: noneOp, src: noneOp };
      case 'CDQ':
        return { opcode: OPCODES.CDQ, mnemonic: 'CDQ', dest: noneOp, src: noneOp };
      case 'LAHF':
        return { opcode: OPCODES.LAHF, mnemonic: 'LAHF', dest: noneOp, src: noneOp };
      case 'SAHF':
        return { opcode: OPCODES.SAHF, mnemonic: 'SAHF', dest: noneOp, src: noneOp };
      case 'CLC':
        return { opcode: OPCODES.FLAG_OP, mnemonic: 'CLC', dest: { type: 'IMM', imm: 0, rawString: '0' }, src: noneOp };
      case 'STC':
        return { opcode: OPCODES.FLAG_OP, mnemonic: 'STC', dest: { type: 'IMM', imm: 1, rawString: '1' }, src: noneOp };
      case 'CMC':
        return { opcode: OPCODES.FLAG_OP, mnemonic: 'CMC', dest: { type: 'IMM', imm: 2, rawString: '2' }, src: noneOp };
      case 'CLD':
        return { opcode: OPCODES.FLAG_OP, mnemonic: 'CLD', dest: { type: 'IMM', imm: 3, rawString: '3' }, src: noneOp };
      case 'STD':
        return { opcode: OPCODES.FLAG_OP, mnemonic: 'STD', dest: { type: 'IMM', imm: 4, rawString: '4' }, src: noneOp };

      case 'MOVSB':
      case 'MOVSW':
      case 'MOVSD':
      case 'STOSB':
      case 'STOSW':
      case 'STOSD':
      case 'LODSB':
      case 'LODSW':
      case 'LODSD':
      case 'CMPSB':
      case 'CMPSW':
      case 'CMPSD':
      case 'SCASB':
      case 'SCASW':
      case 'SCASD':
        return {
          opcode: OPCODES.STRING_OP,
          mnemonic,
          dest: noneOp,
          src: noneOp,
          repPrefix,
        };
    }

    // 2. RET and ENTER
    if (mnemonic === 'RET') {
      if (args.length === 0) {
        return { opcode: OPCODES.RET, mnemonic: 'RET', dest: noneOp, src: noneOp };
      }
      const imm16 = this.parseImmediate(args[0], lineNum, labels) & 0xffff;
      return {
        opcode: OPCODES.RET_IMM,
        mnemonic: 'RET',
        dest: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        src: noneOp,
      };
    }

    if (mnemonic === 'ENTER') {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: ENTER requires 2 operands: ENTER frameSize, nestingLevel`);
      const frameSize = this.parseImmediate(args[0], lineNum, labels) & 0xffff;
      const level = this.parseImmediate(args[1], lineNum, labels) & 0xff;
      return {
        opcode: OPCODES.ENTER,
        mnemonic: 'ENTER',
        dest: { type: 'IMM', imm: frameSize, rawString: String(frameSize) },
        src: { type: 'IMM', imm: level, rawString: String(level) },
      };
    }

    // 3. MOVH, PRINT, INT, SYSCALL
    if (mnemonic === 'MOVH') {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: MOVH requires 2 operands`);
      const destOp = this.toRegOperand(this.parseRegister(args[0], lineNum));
      const imm = this.parseImmediate(args[1], lineNum, labels) & 0xffff;
      return {
        opcode: OPCODES.MOVH,
        mnemonic: 'MOVH',
        dest: destOp,
        src: { type: 'IMM', imm, rawString: String(imm) },
      };
    }

    if (mnemonic === 'PRINT') {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: PRINT requires 1 operand`);
      const op = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, false);
      return { opcode: OPCODES.PRINT, mnemonic: 'PRINT', dest: op, src: noneOp };
    }

    if (mnemonic === 'INT') {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: INT requires 1 operand`);
      const intNum = this.parseImmediate(args[0], lineNum, labels) & 0xff;
      return {
        opcode: OPCODES.SYSCALL,
        mnemonic: 'INT',
        dest: { type: 'IMM', imm: intNum, rawString: `0x${intNum.toString(16).toUpperCase()}` },
        src: noneOp,
      };
    }

    if (mnemonic === 'SYSCALL') {
      return {
        opcode: OPCODES.SYSCALL,
        mnemonic: 'INT',
        dest: { type: 'IMM', imm: 0x80, rawString: '0x80' },
        src: noneOp,
      };
    }

    // 4. Branches, Loops, and CALL
    const branchOpcodeMap: Partial<Record<Mnemonic, { op: number; norm: Mnemonic }>> = {
      JMP: { op: OPCODES.JMP, norm: 'JMP' },
      JE: { op: OPCODES.JE, norm: 'JE' },
      JZ: { op: OPCODES.JE, norm: 'JE' },
      JNE: { op: OPCODES.JNE, norm: 'JNE' },
      JNZ: { op: OPCODES.JNE, norm: 'JNE' },
      JL: { op: OPCODES.JL, norm: 'JL' },
      JNGE: { op: OPCODES.JL, norm: 'JL' },
      JLE: { op: OPCODES.JLE, norm: 'JLE' },
      JNG: { op: OPCODES.JLE, norm: 'JLE' },
      JG: { op: OPCODES.JG, norm: 'JG' },
      JNLE: { op: OPCODES.JG, norm: 'JG' },
      JGE: { op: OPCODES.JGE, norm: 'JGE' },
      JNL: { op: OPCODES.JGE, norm: 'JGE' },
      JB: { op: OPCODES.JB, norm: 'JB' },
      JC: { op: OPCODES.JB, norm: 'JB' },
      JNAE: { op: OPCODES.JB, norm: 'JB' },
      JBE: { op: OPCODES.JBE, norm: 'JBE' },
      JNA: { op: OPCODES.JBE, norm: 'JBE' },
      JA: { op: OPCODES.JA, norm: 'JA' },
      JNBE: { op: OPCODES.JA, norm: 'JA' },
      JAE: { op: OPCODES.JAE, norm: 'JAE' },
      JNC: { op: OPCODES.JAE, norm: 'JAE' },
      JNB: { op: OPCODES.JAE, norm: 'JAE' },
      JS: { op: OPCODES.JS, norm: 'JS' },
      JNS: { op: OPCODES.JNS, norm: 'JNS' },
      JO: { op: OPCODES.JO, norm: 'JO' },
      JNO: { op: OPCODES.JNO, norm: 'JNO' },
      LOOP: { op: OPCODES.LOOP, norm: 'LOOP' },
      LOOPE: { op: OPCODES.LOOPE, norm: 'LOOPE' },
      LOOPZ: { op: OPCODES.LOOPE, norm: 'LOOPE' },
      LOOPNE: { op: OPCODES.LOOPNE, norm: 'LOOPNE' },
      LOOPNZ: { op: OPCODES.LOOPNE, norm: 'LOOPNE' },
      JECXZ: { op: OPCODES.JECXZ, norm: 'JECXZ' },
      JCXZ: { op: OPCODES.JECXZ, norm: 'JECXZ' },
      CALL: { op: OPCODES.CALL, norm: 'CALL' },
    };

    if (mnemonic in branchOpcodeMap) {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: ${mnemonic} requires 1 target operand`);
      const info = branchOpcodeMap[mnemonic]!;
      const target = this.parseImmediate(args[0], lineNum, labels);
      return {
        opcode: info.op,
        mnemonic: info.norm,
        dest: { type: 'IMM', imm: target, rawString: `0x${(target >>> 0).toString(16).toUpperCase()}` },
        src: noneOp,
      };
    }

    // 5. Stack PUSH / POP
    if (mnemonic === 'PUSH') {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: PUSH requires 1 operand`);
      const dOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, false);
      return { opcode: OPCODES.PUSH, mnemonic: 'PUSH', dest: dOp, src: noneOp };
    }
    if (mnemonic === 'POP') {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: POP requires 1 operand`);
      const dOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, true);
      return { opcode: OPCODES.POP, mnemonic: 'POP', dest: dOp, src: noneOp };
    }

    // 6. Unary INC, DEC, NEG, NOT, BSWAP, SETcc
    if (mnemonic === 'INC' || mnemonic === 'DEC' || mnemonic === 'NEG' || mnemonic === 'NOT') {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: ${mnemonic} requires 1 operand`);
      const dOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, true);
      const op =
        mnemonic === 'INC'
          ? OPCODES.INC
          : mnemonic === 'DEC'
          ? OPCODES.DEC
          : mnemonic === 'NEG'
          ? OPCODES.NEG
          : OPCODES.NOT;
      return { opcode: op, mnemonic, dest: dOp, src: noneOp };
    }

    if (mnemonic === 'BSWAP') {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: BSWAP requires 1 register operand`);
      const dOp = this.toRegOperand(this.parseRegister(args[0], lineNum));
      return { opcode: OPCODES.BIT_OP, mnemonic: 'BSWAP', dest: dOp, src: noneOp };
    }

    if (mnemonic.startsWith('SET')) {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: ${mnemonic} requires 1 operand`);
      const dOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, true, true);
      return { opcode: OPCODES.SETCC, mnemonic, dest: dOp, src: noneOp };
    }

    // 7. LEA
    if (mnemonic === 'LEA') {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: LEA requires 2 operands: LEA reg, [mem]`);
      const destOp = this.toRegOperand(this.parseRegister(args[0], lineNum));
      const memOp = this.parseMemoryOperand(args[1], lineNum, labels, dataSymbols);
      return { opcode: OPCODES.LEA, mnemonic: 'LEA', dest: destOp, src: memOp };
    }

    // 8. XCHG, XADD, CMPXCHG
    if (mnemonic === 'XCHG' || mnemonic === 'XADD' || mnemonic === 'CMPXCHG') {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: ${mnemonic} requires 2 operands`);
      const dOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, true);
      const sOp = this.parseGeneralOperand(args[1], lineNum, labels, dataSymbols, false);
      const op =
        mnemonic === 'XCHG'
          ? OPCODES.XCHG
          : mnemonic === 'XADD'
          ? OPCODES.XADD
          : OPCODES.CMPXCHG;
      return { opcode: op, mnemonic, dest: dOp, src: sOp };
    }

    // 9. Shifts & Rotates: SHL, SAL, SHR, SAR, ROL, ROR
    if (
      mnemonic === 'SHL' ||
      mnemonic === 'SAL' ||
      mnemonic === 'SHR' ||
      mnemonic === 'SAR' ||
      mnemonic === 'ROL' ||
      mnemonic === 'ROR'
    ) {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: ${mnemonic} requires 2 operands`);
      const dOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, true);
      const sOp = this.parseGeneralOperand(args[1], lineNum, labels, dataSymbols, false);
      const op =
        mnemonic === 'SHL' || mnemonic === 'SAL'
          ? OPCODES.SHL
          : mnemonic === 'SHR'
          ? OPCODES.SHR
          : mnemonic === 'SAR'
          ? OPCODES.SAR
          : mnemonic === 'ROL'
          ? OPCODES.ROL
          : OPCODES.ROR;
      return { opcode: op, mnemonic: mnemonic === 'SAL' ? 'SHL' : mnemonic, dest: dOp, src: sOp };
    }

    // 10. Bit Manipulation: BT, BTS, BTR, BTC, BSF, BSR
    if (
      mnemonic === 'BT' ||
      mnemonic === 'BTS' ||
      mnemonic === 'BTR' ||
      mnemonic === 'BTC' ||
      mnemonic === 'BSF' ||
      mnemonic === 'BSR'
    ) {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: ${mnemonic} requires 2 operands`);
      const dOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, true);
      const sOp = this.parseGeneralOperand(args[1], lineNum, labels, dataSymbols, false);
      return { opcode: OPCODES.BIT_OP, mnemonic, dest: dOp, src: sOp };
    }

    // 11. Conditional Move: CMOVcc
    if (mnemonic.startsWith('CMOV')) {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: ${mnemonic} requires 2 operands`);
      const dOp = this.toRegOperand(this.parseRegister(args[0], lineNum));
      const sOp = this.parseGeneralOperand(args[1], lineNum, labels, dataSymbols, false);
      return { opcode: OPCODES.CMOVCC, mnemonic, dest: dOp, src: sOp };
    }

    // 12. MUL, IMUL, DIV, IDIV
    if (mnemonic === 'MUL' || mnemonic === 'IMUL') {
      if (args.length === 1) {
        const sOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, false);
        return {
          opcode: OPCODES.MUL,
          mnemonic,
          dest: { type: 'REG', reg: 0, rawString: 'EAX' },
          src: sOp,
        };
      }
      if (args.length === 2) {
        const dOp = this.toRegOperand(this.parseRegister(args[0], lineNum));
        const sOp = this.parseGeneralOperand(args[1], lineNum, labels, dataSymbols, false);
        return { opcode: OPCODES.MUL, mnemonic: 'IMUL', dest: dOp, src: sOp };
      }
      if (args.length === 3) {
        // 3-operand IMUL reg, reg/mem, imm
        const dOp = this.toRegOperand(this.parseRegister(args[0], lineNum));
        const sOp = this.parseGeneralOperand(args[1], lineNum, labels, dataSymbols, false);
        const imm2 = this.parseImmediate(args[2], lineNum, labels);
        return { opcode: OPCODES.MUL, mnemonic: 'IMUL', dest: dOp, src: sOp, imm2 };
      }
      throw new Error(`Line ${lineNum}: ${mnemonic} expects 1, 2, or 3 operands`);
    }

    if (mnemonic === 'DIV' || mnemonic === 'IDIV') {
      if (args.length !== 1) throw new Error(`Line ${lineNum}: ${mnemonic} requires 1 operand`);
      const sOp = this.parseGeneralOperand(args[0], lineNum, labels, dataSymbols, false);
      return {
        opcode: mnemonic === 'DIV' ? OPCODES.DIV : OPCODES.IDIV,
        mnemonic,
        dest: { type: 'REG', reg: 0, rawString: 'EAX' },
        src: sOp,
      };
    }

    // 13. MOV, MOVB, MOVW, MOVZX, MOVSX
    if (
      mnemonic === 'MOV' ||
      mnemonic === 'MOVB' ||
      mnemonic === 'MOVW' ||
      mnemonic === 'MOVZX' ||
      mnemonic === 'MOVSX'
    ) {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: ${mnemonic} requires 2 operands`);
      const [destStr, srcStr] = args;

      const destIsReg = this.isRegister(destStr);
      const srcIsReg = this.isRegister(srcStr);
      const destRegTok = destIsReg ? this.parseRegister(destStr, lineNum) : null;
      const srcRegTok = srcIsReg ? this.parseRegister(srcStr, lineNum) : null;

      if (mnemonic === 'MOVZX' || mnemonic === 'MOVSX') {
        if (!destRegTok) throw new Error(`Line ${lineNum}: ${mnemonic} destination must be a register`);
        const dOp = this.toRegOperand(destRegTok);
        const sOp = this.parseGeneralOperand(srcStr, lineNum, labels, dataSymbols, false, true);
        if (sOp.type === 'MEM' && !sOp.isByte && !sOp.isWord) {
          sOp.isByte = true;
          sOp.rawString = formatMemoryOperand(sOp);
        }
        return {
          opcode: mnemonic === 'MOVZX' ? OPCODES.MOVZX : OPCODES.MOVSX,
          mnemonic,
          dest: dOp,
          src: sOp,
        };
      }

      // Destination is Memory: MOV [mem], reg or MOV [mem], imm
      if (!destIsReg && this.isMemoryOperand(destStr, dataSymbols, true)) {
        const memOp = this.parseMemoryOperand(destStr, lineNum, labels, dataSymbols);
        if (mnemonic === 'MOVB') memOp.isByte = true;
        if (mnemonic === 'MOVW') memOp.isWord = true;

        if (srcRegTok) {
          const sOp = this.toRegOperand(srcRegTok);
          const isByte = Boolean(memOp.isByte || sOp.is8Bit);
          const isWord = Boolean(!isByte && (memOp.isWord || sOp.is16Bit));
          memOp.isByte = isByte;
          memOp.isWord = isWord;
          memOp.rawString = formatMemoryOperand(memOp);
          const op = isByte ? OPCODES.MOVB_MR : isWord ? OPCODES.MOVW_MR : OPCODES.MOV_MR;
          return { opcode: op, mnemonic: isByte ? 'MOVB' : 'MOV', dest: memOp, src: sOp };
        } else {
          // MOV [mem], imm
          const imm = this.parseImmediate(srcStr, lineNum, labels);
          memOp.rawString = formatMemoryOperand(memOp, true);
          return {
            opcode: OPCODES.MOV_MI,
            mnemonic: 'MOV',
            dest: memOp,
            src: { type: 'IMM', imm, rawString: String(imm) },
          };
        }
      }

      // Destination is Register
      if (!destRegTok) {
        throw new Error(`Line ${lineNum}: Invalid destination operand '${destStr}' for ${mnemonic}`);
      }
      const dOp = this.toRegOperand(destRegTok);

      // Source is Memory: MOV reg, [mem]
      if (this.isMemoryOperand(srcStr, dataSymbols, false, Boolean(dOp.is8Bit))) {
        const memOp = this.parseMemoryOperand(srcStr, lineNum, labels, dataSymbols);
        const isByte = Boolean(mnemonic === 'MOVB' || memOp.isByte || dOp.is8Bit);
        const isWord = Boolean(!isByte && (mnemonic === 'MOVW' || memOp.isWord || dOp.is16Bit));
        memOp.isByte = isByte;
        memOp.isWord = isWord;
        memOp.rawString = formatMemoryOperand(memOp);
        const op = isByte ? OPCODES.MOVB_RM : isWord ? OPCODES.MOVW_RM : OPCODES.MOV_RM;
        return { opcode: op, mnemonic: isByte ? 'MOVB' : 'MOV', dest: dOp, src: memOp };
      }

      // Source is Register: MOV reg, reg
      if (srcRegTok) {
        const sOp = this.toRegOperand(srcRegTok);
        return { opcode: OPCODES.MOV_RR, mnemonic: 'MOV', dest: dOp, src: sOp };
      }

      // Source is Immediate: MOV reg, imm
      const imm = this.parseImmediate(srcStr, lineNum, labels);
      return {
        opcode: OPCODES.MOV_RI,
        mnemonic: 'MOV',
        dest: dOp,
        src: { type: 'IMM', imm, rawString: String(imm) },
      };
    }

    // 14. Binary ALU & Comparison Operations: ADD, SUB, AND, OR, XOR, CMP, TEST, ADC, SBB
    if (
      mnemonic === 'ADD' ||
      mnemonic === 'SUB' ||
      mnemonic === 'AND' ||
      mnemonic === 'OR' ||
      mnemonic === 'XOR' ||
      mnemonic === 'CMP' ||
      mnemonic === 'TEST' ||
      mnemonic === 'ADC' ||
      mnemonic === 'SBB'
    ) {
      if (args.length !== 2) throw new Error(`Line ${lineNum}: ${mnemonic} requires 2 operands`);
      const [destStr, srcStr] = args;
      const destOp = this.parseGeneralOperand(destStr, lineNum, labels, dataSymbols, true);
      const srcOp = this.parseGeneralOperand(
        srcStr,
        lineNum,
        labels,
        dataSymbols,
        false,
        Boolean(destOp.is8Bit)
      );

      // If either operand is a memory reference, use ALU_MEM or standard opcodes
      if (destOp.type === 'MEM' || srcOp.type === 'MEM') {
        return { opcode: OPCODES.ALU_MEM, mnemonic, dest: destOp, src: srcOp };
      }

      const opPairs: Record<string, { rr: number; ri: number }> = {
        ADD: { rr: OPCODES.ADD_RR, ri: OPCODES.ADD_RI },
        SUB: { rr: OPCODES.SUB_RR, ri: OPCODES.SUB_RI },
        AND: { rr: OPCODES.AND_RR, ri: OPCODES.AND_RI },
        OR: { rr: OPCODES.OR_RR, ri: OPCODES.OR_RI },
        XOR: { rr: OPCODES.XOR_RR, ri: OPCODES.XOR_RI },
        CMP: { rr: OPCODES.CMP_RR, ri: OPCODES.CMP_RI },
        TEST: { rr: OPCODES.TEST_RR, ri: OPCODES.TEST_RI },
        ADC: { rr: OPCODES.ADC_RR, ri: OPCODES.ADC_RI },
        SBB: { rr: OPCODES.SBB_RR, ri: OPCODES.SBB_RI },
      };
      const pair = opPairs[mnemonic];
      const op = srcOp.type === 'REG' ? pair.rr : pair.ri;
      return { opcode: op, mnemonic, dest: destOp, src: srcOp };
    }

    throw new Error(`Line ${lineNum}: Unknown instruction '${mnemonic}'`);
  }
}
