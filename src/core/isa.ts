// PulseCISC-32 Instruction Set Architecture (ISA) Definition
import type { DecodedInstruction, Mnemonic, RegisterId, RegisterName, SubRegisterName } from './types';

// Opcodes (6-bit: bits 31-26)
export const OPCODES = {
  MOV_RR: 0x01, // MOV reg, reg
  MOV_RI: 0x02, // MOV reg, imm
  MOV_RM: 0x03, // MOV reg, [mem] (Load)
  MOV_MR: 0x04, // MOV [mem], reg (Store)
  ADD_RR: 0x05, // ADD reg, reg
  ADD_RI: 0x06, // ADD reg, imm
  SUB_RR: 0x07, // SUB reg, reg
  SUB_RI: 0x08, // SUB reg, imm
  AND_RR: 0x09, // AND reg, reg
  AND_RI: 0x0a, // AND reg, imm
  OR_RR: 0x0b,  // OR reg, reg
  OR_RI: 0x0c,  // OR reg, imm
  XOR_RR: 0x0d, // XOR reg, reg
  XOR_RI: 0x0e, // XOR reg, imm
  CMP_RR: 0x0f, // CMP reg, reg
  CMP_RI: 0x10, // CMP reg, imm
  JE: 0x11,     // JE target
  JNE: 0x12,    // JNE target
  JMP: 0x13,    // JMP target
  MOVH: 0x14,   // MOVH reg, imm (Load upper 16 bits)
  PRINT: 0x15,  // PRINT reg / imm / [mem] (Print to console)
  SYSCALL: 0x16,// INT 0x80 / SYSCALL (Software interrupt / System call)
  HLT: 0x3f,    // HLT
} as const;

export const REGISTER_NAMES: Record<RegisterId, RegisterName> = {
  0: 'EAX',
  1: 'EBX',
  2: 'ECX',
  3: 'EDX',
  4: 'ESI',
  5: 'EDI',
  6: 'EBP',
  7: 'ESP',
};

export const SUB_REGISTER_NAMES: Record<RegisterId, SubRegisterName> = {
  0: 'AX',
  1: 'BX',
  2: 'CX',
  3: 'DX',
  4: 'SI',
  5: 'DI',
  6: 'BP',
  7: 'SP',
};

export interface ParsedRegisterToken {
  id: RegisterId;
  is16Bit: boolean;
  name: string;
}

export const REGISTER_LOOKUP: Record<string, ParsedRegisterToken> = {
  eax: { id: 0, is16Bit: false, name: 'EAX' },
  ebx: { id: 1, is16Bit: false, name: 'EBX' },
  ecx: { id: 2, is16Bit: false, name: 'ECX' },
  edx: { id: 3, is16Bit: false, name: 'EDX' },
  esi: { id: 4, is16Bit: false, name: 'ESI' },
  edi: { id: 5, is16Bit: false, name: 'EDI' },
  ebp: { id: 6, is16Bit: false, name: 'EBP' },
  esp: { id: 7, is16Bit: false, name: 'ESP' },

  ax: { id: 0, is16Bit: true, name: 'AX' },
  bx: { id: 1, is16Bit: true, name: 'BX' },
  cx: { id: 2, is16Bit: true, name: 'CX' },
  dx: { id: 3, is16Bit: true, name: 'DX' },
  si: { id: 4, is16Bit: true, name: 'SI' },
  di: { id: 5, is16Bit: true, name: 'DI' },
  bp: { id: 6, is16Bit: true, name: 'BP' },
  sp: { id: 7, is16Bit: true, name: 'SP' },
};

export function signExtend16(imm16: number): number {
  const clamped = imm16 & 0xffff;
  return (clamped << 16) >> 16;
}

export function toUint32(val: number): number {
  return val >>> 0;
}

export function toInt32(val: number): number {
  return val | 0;
}

