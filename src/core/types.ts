// PulseCISC-32 Core Type Definitions

export type CPUPhase = 'FETCH' | 'DECODE' | 'EXECUTE' | 'MEMORY' | 'WRITEBACK' | 'HALTED';

export type Mnemonic =
  | 'MOV'
  | 'ADD'
  | 'SUB'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'CMP'
  | 'JE'
  | 'JNE'
  | 'JMP'
  | 'HLT';

export type RegisterId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RegisterName =
  | 'EAX'
  | 'EBX'
  | 'ECX'
  | 'EDX'
  | 'ESI'
  | 'EDI'
  | 'EBP'
  | 'ESP';

export type SubRegisterName =
  | 'AX'
  | 'BX'
  | 'CX'
  | 'DX'
  | 'SI'
  | 'DI'
  | 'BP'
  | 'SP';

export interface EFLAGS {
  zf: boolean; // Zero flag
  sf: boolean; // Sign flag (negative)
  of: boolean; // Overflow flag
}

export type OperandType = 'REG' | 'IMM' | 'MEM' | 'NONE';

export interface Operand {
  type: OperandType;
  reg?: RegisterId;
  is16Bit?: boolean;
  imm?: number;
  memBaseReg?: RegisterId;
  memOffset?: number;
  label?: string;
  rawString: string;
}

export interface DecodedInstruction {
  raw: number;
  mnemonic: Mnemonic;
  opcode: number;
  dest: Operand;
  src: Operand;
  assemblyString: string;
}

export type ActiveBusId =
  | 'EIP_TO_MAR'
  | 'MAR_TO_CODE_MEM'
  | 'CODE_MEM_TO_IR'
  | 'EIP_INCREMENT'
  | 'IR_TO_CU'
  | 'IR_TO_REG_READ'
  | 'REGS_TO_LATCHES'
  | 'LATCHES_TO_ALU'
  | 'IMM_TO_ALU'
  | 'ALU_TO_ALU_OUT'
  | 'ALU_TO_FLAGS'
  | 'BRANCH_TARGET_TO_EIP'
  | 'JUMP_TARGET_TO_EIP'
  | 'ALU_OUT_TO_MAR'
  | 'MEM_TO_MDR'
  | 'LATCH_TO_MDR'
  | 'MDR_TO_DATA_MEM'
  | 'ALU_OUT_TO_REG_WB'
  | 'MDR_TO_REG_WB'
  | 'IMM_TO_REG_WB';

export interface TraceRecord {
  id: number;
  cycle: number;
  instructionCount: number;
  eip: number;
  phase: CPUPhase;
  microOp: string;
  details: string;
  activeBuses: ActiveBusId[];
  timestamp: number;
}

export interface CPUMicroState {
  eip: number;
  ir: number;
  mar: number;
  mdr: number;
  aluOut: number;
  latchA: number;
  latchB: number;
  registers: Uint32Array; // 8 registers: EAX(0) to ESP(7)
  flags: EFLAGS;
  phase: CPUPhase;
  decoded: DecodedInstruction | null;
  activeBuses: ActiveBusId[];
  cycles: number;
  instructionCount: number;
  halted: boolean;
  lastModifiedReg: RegisterId | null;
  lastModifiedMem: number | null;
}

export interface AssembledProgram {
  codeBytes: Uint8Array;
  sourceLines: string[];
  lineAddresses: Map<number, number>; // source line (0-indexed) -> byte address
  addressToLine: Map<number, number>; // byte address -> source line (0-indexed)
  labels: Map<string, number>; // label -> byte address
  errors: AssemblyError[];
  warnings: string[];
}

export interface AssemblyError {
  line: number; // 1-indexed
  message: string;
}
