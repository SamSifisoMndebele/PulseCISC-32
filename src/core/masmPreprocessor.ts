// PulseCISC-32 High-Level MASM Preprocessor & Directive Lowering Engine
// Supports: .MODEL FLAT, STDCALL, PROC/ENDP, LOCAL, USES, INVOKE, STRUCT/ENDS,
// MACRO/ENDM, .IF/.ELSEIF/.ELSE/.ENDIF, .WHILE/.ENDW, .REPEAT/.UNTIL, DUP, EQU/=,
// SIZEOF/LENGTHOF/TYPE/OFFSET, and Win32/Irvine32 compatibility helpers.

export interface PreprocessedLine {
  text: string;
  originLine: number; // 0-indexed line in original user source code
}

export interface StructFieldInfo {
  name: string;
  type: 'DB' | 'DW' | 'DD';
  offset: number;
  elemSize: number;
  count: number;
  defaultRaw: string;
}

export interface StructDef {
  name: string;
  fields: StructFieldInfo[];
  size: number;
}

export interface DataSymbolInfo {
  name: string;
  type: 'DB' | 'DW' | 'DD';
  elemSize: number;
  length: number;
  byteSize: number;
  structName?: string;
}

export interface MASMPreprocessResult {
  lines: PreprocessedLine[];
  dataSymbols: Map<string, DataSymbolInfo>;
  constants: Map<string, string>;
  structs: Map<string, StructDef>;
  entryLabel?: string;
  callingConvention: 'STDCALL' | 'C';
}

interface ProcLocalInfo {
  name: string;
  type: 'BYTE' | 'WORD' | 'DWORD';
  ebpOffset: number; // negative offset from EBP, e.g. -4
}

interface ProcParamInfo {
  name: string;
  type: 'BYTE' | 'WORD' | 'DWORD';
  ebpOffset: number; // positive offset from EBP, e.g. +8
}

interface ActiveProc {
  name: string;
  usesRegs: string[];
  params: ProcParamInfo[];
  locals: ProcLocalInfo[];
  localBytes: number;
  hasFrame: boolean;
  headerLineIndex: number;
  bodyLines: PreprocessedLine[];
}

interface ControlBlock {
  kind: 'IF' | 'WHILE' | 'REPEAT';
  id: number;
  elseLabel: string;
  endLabel: string;
  loopStartLabel: string;
  hasElse: boolean;
  elseIfCount: number;
}

interface MacroDef {
  name: string;
  params: string[];
  body: { text: string; offsetLine: number }[];
}

export class MASMPreprocessor {
  public static preprocess(source: string): MASMPreprocessResult {
    const rawLines = source.split(/\r?\n/);
    const constants = new Map<string, string>();
    const structs = new Map<string, StructDef>();
    const dataSymbols = new Map<string, DataSymbolInfo>();
    const macros = new Map<string, MacroDef>();
    let callingConvention: 'STDCALL' | 'C' = 'STDCALL';
    let entryLabel: string | undefined = undefined;

    // --- Pass 0: Expand Macros & Collect Constants and Struct Definitions ---
    const macroExpandedLines: PreprocessedLine[] = [];
    let currentMacro: MacroDef | null = null;
    let currentStruct: StructDef | null = null;
    let macroInvokeCounter = 1;

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i];
      const clean = this.stripComments(raw);
      if (!clean) {
        macroExpandedLines.push({ text: '', originLine: i });
        continue;
      }

      // Inside MACRO definition
      if (currentMacro) {
        if (/^ENDM\b/i.test(clean)) {
          macros.set(currentMacro.name.toLowerCase(), currentMacro);
          currentMacro = null;
        } else {
          currentMacro.body.push({ text: clean, offsetLine: i });
        }
        macroExpandedLines.push({ text: '', originLine: i });
        continue;
      }

