// PulseCISC-32 Variable-Length x86 Instruction Set Architecture (ISA)
import type {
  DecodedInstruction,
  Mnemonic,
  Operand,
  RegisterId,
  RegisterName,
  SubRegisterName,
  ByteRegisterName,
  SegmentRegisterName,
} from './types';

// Logical Opcode Identifiers used by CPU Execution Engine & Visualizer
export const OPCODES = {
  NOP: 0x00,
  MOV_RR: 0x01,
  MOV_RI: 0x02,
  MOV_RM: 0x03,
  MOV_MR: 0x04,
  ADD_RR: 0x05,
  ADD_RI: 0x06,
  SUB_RR: 0x07,
  SUB_RI: 0x08,
  AND_RR: 0x09,
  AND_RI: 0x0a,
  OR_RR: 0x0b,
  OR_RI: 0x0c,
  XOR_RR: 0x0d,
  XOR_RI: 0x0e,
  CMP_RR: 0x0f,
  CMP_RI: 0x10,
  JE: 0x11,
  JNE: 0x12,
  JMP: 0x13,
  MOVH: 0x14,
  SYSCALL: 0x16,

  // Signed Conditional Branches
  JL: 0x17,
  JLE: 0x18,
  JG: 0x19,
  JGE: 0x1a,

  // Unsigned Conditional Branches & Flags
  JB: 0x1b,
  JBE: 0x1c,
  JA: 0x1d,
  JAE: 0x1e,
  JS: 0x1f,
  JNS: 0x20,
  JO: 0x21,
  JNO: 0x22,

  // Subroutines, Stack & Loops
  LOOP: 0x23,
  CALL: 0x24,
  RET: 0x25,
  PUSH: 0x26,
  POP: 0x27,

  // Pointers & Registers
  LEA: 0x28,
  XCHG: 0x29,

  // Unary Arithmetic & Logic
  INC: 0x2a,
  DEC: 0x2b,
  NEG: 0x2c,
  NOT: 0x2d,

  // Non-destructive Test & Multi-Precision
  TEST_RR: 0x2e,
  TEST_RI: 0x2f,
  ADC_RR: 0x30,
  ADC_RI: 0x31,
  SBB_RR: 0x32,
  SBB_RI: 0x33,

  // Bit Shifts & Rotates
  SHL: 0x34,
  SHR: 0x35,
  SAR: 0x36,
  ROL: 0x37,
  ROR: 0x38,

  // Multiplication & Division
  MUL: 0x39,
  DIV: 0x3a,
  IDIV: 0x3b,

  // Flag Operations
  FLAG_OP: 0x3c,

  // Byte Memory Access
  MOVB_RM: 0x3d,
  MOVB_MR: 0x3e,

  HLT: 0x3f,

  // --- Extended x86 / MASM Opcodes (0x40+) ---
  MOV_MI: 0x40,      // MOV [mem], imm (8/16/32-bit)
  MOVW_RM: 0x41,     // MOV reg16, WORD PTR [mem]
  MOVW_MR: 0x42,     // MOV WORD PTR [mem], reg16
  MOVZX: 0x43,       // MOVZX reg32/16, r/m8 or r/m16
  MOVSX: 0x44,       // MOVSX reg32/16, r/m8 or r/m16
  ENTER: 0x45,       // ENTER imm16, imm8
  LEAVE: 0x46,       // LEAVE
  RET_IMM: 0x47,     // RET imm16 (STDCALL stack cleanup)
  PUSHAD: 0x48,      // PUSHAD / PUSHA
  POPAD: 0x49,       // POPAD / POPA
  PUSHFD: 0x4a,      // PUSHFD / PUSHF
  POPFD: 0x4b,       // POPFD / POPF
  CBW: 0x4c,         // CBW (AL -> AX)
  CWDE: 0x4d,        // CWDE (AX -> EAX)
  CWD: 0x4e,         // CWD (AX -> DX:AX)
  CDQ: 0x4f,         // CDQ (EAX -> EDX:EAX)
  LAHF: 0x50,        // LAHF
  SAHF: 0x51,        // SAHF
  STRING_OP: 0x52,   // MOVSB/W/D, STOSB/W/D, LODSB/W/D, CMPSB/W/D, SCASB/W/D (+ REP)
  CMOVCC: 0x53,      // CMOVE, CMOVNE, CMOVG, CMOVGE, CMOVL, CMOVLE, CMOVA, CMOVB, etc.
  SETCC: 0x54,       // SETE, SETNE, SETG, SETGE, SETL, SETLE, SETA, SETB, etc.
  BIT_OP: 0x55,      // BT, BTS, BTR, BTC, BSF, BSR, BSWAP
  LOOPE: 0x56,       // LOOPE / LOOPZ
  LOOPNE: 0x57,      // LOOPNE / LOOPNZ
  JECXZ: 0x58,       // JECXZ / JCXZ
  XADD: 0x59,        // XADD dest, src
  CMPXCHG: 0x5a,     // CMPXCHG dest, src
  ALU_MEM: 0x5b,     // ADD/SUB/AND/OR/XOR/CMP/TEST/ADC/SBB with [mem] operand
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

export const SEGMENT_REGISTER_NAMES: Record<number, SegmentRegisterName> = {
  0: 'CS',
  1: 'DS',
  2: 'SS',
  3: 'ES',
  4: 'FS',
  5: 'GS',
};

export interface ParsedRegisterToken {
  id: RegisterId;
  is16Bit: boolean;
  is8Bit?: boolean;
  is8BitHigh?: boolean;
  segReg?: SegmentRegisterName;
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

  cs: { id: 0, is16Bit: true, segReg: 'CS', name: 'CS' },
  ds: { id: 1, is16Bit: true, segReg: 'DS', name: 'DS' },
  ss: { id: 2, is16Bit: true, segReg: 'SS', name: 'SS' },
  es: { id: 3, is16Bit: true, segReg: 'ES', name: 'ES' },
  fs: { id: 4, is16Bit: true, segReg: 'FS', name: 'FS' },
  gs: { id: 5, is16Bit: true, segReg: 'GS', name: 'GS' },
};

export function signExtend8(imm8: number): number {
  const clamped = imm8 & 0xff;
  return (clamped << 24) >> 24;
}

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

export function toHex8(val: number): string {
  return '0x' + (val & 0xff).toString(16).padStart(2, '0').toUpperCase();
}

export function formatBytesHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => (b & 0xff).toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

export function formatRegisterOperand(op: Operand): string {
  if (op.segReg) return op.segReg;
  const regId = (op.reg ?? 0) as RegisterId;
  if (op.is8BitHigh) return BYTE_HIGH_REGISTER_NAMES[regId] ?? 'AH';
  if (op.is8Bit) return BYTE_REGISTER_NAMES[regId] ?? 'AL';
  if (op.is16Bit) return SUB_REGISTER_NAMES[regId];
  return REGISTER_NAMES[regId];
}

export function formatMemoryOperand(op: Operand, includeSizePrefix: boolean = false): string {
  const parts: string[] = [];
  if (!op.isDirect && op.memBaseReg !== undefined) {
    parts.push(REGISTER_NAMES[op.memBaseReg]);
  }
  if (op.memIndexReg !== undefined) {
    const scale = op.memScale ?? 1;
    parts.push(scale > 1 ? `${REGISTER_NAMES[op.memIndexReg]}*${scale}` : REGISTER_NAMES[op.memIndexReg]);
  }
  const offset = op.memOffset ?? 0;
  if (op.isDirect) {
    const hexAddr = `0x${toUint32(offset).toString(16).toUpperCase().padStart(4, '0')}`;
    if (parts.length === 0) {
      parts.push(hexAddr);
    } else if (offset !== 0) {
      parts.unshift(hexAddr);
    }
  } else if (offset !== 0 || parts.length === 0) {
    if (parts.length === 0) {
      parts.push(`0x${toUint32(offset).toString(16).toUpperCase().padStart(4, '0')}`);
    } else if (offset > 0) {
      parts.push(`${offset}`);
    } else if (offset < 0) {
      parts.push(`- ${Math.abs(offset)}`);
    }
  }

  let expr = '';
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      expr = parts[i];
    } else if (parts[i].startsWith('- ')) {
      expr += ` ${parts[i]}`;
    } else {
      expr += ` + ${parts[i]}`;
    }
  }

  const segPrefix = op.segmentOverride ? `${op.segmentOverride}:` : '';
  const sizePrefix =
    includeSizePrefix || op.isByte || op.isWord
      ? op.isByte
        ? 'BYTE PTR '
        : op.isWord
        ? 'WORD PTR '
        : includeSizePrefix
        ? 'DWORD PTR '
        : ''
      : '';
  return `${sizePrefix}${segPrefix}[${expr}]`;
}

