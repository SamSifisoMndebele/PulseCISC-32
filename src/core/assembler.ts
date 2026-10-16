// PulseCISC-32 Two-Pass CISC Assembler
import type { AssembledProgram, AssemblyError, RegisterId } from './types';
import { OPCODES, REGISTER_LOOKUP } from './isa';
import type { ParsedRegisterToken } from './isa';
import { CODE_END, DATA_START, DATA_END } from './memory';

interface DataDirective {
  type: 'DB' | 'DW' | 'DD';
  argsStr: string;
}

interface ParsedLine {
  lineIndex: number;
  original: string;
  clean: string;
  labels: string[];
  isDataDirective?: boolean;
  dataDirective?: DataDirective;
  instruction: {
    mnemonic: string;
    args: string[];
  } | null;
}

interface ParsedMemoryOperand {
  baseReg: RegisterId;
  offset: number;
  isDirect: boolean;
}

export class Assembler {
  /**
   * Assembles strict 2-operand x86 assembly source code into machine code bytes and data bytes.
   */
  public static assemble(source: string): AssembledProgram {
    const rawLines = source.split(/\r?\n/);
    const parsedLines: ParsedLine[] = [];
    const labels = new Map<string, number>();
    const lineAddresses = new Map<number, number>();
    const addressToLine = new Map<number, number>();
    const errors: AssemblyError[] = [];
    const warnings: string[] = [];

    // Preprocessing & Pass 1: Extract labels and assign instruction / data addresses
    let currentCodeAddress = 0x0000;
    let currentDataAddress = DATA_START; // 0x0800
    const pendingLabels: { name: string; lineIndex: number }[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      let clean = this.stripComments(line);
      const extractedLabels: string[] = [];

      // Extract leading labels ending with colon (e.g. "loop:", "msg:")
      let matchLabel: RegExpExecArray | null;
      while ((matchLabel = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:(.*)$/.exec(clean)) !== null) {
        const labelName = matchLabel[1].trim();
        clean = matchLabel[2].trim();

        if (labelName.length > 0) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(labelName)) {
            errors.push({
              line: i + 1,
              message: `Invalid label identifier: "${labelName}"`,
            });
          } else if (
            labels.has(labelName.toLowerCase()) ||
            pendingLabels.some((p) => p.name.toLowerCase() === labelName.toLowerCase())
          ) {
            errors.push({
              line: i + 1,
              message: `Duplicate label definition: "${labelName}"`,
            });
          } else {
            pendingLabels.push({ name: labelName, lineIndex: i });
            extractedLabels.push(labelName);
          }
        }
      }

      // Skip section headers like "section .data", ".data", "section .text", ".text"
      if (/^(section\s+\.(data|text)|\.(data|text))$/i.test(clean)) {
        parsedLines.push({
          lineIndex: i,
          original: line,
          clean,
          labels: extractedLabels,
          instruction: null,
        });
        continue;
      }

      // Check if line is empty after labels and comments
      if (clean.length === 0) {
        parsedLines.push({
          lineIndex: i,
          original: line,
          clean,
          labels: extractedLabels,
          instruction: null,
        });
        continue;
      }

      // Check for Data Directives (DB, DW, DD, BYTE, WORD)
      const dataMatch = clean.match(/^(DB|DW|DD|BYTE|WORD)\s*(.*)$/i);
      if (dataMatch) {
        let dirType = dataMatch[1].toUpperCase() as 'DB' | 'DW' | 'DD';
        if (dirType === ('BYTE' as string)) dirType = 'DB';
        if (dirType === ('WORD' as string)) dirType = 'DW';
        const argsStr = dataMatch[2].trim();

        // Assign all pending labels to this data address
        for (const p of pendingLabels) {
          labels.set(p.name.toLowerCase(), currentDataAddress);
        }
        pendingLabels.length = 0;

        lineAddresses.set(i, currentDataAddress);
        addressToLine.set(currentDataAddress, i);

        // Calculate byte count for this directive
        const byteCount = this.calculateDirectiveByteCount(dirType, argsStr, i + 1);
        currentDataAddress += byteCount;

        parsedLines.push({
          lineIndex: i,
          original: line,
          clean,
          labels: extractedLabels,
          isDataDirective: true,
          dataDirective: { type: dirType, argsStr },
          instruction: null,
        });
        continue;
      }

      // Line is an executable instruction: assign all pending labels to current code address
      for (const p of pendingLabels) {
        labels.set(p.name.toLowerCase(), currentCodeAddress);
      }
      pendingLabels.length = 0;

