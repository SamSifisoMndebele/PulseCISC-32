// PulseCISC-32 Two-Pass CISC Assembler
import type { AssembledProgram, AssemblyError, RegisterId } from './types';
import { OPCODES, REGISTER_LOOKUP } from './isa';
import type { ParsedRegisterToken } from './isa';

interface ParsedLine {
  lineIndex: number;
  original: string;
  clean: string;
  labels: string[];
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
   * Assembles strict 2-operand x86 assembly source code into machine code bytes.
   */
  public static assemble(source: string): AssembledProgram {
    const rawLines = source.split(/\r?\n/);
    const parsedLines: ParsedLine[] = [];
    const labels = new Map<string, number>();
    const lineAddresses = new Map<number, number>();
    const addressToLine = new Map<number, number>();
    const errors: AssemblyError[] = [];
    const warnings: string[] = [];

    // Preprocessing & Pass 1: Extract labels and assign instruction byte addresses
    let currentAddress = 0x0000;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      // Strip comments (;, #, //)
      let clean = line.replace(/(;|\/\/|#).*$/, '').trim();

      const extractedLabels: string[] = [];

      // Extract labels ending with colon
      while (clean.includes(':')) {
        const colonIdx = clean.indexOf(':');
        const labelName = clean.substring(0, colonIdx).trim();
        clean = clean.substring(colonIdx + 1).trim();

        if (labelName.length > 0) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(labelName)) {
            errors.push({
              line: i + 1,
              message: `Invalid label identifier: "${labelName}"`,
            });
          } else if (labels.has(labelName.toLowerCase())) {
            errors.push({
              line: i + 1,
              message: `Duplicate label definition: "${labelName}"`,
            });
          } else {
            labels.set(labelName.toLowerCase(), currentAddress);
            extractedLabels.push(labelName);
          }
        }
      }

      let instruction: { mnemonic: string; args: string[] } | null = null;

      if (clean.length > 0) {
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

        const args: string[] = [];
        if (argsStr.length > 0) {
          // Parse comma separated arguments, preserving brackets [EBX + 4]
          let currentArg = '';
          let insideBracket = false;
          for (let c = 0; c < argsStr.length; c++) {
            const ch = argsStr[c];
            if (ch === '[') insideBracket = true;
            if (ch === ']') insideBracket = false;

            if (ch === ',' && !insideBracket) {
              args.push(currentArg.trim());
              currentArg = '';
            } else {
              currentArg += ch;
            }
          }
          if (currentArg.trim().length > 0) {
            args.push(currentArg.trim());
          }
        }

        instruction = { mnemonic, args };
        lineAddresses.set(i, currentAddress);
        addressToLine.set(currentAddress, i);

        // Fixed 4-byte instruction size
        currentAddress += 4;
      }

      parsedLines.push({
        lineIndex: i,
        original: line,
        clean,
        labels: extractedLabels,
        instruction,
      });
    }

    if (currentAddress > 0x0800) {
      errors.push({
        line: 1,
        message: `Program size (${currentAddress} bytes) exceeds Code Segment capacity (2048 bytes).`,
      });
    }

    // Pass 2: Encode instructions into 32-bit machine code words
    const codeBytes = new Uint8Array(2048);
    let bytePointer = 0;

    for (const parsed of parsedLines) {
      if (!parsed.instruction) continue;

      const { mnemonic, args } = parsed.instruction;
      const lineNum = parsed.lineIndex + 1;
      const pc = bytePointer;

      try {
        const encodedWord = this.encodeInstruction(
          mnemonic,
          args,
          pc,
          labels,
          lineNum
        );
        // Write Little-Endian 32-bit word
        codeBytes[bytePointer] = encodedWord & 0xff;
        codeBytes[bytePointer + 1] = (encodedWord >>> 8) & 0xff;
        codeBytes[bytePointer + 2] = (encodedWord >>> 16) & 0xff;
        codeBytes[bytePointer + 3] = (encodedWord >>> 24) & 0xff;
        bytePointer += 4;
      } catch (err: unknown) {
        errors.push({
          line: lineNum,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      codeBytes: codeBytes.subarray(0, bytePointer),
      sourceLines: rawLines,
      lineAddresses,
      addressToLine,
      labels,
      errors,
      warnings,
    };
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
    let val: number;
    if (clean.startsWith('0x') || clean.startsWith('0X')) {
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

  private static parseMemoryOperand(memStr: string, lineNum: number): ParsedMemoryOperand {
    const s = memStr.trim();
    if (!s.startsWith('[') || !s.endsWith(']')) {
      throw new Error(`Line ${lineNum}: Expected memory operand enclosed in brackets like '[EBX]' or '[EBX + 4]'`);
    }
    const inner = s.substring(1, s.length - 1).trim();

    // Direct address, e.g. [0x0800]
    if (/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(inner)) {
      const addr = this.parseImmediate(inner, lineNum);
      return { baseReg: 0, offset: addr, isDirect: true };
    }

    // [reg + offset] or [reg - offset]
    const match = inner.match(/^([a-zA-Z]{2,3})\s*([\+\-])\s*(.+)$/);
    if (match) {
      const regToken = this.parseRegister(match[1], lineNum);
      const sign = match[2] === '-' ? -1 : 1;
      const offsetVal = this.parseImmediate(match[3], lineNum);
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
          const mem = this.parseMemoryOperand(destStr, lineNum);
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
          const mem = this.parseMemoryOperand(srcStr, lineNum);
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