// Condition code mapping for Jcc, CMOVcc, SETcc
export const CONDITION_CODES: Record<string, number> = {
  O: 0x0,
  NO: 0x1,
  B: 0x2,
  C: 0x2,
  NAE: 0x2,
  AE: 0x3,
  NB: 0x3,
  NC: 0x3,
  E: 0x4,
  Z: 0x4,
  NE: 0x5,
  NZ: 0x5,
  BE: 0x6,
  NA: 0x6,
  A: 0x7,
  NBE: 0x7,
  S: 0x8,
  NS: 0x9,
  L: 0xc,
  NGE: 0xc,
  GE: 0xd,
  NL: 0xd,
  LE: 0xe,
  NG: 0xe,
  G: 0xf,
  NLE: 0xf,
};

export const CONDITION_SUFFIX_BY_CODE: Record<number, string> = {
  0x0: 'O',
  0x1: 'NO',
  0x2: 'B',
  0x3: 'AE',
  0x4: 'E',
  0x5: 'NE',
  0x6: 'BE',
  0x7: 'A',
  0x8: 'S',
  0x9: 'NS',
  0xc: 'L',
  0xd: 'GE',
  0xe: 'LE',
  0xf: 'G',
};

const SCALE_TO_BITS: Record<number, number> = { 1: 0, 2: 1, 4: 2, 8: 3 };
const BITS_TO_SCALE: Record<number, 1 | 2 | 4 | 8> = { 0: 1, 1: 2, 2: 4, 3: 8 };

const SEG_TO_ID: Record<SegmentRegisterName, number> = {
  CS: 0,
  DS: 1,
  SS: 2,
  ES: 3,
  FS: 4,
  GS: 5,
};

function pushInt32LE(out: number[], val: number): void {
  const u = val >>> 0;
  out.push(u & 0xff, (u >>> 8) & 0xff, (u >>> 16) & 0xff, (u >>> 24) & 0xff);
}

function pushInt16LE(out: number[], val: number): void {
  const u = val & 0xffff;
  out.push(u & 0xff, (u >>> 8) & 0xff);
}

function readUint32LE(bytes: Uint8Array | number[], offset: number): number {
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  const b2 = bytes[offset + 2] ?? 0;
  const b3 = bytes[offset + 3] ?? 0;
  return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
}

function readUint16LE(bytes: Uint8Array | number[], offset: number): number {
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  return ((b1 << 8) | b0) & 0xffff;
}

function fitsImm8(val: number): boolean {
  const s = toInt32(val);
  return s >= -128 && s <= 127;
}

function isSimple32Reg(op: Operand): boolean {
  return (
    op.type === 'REG' &&
    op.reg !== undefined &&
    !op.is16Bit &&
    !op.is8Bit &&
    !op.is8BitHigh &&
    !op.segReg
  );
}

function isStandard32Mem(op: Operand): boolean {
  return (
    op.type === 'MEM' &&
    !op.isByte &&
    !op.isWord &&
    !op.segmentOverride
  );
}

/**
 * Encodes an x86 ModR/M + optional SIB + optional Displacement (disp8/disp32)
 * for a 32-bit register (`regField`) and a 32-bit memory operand (`memOp`).
 */
function encodeModRMAndSIB(out: number[], regField: number, memOp: Operand): void {
  const r = regField & 0x07;
  const offset = toInt32(memOp.memOffset ?? 0);
  const hasIndex = memOp.memIndexReg !== undefined;
  const scaleBits = SCALE_TO_BITS[memOp.memScale ?? 1] ?? 0;

  // Case 1: Pure direct address [disp32] without index register
  if (memOp.isDirect && !hasIndex) {
    // mod = 00, rm = 6 (EBP -> disp32 in PulseCISC-32)
    out.push((0x00 << 6) | (r << 3) | 0x06);
    pushInt32LE(out, offset);
    return;
  }

  // Case 2: Needs SIB byte (has index register, or base is ESP(7), or direct+index)
  const baseReg = memOp.isDirect ? undefined : memOp.memBaseReg;
  if (hasIndex || baseReg === 7 || baseReg === undefined) {
    const indexBits = (memOp.memIndexReg ?? 7) & 0x07; // 7 (ESP) means no index in SIB
    if (baseReg === undefined) {
      // No base register (e.g. [ESI*4 + disp32]): mod = 00, rm = 7 (SIB), base = 6 (disp32)
      out.push((0x00 << 6) | (r << 3) | 0x07);
      out.push((scaleBits << 6) | (indexBits << 3) | 0x06);
      pushInt32LE(out, offset);
      return;
    }

    // Has baseReg + optional index
    if (offset === 0 && baseReg !== 6) {
      out.push((0x00 << 6) | (r << 3) | 0x07);
      out.push((scaleBits << 6) | (indexBits << 3) | (baseReg & 0x07));
    } else if (fitsImm8(offset)) {
      out.push((0x01 << 6) | (r << 3) | 0x07);
      out.push((scaleBits << 6) | (indexBits << 3) | (baseReg & 0x07));
      out.push(offset & 0xff);
    } else {
      out.push((0x02 << 6) | (r << 3) | 0x07);
      out.push((scaleBits << 6) | (indexBits << 3) | (baseReg & 0x07));
      pushInt32LE(out, offset);
    }
    return;
  }

  // Case 3: Simple [baseReg + disp] where baseReg != ESP(7)
  if (offset === 0 && baseReg !== 6) {
    // mod = 00
    out.push((0x00 << 6) | (r << 3) | (baseReg & 0x07));
  } else if (fitsImm8(offset)) {
    // mod = 01 + disp8
    out.push((0x01 << 6) | (r << 3) | (baseReg & 0x07));
    out.push(offset & 0xff);
  } else {
    // mod = 10 + disp32
    out.push((0x02 << 6) | (r << 3) | (baseReg & 0x07));
    pushInt32LE(out, offset);
  }
}

/**
 * Decodes x86 ModR/M + optional SIB + optional Displacement starting at `offset`.
 * Returns `{ regField, isRegMode, rmReg, memOperand, nextOffset }`.
 */
