// PulseCISC-32 Core Type Definitions

export type CPUPhase = 'FETCH' | 'DECODE' | 'EXECUTE' | 'MEMORY' | 'WRITEBACK' | 'HALTED';

export type Mnemonic =
  | 'MOV'
  | 'MOVB'
  | 'MOVW'
  | 'MOVH'
  | 'MOVZX'
  | 'MOVSX'
  | 'ADD'
  | 'ADC'
  | 'SUB'
  | 'SBB'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'CMP'
  | 'TEST'
  | 'JE'
  | 'JZ'
  | 'JNE'
  | 'JNZ'
  | 'JL'
  | 'JNGE'
  | 'JLE'
  | 'JNG'
  | 'JG'
  | 'JNLE'
  | 'JGE'
  | 'JNL'
  | 'JB'
  | 'JC'
  | 'JNAE'
  | 'JBE'
  | 'JNA'
  | 'JA'
  | 'JNBE'
  | 'JAE'
  | 'JNC'
  | 'JNB'
  | 'JS'
  | 'JNS'
  | 'JO'
  | 'JNO'
  | 'JMP'
  | 'JECXZ'
  | 'JCXZ'
  | 'LOOP'
  | 'LOOPE'
  | 'LOOPZ'
  | 'LOOPNE'
  | 'LOOPNZ'
  | 'CALL'
  | 'RET'
  | 'ENTER'
  | 'LEAVE'
  | 'PUSH'
  | 'POP'
  | 'PUSHAD'
  | 'POPAD'
  | 'PUSHA'
  | 'POPA'
  | 'PUSHFD'
  | 'POPFD'
  | 'PUSHF'
  | 'POPF'
  | 'LEA'
  | 'XCHG'
  | 'XADD'
  | 'CMPXCHG'
  | 'BSWAP'
  | 'INC'
  | 'DEC'
  | 'NEG'
  | 'NOT'
  | 'SHL'
  | 'SAL'
  | 'SHR'
  | 'SAR'
  | 'ROL'
  | 'ROR'
  | 'MUL'
  | 'IMUL'
  | 'DIV'
  | 'IDIV'
  | 'CBW'
  | 'CWDE'
  | 'CWD'
  | 'CDQ'
  | 'CLC'
  | 'STC'
  | 'CMC'
  | 'CLD'
  | 'STD'
  | 'LAHF'
  | 'SAHF'
  | 'MOVSB'
  | 'MOVSW'
  | 'MOVSD'
  | 'STOSB'
  | 'STOSW'
  | 'STOSD'
  | 'LODSB'
  | 'LODSW'
  | 'LODSD'
  | 'CMPSB'
  | 'CMPSW'
  | 'CMPSD'
  | 'SCASB'
  | 'SCASW'
  | 'SCASD'
  | 'CMOVE'
  | 'CMOVZ'
  | 'CMOVNE'
  | 'CMOVNZ'
  | 'CMOVG'
  | 'CMOVNLE'
  | 'CMOVGE'
  | 'CMOVNL'
  | 'CMOVL'
  | 'CMOVNGE'
  | 'CMOVLE'
  | 'CMOVNG'
  | 'CMOVA'
  | 'CMOVNBE'
  | 'CMOVAE'
  | 'CMOVNB'
  | 'CMOVNC'
  | 'CMOVB'
  | 'CMOVNAE'
  | 'CMOVC'
  | 'CMOVBE'
  | 'CMOVNA'
  | 'CMOVS'
  | 'CMOVNS'
  | 'SETE'
  | 'SETZ'
  | 'SETNE'
  | 'SETNZ'
  | 'SETG'
  | 'SETNLE'
  | 'SETGE'
  | 'SETNL'
  | 'SETL'
  | 'SETNGE'
  | 'SETLE'
  | 'SETNG'
  | 'SETA'
  | 'SETNBE'
  | 'SETAE'
  | 'SETNB'
  | 'SETNC'
  | 'SETB'
  | 'SETNAE'
  | 'SETC'
  | 'SETBE'
  | 'SETNA'
  | 'SETS'
  | 'SETNS'
  | 'BT'
  | 'BTS'
  | 'BTR'
  | 'BTC'
  | 'BSF'
  | 'BSR'
  | 'NOP'
  | 'HLT'
  | 'PRINT'
  | 'INT'
  | 'SYSCALL';

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