export function toHex32(val: number): string {
  return '0x' + (val >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function toHex16(val: number): string {
  return '0x' + (val & 0xffff).toString(16).padStart(4, '0').toUpperCase();
}

/**
 * Decodes a 32-bit machine word into a DecodedInstruction for PulseCISC-32.
 */
export function decodeInstruction(raw: number): DecodedInstruction {
  const u32 = raw >>> 0;
  const opcode = (u32 >>> 26) & 0x3f;
  const destRegId = ((u32 >>> 23) & 0x07) as RegisterId;
  const srcRegId = ((u32 >>> 20) & 0x07) as RegisterId;
  const destIs16 = ((u32 >>> 19) & 0x01) === 1;
  const srcIs16 = ((u32 >>> 18) & 0x01) === 1;
  const imm16 = signExtend16(u32 & 0xffff);
  const jumpTarget = (u32 & 0x03ffffff) << 2;

  const destRegName = destIs16 ? SUB_REGISTER_NAMES[destRegId] : REGISTER_NAMES[destRegId];
  const srcRegName = srcIs16 ? SUB_REGISTER_NAMES[srcRegId] : REGISTER_NAMES[srcRegId];

  let mnemonic: Mnemonic = 'MOV';
  let asm = '';

  switch (opcode) {
    case OPCODES.MOV_RR:
      mnemonic = 'MOV';
      asm = `MOV ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };

    case OPCODES.MOV_RI:
      mnemonic = 'MOV';
      asm = `MOV ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };

    case OPCODES.MOV_RM: {
      mnemonic = 'MOV';
      const offsetStr = imm16 !== 0 ? (imm16 > 0 ? ` + ${imm16}` : ` - ${Math.abs(imm16)}`) : '';
      asm = `MOV ${destRegName}, [${srcRegName}${offsetStr}]`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: {
          type: 'MEM',
          memBaseReg: srcRegId,
          memOffset: imm16,
          rawString: `[${srcRegName}${offsetStr}]`,
        },
        assemblyString: asm,
      };
    }

    case OPCODES.MOV_MR: {
      mnemonic = 'MOV';
      const offsetStr = imm16 !== 0 ? (imm16 > 0 ? ` + ${imm16}` : ` - ${Math.abs(imm16)}`) : '';
      asm = `MOV [${destRegName}${offsetStr}], ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: {
          type: 'MEM',
          memBaseReg: destRegId,
          memOffset: imm16,
          rawString: `[${destRegName}${offsetStr}]`,
        },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };
    }

    case OPCODES.ADD_RR:
      mnemonic = 'ADD';
      asm = `ADD ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };

    case OPCODES.ADD_RI:
      mnemonic = 'ADD';
      asm = `ADD ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };

    case OPCODES.SUB_RR:
      mnemonic = 'SUB';
      asm = `SUB ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };

    case OPCODES.SUB_RI:
      mnemonic = 'SUB';
      asm = `SUB ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };

    case OPCODES.AND_RR:
      mnemonic = 'AND';
      asm = `AND ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };

    case OPCODES.AND_RI:
      mnemonic = 'AND';
      asm = `AND ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };

    case OPCODES.OR_RR:
      mnemonic = 'OR';
      asm = `OR ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };

    case OPCODES.OR_RI:
      mnemonic = 'OR';
      asm = `OR ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };

    case OPCODES.XOR_RR:
      mnemonic = 'XOR';
      asm = `XOR ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };

    case OPCODES.XOR_RI:
      mnemonic = 'XOR';
      asm = `XOR ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };

    case OPCODES.CMP_RR:
      mnemonic = 'CMP';
      asm = `CMP ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };

    case OPCODES.CMP_RI:
      mnemonic = 'CMP';
      asm = `CMP ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };

    case OPCODES.JE:
      mnemonic = 'JE';
      asm = `JE 0x${jumpTarget.toString(16).padStart(4, '0')}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'IMM', imm: jumpTarget, rawString: toHex32(jumpTarget) },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };

    case OPCODES.JNE:
      mnemonic = 'JNE';
      asm = `JNE 0x${jumpTarget.toString(16).padStart(4, '0')}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'IMM', imm: jumpTarget, rawString: toHex32(jumpTarget) },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };

    case OPCODES.JMP:
      mnemonic = 'JMP';
      asm = `JMP 0x${jumpTarget.toString(16).padStart(4, '0')}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'IMM', imm: jumpTarget, rawString: toHex32(jumpTarget) },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };

    case OPCODES.MOVH:
      mnemonic = 'MOV';
      asm = `MOVH ${destRegName}, 0x${(imm16 & 0xffff).toString(16).toUpperCase()}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: false, rawString: destRegName },
        src: { type: 'IMM', imm: imm16 & 0xffff, rawString: String(imm16 & 0xffff) },
        assemblyString: asm,
      };

    case OPCODES.PRINT: {
      mnemonic = 'PRINT';
      const isImm = srcIs16;
      if (isImm) {
        asm = `PRINT ${imm16}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'IMM', imm: imm16, rawString: String(imm16) },
          src: { type: 'NONE', rawString: '' },
          assemblyString: asm,
        };
      } else {
        asm = `PRINT ${destRegName}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
          src: { type: 'NONE', rawString: '' },
          assemblyString: asm,
        };
      }
    }

    case OPCODES.SYSCALL: {
      mnemonic = 'INT';
      const intNum = imm16 & 0xff;
      asm = intNum === 0x80 ? 'INT 0x80' : `INT 0x${intNum.toString(16).toUpperCase()}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'IMM', imm: intNum, rawString: toHex16(intNum) },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
    }

    case OPCODES.HLT:
      mnemonic = 'HLT';
      asm = 'HLT';
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'NONE', rawString: '' },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };

    default:
      mnemonic = 'HLT';
      asm = 'HLT';
      return {
        raw: u32,
        mnemonic,
        opcode: OPCODES.HLT,
        dest: { type: 'NONE', rawString: '' },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
  }
}