function decodeModRMAndSIB(
  bytes: Uint8Array | number[],
  offset: number
): {
  regField: RegisterId;
  isRegMode: boolean;
  rmReg: RegisterId;
  memOperand: Operand;
  nextOffset: number;
} {
  const modrm = bytes[offset] ?? 0;
  let cur = offset + 1;
  const mod = (modrm >>> 6) & 0x03;
  const regField = ((modrm >>> 3) & 0x07) as RegisterId;
  const rm = (modrm & 0x07) as RegisterId;

  if (mod === 0x03) {
    return {
      regField,
      isRegMode: true,
      rmReg: rm,
      memOperand: { type: 'NONE', rawString: '' },
      nextOffset: cur,
    };
  }

  // Memory mode (mod = 0, 1, or 2)
  if (mod === 0x00 && rm === 6) {
    // Direct [disp32]
    const disp32 = readUint32LE(bytes, cur);
    cur += 4;
    const memOp: Operand = {
      type: 'MEM',
      memBaseReg: 0,
      memOffset: disp32,
      isDirect: true,
      rawString: '',
    };
    memOp.rawString = formatMemoryOperand(memOp);
    return { regField, isRegMode: false, rmReg: 0, memOperand: memOp, nextOffset: cur };
  }

  let baseReg: RegisterId | undefined = rm;
  let indexReg: RegisterId | undefined = undefined;
  let scale: 1 | 2 | 4 | 8 = 1;
  let isDirect = false;

  if (rm === 7) {
    // SIB byte present
    const sib = bytes[cur] ?? 0;
    cur++;
    const scaleBits = (sib >>> 6) & 0x03;
    const idxBits = ((sib >>> 3) & 0x07) as RegisterId;
    const baseBits = (sib & 0x07) as RegisterId;

    scale = BITS_TO_SCALE[scaleBits] ?? 1;
    indexReg = idxBits === 7 ? undefined : idxBits;

    if (mod === 0x00 && baseBits === 6) {
      baseReg = undefined;
      isDirect = true;
    } else {
      baseReg = baseBits;
    }
  }

  let disp = 0;
  if (mod === 0x00 && isDirect) {
    disp = toInt32(readUint32LE(bytes, cur));
    cur += 4;
  } else if (mod === 0x01) {
    disp = signExtend8(bytes[cur] ?? 0);
    cur += 1;
  } else if (mod === 0x02) {
    disp = toInt32(readUint32LE(bytes, cur));
    cur += 4;
  }

  const memOp: Operand = {
    type: 'MEM',
    memBaseReg: baseReg,
    memIndexReg: indexReg,
    memScale: indexReg !== undefined ? scale : undefined,
    memOffset: disp,
    isDirect,
    rawString: '',
  };
  memOp.rawString = formatMemoryOperand(memOp);

  return { regField, isRegMode: false, rmReg: 0, memOperand: memOp, nextOffset: cur };
}

/**
 * Encodes an arbitrary Operand into compact descriptor bytes for `0x0F` extended instructions.
 */
function encodeExtendedOperand(out: number[], op: Operand): void {
  if (op.type === 'NONE') {
    out.push(0x00);
    return;
  }
  if (op.type === 'REG') {
    let sizeCode = 0; // 0=32b, 1=16b, 2=8b low, 3=8b high, 4=segReg
    let regId = (op.reg ?? 0) & 0x07;
    if (op.segReg) {
      sizeCode = 4;
      regId = SEG_TO_ID[op.segReg] ?? 0;
    } else if (op.is8BitHigh) {
      sizeCode = 3;
    } else if (op.is8Bit) {
      sizeCode = 2;
    } else if (op.is16Bit) {
      sizeCode = 1;
    }
    out.push(0x10 | ((sizeCode & 0x07) << 0));
    out.push(regId & 0x07);
    return;
  }
  if (op.type === 'IMM') {
    const val = toInt32(op.imm ?? 0);
    if (fitsImm8(val)) {
      out.push(0x20); // IMM8
      out.push(val & 0xff);
    } else {
      out.push(0x21); // IMM32
      pushInt32LE(out, val);
    }
    return;
  }
  if (op.type === 'MEM') {
    const offset = toInt32(op.memOffset ?? 0);
    const useDisp8 = !op.isDirect && fitsImm8(offset);
    let memFlags = 0x30; // base tag 0x30
    if (op.isByte) memFlags |= 0x01;
    else if (op.isWord) memFlags |= 0x02;
    if (op.isDirect) memFlags |= 0x04;
    if (useDisp8) memFlags |= 0x08;
    out.push(memFlags);

    const hasBase = !op.isDirect && op.memBaseReg !== undefined ? 1 : 0;
    const hasIndex = op.memIndexReg !== undefined ? 1 : 0;
    const scaleCode = SCALE_TO_BITS[op.memScale ?? 1] ?? 0;
    const baseReg = (op.memBaseReg ?? 0) & 0x07;
    const indexReg = (op.memIndexReg ?? 0) & 0x07;
    const segCode = op.segmentOverride ? (SEG_TO_ID[op.segmentOverride] + 1) & 0x07 : 0;

    out.push((hasBase << 7) | (hasIndex << 6) | ((scaleCode & 0x03) << 4) | baseReg);
    out.push(((segCode & 0x07) << 4) | indexReg);

    if (useDisp8) {
      out.push(offset & 0xff);
    } else {
      pushInt32LE(out, offset);
    }
  }
}

function decodeExtendedOperand(
  bytes: Uint8Array | number[],
  offset: number
): { operand: Operand; nextOffset: number } {
  const tag = bytes[offset] ?? 0;
  let cur = offset + 1;

  if (tag === 0x00) {
    return { operand: { type: 'NONE', rawString: '' }, nextOffset: cur };
  }

  if ((tag & 0xf0) === 0x10) {
    const sizeCode = tag & 0x07;
    const regId = ((bytes[cur] ?? 0) & 0x07) as RegisterId;
    cur++;
    const op: Operand = {
      type: 'REG',
      reg: regId,
      is16Bit: sizeCode === 1 || sizeCode === 4,
      is8Bit: sizeCode === 2 || sizeCode === 3,
      is8BitHigh: sizeCode === 3,
      segReg: sizeCode === 4 ? SEGMENT_REGISTER_NAMES[regId] : undefined,
      rawString: '',
    };
    op.rawString = formatRegisterOperand(op);
    return { operand: op, nextOffset: cur };
  }

  if (tag === 0x20) {
    const imm = signExtend8(bytes[cur] ?? 0);
    cur++;
    return {
      operand: { type: 'IMM', imm, rawString: String(imm) },
      nextOffset: cur,
    };
  }

  if (tag === 0x21) {
    const imm = toInt32(readUint32LE(bytes, cur));
    cur += 4;
    return {
      operand: { type: 'IMM', imm, rawString: String(imm) },
      nextOffset: cur,
    };
  }

  if ((tag & 0xf0) === 0x30) {
    const isByte = (tag & 0x01) !== 0;
    const isWord = (tag & 0x02) !== 0;
    const isDirect = (tag & 0x04) !== 0;
    const useDisp8 = (tag & 0x08) !== 0;

    const sib1 = bytes[cur] ?? 0;
    const sib2 = bytes[cur + 1] ?? 0;
    cur += 2;

    const hasBase = ((sib1 >>> 7) & 1) === 1;
    const hasIndex = ((sib1 >>> 6) & 1) === 1;
    const scale = BITS_TO_SCALE[(sib1 >>> 4) & 0x03] ?? 1;
    const baseReg = (sib1 & 0x07) as RegisterId;
    const segCode = (sib2 >>> 4) & 0x07;
    const indexReg = (sib2 & 0x07) as RegisterId;

    let disp = 0;
    if (useDisp8) {
      disp = signExtend8(bytes[cur] ?? 0);
      cur += 1;
    } else {
      disp = toInt32(readUint32LE(bytes, cur));
      cur += 4;
    }

    const op: Operand = {
      type: 'MEM',
      memBaseReg: hasBase ? baseReg : undefined,
      memIndexReg: hasIndex ? indexReg : undefined,
      memScale: hasIndex ? scale : undefined,
      memOffset: disp,
      isDirect,
      isByte,
      isWord,
      segmentOverride: segCode > 0 ? SEGMENT_REGISTER_NAMES[segCode - 1] : undefined,
      rawString: '',
    };
    op.rawString = formatMemoryOperand(op);
    return { operand: op, nextOffset: cur };
  }

  return { operand: { type: 'NONE', rawString: '' }, nextOffset: cur };
}