      // Split mnemonic and args
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

      const instruction = { mnemonic, args };
      lineAddresses.set(i, currentCodeAddress);
      addressToLine.set(currentCodeAddress, i);

      // Fixed 4-byte instruction size
      currentCodeAddress += 4;

      parsedLines.push({
        lineIndex: i,
        original: line,
        clean,
        labels: extractedLabels,
        instruction,
      });
    }

    // Assign any trailing pending labels to current code address
    for (const p of pendingLabels) {
      labels.set(p.name.toLowerCase(), currentCodeAddress);
    }
    pendingLabels.length = 0;

    if (currentCodeAddress > CODE_END + 1) {
      errors.push({
        line: 1,
        message: `Program code size (${currentCodeAddress} bytes) exceeds Code Segment capacity (2048 bytes).`,
      });
    }

    if (currentDataAddress > DATA_END + 1) {
      errors.push({
        line: 1,
        message: `Program data size (${currentDataAddress - DATA_START} bytes) exceeds Data Segment capacity (2048 bytes).`,
      });
    }

    // Pass 2: Encode instructions into machine code and data into dataBytes
    const codeBytes = new Uint8Array(2048);
    const dataBytes = new Uint8Array(2048);
    let codePointer = 0;
    let dataPointer = 0;

    for (const parsed of parsedLines) {
      const lineNum = parsed.lineIndex + 1;

      // Handle Data Directive in Pass 2
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

      // Handle Instruction in Pass 2
      if (parsed.instruction) {
        const { mnemonic, args } = parsed.instruction;
        const pc = codePointer;

        try {
          const encodedWord = this.encodeInstruction(
            mnemonic,
            args,
            pc,
            labels,
            lineNum
          );
          // Write Little-Endian 32-bit word
          codeBytes[codePointer] = encodedWord & 0xff;
          codeBytes[codePointer + 1] = (encodedWord >>> 8) & 0xff;
          codeBytes[codePointer + 2] = (encodedWord >>> 16) & 0xff;
          codeBytes[codePointer + 3] = (encodedWord >>> 24) & 0xff;
          codePointer += 4;
        } catch (err: unknown) {
          errors.push({
            line: lineNum,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return {
      codeBytes: codeBytes.subarray(0, codePointer),
      dataBytes: dataBytes.subarray(0, dataPointer),
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
    let insideBracket = false;
    let inDouble = false;
    let inSingle = false;

    for (let c = 0; c < argsStr.length; c++) {
      const ch = argsStr[c];
      if (ch === '"' && !inSingle && (c === 0 || argsStr[c - 1] !== '\\')) inDouble = !inDouble;
      if (ch === "'" && !inDouble && (c === 0 || argsStr[c - 1] !== '\\')) inSingle = !inSingle;
      if (ch === '[' && !inDouble && !inSingle) insideBracket = true;
      if (ch === ']' && !inDouble && !inSingle) insideBracket = false;

      if (ch === ',' && !insideBracket && !inDouble && !inSingle) {
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

      // String literal in double or single quotes
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
        // Numeric value, character literal, or label
        let val = 0;
        try {
          val = this.parseImmediate(trimmed, lineNum, labels);
        } catch (e) {
          if (!labels) {
            // In Pass 1, unknown label can be assumed 0 for size calculation
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

  private static parseRegister(regStr: string, lineNum: number): ParsedRegisterToken {
    const clean = regStr.trim().toLowerCase();
    if (clean in REGISTER_LOOKUP) {
      return REGISTER_LOOKUP[clean];
    }
    throw new Error(`Line ${lineNum}: Unknown register '${regStr}' (expected EAX-ESP or AX-SP)`);
  }

  private static parseImmediate(immStr: string, lineNum: number, labels?: Map<string, number>): number {
    const clean = immStr.trim();
    if (labels && labels.has(clean.toLowerCase())) {
      return labels.get(clean.toLowerCase())!;
    }

    // Single character literal, e.g. 'A' or '\n'
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
    // Hex ending in 'h' or 'H' (e.g. 80h, 0ffh)
    if (/^[0-9][0-9a-fA-F]*h$/i.test(clean)) {
      val = parseInt(clean.substring(0, clean.length - 1), 16);
    } else if (clean.startsWith('0x') || clean.startsWith('0X')) {
      val = parseInt(clean, 16);
    } else if (clean.startsWith('0b') || clean.startsWith('0B')) {
      val = parseInt(clean.substring(2), 2);
    } else {
      val = parseInt(clean, 10);
    }

    if (isNaN(val)) {
      throw new Error(`Line ${lineNum}: Invalid number/label '${immStr}'`);
    }
    return val;
  }

  private static isMemoryOperand(str: string): boolean {
    const s = str.trim();
    return s.startsWith('[') && s.endsWith(']');
  }

  private static parseMemoryOperand(
    memStr: string,
    lineNum: number,
    labels?: Map<string, number>
  ): ParsedMemoryOperand {
    const s = memStr.trim();
    if (!s.startsWith('[') || !s.endsWith(']')) {
      throw new Error(
        `Line ${lineNum}: Expected memory operand enclosed in brackets like '[EBX]' or '[EBX + 4]'`
      );
    }
    const inner = s.substring(1, s.length - 1).trim();

    // Direct address or label, e.g. [0x0800] or [msg]
    if (labels && labels.has(inner.toLowerCase())) {
      const addr = labels.get(inner.toLowerCase())!;
      return { baseReg: 0, offset: addr, isDirect: true };
    }
    if (/^(0x[0-9a-fA-F]+|[0-9]+[hH]?|[0-9]+)$/.test(inner)) {
      const addr = this.parseImmediate(inner, lineNum, labels);
      return { baseReg: 0, offset: addr, isDirect: true };
    }

    // [reg + offset] or [reg - offset] or [label + offset]
    const match = inner.match(/^([a-zA-Z0-9_]+)\s*([\+\-])\s*(.+)$/);
    if (match) {
      const baseStr = match[1];
      const sign = match[2] === '-' ? -1 : 1;
      const offsetVal = this.parseImmediate(match[3], lineNum, labels);

      if (labels && labels.has(baseStr.toLowerCase())) {
        const baseAddr = labels.get(baseStr.toLowerCase())!;
        return { baseReg: 0, offset: baseAddr + sign * offsetVal, isDirect: true };
      }

      const regToken = this.parseRegister(baseStr, lineNum);
      return { baseReg: regToken.id, offset: sign * offsetVal, isDirect: false };
    }

    // Simple [reg]
    const regToken = this.parseRegister(inner, lineNum);
    return { baseReg: regToken.id, offset: 0, isDirect: false };
  }

  private static encodeInstruction(
    mnemonic: string,
    args: string[],
    _pc: number,
    labels: Map<string, number>,
    lineNum: number
  ): number {
    switch (mnemonic) {
      case 'HLT':
      case 'HALT':
        return ((OPCODES.HLT & 0x3f) << 26) >>> 0;

      case 'MOVH': {
        if (args.length !== 2) throw new Error(`Line ${lineNum}: MOVH requires 2 operands: MOVH reg, imm`);
        const destReg = this.parseRegister(args[0], lineNum);
        const imm = this.parseImmediate(args[1], lineNum, labels);
        return this.pack(OPCODES.MOVH, destReg.id, 0, false, false, imm);
      }

      case 'PRINT': {
        if (args.length !== 1) throw new Error(`Line ${lineNum}: PRINT requires 1 operand: PRINT reg or PRINT imm`);
        const argStr = args[0].trim();
        try {
          const reg = this.parseRegister(argStr, lineNum);
          return this.pack(OPCODES.PRINT, reg.id, 0, reg.is16Bit, false, 0);
        } catch {
          const imm = this.parseImmediate(argStr, lineNum, labels);
          return this.pack(OPCODES.PRINT, 0, 0, false, true, imm);
        }
      }

      case 'INT': {
        if (args.length !== 1) throw new Error(`Line ${lineNum}: INT requires 1 operand (e.g. INT 0x80)`);
        const intNum = this.parseImmediate(args[0], lineNum, labels);
        return this.pack(OPCODES.SYSCALL, 0, 0, false, false, intNum & 0xff);
      }

      case 'SYSCALL': {
        return this.pack(OPCODES.SYSCALL, 0, 0, false, false, 0x80);
      }

      case 'JMP': {
        if (args.length !== 1) throw new Error(`Line ${lineNum}: JMP requires 1 target: JMP label/address`);
        const target = this.parseImmediate(args[0], lineNum, labels);
        const wordAddr = (target >>> 2) & 0x03ffffff;
        return (((OPCODES.JMP & 0x3f) << 26) | wordAddr) >>> 0;
      }

      case 'JE': {
        if (args.length !== 1) throw new Error(`Line ${lineNum}: JE requires 1 target: JE label/address`);
        const target = this.parseImmediate(args[0], lineNum, labels);
        const wordAddr = (target >>> 2) & 0x03ffffff;
        return (((OPCODES.JE & 0x3f) << 26) | wordAddr) >>> 0;
      }

      case 'JNE': {
        if (args.length !== 1) throw new Error(`Line ${lineNum}: JNE requires 1 target: JNE label/address`);
        const target = this.parseImmediate(args[0], lineNum, labels);
        const wordAddr = (target >>> 2) & 0x03ffffff;
        return (((OPCODES.JNE & 0x3f) << 26) | wordAddr) >>> 0;
      }

      case 'MOV': {
        if (args.length !== 2) throw new Error(`Line ${lineNum}: MOV requires 2 operands: MOV dest, src`);
        const [destStr, srcStr] = args;

        // Case 1: MOV [mem], reg (Store)
        if (this.isMemoryOperand(destStr)) {
          const mem = this.parseMemoryOperand(destStr, lineNum, labels);
          const srcReg = this.parseRegister(srcStr, lineNum);
          return this.pack(
            OPCODES.MOV_MR,
            mem.baseReg,
            srcReg.id,
            false,
            srcReg.is16Bit,
            mem.offset
          );
        }

        // Case 2: Dest is a Register
        const destReg = this.parseRegister(destStr, lineNum);

        // Subcase 2a: MOV reg, [mem] (Load)
        if (this.isMemoryOperand(srcStr)) {
          const mem = this.parseMemoryOperand(srcStr, lineNum, labels);
          return this.pack(
            OPCODES.MOV_RM,
            destReg.id,
            mem.baseReg,
            destReg.is16Bit,
            false,
            mem.offset
          );
        }

        // Subcase 2b: MOV reg, reg
        try {
          const srcReg = this.parseRegister(srcStr, lineNum);
          return this.pack(
            OPCODES.MOV_RR,
            destReg.id,
            srcReg.id,
            destReg.is16Bit,
            srcReg.is16Bit,
            0
          );
        } catch {
          // Subcase 2c: MOV reg, imm
          const imm = this.parseImmediate(srcStr, lineNum, labels);
          return this.pack(
            OPCODES.MOV_RI,
            destReg.id,
            0,
            destReg.is16Bit,
            false,
            imm
          );
        }
      }

      case 'ADD':
      case 'SUB':
      case 'AND':
      case 'OR':
      case 'XOR':
      case 'CMP': {
        if (args.length !== 2) throw new Error(`Line ${lineNum}: ${mnemonic} requires 2 operands: ${mnemonic} dest, src`);
        const [destStr, srcStr] = args;
        const destReg = this.parseRegister(destStr, lineNum);

        let opcodeRR: number = OPCODES.ADD_RR;
        let opcodeRI: number = OPCODES.ADD_RI;

        if (mnemonic === 'SUB') {
          opcodeRR = OPCODES.SUB_RR;
          opcodeRI = OPCODES.SUB_RI;
        } else if (mnemonic === 'AND') {
          opcodeRR = OPCODES.AND_RR;
          opcodeRI = OPCODES.AND_RI;
        } else if (mnemonic === 'OR') {
          opcodeRR = OPCODES.OR_RR;
          opcodeRI = OPCODES.OR_RI;
        } else if (mnemonic === 'XOR') {
          opcodeRR = OPCODES.XOR_RR;
          opcodeRI = OPCODES.XOR_RI;
        } else if (mnemonic === 'CMP') {
          opcodeRR = OPCODES.CMP_RR;
          opcodeRI = OPCODES.CMP_RI;
        }

        // Check if src is reg or imm
        try {
          const srcReg = this.parseRegister(srcStr, lineNum);
          return this.pack(
            opcodeRR,
            destReg.id,
            srcReg.id,
            destReg.is16Bit,
            srcReg.is16Bit,
            0
          );
        } catch {
          const imm = this.parseImmediate(srcStr, lineNum, labels);
          return this.pack(
            opcodeRI,
            destReg.id,
            0,
            destReg.is16Bit,
            false,
            imm
          );
        }
      }

      default:
        throw new Error(`Line ${lineNum}: Unknown instruction '${mnemonic}'`);
    }
  }

  private static pack(
    opcode: number,
    destReg: number,
    srcReg: number,
    destIs16: boolean,
    srcIs16: boolean,
    imm16: number
  ): number {
    const immClamped = imm16 & 0xffff;
    return (
      (((opcode & 0x3f) << 26) |
        ((destReg & 0x07) << 23) |
        ((srcReg & 0x07) << 20) |
        ((destIs16 ? 1 : 0) << 19) |
        ((srcIs16 ? 1 : 0) << 18) |
        immClamped) >>>
      0
    );
  }
}