      // Start of MACRO: Name MACRO [p1, p2...]
      const macroStart = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+MACRO\b(.*)$/i);
      if (macroStart) {
        const name = macroStart[1];
        const paramStr = macroStart[2].trim();
        const params = paramStr
          ? paramStr.split(',').map((p) => p.trim()).filter(Boolean)
          : [];
        currentMacro = { name, params, body: [] };
        macroExpandedLines.push({ text: '', originLine: i });
        continue;
      }

      // Inside STRUCT definition
      if (currentStruct) {
        const endStructMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+ENDS\b/i) || clean.match(/^ENDS\b/i);
        if (endStructMatch) {
          structs.set(currentStruct.name.toLowerCase(), currentStruct);
          // Register struct field offset constants: StructName.field
          for (const f of currentStruct.fields) {
            constants.set(`${currentStruct.name.toLowerCase()}.${f.name.toLowerCase()}`, String(f.offset));
          }
          currentStruct = null;
        } else {
          // Parse struct field: fieldName BYTE/WORD/DWORD/DB/DW/DD initVal
          const fieldMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+(DB|DW|DD|BYTE|SBYTE|WORD|SWORD|DWORD|SDWORD)\s+(.*)$/i);
          if (fieldMatch) {
            const fName = fieldMatch[1];
            const fTypeRaw = fieldMatch[2].toUpperCase();
            const fInit = fieldMatch[3].trim();
            const normType = this.normalizeDataType(fTypeRaw);
            const elemSize = normType === 'DB' ? 1 : normType === 'DW' ? 2 : 4;
            const count = this.countDataElements(normType, fInit);
            currentStruct.fields.push({
              name: fName,
              type: normType,
              offset: currentStruct.size,
              elemSize,
              count,
              defaultRaw: fInit === '?' ? '0' : fInit,
            });
            currentStruct.size += elemSize * count;
          }
        }
        macroExpandedLines.push({ text: '', originLine: i });
        continue;
      }

      // Start of STRUCT: Name STRUCT
      const structStart = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:STRUCT|STRUC)\b/i);
      if (structStart) {
        currentStruct = { name: structStart[1], fields: [], size: 0 };
        macroExpandedLines.push({ text: '', originLine: i });
        continue;
      }

      // Check for EQU or = constant definition: NAME EQU val or NAME = val
      const equMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:EQU|=)\s+(.+)$/i);
      if (equMatch) {
        const cName = equMatch[1].toLowerCase();
        const cVal = equMatch[2].trim();
        constants.set(cName, cVal);
        macroExpandedLines.push({ text: '', originLine: i });
        continue;
      }

      // Check if line invokes a user-defined MACRO
      const firstWordMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(.*))?$/);
      if (firstWordMatch) {
        const word = firstWordMatch[1].toLowerCase();
        if (macros.has(word)) {
          const mac = macros.get(word)!;
          const argStr = (firstWordMatch[2] ?? '').trim();
          const args = argStr ? this.splitCommaArgs(argStr) : [];
          const invokeId = macroInvokeCounter++;

          for (const bodyLine of mac.body) {
            let expanded = bodyLine.text;
            for (let pIdx = 0; pIdx < mac.params.length; pIdx++) {
              const pName = mac.params[pIdx];
              const argVal = args[pIdx] ?? '';
              const re = new RegExp(`\\b${pName}\\b`, 'gi');
              expanded = expanded.replace(re, argVal);
            }
            // Replace @@ local macro labels if any
            expanded = expanded.replace(/@@/g, `__mac_${invokeId}`);
            macroExpandedLines.push({ text: expanded, originLine: i });
          }
          continue;
        }
      }

      macroExpandedLines.push({ text: clean, originLine: i });
    }

    // --- Pass 1: Normalize Data Directives, Struct Instances, Control Flow, and PROC/INVOKE ---
    const outputLines: PreprocessedLine[] = [];
    const controlStack: ControlBlock[] = [];
    let controlCounter = 1;
    let activeProc: ActiveProc | null = null;
    const procParamCounts = new Map<string, { paramCount: number; isStdCall: boolean }>();

    // Pre-scan for PROC and PROTO declarations to know parameter counts for INVOKE
    for (const item of macroExpandedLines) {
      const line = item.text;
      if (!line) continue;
      const protoMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+PROTO\b(.*)$/i);
      if (protoMatch) {
        const pName = protoMatch[1].toLowerCase();
        const rest = protoMatch[2].trim();
        const params = rest ? rest.split(',').map((s) => s.trim()).filter(Boolean) : [];
        procParamCounts.set(pName, { paramCount: params.length, isStdCall: true });
      }
      const procMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+PROC\b(.*)$/i);
      if (procMatch) {
        const pName = procMatch[1].toLowerCase();
        const parsedHeader = this.parseProcHeader(procMatch[2] ?? '');
        procParamCounts.set(pName, {
          paramCount: parsedHeader.params.length,
          isStdCall: callingConvention === 'STDCALL',
        });
      }
    }

    const emitLine = (text: string, originLine: number) => {
      if (activeProc) {
        activeProc.bodyLines.push({ text, originLine });
      } else {
        outputLines.push({ text, originLine });
      }
    };

    for (let idx = 0; idx < macroExpandedLines.length; idx++) {
      const { text: rawClean, originLine } = macroExpandedLines[idx];
      if (!rawClean) continue;

      let line = rawClean.trim();

      // 1. Check module header directives
      if (/^\.(386|486|586|686|mmx|xmm)\b/i.test(line)) {
        continue;
      }
      const modelMatch = line.match(/^\.MODEL\s+FLAT(?:\s*,\s*(STDCALL|C|CDECL))?/i);
      if (modelMatch) {
        if (modelMatch[1] && /^C/i.test(modelMatch[1])) {
          callingConvention = 'C';
        } else {
          callingConvention = 'STDCALL';
        }
        continue;
      }
      if (/^(OPTION\b|\.STACK\b|INCLUDE\b|INCLUDELIB\b|.*[a-zA-Z0-9_]\s+PROTO\b)/i.test(line)) {
        continue;
      }
      if (/^(\.CODE|section\s+\.code)$/i.test(line)) {
        emitLine('.text', originLine);
        continue;
      }
      if (/^(\.DATA\??|\.CONST|section\s+\.data)$/i.test(line)) {
        emitLine('.data', originLine);
        continue;
      }

      // END [entryLabel]
      const endMatch = line.match(/^END(?:\s+([a-zA-Z_][a-zA-Z0-9_]*))?$/i);
      if (endMatch) {
        if (endMatch[1]) {
          entryLabel = endMatch[1].trim();
        }
        continue;
      }

      // 2. Check Struct Instance Allocation in .data: varName StructName <val1, val2>
      const structInstMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:?\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*<(.*)>$/);
      if (structInstMatch && structs.has(structInstMatch[2].toLowerCase())) {
        const varName = structInstMatch[1];
        const sDef = structs.get(structInstMatch[2].toLowerCase())!;
        const initInside = structInstMatch[3].trim();
        const initVals = initInside ? this.splitCommaArgs(initInside) : [];

        dataSymbols.set(varName.toLowerCase(), {
          name: varName,
          type: 'DB',
          elemSize: sDef.size,
          length: 1,
          byteSize: sDef.size,
          structName: sDef.name,
        });

        emitLine(`${varName}:`, originLine);
        for (let fIdx = 0; fIdx < sDef.fields.length; fIdx++) {
          const field = sDef.fields[fIdx];
          const valStr =
            initVals[fIdx] !== undefined && initVals[fIdx] !== '' && initVals[fIdx] !== '?'
              ? initVals[fIdx]
              : field.defaultRaw;
          // Also register varName.fieldName as direct label offset expression
          emitLine(`${varName}_${field.name}: ${field.type} ${valStr}`, originLine);
        }
        continue;
      }

      // 3. Check MASM Data Definition (with or without colon):
      // e.g. "val1 DWORD 15" or "arr DWORD 5 DUP(0)" or "msg BYTE 'Hi', 0"
      const masmDataMatch = line.match(
        /^(?:([a-zA-Z_][a-zA-Z0-9_]*)\s*:?\s+)?(DB|DW|DD|BYTE|SBYTE|WORD|SWORD|DWORD|SDWORD)\s+(.+)$/i
      );
      if (masmDataMatch) {
        const varName = masmDataMatch[1];
        const rawType = masmDataMatch[2].toUpperCase();
        // Make sure rawType isn't an instruction mnemonic and isn't "BYTE PTR"
        if (!/^PTR\b/i.test(masmDataMatch[3].trim())) {
          const normType = this.normalizeDataType(rawType);
          const expandedArgs = this.expandDupAndQuestion(masmDataMatch[3].trim(), constants);
          const elemSize = normType === 'DB' ? 1 : normType === 'DW' ? 2 : 4;
          const elemCount = this.countDataElements(normType, expandedArgs);

          if (varName) {
            dataSymbols.set(varName.toLowerCase(), {
              name: varName,
              type: normType,
              elemSize,
              length: elemCount,
              byteSize: elemSize * elemCount,
            });
            emitLine(`${varName}: ${normType} ${expandedArgs}`, originLine);
          } else {
            emitLine(`${normType} ${expandedArgs}`, originLine);
          }
          continue;
        }
      }

      // 4. PROC / ENDP / LOCAL
      const procStartMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+PROC\b(.*)$/i);
      if (procStartMatch) {
        const procName = procStartMatch[1];
        const headerRest = procStartMatch[2] ?? '';
        const parsed = this.parseProcHeader(headerRest);
        activeProc = {
          name: procName,
          usesRegs: parsed.usesRegs,
          params: parsed.params,
          locals: [],
          localBytes: 0,
          hasFrame: parsed.params.length > 0,
          headerLineIndex: originLine,
          bodyLines: [],
        };
        continue;
      }

      if (activeProc && /^LOCAL\b/i.test(line)) {
        const localSpec = line.replace(/^LOCAL\s+/i, '').trim();
        const decls = this.splitCommaArgs(localSpec);
        for (const decl of decls) {
          // e.g. temp:DWORD or buffer[16]:BYTE or x:WORD
          const m = decl.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\[(\d+)\])?(?:\s*:\s*(BYTE|SBYTE|WORD|SWORD|DWORD|SDWORD))?$/i);
          if (m) {
            const lName = m[1];
            const arrLen = m[2] ? parseInt(m[2], 10) : 1;
            const lTypeRaw = (m[3] ?? 'DWORD').toUpperCase();
            const lType: 'BYTE' | 'WORD' | 'DWORD' =
              lTypeRaw.includes('BYTE') ? 'BYTE' : lTypeRaw.includes('WORD') && !lTypeRaw.includes('DWORD') ? 'WORD' : 'DWORD';
            const unitSize = lType === 'BYTE' ? 1 : lType === 'WORD' ? 2 : 4;
            const rawBytes = Math.max(4, Math.ceil((unitSize * arrLen) / 4) * 4);
            activeProc.localBytes += rawBytes;
            activeProc.locals.push({
              name: lName,
              type: lType,
              ebpOffset: -activeProc.localBytes,
            });
            activeProc.hasFrame = true;
          }
        }
        continue;
      }

      const endpMatch = line.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)\s+)?ENDP\b/i);
      if (endpMatch && activeProc) {
        this.flushActiveProc(activeProc, outputLines, callingConvention);
        activeProc = null;
        continue;
      }

      // 5. Structured Control Flow: .IF, .ELSEIF, .ELSE, .ENDIF, .WHILE, .ENDW, .REPEAT, .UNTIL
      if (/^\.IF\b/i.test(line)) {
        const condStr = line.replace(/^\.IF\s+/i, '').trim();
        const id = controlCounter++;
        const block: ControlBlock = {
          kind: 'IF',
          id,
          elseLabel: `__if_else_${id}_0`,
          endLabel: `__if_end_${id}`,
          loopStartLabel: '',
          hasElse: false,
          elseIfCount: 0,
        };
        controlStack.push(block);
        const condLines = this.emitBranchIfFalse(condStr, block.elseLabel, originLine);
        for (const cl of condLines) emitLine(cl.text, cl.originLine);
        continue;
      }

      if (/^\.ELSEIF\b/i.test(line)) {
        const condStr = line.replace(/^\.ELSEIF\s+/i, '').trim();
        const top = controlStack[controlStack.length - 1];
        if (top && top.kind === 'IF') {
          emitLine(`JMP ${top.endLabel}`, originLine);
          emitLine(`${top.elseLabel}:`, originLine);
          top.elseIfCount++;
          top.elseLabel = `__if_else_${top.id}_${top.elseIfCount}`;
          const condLines = this.emitBranchIfFalse(condStr, top.elseLabel, originLine);
          for (const cl of condLines) emitLine(cl.text, cl.originLine);
        }
        continue;
      }

      if (/^\.ELSE\b/i.test(line)) {
        const top = controlStack[controlStack.length - 1];
        if (top && top.kind === 'IF') {
          emitLine(`JMP ${top.endLabel}`, originLine);
          emitLine(`${top.elseLabel}:`, originLine);
          top.hasElse = true;
        }
        continue;
      }

      if (/^\.ENDIF\b/i.test(line)) {
        const top = controlStack.pop();
        if (top && top.kind === 'IF') {
          if (!top.hasElse) {
            emitLine(`${top.elseLabel}:`, originLine);
          }
          emitLine(`${top.endLabel}:`, originLine);
        }
        continue;
      }

      if (/^\.WHILE\b/i.test(line)) {
        const condStr = line.replace(/^\.WHILE\s+/i, '').trim();
        const id = controlCounter++;
        const block: ControlBlock = {
          kind: 'WHILE',
          id,
          elseLabel: '',
          endLabel: `__while_end_${id}`,
          loopStartLabel: `__while_start_${id}`,
          hasElse: false,
          elseIfCount: 0,
        };
        controlStack.push(block);
        emitLine(`${block.loopStartLabel}:`, originLine);
        const condLines = this.emitBranchIfFalse(condStr, block.endLabel, originLine);
        for (const cl of condLines) emitLine(cl.text, cl.originLine);
        continue;
      }

      if (/^\.(ENDW|ENDWHILE)\b/i.test(line)) {
        const top = controlStack.pop();
        if (top && top.kind === 'WHILE') {
          emitLine(`JMP ${top.loopStartLabel}`, originLine);
          emitLine(`${top.endLabel}:`, originLine);
        }
        continue;
      }

      if (/^\.REPEAT\b/i.test(line)) {
        const id = controlCounter++;
        const block: ControlBlock = {
          kind: 'REPEAT',
          id,
          elseLabel: '',
          endLabel: `__repeat_end_${id}`,
          loopStartLabel: `__repeat_start_${id}`,
          hasElse: false,
          elseIfCount: 0,
        };
        controlStack.push(block);
        emitLine(`${block.loopStartLabel}:`, originLine);
        continue;
      }

      if (/^\.UNTIL\b/i.test(line)) {
        const condStr = line.replace(/^\.UNTIL\s+/i, '').trim();
        const top = controlStack.pop();
        if (top && top.kind === 'REPEAT') {
          const condLines = this.emitBranchIfFalse(condStr, top.loopStartLabel, originLine);
          for (const cl of condLines) emitLine(cl.text, cl.originLine);
          emitLine(`${top.endLabel}:`, originLine);
        }
        continue;
      }

      if (/^\.BREAK\b/i.test(line)) {
        for (let k = controlStack.length - 1; k >= 0; k--) {
          if (controlStack[k].kind === 'WHILE' || controlStack[k].kind === 'REPEAT') {
            emitLine(`JMP ${controlStack[k].endLabel}`, originLine);
            break;
          }
        }
        continue;
      }

      if (/^\.CONTINUE\b/i.test(line)) {
        for (let k = controlStack.length - 1; k >= 0; k--) {
          if (controlStack[k].kind === 'WHILE' || controlStack[k].kind === 'REPEAT') {
            emitLine(`JMP ${controlStack[k].loopStartLabel}`, originLine);
            break;
          }
        }
        continue;
      }

      // 6. INVOKE Directive: INVOKE procName [, arg1, arg2, ...]
      const invokeMatch = line.match(/^INVOKE\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*,\s*(.*))?$/i);
      if (invokeMatch) {
        const targetProc = invokeMatch[1].trim();
        const argsRaw = (invokeMatch[2] ?? '').trim();
        const args = argsRaw ? this.splitCommaArgs(argsRaw) : [];

        // Built-in Win32 ExitProcess support: INVOKE ExitProcess, exitCode
        if (targetProc.toLowerCase() === 'exitprocess') {
          const codeArg = args[0] ?? '0';
          emitLine(`MOV EBX, ${codeArg}`, originLine);
          emitLine(`MOV EAX, 1`, originLine);
          emitLine(`INT 0x80`, originLine);
          continue;
        }

        // Push arguments right-to-left (STDCALL / CDECL standard)
        for (let aIdx = args.length - 1; aIdx >= 0; aIdx--) {
          const arg = args[aIdx].trim();
          const addrMatch = arg.match(/^(?:ADDR|OFFSET)\s+(.+)$/i);
          if (addrMatch) {
            const sym = addrMatch[1].trim();
            // Check if sym is a LOCAL or param in activeProc
            const localOrParam = activeProc
              ? this.resolveProcSymbol(sym, activeProc)
              : null;
            if (localOrParam) {
              emitLine(`LEA EAX, ${localOrParam.bracketExpr}`, originLine);
              emitLine(`PUSH EAX`, originLine);
            } else {
              emitLine(`PUSH OFFSET ${sym}`, originLine);
            }
          } else {
            emitLine(`PUSH ${arg}`, originLine);
          }
        }

        emitLine(`CALL ${targetProc}`, originLine);

        const procInfo = procParamCounts.get(targetProc.toLowerCase());
        const isCDecl = callingConvention === 'C' || (procInfo && !procInfo.isStdCall);
        if (isCDecl && args.length > 0) {
          emitLine(`ADD ESP, ${args.length * 4}`, originLine);
        }
        continue;
      }

      // 7. Built-in Irvine32 "exit" macro
      if (/^exit$/i.test(line)) {
        emitLine(`MOV EBX, 0`, originLine);
        emitLine(`MOV EAX, 1`, originLine);
        emitLine(`INT 0x80`, originLine);
        continue;
      }

      // 8. Lower legacy PRINT pseudo-instruction to Irvine32 WriteString / WriteInt
      const printMatch = line.match(/^PRINT\s+(.+)$/i);
      if (printMatch) {
        const arg = printMatch[1].trim();
        if (dataSymbols.has(arg.toLowerCase())) {
          emitLine(`MOV EDX, OFFSET ${arg}`, originLine);
          emitLine(`CALL WriteString`, originLine);
          emitLine(`CALL Crlf`, originLine);
        } else if (/^EAX$/i.test(arg)) {
          emitLine(`CALL WriteInt`, originLine);
          emitLine(`CALL Crlf`, originLine);
        } else if (/^(EBX|ECX|EDX|ESI|EDI|EBP|ESP)$/i.test(arg)) {
          emitLine(`PUSH EAX`, originLine);
          emitLine(`MOV EAX, ${arg}`, originLine);
          emitLine(`CALL WriteInt`, originLine);
          emitLine(`CALL Crlf`, originLine);
          emitLine(`POP EAX`, originLine);
        } else {
          // Immediate or memory operand
          emitLine(`PUSH EAX`, originLine);
          emitLine(`MOV EAX, ${arg}`, originLine);
          emitLine(`CALL WriteInt`, originLine);
          emitLine(`CALL Crlf`, originLine);
          emitLine(`POP EAX`, originLine);
        }
        continue;
      }

      emitLine(line, originLine);
    }

    // If a PROC was left unclosed at EOF, flush it
    if (activeProc) {
      this.flushActiveProc(activeProc, outputLines, callingConvention);
      activeProc = null;
    }

    // --- Pass 2: Substitute Constants, SIZEOF/LENGTHOF/TYPE, and Struct Field Accesses ---
    const finalLines: PreprocessedLine[] = [];
    for (const item of outputLines) {
      const substituted = this.substituteExpressions(
        item.text,
        constants,
        dataSymbols,
        structs
      );
      finalLines.push({ text: substituted, originLine: item.originLine });
    }

    return {
      lines: finalLines,
      dataSymbols,
      constants,
      structs,
      entryLabel,
      callingConvention,
    };
  }

  private static parseProcHeader(headerRest: string): {
    usesRegs: string[];
    params: ProcParamInfo[];
  } {
    let rest = headerRest.trim();
    const usesRegs: string[] = [];

    // Strip visibility qualifiers
    rest = rest.replace(/^(PUBLIC|PRIVATE|NEAR|FAR|STDCALL|C)\s+/i, '').trim();

    // Check USES reg1 reg2 ... (delimited by comma or colon-param)
    if (/^USES\b/i.test(rest)) {
      rest = rest.replace(/^USES\s+/i, '').trim();
      const commaIdx = rest.indexOf(',');
      if (commaIdx !== -1) {
        const usesPart = rest.substring(0, commaIdx).trim();
        usesRegs.push(...usesPart.split(/\s+/).filter(Boolean));
        rest = rest.substring(commaIdx + 1).trim();
      } else {
        // Check where first param `name:TYPE` begins
        const tokens = rest.split(/\s+/);
        const paramTokens: string[] = [];
        let inParams = false;
        for (const tok of tokens) {
          if (tok.includes(':') || inParams) {
            inParams = true;
            paramTokens.push(tok);
          } else {
            usesRegs.push(tok);
          }
        }
        rest = paramTokens.join(' ');
      }
    }

    rest = rest.replace(/^,\s*/, '').trim();
    const params: ProcParamInfo[] = [];
    if (rest.length > 0) {
      const rawParams = this.splitCommaArgs(rest);
      let ebpOffset = 8; // [EBP + 8] is first argument (after return EIP at +4 and saved EBP at 0)
      for (const rp of rawParams) {
        const pm = rp.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:\s*(BYTE|SBYTE|WORD|SWORD|DWORD|SDWORD|PTR\s+\w+))?$/i);
        if (pm) {
          const pName = pm[1];
          const pTypeRaw = (pm[2] ?? 'DWORD').toUpperCase();
          const pType: 'BYTE' | 'WORD' | 'DWORD' =
            pTypeRaw.includes('BYTE') ? 'BYTE' : pTypeRaw.includes('WORD') && !pTypeRaw.includes('DWORD') ? 'WORD' : 'DWORD';
          params.push({
            name: pName,
            type: pType,
            ebpOffset,
          });
          ebpOffset += 4;
        }
      }
    }

    return { usesRegs, params };
  }

  private static resolveProcSymbol(
    sym: string,
    proc: ActiveProc
  ): { bracketExpr: string; qualifiedExpr: string } | null {
    const lower = sym.toLowerCase();
    for (const loc of proc.locals) {
      if (loc.name.toLowerCase() === lower) {
        const bracket = `[EBP - ${Math.abs(loc.ebpOffset)}]`;
        const sizePrefix = loc.type === 'BYTE' ? 'BYTE PTR ' : loc.type === 'WORD' ? 'WORD PTR ' : '';
        return { bracketExpr: bracket, qualifiedExpr: `${sizePrefix}${bracket}` };
      }
    }
    for (const par of proc.params) {
      if (par.name.toLowerCase() === lower) {
        const bracket = `[EBP + ${par.ebpOffset}]`;
        const sizePrefix = par.type === 'BYTE' ? 'BYTE PTR ' : par.type === 'WORD' ? 'WORD PTR ' : '';
        return { bracketExpr: bracket, qualifiedExpr: `${sizePrefix}${bracket}` };
      }
    }
    return null;
  }

  private static flushActiveProc(
    proc: ActiveProc,
    outputLines: PreprocessedLine[],
    callingConvention: 'STDCALL' | 'C'
  ): void {
    const needsFrame = proc.hasFrame || proc.locals.length > 0 || proc.params.length > 0;
    const paramBytes = proc.params.length * 4;

    // Emit procedure entry label
    outputLines.push({ text: `${proc.name}:`, originLine: proc.headerLineIndex });

    // Emit automatic prologue if PROC has parameters or LOCALs
    if (needsFrame) {
      outputLines.push({ text: 'PUSH EBP', originLine: proc.headerLineIndex });
      outputLines.push({ text: 'MOV EBP, ESP', originLine: proc.headerLineIndex });
      if (proc.localBytes > 0) {
        outputLines.push({ text: `SUB ESP, ${proc.localBytes}`, originLine: proc.headerLineIndex });
      }
    }
    for (const uReg of proc.usesRegs) {
      outputLines.push({ text: `PUSH ${uReg.toUpperCase()}`, originLine: proc.headerLineIndex });
    }

    // Process body lines: substitute parameter and LOCAL names, and expand `RET`
    for (const bLine of proc.bodyLines) {
      let text = bLine.text.trim();

      // Substitute local and param identifiers in operands
      if (proc.locals.length > 0 || proc.params.length > 0) {
        text = this.substituteProcSymbolsInLine(text, proc);
      }

      if (/^RET$/i.test(text)) {
        // Pop USES registers in reverse order
        for (let u = proc.usesRegs.length - 1; u >= 0; u--) {
          outputLines.push({ text: `POP ${proc.usesRegs[u].toUpperCase()}`, originLine: bLine.originLine });
        }
        if (needsFrame) {
          outputLines.push({ text: 'LEAVE', originLine: bLine.originLine });
        }
        if (callingConvention === 'STDCALL' && paramBytes > 0) {
          outputLines.push({ text: `RET ${paramBytes}`, originLine: bLine.originLine });
        } else {
          outputLines.push({ text: 'RET', originLine: bLine.originLine });
        }
      } else {
        outputLines.push({ text, originLine: bLine.originLine });
      }
    }
  }

  private static substituteProcSymbolsInLine(line: string, proc: ActiveProc): string {
    // Preserve leading label if any
    let labelPrefix = '';
    let rest = line;
    const labelMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*\s*:)\s*(.*)$/);
    if (labelMatch) {
      labelPrefix = labelMatch[1] + ' ';
      rest = labelMatch[2];
    }

    const firstSpace = rest.search(/\s/);
    if (firstSpace === -1) return line;

    const mnemonic = rest.substring(0, firstSpace);
    const argsStr = rest.substring(firstSpace + 1);
    const args = this.splitCommaArgs(argsStr);

    const replacedArgs = args.map((arg) => {
      const trimmed = arg.trim();
      // Direct match with a local or param name
      const direct = this.resolveProcSymbol(trimmed, proc);
      if (direct) return direct.qualifiedExpr;

      // Match inside indexed expression like buffer[esi] or [temp]
      let modified = trimmed;
      for (const loc of proc.locals) {
        const re = new RegExp(`\\b${loc.name}\\b`, 'gi');
        if (re.test(modified)) {
          if (modified.includes('[')) {
            modified = modified.replace(re, `EBP - ${Math.abs(loc.ebpOffset)}`);
          } else {
            modified = modified.replace(re, `[EBP - ${Math.abs(loc.ebpOffset)}]`);
          }
        }
      }
      for (const par of proc.params) {
        const re = new RegExp(`\\b${par.name}\\b`, 'gi');
        if (re.test(modified)) {
          if (modified.includes('[')) {
            modified = modified.replace(re, `EBP + ${par.ebpOffset}`);
          } else {
            modified = modified.replace(re, `[EBP + ${par.ebpOffset}]`);
          }
        }
      }
      return modified;
    });

    return `${labelPrefix}${mnemonic} ${replacedArgs.join(', ')}`;
  }

  /**
   * Emits CMP / TEST + conditional jump that branches to `falseTarget` when `condition` is FALSE.
   */
  private static emitBranchIfFalse(
    condStr: string,
    falseTarget: string,
    originLine: number
  ): PreprocessedLine[] {
    const out: PreprocessedLine[] = [];
    const c = condStr.trim().replace(/^\((.*)\)$/, '$1').trim();

    // Flag conditions: ZERO?, !ZERO?, CARRY?, !CARRY?, SIGN?, !SIGN?, OVERFLOW?, !OVERFLOW?
    if (/^!?ZERO\?$/i.test(c)) {
      const neg = c.startsWith('!');
      out.push({ text: `${neg ? 'JE' : 'JNE'} ${falseTarget}`, originLine });
      return out;
    }
    if (/^!?CARRY\?$/i.test(c)) {
      const neg = c.startsWith('!');
      out.push({ text: `${neg ? 'JB' : 'JAE'} ${falseTarget}`, originLine });
      return out;
    }
    if (/^!?SIGN\?$/i.test(c)) {
      const neg = c.startsWith('!');
      out.push({ text: `${neg ? 'JS' : 'JNS'} ${falseTarget}`, originLine });
      return out;
    }

    // Relational comparison: lhs OP rhs (==, !=, >=, <=, >, <)
    const relMatch = c.match(/^(.+?)\s*(==|!=|<>|>=|<=|>|<)\s*(.+)$/);
    if (relMatch) {
      const lhs = relMatch[1].trim();
      const op = relMatch[2].trim();
      const rhs = relMatch[3].trim();

      out.push({ text: `CMP ${lhs}, ${rhs}`, originLine });
      // Branch on the INVERSE condition to `falseTarget`
      let jcc = 'JNE';
      switch (op) {
        case '==': jcc = 'JNE'; break;
        case '!=':
        case '<>': jcc = 'JE'; break;
        case '>':  jcc = 'JLE'; break;
        case '>=': jcc = 'JL'; break;
        case '<':  jcc = 'JGE'; break;
        case '<=': jcc = 'JG'; break;
      }
      out.push({ text: `${jcc} ${falseTarget}`, originLine });
      return out;
    }

    // Single register/expression truthiness: e.g. `.IF eax` -> `CMP eax, 0` + `JE falseTarget`
    out.push({ text: `CMP ${c}, 0`, originLine });
    out.push({ text: `JE ${falseTarget}`, originLine });
    return out;
  }

  private static substituteExpressions(
    line: string,
    constants: Map<string, string>,
    dataSymbols: Map<string, DataSymbolInfo>,
    structs: Map<string, StructDef>
  ): string {
    let result = line;

    // 1. SIZEOF, LENGTHOF, TYPE operators
    result = result.replace(/\b(SIZEOF|LENGTHOF|TYPE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi, (_full, opRaw, symRaw) => {
      const op = opRaw.toUpperCase();
      const sym = symRaw.toLowerCase();
      if (dataSymbols.has(sym)) {
        const info = dataSymbols.get(sym)!;
        if (op === 'SIZEOF') return String(info.byteSize);
        if (op === 'LENGTHOF') return String(info.length);
        if (op === 'TYPE') return String(info.elemSize);
      }
      if (structs.has(sym)) {
        const sDef = structs.get(sym)!;
        if (op === 'SIZEOF' || op === 'TYPE') return String(sDef.size);
        if (op === 'LENGTHOF') return '1';
      }
      if (sym === 'byte' || sym === 'sbyte') return '1';
      if (sym === 'word' || sym === 'sword') return '2';
      if (sym === 'dword' || sym === 'sdword') return '4';
      return '4';
    });

    // 2. Struct field access: StructName.field or instanceName.field
    result = result.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (full, left, right) => {
      const leftLower = left.toLowerCase();
      const rightLower = right.toLowerCase();
      const key = `${leftLower}.${rightLower}`;
      if (constants.has(key)) {
        return constants.get(key)!;
      }
      // Check if `left` is a struct instance in dataSymbols
      const symInfo = dataSymbols.get(leftLower);
      if (symInfo && symInfo.structName) {
        const sDef = structs.get(symInfo.structName.toLowerCase());
        const field = sDef?.fields.find((f) => f.name.toLowerCase() === rightLower);
        if (field) {
          return `${left}_${field.name}`;
        }
      }
      return full;
    });

    // 3. Substitute symbolic constants (EQU / =) outside string literals
    if (constants.size > 0 && !/^(DB|DW|DD)\b/i.test(result)) {
      for (const [k, v] of constants.entries()) {
        if (!k.includes('.')) {
          const re = new RegExp(`\\b${k}\\b`, 'gi');
          result = result.replace(re, v);
        }
      }
    }

    return result;
  }

  private static normalizeDataType(rawType: string): 'DB' | 'DW' | 'DD' {
    const u = rawType.toUpperCase();
    if (u === 'DB' || u === 'BYTE' || u === 'SBYTE') return 'DB';
    if (u === 'DW' || u === 'WORD' || u === 'SWORD') return 'DW';
    return 'DD';
  }

  private static expandDupAndQuestion(argsStr: string, constants: Map<string, string>): string {
    let s = argsStr;
    for (const [k, v] of constants.entries()) {
      if (!k.includes('.')) {
        s = s.replace(new RegExp(`\\b${k}\\b`, 'gi'), v);
      }
    }

    // Expand `count DUP(val)` -> `val, val, ...`
    s = s.replace(/(\d+)\s+DUP\s*\(([^)]+)\)/gi, (_full, countStr, innerVal) => {
      const count = Math.min(1024, Math.max(1, parseInt(countStr, 10)));
      const cleanVal = innerVal.trim() === '?' ? '0' : innerVal.trim();
      return Array(count).fill(cleanVal).join(', ');
    });

    // Replace standalone `?` tokens with `0`
    const parts = this.splitCommaArgs(s).map((p) => (p.trim() === '?' ? '0' : p.trim()));
    return parts.join(', ');
  }

  private static countDataElements(_type: 'DB' | 'DW' | 'DD', expandedArgs: string): number {
    const tokens = this.splitCommaArgs(expandedArgs);
    let count = 0;
    for (const tok of tokens) {
      const t = tok.trim();
      if (!t) continue;
      if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        count += Math.max(1, t.length - 2);
      } else {
        count += 1;
      }
    }
    return Math.max(1, count);
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

  private static splitCommaArgs(argsStr: string): string[] {
    const args: string[] = [];
    if (!argsStr) return args;

    let current = '';
    let bracketDepth = 0;
    let parenDepth = 0;
    let inDouble = false;
    let inSingle = false;

    for (let i = 0; i < argsStr.length; i++) {
      const ch = argsStr[i];
      if (ch === '"' && !inSingle && (i === 0 || argsStr[i - 1] !== '\\')) inDouble = !inDouble;
      else if (ch === "'" && !inDouble && (i === 0 || argsStr[i - 1] !== '\\')) inSingle = !inSingle;
      else if (!inDouble && !inSingle) {
        if (ch === '[') bracketDepth++;
        else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        else if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (ch === ',' && bracketDepth === 0 && parenDepth === 0) {
          args.push(current.trim());
          current = '';
          continue;
        }
      }
      current += ch;
    }
    if (current.trim().length > 0) {
      args.push(current.trim());
    }
    return args;
  }
}