export interface InstructionToEncode {
  opcode: number;
  mnemonic: Mnemonic;
  dest: Operand;
  src: Operand;
  imm2?: number;
  repPrefix?: 'REP' | 'REPE' | 'REPNE';
}

const MNEMONIC_LIST: Mnemonic[] = [
  'MOV', 'MOVB', 'MOVW', 'MOVH', 'MOVZX', 'MOVSX',
  'ADD', 'ADC', 'SUB', 'SBB', 'AND', 'OR', 'XOR', 'CMP', 'TEST',
  'JE', 'JZ', 'JNE', 'JNZ', 'JL', 'JNGE', 'JLE', 'JNG', 'JG', 'JNLE', 'JGE', 'JNL',
  'JB', 'JC', 'JNAE', 'JBE', 'JNA', 'JA', 'JNBE', 'JAE', 'JNC', 'JNB',
  'JS', 'JNS', 'JO', 'JNO', 'JMP', 'JECXZ', 'JCXZ',
  'LOOP', 'LOOPE', 'LOOPZ', 'LOOPNE', 'LOOPNZ',
  'CALL', 'RET', 'ENTER', 'LEAVE',
  'PUSH', 'POP', 'PUSHAD', 'POPAD', 'PUSHA', 'POPA', 'PUSHFD', 'POPFD', 'PUSHF', 'POPF',
  'LEA', 'XCHG', 'XADD', 'CMPXCHG', 'BSWAP',
  'INC', 'DEC', 'NEG', 'NOT',
  'SHL', 'SAL', 'SHR', 'SAR', 'ROL', 'ROR',
  'MUL', 'IMUL', 'DIV', 'IDIV',
  'CBW', 'CWDE', 'CWD', 'CDQ',
  'CLC', 'STC', 'CMC', 'CLD', 'STD', 'LAHF', 'SAHF',
  'MOVSB', 'MOVSW', 'MOVSD', 'STOSB', 'STOSW', 'STOSD',
  'LODSB', 'LODSW', 'LODSD', 'CMPSB', 'CMPSW', 'CMPSD', 'SCASB', 'SCASW', 'SCASD',
  'CMOVE', 'CMOVZ', 'CMOVNE', 'CMOVNZ', 'CMOVG', 'CMOVNLE', 'CMOVGE', 'CMOVNL',
  'CMOVL', 'CMOVNGE', 'CMOVLE', 'CMOVNG', 'CMOVA', 'CMOVNBE', 'CMOVAE', 'CMOVNB', 'CMOVNC',
  'CMOVB', 'CMOVNAE', 'CMOVC', 'CMOVBE', 'CMOVNA', 'CMOVS', 'CMOVNS',
  'SETE', 'SETZ', 'SETNE', 'SETNZ', 'SETG', 'SETNLE', 'SETGE', 'SETNL',
  'SETL', 'SETNGE', 'SETLE', 'SETNG', 'SETA', 'SETNBE', 'SETAE', 'SETNB', 'SETNC',
  'SETB', 'SETNAE', 'SETC', 'SETBE', 'SETNA', 'SETS', 'SETNS',
  'BT', 'BTS', 'BTR', 'BTC', 'BSF', 'BSR',
  'NOP', 'HLT', 'INT', 'SYSCALL',
];

/**
 * Encodes an instruction into variable-length x86 machine code bytes (1 to 11 bytes).
 */