export type ByteRegisterName =
  | 'AL'
  | 'BL'
  | 'CL'
  | 'DL'
  | 'AH'
  | 'BH'
  | 'CH'
  | 'DH';

export type SegmentRegisterName = 'CS' | 'DS' | 'SS' | 'ES' | 'FS' | 'GS';

export interface SegmentRegisters {
  cs: number;
  ds: number;
  ss: number;
  es: number;
  fs: number;
  gs: number;
}

export interface EFLAGS {
  zf: boolean; // Zero flag
  sf: boolean; // Sign flag (negative)
  of: boolean; // Overflow flag
  cf: boolean; // Carry flag (unsigned overflow / borrow)
  df?: boolean; // Direction flag (0 = forward, 1 = backward for string ops)
}

export type OperandType = 'REG' | 'IMM' | 'MEM' | 'NONE';

export interface Operand {
  type: OperandType;
  reg?: RegisterId;
  is16Bit?: boolean;
  is8Bit?: boolean;
  is8BitHigh?: boolean;
  segReg?: SegmentRegisterName;
  imm?: number;
  memBaseReg?: RegisterId;
  memIndexReg?: RegisterId;
  memScale?: 1 | 2 | 4 | 8;
  memOffset?: number;
  isDirect?: boolean;
  isByte?: boolean;
  isWord?: boolean;
  segmentOverride?: SegmentRegisterName;
  label?: string;
  stringPayload?: string;
  rawString: string;
}

export interface ConsoleOutputEntry {
  id: number;
  cycle: number;
  type: 'output' | 'info' | 'system';
  text: string;
  timestamp: number;
}

export interface DecodedInstruction {
  raw: number;
  bytes?: number[];
  byteLength?: number;
  repPrefix?: 'REP' | 'REPE' | 'REPNE';
  mnemonic: Mnemonic;
  opcode: number;
  dest: Operand;
  src: Operand;
  imm2?: number;
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
  | 'IMM_TO_REG_WB'
  | 'REG_TO_CONSOLE';

export interface OperandProvenance {
  name: string;
  type: 'REG' | 'IMM' | 'MEM' | 'NONE';
  value: number;
}

export interface TraceRecord {
  id: number;
  cycle: number;
  instructionCount: number;
  eip: number;
  phase: CPUPhase;
  microOp: string;
  studentExplanation?: string;
  details: string;
  activeBuses: ActiveBusId[];
  latchAProvenance?: OperandProvenance;
  latchBProvenance?: OperandProvenance;
  timestamp: number;
}

export interface CPUMicroState {
  eip: number;
  oldEip?: number;
  ir: number;
  irBytes?: number[];
  instLength?: number;
  mar: number;
  mdr: number;
  aluOut: number;
  latchA: number;
  latchB: number;
  latchASource?: string;
  latchBSource?: string;
  latchBIsImmediate?: boolean;
  registers: Uint32Array; // 8 registers: EAX(0) to ESP(7)
  segments?: SegmentRegisters;
  flags: EFLAGS;
  phase: CPUPhase;
  stepPhase?: CPUPhase;
  codeWord?: number;
  decoded: DecodedInstruction | null;
  activeBuses: ActiveBusId[];
  cycles: number;
  instructionCount: number;
  halted: boolean;
  lastModifiedReg: RegisterId | null;
  lastModifiedMem: number | null;
  consoleOutput: ConsoleOutputEntry[];
  memorySize?: number;
  dataStart?: number;
  dataEnd?: number;
  ramPreview?: number[];
}

export interface AssembledProgram {
  codeBytes: Uint8Array;
  dataBytes?: Uint8Array;
  entryPoint?: number;
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
