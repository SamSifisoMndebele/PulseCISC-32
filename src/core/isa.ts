// PulseCISC-32 Instruction Set Architecture (ISA) Definition
import type {
  DecodedInstruction,
  Mnemonic,
  RegisterId,
  RegisterName,
  SubRegisterName,
  ByteRegisterName,
} from './types';

// Opcodes (6-bit: bits 31-26, values 0x00 - 0x3F)
export const OPCODES = {
  NOP: 0x00,    // NOP (No operation)
  MOV_RR: 0x01, // MOV reg, reg
  MOV_RI: 0x02, // MOV reg, imm
  MOV_RM: 0x03, // MOV reg, [mem] (Load 32-bit dword)
  MOV_MR: 0x04, // MOV [mem], reg (Store 32-bit dword)
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
  JE: 0x11,     // JE / JZ target (jump if ZF=1)
  JNE: 0x12,    // JNE / JNZ target (jump if ZF=0)
  JMP: 0x13,    // JMP target (unconditional jump)
  MOVH: 0x14,   // MOVH reg, imm (Load upper 16 bits)
  PRINT: 0x15,  // PRINT reg / imm / [mem] (Print to console)
  SYSCALL: 0x16,// INT 0x80 / SYSCALL (Software interrupt / System call)
  
  // Signed Conditional Branches
  JL: 0x17,     // JL / JNGE target (jump if SF != OF)
  JLE: 0x18,    // JLE / JNG target (jump if ZF=1 or SF != OF)
  JG: 0x19,     // JG / JNLE target (jump if ZF=0 and SF == OF)
  JGE: 0x1a,    // JGE / JNL target (jump if SF == OF)

  // Unsigned Conditional Branches & Flags
  JB: 0x1b,     // JB / JC / JNAE target (jump if CF=1)
  JBE: 0x1c,    // JBE / JNA target (jump if CF=1 or ZF=1)
  JA: 0x1d,     // JA / JNBE target (jump if CF=0 and ZF=0)
  JAE: 0x1e,    // JAE / JNC / JNB target (jump if CF=0)
  JS: 0x1f,     // JS target (jump if SF=1, negative)
  JNS: 0x20,    // JNS target (jump if SF=0, positive)
  JO: 0x21,     // JO target (jump if OF=1, overflow)
  JNO: 0x22,    // JNO target (jump if OF=0, no overflow)

  // Subroutines, Stack & Loops
  LOOP: 0x23,   // LOOP target (decrement ECX, jump if ECX != 0)
  CALL: 0x24,   // CALL target (push return EIP, jump)
  RET: 0x25,    // RET (pop return EIP)
  PUSH: 0x26,   // PUSH reg / imm (decrement ESP, write to [ESP])
  POP: 0x27,    // POP reg (read from [ESP], increment ESP)

  // Pointers & Registers
  LEA: 0x28,    // LEA reg, [mem] (Load effective address)
  XCHG: 0x29,   // XCHG reg, reg (Exchange two registers)

  // Unary Arithmetic & Logic
  INC: 0x2a,    // INC reg (Increment by 1)
  DEC: 0x2b,    // DEC reg (Decrement by 1)
  NEG: 0x2c,    // NEG reg (Two's complement negate)
  NOT: 0x2d,    // NOT reg (One's complement bitwise inversion)

  // Non-destructive Test & Multi-Precision
  TEST_RR: 0x2e,// TEST reg, reg (Bitwise AND without storing, updates flags)
  TEST_RI: 0x2f,// TEST reg, imm
  ADC_RR: 0x30, // ADC reg, reg (Add with carry)
  ADC_RI: 0x31, // ADC reg, imm
  SBB_RR: 0x32, // SBB reg, reg (Subtract with borrow)
  SBB_RI: 0x33, // SBB reg, imm

  // Bit Shifts & Rotates
  SHL: 0x34,    // SHL / SAL reg, imm or reg, reg (Shift left)
  SHR: 0x35,    // SHR reg, imm or reg, reg (Logical shift right)
  SAR: 0x36,    // SAR reg, imm or reg, reg (Arithmetic shift right)
  ROL: 0x37,    // ROL reg, imm or reg, reg (Rotate left)
  ROR: 0x38,    // ROR reg, imm or reg, reg (Rotate right)

  // Multiplication & Division
  MUL: 0x39,    // MUL reg / IMUL reg, reg / IMUL reg, imm
  DIV: 0x3a,    // DIV reg (Unsigned divide: EAX = quotient, EDX = remainder)
  IDIV: 0x3b,   // IDIV reg (Signed divide: EAX = quotient, EDX = remainder)

  // Flag Operations
  FLAG_OP: 0x3c,// CLC (imm=0), STC (imm=1), CMC (imm=2)

  // Byte Memory Access
  MOVB_RM: 0x3d,// MOV BYTE reg, [mem] / MOVZX
  MOVB_MR: 0x3e,// MOV BYTE [mem], reg

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

export const BYTE_REGISTER_NAMES: Record<number, ByteRegisterName> = {
  0: 'AL',
  1: 'BL',
  2: 'CL',
  3: 'DL',
};

export const BYTE_HIGH_REGISTER_NAMES: Record<number, ByteRegisterName> = {
  0: 'AH',
  1: 'BH',
  2: 'CH',
  3: 'DH',
};

export interface ParsedRegisterToken {
  id: RegisterId;
  is16Bit: boolean;
  is8Bit?: boolean;
  is8BitHigh?: boolean;
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

  al: { id: 0, is16Bit: false, is8Bit: true, is8BitHigh: false, name: 'AL' },
  bl: { id: 1, is16Bit: false, is8Bit: true, is8BitHigh: false, name: 'BL' },
  cl: { id: 2, is16Bit: false, is8Bit: true, is8BitHigh: false, name: 'CL' },
  dl: { id: 3, is16Bit: false, is8Bit: true, is8BitHigh: false, name: 'DL' },

  ah: { id: 0, is16Bit: false, is8Bit: true, is8BitHigh: true, name: 'AH' },
  bh: { id: 1, is16Bit: false, is8Bit: true, is8BitHigh: true, name: 'BH' },
  ch: { id: 2, is16Bit: false, is8Bit: true, is8BitHigh: true, name: 'CH' },
  dh: { id: 3, is16Bit: false, is8Bit: true, is8BitHigh: true, name: 'DH' },
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
  const isDirectMem = ((u32 >>> 17) & 0x01) === 1;
  const is8Bit = ((u32 >>> 16) & 0x01) === 1;
  const rawImm16 = u32 & 0xffff;
  const imm16 = signExtend16(rawImm16);
  const jumpTarget = (u32 & 0x03ffffff) << 2;

  const destRegName = is8Bit && destRegId in BYTE_REGISTER_NAMES
    ? BYTE_REGISTER_NAMES[destRegId]
    : destIs16
    ? SUB_REGISTER_NAMES[destRegId]
    : REGISTER_NAMES[destRegId];

  const srcRegName = is8Bit && srcRegId in BYTE_REGISTER_NAMES
    ? BYTE_REGISTER_NAMES[srcRegId]
    : srcIs16
    ? SUB_REGISTER_NAMES[srcRegId]
    : REGISTER_NAMES[srcRegId];

  let mnemonic: Mnemonic = 'MOV';
  let asm = '';

  switch (opcode) {
    case OPCODES.NOP:
      mnemonic = 'NOP';
      asm = 'NOP';
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'NONE', rawString: '' },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };

    case OPCODES.MOV_RR:
      mnemonic = 'MOV';
      asm = `MOV ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, is8Bit, rawString: srcRegName },
        assemblyString: asm,
      };

    case OPCODES.MOV_RI:
      mnemonic = 'MOV';
      asm = `MOV ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };

    case OPCODES.MOV_RM: {
      mnemonic = 'MOV';
      if (isDirectMem) {
        asm = `MOV ${destRegName}, [0x${rawImm16.toString(16).toUpperCase().padStart(4, '0')}]`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
          src: {
            type: 'MEM',
            memBaseReg: 0,
            memOffset: rawImm16,
            isDirect: true,
            rawString: `[0x${rawImm16.toString(16).toUpperCase().padStart(4, '0')}]`,
          },
          assemblyString: asm,
        };
      }
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
          isDirect: false,
          rawString: `[${srcRegName}${offsetStr}]`,
        },
        assemblyString: asm,
      };
    }

    case OPCODES.MOV_MR: {
      mnemonic = 'MOV';
      if (isDirectMem) {
        asm = `MOV [0x${rawImm16.toString(16).toUpperCase().padStart(4, '0')}], ${srcRegName}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: {
            type: 'MEM',
            memBaseReg: 0,
            memOffset: rawImm16,
            isDirect: true,
            rawString: `[0x${rawImm16.toString(16).toUpperCase().padStart(4, '0')}]`,
          },
          src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
          assemblyString: asm,
        };
      }
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
          isDirect: false,
          rawString: `[${destRegName}${offsetStr}]`,
        },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };
    }

    case OPCODES.MOVB_RM: {
      mnemonic = 'MOVB';
      if (isDirectMem) {
        asm = `MOV ${destRegName}, BYTE [0x${rawImm16.toString(16).toUpperCase().padStart(4, '0')}]`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
          src: {
            type: 'MEM',
            memBaseReg: 0,
            memOffset: rawImm16,
            isDirect: true,
            isByte: true,
            rawString: `BYTE [0x${rawImm16.toString(16).toUpperCase().padStart(4, '0')}]`,
          },
          assemblyString: asm,
        };
      }
      const offsetStr = imm16 !== 0 ? (imm16 > 0 ? ` + ${imm16}` : ` - ${Math.abs(imm16)}`) : '';
      asm = `MOV ${destRegName}, BYTE [${srcRegName}${offsetStr}]`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
        src: {
          type: 'MEM',
          memBaseReg: srcRegId,
          memOffset: imm16,
          isDirect: false,
          isByte: true,
          rawString: `BYTE [${srcRegName}${offsetStr}]`,
        },
        assemblyString: asm,
      };
    }

    case OPCODES.MOVB_MR: {
      mnemonic = 'MOVB';
      if (isDirectMem) {
        asm = `MOV BYTE [0x${rawImm16.toString(16).toUpperCase().padStart(4, '0')}], ${srcRegName}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: {
            type: 'MEM',
            memBaseReg: 0,
            memOffset: rawImm16,
            isDirect: true,
            isByte: true,
            rawString: `BYTE [0x${rawImm16.toString(16).toUpperCase().padStart(4, '0')}]`,
          },
          src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, is8Bit, rawString: srcRegName },
          assemblyString: asm,
        };
      }
      const offsetStr = imm16 !== 0 ? (imm16 > 0 ? ` + ${imm16}` : ` - ${Math.abs(imm16)}`) : '';
      asm = `MOV BYTE [${destRegName}${offsetStr}], ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: {
          type: 'MEM',
          memBaseReg: destRegId,
          memOffset: imm16,
          isDirect: false,
          isByte: true,
          rawString: `BYTE [${destRegName}${offsetStr}]`,
        },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, is8Bit, rawString: srcRegName },
        assemblyString: asm,
      };
    }

    case OPCODES.ADD_RR:
    case OPCODES.SUB_RR:
    case OPCODES.AND_RR:
    case OPCODES.OR_RR:
    case OPCODES.XOR_RR:
    case OPCODES.CMP_RR:
    case OPCODES.TEST_RR:
    case OPCODES.ADC_RR:
    case OPCODES.SBB_RR: {
      let m: Mnemonic = 'ADD';
      if (opcode === OPCODES.SUB_RR) m = 'SUB';
      else if (opcode === OPCODES.AND_RR) m = 'AND';
      else if (opcode === OPCODES.OR_RR) m = 'OR';
      else if (opcode === OPCODES.XOR_RR) m = 'XOR';
      else if (opcode === OPCODES.CMP_RR) m = 'CMP';
      else if (opcode === OPCODES.TEST_RR) m = 'TEST';
      else if (opcode === OPCODES.ADC_RR) m = 'ADC';
      else if (opcode === OPCODES.SBB_RR) m = 'SBB';
      asm = `${m} ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic: m,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, is8Bit, rawString: srcRegName },
        assemblyString: asm,
      };
    }

    case OPCODES.ADD_RI:
    case OPCODES.SUB_RI:
    case OPCODES.AND_RI:
    case OPCODES.OR_RI:
    case OPCODES.XOR_RI:
    case OPCODES.CMP_RI:
    case OPCODES.TEST_RI:
    case OPCODES.ADC_RI:
    case OPCODES.SBB_RI: {
      let m: Mnemonic = 'ADD';
      if (opcode === OPCODES.SUB_RI) m = 'SUB';
      else if (opcode === OPCODES.AND_RI) m = 'AND';
      else if (opcode === OPCODES.OR_RI) m = 'OR';
      else if (opcode === OPCODES.XOR_RI) m = 'XOR';
      else if (opcode === OPCODES.CMP_RI) m = 'CMP';
      else if (opcode === OPCODES.TEST_RI) m = 'TEST';
      else if (opcode === OPCODES.ADC_RI) m = 'ADC';
      else if (opcode === OPCODES.SBB_RI) m = 'SBB';
      asm = `${m} ${destRegName}, ${imm16}`;
      return {
        raw: u32,
        mnemonic: m,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
        src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        assemblyString: asm,
      };
    }

    case OPCODES.INC:
    case OPCODES.DEC:
    case OPCODES.NEG:
    case OPCODES.NOT: {
      let m: Mnemonic = 'INC';
      if (opcode === OPCODES.DEC) m = 'DEC';
      else if (opcode === OPCODES.NEG) m = 'NEG';
      else if (opcode === OPCODES.NOT) m = 'NOT';
      asm = `${m} ${destRegName}`;
      return {
        raw: u32,
        mnemonic: m,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
    }

    case OPCODES.SHL:
    case OPCODES.SHR:
    case OPCODES.SAR:
    case OPCODES.ROL:
    case OPCODES.ROR: {
      let m: Mnemonic = 'SHL';
      if (opcode === OPCODES.SHR) m = 'SHR';
      else if (opcode === OPCODES.SAR) m = 'SAR';
      else if (opcode === OPCODES.ROL) m = 'ROL';
      else if (opcode === OPCODES.ROR) m = 'ROR';

      const isRegShift = srcIs16;
      if (isRegShift) {
        asm = `${m} ${destRegName}, ${srcRegName}`;
        return {
          raw: u32,
          mnemonic: m,
          opcode,
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
          src: { type: 'REG', reg: srcRegId, is16Bit: false, is8Bit: true, rawString: srcRegName },
          assemblyString: asm,
        };
      } else {
        const count = imm16 & 0x1f;
        asm = `${m} ${destRegName}, ${count}`;
        return {
          raw: u32,
          mnemonic: m,
          opcode,
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
          src: { type: 'IMM', imm: count, rawString: String(count) },
          assemblyString: asm,
        };
      }
    }

    case OPCODES.MUL: {
      const isImm = srcIs16;
      if (isImm) {
        mnemonic = 'IMUL';
        asm = `IMUL ${destRegName}, ${imm16}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
          src: { type: 'IMM', imm: imm16, rawString: String(imm16) },
          assemblyString: asm,
        };
      } else if (destRegId !== 0) {
        mnemonic = 'IMUL';
        asm = `IMUL ${destRegName}, ${srcRegName}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
          src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
          assemblyString: asm,
        };
      } else {
        mnemonic = 'MUL';
        asm = `MUL ${srcRegName}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'REG', reg: 0, is16Bit: false, rawString: 'EAX' },
          src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
          assemblyString: asm,
        };
      }
    }

    case OPCODES.DIV:
    case OPCODES.IDIV: {
      mnemonic = opcode === OPCODES.DIV ? 'DIV' : 'IDIV';
      asm = `${mnemonic} ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: 0, is16Bit: false, rawString: 'EAX' },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };
    }

    case OPCODES.PUSH: {
      mnemonic = 'PUSH';
      const isImm = srcIs16;
      if (isImm) {
        asm = `PUSH ${imm16}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'IMM', imm: imm16, rawString: String(imm16) },
          src: { type: 'NONE', rawString: '' },
          assemblyString: asm,
        };
      } else {
        asm = `PUSH ${destRegName}`;
        return {
          raw: u32,
          mnemonic,
          opcode,
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
          src: { type: 'NONE', rawString: '' },
          assemblyString: asm,
        };
      }
    }

    case OPCODES.POP: {
      mnemonic = 'POP';
      asm = `POP ${destRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
    }

    case OPCODES.CALL: {
      mnemonic = 'CALL';
      asm = `CALL 0x${jumpTarget.toString(16).padStart(4, '0')}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'IMM', imm: jumpTarget, rawString: toHex32(jumpTarget) },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
    }

    case OPCODES.RET: {
      mnemonic = 'RET';
      asm = 'RET';
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'NONE', rawString: '' },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
    }

    case OPCODES.LOOP: {
      mnemonic = 'LOOP';
      asm = `LOOP 0x${jumpTarget.toString(16).padStart(4, '0')}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'IMM', imm: jumpTarget, rawString: toHex32(jumpTarget) },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
    }

    case OPCODES.LEA: {
      mnemonic = 'LEA';
      const offsetStr = imm16 !== 0 ? (imm16 > 0 ? ` + ${imm16}` : ` - ${Math.abs(imm16)}`) : '';
      asm = `LEA ${destRegName}, [${srcRegName}${offsetStr}]`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: {
          type: 'MEM',
          memBaseReg: srcRegId,
          memOffset: imm16,
          isDirect: false,
          rawString: `[${srcRegName}${offsetStr}]`,
        },
        assemblyString: asm,
      };
    }

    case OPCODES.XCHG: {
      mnemonic = 'XCHG';
      asm = `XCHG ${destRegName}, ${srcRegName}`;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, rawString: destRegName },
        src: { type: 'REG', reg: srcRegId, is16Bit: srcIs16, rawString: srcRegName },
        assemblyString: asm,
      };
    }

    case OPCODES.FLAG_OP: {
      if (imm16 === 0) mnemonic = 'CLC';
      else if (imm16 === 1) mnemonic = 'STC';
      else mnemonic = 'CMC';
      asm = mnemonic;
      return {
        raw: u32,
        mnemonic,
        opcode,
        dest: { type: 'IMM', imm: imm16, rawString: String(imm16) },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
    }

    // Branching Instructions
    case OPCODES.JE:
    case OPCODES.JNE:
    case OPCODES.JMP:
    case OPCODES.JL:
    case OPCODES.JLE:
    case OPCODES.JG:
    case OPCODES.JGE:
    case OPCODES.JB:
    case OPCODES.JBE:
    case OPCODES.JA:
    case OPCODES.JAE:
    case OPCODES.JS:
    case OPCODES.JNS:
    case OPCODES.JO:
    case OPCODES.JNO: {
      let m: Mnemonic = 'JMP';
      if (opcode === OPCODES.JE) m = 'JE';
      else if (opcode === OPCODES.JNE) m = 'JNE';
      else if (opcode === OPCODES.JL) m = 'JL';
      else if (opcode === OPCODES.JLE) m = 'JLE';
      else if (opcode === OPCODES.JG) m = 'JG';
      else if (opcode === OPCODES.JGE) m = 'JGE';
      else if (opcode === OPCODES.JB) m = 'JB';
      else if (opcode === OPCODES.JBE) m = 'JBE';
      else if (opcode === OPCODES.JA) m = 'JA';
      else if (opcode === OPCODES.JAE) m = 'JAE';
      else if (opcode === OPCODES.JS) m = 'JS';
      else if (opcode === OPCODES.JNS) m = 'JNS';
      else if (opcode === OPCODES.JO) m = 'JO';
      else if (opcode === OPCODES.JNO) m = 'JNO';

      asm = `${m} 0x${jumpTarget.toString(16).padStart(4, '0')}`;
      return {
        raw: u32,
        mnemonic: m,
        opcode,
        dest: { type: 'IMM', imm: jumpTarget, rawString: toHex32(jumpTarget) },
        src: { type: 'NONE', rawString: '' },
        assemblyString: asm,
      };
    }

    case OPCODES.MOVH:
      mnemonic = 'MOVH';
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
          dest: { type: 'REG', reg: destRegId, is16Bit: destIs16, is8Bit, rawString: destRegName },
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