export function encodeInstructionToBytes(inst: InstructionToEncode): number[] {
  const out: number[] = [];
  const { opcode, mnemonic, dest, src, imm2, repPrefix } = inst;

  if (repPrefix === 'REP' || repPrefix === 'REPE') {
    out.push(0xf3);
  } else if (repPrefix === 'REPNE') {
    out.push(0xf2);
  }

  // 1. Authentic 1-Byte Zero-Operand x86 Instructions
  if (opcode === OPCODES.NOP) return [...out, 0x90];
  if (opcode === OPCODES.HLT) return [...out, 0xf4];
  if (opcode === OPCODES.RET && dest.type === 'NONE') return [...out, 0xc3];
  if (opcode === OPCODES.RET_IMM) {
    out.push(0xc2);
    pushInt16LE(out, dest.imm ?? 0);
    return out;
  }
  if (opcode === OPCODES.LEAVE) return [...out, 0xc9];
  if (opcode === OPCODES.ENTER) {
    out.push(0xc8);
    pushInt16LE(out, dest.imm ?? 0);
    out.push((src.imm ?? 0) & 0xff);
    return out;
  }
  if (opcode === OPCODES.PUSHAD) return [...out, 0x60];
  if (opcode === OPCODES.POPAD) return [...out, 0x61];
  if (opcode === OPCODES.PUSHFD) return [...out, 0x9c];
  if (opcode === OPCODES.POPFD) return [...out, 0x9d];
  if (opcode === OPCODES.CBW) return [...out, 0x66, 0x98];
  if (opcode === OPCODES.CWDE) return [...out, 0x98];
  if (opcode === OPCODES.CWD) return [...out, 0x66, 0x99];
  if (opcode === OPCODES.CDQ) return [...out, 0x99];
  if (opcode === OPCODES.SAHF) return [...out, 0x9e];
  if (opcode === OPCODES.LAHF) return [...out, 0x9f];

  if (opcode === OPCODES.FLAG_OP) {
    const flagImm = dest.imm ?? 0;
    if (flagImm === 0) return [...out, 0xf8]; // CLC
    if (flagImm === 1) return [...out, 0xf9]; // STC
    if (flagImm === 2) return [...out, 0xf5]; // CMC
    if (flagImm === 3) return [...out, 0xfc]; // CLD
    if (flagImm === 4) return [...out, 0xfd]; // STD
  }

  if (opcode === OPCODES.STRING_OP) {
    switch (mnemonic) {
      case 'MOVSB': return [...out, 0xa4];
      case 'MOVSW': return [...out, 0x66, 0xa5];
      case 'MOVSD': return [...out, 0xa5];
      case 'STOSB': return [...out, 0xaa];
      case 'STOSW': return [...out, 0x66, 0xab];
      case 'STOSD': return [...out, 0xab];
      case 'LODSB': return [...out, 0xac];
      case 'LODSW': return [...out, 0x66, 0xad];
      case 'LODSD': return [...out, 0xad];
      case 'CMPSB': return [...out, 0xa6];
      case 'CMPSW': return [...out, 0x66, 0xa7];
      case 'CMPSD': return [...out, 0xa7];
      case 'SCASB': return [...out, 0xae];
      case 'SCASW': return [...out, 0x66, 0xaf];
      case 'SCASD': return [...out, 0xaf];
    }
  }

  // 2. Single-Byte Register Opcodes: PUSH/POP/INC/DEC reg32
  if (opcode === OPCODES.PUSH && isSimple32Reg(dest)) {
    return [...out, 0x50 + (dest.reg! & 0x07)];
  }
  if (opcode === OPCODES.POP && isSimple32Reg(dest)) {
    return [...out, 0x58 + (dest.reg! & 0x07)];
  }
  if (opcode === OPCODES.INC && isSimple32Reg(dest)) {
    return [...out, 0x40 + (dest.reg! & 0x07)];
  }
  if (opcode === OPCODES.DEC && isSimple32Reg(dest)) {
    return [...out, 0x48 + (dest.reg! & 0x07)];
  }

  // 3. PUSH Immediate (0x6A imm8 / 0x68 imm32)
  if (opcode === OPCODES.PUSH && dest.type === 'IMM') {
    const imm = toInt32(dest.imm ?? 0);
    if (fitsImm8(imm)) {
      return [...out, 0x6a, imm & 0xff];
    }
    out.push(0x68);
    pushInt32LE(out, imm);
    return out;
  }

  // 4. INT imm8 (0xCD imm8)
  if (opcode === OPCODES.SYSCALL) {
    return [...out, 0xcd, (dest.imm ?? 0x80) & 0xff];
  }

  // 5. MOV reg, imm (0xB0+r imm8, 0x66 0xB8+r imm16, 0xB8+r imm32)
  if (opcode === OPCODES.MOV_RI && dest.type === 'REG' && !dest.segReg && src.type === 'IMM') {
    const r = (dest.reg ?? 0) & 0x07;
    const imm = src.imm ?? 0;
    if (dest.is8Bit) {
      const regCode = dest.is8BitHigh ? r + 4 : r;
      return [...out, 0xb0 + (regCode & 0x07), imm & 0xff];
    }
    if (dest.is16Bit) {
      out.push(0x66, 0xb8 + r);
      pushInt16LE(out, imm);
      return out;
    }
    out.push(0xb8 + r);
    pushInt32LE(out, imm);
    return out;
  }

  // 6. Standard 32-bit Reg-to-Reg Operations (2 bytes: Opcode + ModR/M)
  if (isSimple32Reg(dest) && isSimple32Reg(src)) {
    const modrm = 0xc0 | ((src.reg! & 0x07) << 3) | (dest.reg! & 0x07);
    switch (opcode) {
      case OPCODES.MOV_RR: return [...out, 0x89, modrm];
      case OPCODES.ADD_RR: return [...out, 0x01, modrm];
      case OPCODES.OR_RR:  return [...out, 0x09, modrm];
      case OPCODES.ADC_RR: return [...out, 0x11, modrm];
      case OPCODES.SBB_RR: return [...out, 0x19, modrm];
      case OPCODES.AND_RR: return [...out, 0x21, modrm];
      case OPCODES.SUB_RR: return [...out, 0x29, modrm];
      case OPCODES.XOR_RR: return [...out, 0x31, modrm];
      case OPCODES.CMP_RR: return [...out, 0x39, modrm];
      case OPCODES.TEST_RR: return [...out, 0x85, modrm];
    }
  }

  // 7. Standard 32-bit Reg-Immediate ALU Operations (0x83 /digit imm8 or 0x81 /digit imm32)
  if (isSimple32Reg(dest) && src.type === 'IMM') {
    let digit = -1;
    if (opcode === OPCODES.ADD_RI) digit = 0;
    else if (opcode === OPCODES.OR_RI) digit = 1;
    else if (opcode === OPCODES.ADC_RI) digit = 2;
    else if (opcode === OPCODES.SBB_RI) digit = 3;
    else if (opcode === OPCODES.AND_RI) digit = 4;
    else if (opcode === OPCODES.SUB_RI) digit = 5;
    else if (opcode === OPCODES.XOR_RI) digit = 6;
    else if (opcode === OPCODES.CMP_RI) digit = 7;

    if (digit !== -1) {
      const imm = toInt32(src.imm ?? 0);
      const modrm = 0xc0 | (digit << 3) | (dest.reg! & 0x07);
      if (fitsImm8(imm)) {
        return [...out, 0x83, modrm, imm & 0xff];
      }
      out.push(0x81, modrm);
      pushInt32LE(out, imm);
      return out;
    }
  }

  // 8. Standard 32-bit MOV / LEA with ModR/M + SIB
  if (opcode === OPCODES.MOV_RM && isSimple32Reg(dest) && isStandard32Mem(src)) {
    out.push(0x8b);
    encodeModRMAndSIB(out, dest.reg!, src);
    return out;
  }
  if (opcode === OPCODES.MOV_MR && isStandard32Mem(dest) && isSimple32Reg(src)) {
    out.push(0x89);
    encodeModRMAndSIB(out, src.reg!, dest);
    return out;
  }
  if (opcode === OPCODES.LEA && isSimple32Reg(dest) && src.type === 'MEM') {
    out.push(0x8d);
    encodeModRMAndSIB(out, dest.reg!, src);
    return out;
  }

  // 9. Branches, Loops, and CALL (5 bytes: primary x86 opcode + 32-bit target address)
  const targetAddr = dest.imm ?? 0;
  if (opcode === OPCODES.CALL && dest.type === 'IMM') {
    out.push(0xe8);
    pushInt32LE(out, targetAddr);
    return out;
  }
  if (opcode === OPCODES.JMP && dest.type === 'IMM') {
    out.push(0xe9);
    pushInt32LE(out, targetAddr);
    return out;
  }
  if (opcode === OPCODES.LOOP) {
    out.push(0xe2);
    pushInt32LE(out, targetAddr);
    return out;
  }
  if (opcode === OPCODES.LOOPE) {
    out.push(0xe1);
    pushInt32LE(out, targetAddr);
    return out;
  }
  if (opcode === OPCODES.LOOPNE) {
    out.push(0xe0);
    pushInt32LE(out, targetAddr);
    return out;
  }
  if (opcode === OPCODES.JECXZ) {
    out.push(0xe3);
    pushInt32LE(out, targetAddr);
    return out;
  }

  const jccMap: Partial<Record<number, number>> = {
    [OPCODES.JO]: 0x70,
    [OPCODES.JNO]: 0x71,
    [OPCODES.JB]: 0x72,
    [OPCODES.JAE]: 0x73,
    [OPCODES.JE]: 0x74,
    [OPCODES.JNE]: 0x75,
    [OPCODES.JBE]: 0x76,
    [OPCODES.JA]: 0x77,
    [OPCODES.JS]: 0x78,
    [OPCODES.JNS]: 0x79,
    [OPCODES.JL]: 0x7c,
    [OPCODES.JGE]: 0x7d,
    [OPCODES.JLE]: 0x7e,
    [OPCODES.JG]: 0x7f,
  };
  if (opcode in jccMap) {
    out.push(jccMap[opcode]!);
    pushInt32LE(out, targetAddr);
    return out;
  }

  // 10. Universal 0x0F Extended x86 Encoding for all remaining CISC variants
  out.push(0x0f);
  out.push(opcode & 0xff);
  const mnemIdx = Math.max(0, MNEMONIC_LIST.indexOf(mnemonic));
  out.push(mnemIdx & 0xff);
  encodeExtendedOperand(out, dest);
  encodeExtendedOperand(out, src);
  if (imm2 !== undefined) {
    out.push(0x01);
    pushInt32LE(out, imm2);
  } else {
    out.push(0x00);
  }
  return out;
}

function finalizeDecoded(
  bytes: Uint8Array | number[],
  startOffset: number,
  endOffset: number,
  mnemonic: Mnemonic,
  opcode: number,
  dest: Operand,
  src: Operand,
  assemblyString: string,
  repPrefix?: 'REP' | 'REPE' | 'REPNE',
  imm2?: number
): DecodedInstruction {
  const slice = Array.from(bytes.slice(startOffset, endOffset));
  const b0 = slice[0] ?? 0;
  const b1 = slice[1] ?? 0;
  const b2 = slice[2] ?? 0;
  const b3 = slice[3] ?? 0;
  const raw = ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
  const fullAsm = repPrefix ? `${repPrefix} ${assemblyString}` : assemblyString;

  return {
    raw,
    bytes: slice,
    byteLength: Math.max(1, endOffset - startOffset),
    repPrefix,
    mnemonic,
    opcode,
    dest,
    src,
    imm2,
    assemblyString: fullAsm,
  };
}

/**
 * Decodes a variable-length x86 instruction from a byte buffer at `offset`.
 */
export function decodeInstructionFromBytes(
  bytes: Uint8Array | number[],
  offset: number = 0
): DecodedInstruction {
  const start = offset;
  if (offset >= bytes.length) {
    return finalizeDecoded(
      [0xf4],
      0,
      1,
      'HLT',
      OPCODES.HLT,
      { type: 'NONE', rawString: '' },
      { type: 'NONE', rawString: '' },
      'HLT'
    );
  }

  let cur = offset;
  let repPrefix: 'REP' | 'REPE' | 'REPNE' | undefined = undefined;
  let has66Prefix = false;

  // Check prefixes
  while (cur < bytes.length) {
    const p = bytes[cur];
    if (p === 0xf3) {
      repPrefix = 'REP';
      cur++;
    } else if (p === 0xf2) {
      repPrefix = 'REPNE';
      cur++;
    } else if (p === 0x66) {
      has66Prefix = true;
      cur++;
    } else {
      break;
    }
  }

  const b0 = bytes[cur] ?? 0xf4;
  cur++;

  const noneOp: Operand = { type: 'NONE', rawString: '' };

  // 1-Byte Zero-Operand Opcodes
  switch (b0) {
    case 0x90:
      return finalizeDecoded(bytes, start, cur, 'NOP', OPCODES.NOP, noneOp, noneOp, 'NOP', repPrefix);
    case 0xf4:
      return finalizeDecoded(bytes, start, cur, 'HLT', OPCODES.HLT, noneOp, noneOp, 'HLT', repPrefix);
    case 0xc3:
      return finalizeDecoded(bytes, start, cur, 'RET', OPCODES.RET, noneOp, noneOp, 'RET', repPrefix);
    case 0xc2: {
      const imm16 = readUint16LE(bytes, cur);
      cur += 2;
      const dOp: Operand = { type: 'IMM', imm: imm16, rawString: String(imm16) };
      return finalizeDecoded(bytes, start, cur, 'RET', OPCODES.RET_IMM, dOp, noneOp, `RET ${imm16}`, repPrefix);
    }
    case 0xc9:
      return finalizeDecoded(bytes, start, cur, 'LEAVE', OPCODES.LEAVE, noneOp, noneOp, 'LEAVE', repPrefix);
    case 0xc8: {
      const frameSize = readUint16LE(bytes, cur);
      const level = bytes[cur + 2] ?? 0;
      cur += 3;
      const dOp: Operand = { type: 'IMM', imm: frameSize, rawString: String(frameSize) };
      const sOp: Operand = { type: 'IMM', imm: level, rawString: String(level) };
      return finalizeDecoded(bytes, start, cur, 'ENTER', OPCODES.ENTER, dOp, sOp, `ENTER ${frameSize}, ${level}`, repPrefix);
    }
    case 0x60:
      return finalizeDecoded(bytes, start, cur, 'PUSHAD', OPCODES.PUSHAD, noneOp, noneOp, 'PUSHAD', repPrefix);
    case 0x61:
      return finalizeDecoded(bytes, start, cur, 'POPAD', OPCODES.POPAD, noneOp, noneOp, 'POPAD', repPrefix);
    case 0x9c:
      return finalizeDecoded(bytes, start, cur, 'PUSHFD', OPCODES.PUSHFD, noneOp, noneOp, 'PUSHFD', repPrefix);
    case 0x9d:
      return finalizeDecoded(bytes, start, cur, 'POPFD', OPCODES.POPFD, noneOp, noneOp, 'POPFD', repPrefix);
    case 0x98: {
      const m: Mnemonic = has66Prefix ? 'CBW' : 'CWDE';
      const op = has66Prefix ? OPCODES.CBW : OPCODES.CWDE;
      return finalizeDecoded(bytes, start, cur, m, op, noneOp, noneOp, m, repPrefix);
    }
    case 0x99: {
      const m: Mnemonic = has66Prefix ? 'CWD' : 'CDQ';
      const op = has66Prefix ? OPCODES.CWD : OPCODES.CDQ;
      return finalizeDecoded(bytes, start, cur, m, op, noneOp, noneOp, m, repPrefix);
    }
    case 0x9e:
      return finalizeDecoded(bytes, start, cur, 'SAHF', OPCODES.SAHF, noneOp, noneOp, 'SAHF', repPrefix);
    case 0x9f:
      return finalizeDecoded(bytes, start, cur, 'LAHF', OPCODES.LAHF, noneOp, noneOp, 'LAHF', repPrefix);
    case 0xf8:
      return finalizeDecoded(bytes, start, cur, 'CLC', OPCODES.FLAG_OP, { type: 'IMM', imm: 0, rawString: '0' }, noneOp, 'CLC', repPrefix);
    case 0xf9:
      return finalizeDecoded(bytes, start, cur, 'STC', OPCODES.FLAG_OP, { type: 'IMM', imm: 1, rawString: '1' }, noneOp, 'STC', repPrefix);
    case 0xf5:
      return finalizeDecoded(bytes, start, cur, 'CMC', OPCODES.FLAG_OP, { type: 'IMM', imm: 2, rawString: '2' }, noneOp, 'CMC', repPrefix);
    case 0xfc:
      return finalizeDecoded(bytes, start, cur, 'CLD', OPCODES.FLAG_OP, { type: 'IMM', imm: 3, rawString: '3' }, noneOp, 'CLD', repPrefix);
    case 0xfd:
      return finalizeDecoded(bytes, start, cur, 'STD', OPCODES.FLAG_OP, { type: 'IMM', imm: 4, rawString: '4' }, noneOp, 'STD', repPrefix);
    case 0xa4:
      return finalizeDecoded(bytes, start, cur, 'MOVSB', OPCODES.STRING_OP, noneOp, noneOp, 'MOVSB', repPrefix);
    case 0xa5: {
      const m: Mnemonic = has66Prefix ? 'MOVSW' : 'MOVSD';
      return finalizeDecoded(bytes, start, cur, m, OPCODES.STRING_OP, noneOp, noneOp, m, repPrefix);
    }
    case 0xaa:
      return finalizeDecoded(bytes, start, cur, 'STOSB', OPCODES.STRING_OP, noneOp, noneOp, 'STOSB', repPrefix);
    case 0xab: {
      const m: Mnemonic = has66Prefix ? 'STOSW' : 'STOSD';
      return finalizeDecoded(bytes, start, cur, m, OPCODES.STRING_OP, noneOp, noneOp, m, repPrefix);
    }
    case 0xac:
      return finalizeDecoded(bytes, start, cur, 'LODSB', OPCODES.STRING_OP, noneOp, noneOp, 'LODSB', repPrefix);
    case 0xad: {
      const m: Mnemonic = has66Prefix ? 'LODSW' : 'LODSD';
      return finalizeDecoded(bytes, start, cur, m, OPCODES.STRING_OP, noneOp, noneOp, m, repPrefix);
    }
    case 0xa6:
      return finalizeDecoded(bytes, start, cur, 'CMPSB', OPCODES.STRING_OP, noneOp, noneOp, 'CMPSB', repPrefix);
    case 0xa7: {
      const m: Mnemonic = has66Prefix ? 'CMPSW' : 'CMPSD';
      return finalizeDecoded(bytes, start, cur, m, OPCODES.STRING_OP, noneOp, noneOp, m, repPrefix);
    }
    case 0xae:
      return finalizeDecoded(bytes, start, cur, 'SCASB', OPCODES.STRING_OP, noneOp, noneOp, 'SCASB', repPrefix);
    case 0xaf: {
      const m: Mnemonic = has66Prefix ? 'SCASW' : 'SCASD';
      return finalizeDecoded(bytes, start, cur, m, OPCODES.STRING_OP, noneOp, noneOp, m, repPrefix);
    }
  }

  // Single-byte register INC / DEC / PUSH / POP (0x40 - 0x5F)
  if (b0 >= 0x40 && b0 <= 0x47) {
    const reg = (b0 - 0x40) as RegisterId;
    const dOp: Operand = { type: 'REG', reg, rawString: REGISTER_NAMES[reg] };
    return finalizeDecoded(bytes, start, cur, 'INC', OPCODES.INC, dOp, noneOp, `INC ${REGISTER_NAMES[reg]}`);
  }
  if (b0 >= 0x48 && b0 <= 0x4f) {
    const reg = (b0 - 0x48) as RegisterId;
    const dOp: Operand = { type: 'REG', reg, rawString: REGISTER_NAMES[reg] };
    return finalizeDecoded(bytes, start, cur, 'DEC', OPCODES.DEC, dOp, noneOp, `DEC ${REGISTER_NAMES[reg]}`);
  }
  if (b0 >= 0x50 && b0 <= 0x57) {
    const reg = (b0 - 0x50) as RegisterId;
    const dOp: Operand = { type: 'REG', reg, rawString: REGISTER_NAMES[reg] };
    return finalizeDecoded(bytes, start, cur, 'PUSH', OPCODES.PUSH, dOp, noneOp, `PUSH ${REGISTER_NAMES[reg]}`);
  }
  if (b0 >= 0x58 && b0 <= 0x5f) {
    const reg = (b0 - 0x58) as RegisterId;
    const dOp: Operand = { type: 'REG', reg, rawString: REGISTER_NAMES[reg] };
    return finalizeDecoded(bytes, start, cur, 'POP', OPCODES.POP, dOp, noneOp, `POP ${REGISTER_NAMES[reg]}`);
  }

  // PUSH imm8 (0x6A) / PUSH imm32 (0x68)
  if (b0 === 0x6a) {
    const imm = signExtend8(bytes[cur] ?? 0);
    cur += 1;
    const dOp: Operand = { type: 'IMM', imm, rawString: String(imm) };
    return finalizeDecoded(bytes, start, cur, 'PUSH', OPCODES.PUSH, dOp, noneOp, `PUSH ${imm}`);
  }
  if (b0 === 0x68) {
    const imm = toInt32(readUint32LE(bytes, cur));
    cur += 4;
    const dOp: Operand = { type: 'IMM', imm, rawString: String(imm) };
    return finalizeDecoded(bytes, start, cur, 'PUSH', OPCODES.PUSH, dOp, noneOp, `PUSH ${imm}`);
  }

  // INT imm8 (0xCD)
  if (b0 === 0xcd) {
    const intNum = (bytes[cur] ?? 0x80) & 0xff;
    cur += 1;
    const dOp: Operand = { type: 'IMM', imm: intNum, rawString: toHex8(intNum) };
    const asm = intNum === 0x80 ? 'INT 0x80' : `INT 0x${intNum.toString(16).toUpperCase()}`;
    return finalizeDecoded(bytes, start, cur, 'INT', OPCODES.SYSCALL, dOp, noneOp, asm);
  }

  // MOV reg8, imm8 (0xB0 - 0xB7)
  if (b0 >= 0xb0 && b0 <= 0xb7) {
    const rCode = b0 - 0xb0;
    const isHigh = rCode >= 4;
    const reg = (isHigh ? rCode - 4 : rCode) as RegisterId;
    const imm = signExtend8(bytes[cur] ?? 0);
    cur += 1;
    const regName = isHigh ? BYTE_HIGH_REGISTER_NAMES[reg] : BYTE_REGISTER_NAMES[reg];
    const dOp: Operand = { type: 'REG', reg, is8Bit: true, is8BitHigh: isHigh, rawString: regName };
    const sOp: Operand = { type: 'IMM', imm, rawString: String(imm) };
    return finalizeDecoded(bytes, start, cur, 'MOV', OPCODES.MOV_RI, dOp, sOp, `MOV ${regName}, ${imm}`);
  }

  // MOV reg16/32, imm16/32 (0xB8 - 0xBF)
  if (b0 >= 0xb8 && b0 <= 0xbf) {
    const reg = (b0 - 0xb8) as RegisterId;
    if (has66Prefix) {
      const imm = signExtend16(readUint16LE(bytes, cur));
      cur += 2;
      const regName = SUB_REGISTER_NAMES[reg];
      const dOp: Operand = { type: 'REG', reg, is16Bit: true, rawString: regName };
      const sOp: Operand = { type: 'IMM', imm, rawString: String(imm) };
      return finalizeDecoded(bytes, start, cur, 'MOV', OPCODES.MOV_RI, dOp, sOp, `MOV ${regName}, ${imm}`);
    }
    const imm = toInt32(readUint32LE(bytes, cur));
    cur += 4;
    const regName = REGISTER_NAMES[reg];
    const dOp: Operand = { type: 'REG', reg, rawString: regName };
    const sOp: Operand = { type: 'IMM', imm, rawString: String(imm) };
    return finalizeDecoded(bytes, start, cur, 'MOV', OPCODES.MOV_RI, dOp, sOp, `MOV ${regName}, ${imm}`);
  }

  // Standard 32-bit Reg-Immediate ALU (0x83 imm8 / 0x81 imm32)
  if (b0 === 0x83 || b0 === 0x81) {
    const modrm = bytes[cur] ?? 0;
    cur += 1;
    const digit = (modrm >>> 3) & 0x07;
    const reg = (modrm & 0x07) as RegisterId;
    const imm = b0 === 0x83 ? signExtend8(bytes[cur] ?? 0) : toInt32(readUint32LE(bytes, cur));
    cur += b0 === 0x83 ? 1 : 4;

    const mapOp: { m: Mnemonic; op: number }[] = [
      { m: 'ADD', op: OPCODES.ADD_RI },
      { m: 'OR', op: OPCODES.OR_RI },
      { m: 'ADC', op: OPCODES.ADC_RI },
      { m: 'SBB', op: OPCODES.SBB_RI },
      { m: 'AND', op: OPCODES.AND_RI },
      { m: 'SUB', op: OPCODES.SUB_RI },
      { m: 'XOR', op: OPCODES.XOR_RI },
      { m: 'CMP', op: OPCODES.CMP_RI },
    ];
    const entry = mapOp[digit] ?? mapOp[0];
    const regName = REGISTER_NAMES[reg];
    const dOp: Operand = { type: 'REG', reg, rawString: regName };
    const sOp: Operand = { type: 'IMM', imm, rawString: String(imm) };
    return finalizeDecoded(bytes, start, cur, entry.m, entry.op, dOp, sOp, `${entry.m} ${regName}, ${imm}`);
  }

  // Standard 32-bit Reg-Reg ALU & MOV (0x01, 0x09, 0x11, 0x19, 0x21, 0x29, 0x31, 0x39, 0x85)
  const rrMap: Partial<Record<number, { m: Mnemonic; op: number }>> = {
    0x01: { m: 'ADD', op: OPCODES.ADD_RR },
    0x09: { m: 'OR', op: OPCODES.OR_RR },
    0x11: { m: 'ADC', op: OPCODES.ADC_RR },
    0x19: { m: 'SBB', op: OPCODES.SBB_RR },
    0x21: { m: 'AND', op: OPCODES.AND_RR },
    0x29: { m: 'SUB', op: OPCODES.SUB_RR },
    0x31: { m: 'XOR', op: OPCODES.XOR_RR },
    0x39: { m: 'CMP', op: OPCODES.CMP_RR },
    0x85: { m: 'TEST', op: OPCODES.TEST_RR },
  };
  if (b0 in rrMap) {
    const info = rrMap[b0]!;
    const decodedMod = decodeModRMAndSIB(bytes, cur);
    cur = decodedMod.nextOffset;
    const dName = REGISTER_NAMES[decodedMod.rmReg];
    const sName = REGISTER_NAMES[decodedMod.regField];
    const dOp: Operand = { type: 'REG', reg: decodedMod.rmReg, rawString: dName };
    const sOp: Operand = { type: 'REG', reg: decodedMod.regField, rawString: sName };
    return finalizeDecoded(bytes, start, cur, info.m, info.op, dOp, sOp, `${info.m} ${dName}, ${sName}`);
  }

  // 0x89: MOV reg32, reg32 OR MOV [mem], reg32
  if (b0 === 0x89) {
    const decodedMod = decodeModRMAndSIB(bytes, cur);
    cur = decodedMod.nextOffset;
    const sName = REGISTER_NAMES[decodedMod.regField];
    const sOp: Operand = { type: 'REG', reg: decodedMod.regField, rawString: sName };
    if (decodedMod.isRegMode) {
      const dName = REGISTER_NAMES[decodedMod.rmReg];
      const dOp: Operand = { type: 'REG', reg: decodedMod.rmReg, rawString: dName };
      return finalizeDecoded(bytes, start, cur, 'MOV', OPCODES.MOV_RR, dOp, sOp, `MOV ${dName}, ${sName}`);
    }
    const memOp = decodedMod.memOperand;
    return finalizeDecoded(bytes, start, cur, 'MOV', OPCODES.MOV_MR, memOp, sOp, `MOV ${memOp.rawString}, ${sName}`);
  }

  // 0x8B: MOV reg32, [mem]
  if (b0 === 0x8b) {
    const decodedMod = decodeModRMAndSIB(bytes, cur);
    cur = decodedMod.nextOffset;
    const dName = REGISTER_NAMES[decodedMod.regField];
    const dOp: Operand = { type: 'REG', reg: decodedMod.regField, rawString: dName };
    const memOp = decodedMod.memOperand;
    return finalizeDecoded(bytes, start, cur, 'MOV', OPCODES.MOV_RM, dOp, memOp, `MOV ${dName}, ${memOp.rawString}`);
  }

  // 0x8D: LEA reg32, [mem]
  if (b0 === 0x8d) {
    const decodedMod = decodeModRMAndSIB(bytes, cur);
    cur = decodedMod.nextOffset;
    const dName = REGISTER_NAMES[decodedMod.regField];
    const dOp: Operand = { type: 'REG', reg: decodedMod.regField, rawString: dName };
    const memOp = decodedMod.memOperand;
    return finalizeDecoded(bytes, start, cur, 'LEA', OPCODES.LEA, dOp, memOp, `LEA ${dName}, ${memOp.rawString}`);
  }

  // Branches, CALL, LOOP (0xE8, 0xE9, 0xE2, 0xE1, 0xE0, 0xE3, 0x70-0x7F)
  const branchByteMap: Partial<Record<number, { m: Mnemonic; op: number }>> = {
    0xe8: { m: 'CALL', op: OPCODES.CALL },
    0xe9: { m: 'JMP', op: OPCODES.JMP },
    0xe2: { m: 'LOOP', op: OPCODES.LOOP },
    0xe1: { m: 'LOOPE', op: OPCODES.LOOPE },
    0xe0: { m: 'LOOPNE', op: OPCODES.LOOPNE },
    0xe3: { m: 'JECXZ', op: OPCODES.JECXZ },
    0x70: { m: 'JO', op: OPCODES.JO },
    0x71: { m: 'JNO', op: OPCODES.JNO },
    0x72: { m: 'JB', op: OPCODES.JB },
    0x73: { m: 'JAE', op: OPCODES.JAE },
    0x74: { m: 'JE', op: OPCODES.JE },
    0x75: { m: 'JNE', op: OPCODES.JNE },
    0x76: { m: 'JBE', op: OPCODES.JBE },
    0x77: { m: 'JA', op: OPCODES.JA },
    0x78: { m: 'JS', op: OPCODES.JS },
    0x79: { m: 'JNS', op: OPCODES.JNS },
    0x7c: { m: 'JL', op: OPCODES.JL },
    0x7d: { m: 'JGE', op: OPCODES.JGE },
    0x7e: { m: 'JLE', op: OPCODES.JLE },
    0x7f: { m: 'JG', op: OPCODES.JG },
  };
  if (b0 in branchByteMap) {
    const info = branchByteMap[b0]!;
    const target = readUint32LE(bytes, cur);
    cur += 4;
    const hexTarget = `0x${target.toString(16).padStart(4, '0').toUpperCase()}`;
    const dOp: Operand = { type: 'IMM', imm: target, rawString: hexTarget };
    return finalizeDecoded(bytes, start, cur, info.m, info.op, dOp, noneOp, `${info.m} ${hexTarget}`);
  }

  // Universal 0x0F Extended CISC Encoding
  if (b0 === 0x0f) {
    const op = bytes[cur] ?? OPCODES.NOP;
    const mnemIdx = bytes[cur + 1] ?? 0;
    cur += 2;
    const mnemonic: Mnemonic = MNEMONIC_LIST[mnemIdx] ?? 'MOV';
    const dDec = decodeExtendedOperand(bytes, cur);
    cur = dDec.nextOffset;
    const sDec = decodeExtendedOperand(bytes, cur);
    cur = sDec.nextOffset;
    const hasImm2 = (bytes[cur] ?? 0) === 1;
    cur += 1;
    let imm2: number | undefined = undefined;
    if (hasImm2) {
      imm2 = toInt32(readUint32LE(bytes, cur));
      cur += 4;
    }

    let asm = `${mnemonic}`;
    if (dDec.operand.type !== 'NONE' && sDec.operand.type !== 'NONE') {
      if (imm2 !== undefined) {
        asm = `${mnemonic} ${dDec.operand.rawString}, ${sDec.operand.rawString}, ${imm2}`;
      } else {
        asm = `${mnemonic} ${dDec.operand.rawString}, ${sDec.operand.rawString}`;
      }
    } else if (dDec.operand.type !== 'NONE') {
      asm = `${mnemonic} ${dDec.operand.rawString}`;
    } else if (sDec.operand.type !== 'NONE') {
      asm = `${mnemonic} ${sDec.operand.rawString}`;
    }

    return finalizeDecoded(bytes, start, cur, mnemonic, op, dDec.operand, sDec.operand, asm, repPrefix, imm2);
  }

  // Fallback
  return finalizeDecoded(bytes, start, cur, 'HLT', OPCODES.HLT, noneOp, noneOp, 'HLT', repPrefix);
}

/**
 * Legacy helper: decodes a 32-bit word as a 4-byte little-endian sequence.
 */
export function decodeInstruction(raw: number): DecodedInstruction {
  const u32 = raw >>> 0;
  const bytes = [
    u32 & 0xff,
    (u32 >>> 8) & 0xff,
    (u32 >>> 16) & 0xff,
    (u32 >>> 24) & 0xff,
  ];
  return decodeInstructionFromBytes(bytes, 0);
}
