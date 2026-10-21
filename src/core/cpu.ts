// PulseCISC-32 Multi-Cycle x86 / MASM CPU Simulation Engine
import type {
  ActiveBusId,
  CPUMicroState,
  CPUPhase,
  ConsoleOutputEntry,
  DecodedInstruction,
  EFLAGS,
  Mnemonic,
  Operand,
  OperandProvenance,
  RegisterId,
  SegmentRegisterName,
  SegmentRegisters,
  TraceRecord,
} from './types';
import {
  decodeInstruction,
  decodeInstructionFromBytes,
  formatBytesHex,
  signExtend8,
  signExtend16,
  toHex32,
  toUint32,
  toInt32,
  OPCODES,
} from './isa';
import { Memory } from './memory';
import { ALU } from './alu';
import type { ALUOperation } from './alu';
import { isIrvineTrap, executeIrvineHLE } from './irvineHle';

export class CPU {
  public memory: Memory;

  // Architectural 32-bit General Purpose Registers: EAX(0) through ESP(7)
  public registers: Uint32Array = new Uint32Array(8);

  // x86 Segment Selector Registers (32-bit Flat Protected Mode defaults)
  public segments: SegmentRegisters = {
    cs: 0x001b,
    ds: 0x0023,
    ss: 0x0023,
    es: 0x0023,
    fs: 0x003b,
    gs: 0x0000,
  };

  // Special Registers & Latches
  public eip: number = 0;
  public oldEip: number = 0;
  public ir: number = 0;
  public irBytes: number[] = [];
  public instLength: number = 4;
  public mar: number = 0;
  public mdr: number = 0;
  public aluOut: number = 0;
  public latchA: number = 0;
  public latchB: number = 0;
  public latchASource: string = 'NONE';
  public latchBSource: string = 'NONE';
  public latchBIsImmediate: boolean = false;

  // EFLAGS
  public flags: EFLAGS = {
    zf: false,
    sf: false,
    of: false,
    cf: false,
    df: false,
  };

  // State Machine
  public phase: CPUPhase = 'HALTED';
  public nextPhase: CPUPhase = 'FETCH';
  public stepPhase?: CPUPhase = 'HALTED';
  public decoded: DecodedInstruction | null = null;
  private fetchedDecoded: DecodedInstruction | null = null;
  public activeBuses: ActiveBusId[] = [];
  public cycles: number = 0;
  public instructionCount: number = 0;
  public halted: boolean = false;

  // UI tracking
  public lastModifiedReg: RegisterId | null = null;
  public lastModifiedMem: number | null = null;

  // Trace Log
  public traceLog: TraceRecord[] = [];
  private nextTraceId: number = 1;

  // System Console Output
  public consoleOutput: ConsoleOutputEntry[] = [];
  private nextConsoleId: number = 1;

  public defaultEsp: number | null = null;
  public defaultEip: number = 0x0000;

  constructor(memory?: Memory) {
    this.memory = memory ?? new Memory();
    this.reset();
  }

  /**
   * Resets all architectural state to initial values.
   */
  public reset(entryPoint?: number): void {
    const startEip = entryPoint ?? this.defaultEip ?? 0x0000;
    this.eip = startEip;
    this.oldEip = startEip;
    this.ir = 0;
    this.irBytes = [];
    this.instLength = 4;
    this.mar = 0;
    this.mdr = 0;
    this.aluOut = 0;
    this.latchA = 0;
    this.latchB = 0;
    this.latchASource = 'NONE';
    this.latchBSource = 'NONE';
    this.latchBIsImmediate = false;
    this.registers.fill(0);
    // ESP defaults to top of Data/Stack Segment (4-byte aligned)
    this.registers[7] = this.defaultEsp ?? (this.memory.getDataEnd() & ~0x3);

    this.segments = {
      cs: 0x001b,
      ds: 0x0023,
      ss: 0x0023,
      es: 0x0023,
      fs: 0x003b,
      gs: 0x0000,
    };

    this.flags = { zf: false, sf: false, of: false, cf: false, df: false };
    this.phase = 'HALTED';
    this.nextPhase = 'FETCH';
    this.stepPhase = 'HALTED';
    this.decoded = null;
    this.fetchedDecoded = null;
    this.activeBuses = [];
    this.cycles = 0;
    this.instructionCount = 0;
    this.halted = false;
    this.lastModifiedReg = null;
    this.lastModifiedMem = null;
    this.traceLog = [];
    this.nextTraceId = 1;
    const memKb = (this.memory.getSize() / 1024).toFixed(0);
    const memEndHex = (this.memory.getSize() - 1).toString(16).toUpperCase().padStart(4, '0');
    const spHex = this.registers[7].toString(16).toUpperCase().padStart(4, '0');
    this.consoleOutput = [
      {
        id: this.nextConsoleId++,
        cycle: 0,
        type: 'system',
        text: `[PulseCISC-32] System Reset. Ready for execution. (Memory: ${memKb} KB [0x0000 - 0x${memEndHex}], ESP: 0x${spHex})`,
        timestamp: Date.now(),
      },
    ];
    this.memory.clearChangeFlags();
  }

  /**
   * Reads from a general or segment register, supporting 32-bit, 16-bit, and 8-bit sub-registers.
   */
  public readRegister(
    regId: RegisterId,
    is16Bit: boolean = false,
    is8Bit: boolean = false,
    is8BitHigh: boolean = false,
    segReg?: SegmentRegisterName
  ): number {
    if (segReg) {
      const key = segReg.toLowerCase() as keyof SegmentRegisters;
      return this.segments[key] & 0xffff;
    }
    const full = this.registers[regId];
    if (is8BitHigh) return (full >>> 8) & 0xff;
    if (is8Bit) return full & 0xff;
    if (is16Bit) return full & 0xffff;
    return full;
  }

  /**
   * Writes to a general or segment register, preserving unmodified bits for sub-registers.
   */
  public writeRegister(
    regId: RegisterId,
    value: number,
    is16Bit: boolean = false,
    is8Bit: boolean = false,
    is8BitHigh: boolean = false,
    segReg?: SegmentRegisterName
  ): void {
    if (segReg) {
      const key = segReg.toLowerCase() as keyof SegmentRegisters;
      this.segments[key] = value & 0xffff;
      return;
    }
    const u32 = toUint32(value);
    if (is8BitHigh) {
      const masked = this.registers[regId] & 0xffff00ff;
      this.registers[regId] = toUint32(masked | ((u32 & 0xff) << 8));
    } else if (is8Bit) {
      const masked = this.registers[regId] & 0xffffff00;
      this.registers[regId] = toUint32(masked | (u32 & 0xff));
    } else if (is16Bit) {
      const upper = this.registers[regId] & 0xffff0000;
      const lower = u32 & 0xffff;
      this.registers[regId] = toUint32(upper | lower);
    } else {
      this.registers[regId] = u32;
    }
    this.lastModifiedReg = regId;
  }

  /**
   * Computes the 32-bit Effective Address for any memory operand:
   * Base + Index * Scale + Displacement.
   */
  public computeEffectiveAddress(op: Operand): number {
    let addr = 0;
    if (!op.isDirect && op.memBaseReg !== undefined) {
      addr += this.readRegister(op.memBaseReg, false);
    }
    if (op.memIndexReg !== undefined) {
      const idx = toInt32(this.readRegister(op.memIndexReg, false));
      const scale = op.memScale ?? 1;
      addr += idx * scale;
    }
    if (op.memOffset !== undefined) {
      addr += op.memOffset;
    }
    return toUint32(addr);
  }

  /**
   * Reads 8-bit, 16-bit, or 32-bit value from memory at `addr` according to `op` size qualifiers.
   */
  public readMemoryOperandValue(op: Operand, addr?: number): number {
    const effectiveAddr = addr ?? this.computeEffectiveAddress(op);
    this.mar = effectiveAddr;
    if (op.isByte) {
      const val = this.memory.readByte(effectiveAddr);
      this.mdr = val;
      return val;
    }
    if (op.isWord) {
      const b0 = this.memory.readByte(effectiveAddr);
      const b1 = this.memory.readByte(effectiveAddr + 1);
      const val = ((b1 << 8) | b0) & 0xffff;
      this.mdr = val;
      return val;
    }
    const val = this.memory.readWord(effectiveAddr);
    this.mdr = val;
    return val;
  }

  /**
   * Writes 8-bit, 16-bit, or 32-bit value to memory at `addr` according to `op` size qualifiers.
   */
  public writeMemoryOperandValue(op: Operand, value: number, addr?: number): void {
    const effectiveAddr = addr ?? this.computeEffectiveAddress(op);
    this.mar = effectiveAddr;
    this.lastModifiedMem = effectiveAddr;

    if (op.isByte) {
      const b = value & 0xff;
      this.mdr = b;
      this.memory.writeByte(effectiveAddr, b);
    } else if (op.isWord) {
      const w = value & 0xffff;
      this.mdr = w;
      this.memory.writeByte(effectiveAddr, w & 0xff);
      this.memory.writeByte(effectiveAddr + 1, (w >>> 8) & 0xff);
    } else {
      const d = toUint32(value);
      this.mdr = d;
      this.memory.writeWord(effectiveAddr, d);
      if (effectiveAddr === 0x0ff0) {
        this.consoleOutput.push({
          id: this.nextConsoleId++,
          cycle: this.cycles,
          type: 'output',
          text: `[MMIO 0x0FF0]: ${toInt32(d)} (${toHex32(d)})`,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Evaluates an EFLAGS condition code suffix (`E`, `NE`, `G`, `GE`, `L`, `LE`, `A`, `AE`, `B`, `BE`, `S`, `NS`, `O`, `NO`).
   */
  public checkCondition(mnemonic: Mnemonic): boolean {
    const suffix = mnemonic.replace(/^(CMOV|SET|J)/, '');
    switch (suffix) {
      case 'E':
      case 'Z':
        return this.flags.zf;
      case 'NE':
      case 'NZ':
        return !this.flags.zf;
      case 'G':
      case 'NLE':
        return !this.flags.zf && this.flags.sf === this.flags.of;
      case 'GE':
      case 'NL':
        return this.flags.sf === this.flags.of;
      case 'L':
      case 'NGE':
        return this.flags.sf !== this.flags.of;
      case 'LE':
      case 'NG':
        return this.flags.zf || this.flags.sf !== this.flags.of;
      case 'A':
      case 'NBE':
        return !this.flags.cf && !this.flags.zf;
      case 'AE':
      case 'NB':
      case 'NC':
        return !this.flags.cf;
      case 'B':
      case 'NAE':
      case 'C':
        return this.flags.cf;
      case 'BE':
      case 'NA':
        return this.flags.cf || this.flags.zf;
      case 'S':
        return this.flags.sf;
      case 'NS':
        return !this.flags.sf;
      case 'O':
        return this.flags.of;
      case 'NO':
        return !this.flags.of;
      default:
        return false;
    }
  }

  private applyALUFlags(newFlags: EFLAGS): void {
    this.flags = {
      ...newFlags,
      df: this.flags.df ?? false,
    };
  }

  /**
   * Advances CPU simulation by 1 micro-step (FSM phase transition).
   */
  public stepMicro(): CPUMicroState {
    if (this.halted) {
      return this.getSnapshot();
    }

    this.cycles++;
    this.lastModifiedReg = null;
    this.lastModifiedMem = null;
    this.activeBuses = [];

    const toExecute = this.nextPhase;
    this.stepPhase = toExecute;

    switch (toExecute) {
      case 'FETCH':
        this.executeFetch();
        break;
      case 'DECODE':
        this.executeDecode();
        break;
      case 'EXECUTE':
        this.executeExecute();
        break;
      case 'MEMORY':
        this.executeMemory();
        break;
      case 'WRITEBACK':
        this.executeWriteback();
        break;
      case 'HALTED':
        this.phase = 'HALTED';
        this.nextPhase = 'HALTED';
        this.halted = true;
        break;
    }

    return this.getSnapshot();
  }

  /**
   * Advances CPU until current instruction completes (transitions to next FETCH) or halts.
   */
  public stepInstruction(): CPUMicroState {
    if (this.halted) return this.getSnapshot();

    const startInst = this.instructionCount;
    let guard = 0;
    while (!this.halted && this.instructionCount === startInst && guard < 10) {
      this.stepMicro();
      guard++;
    }
    return this.getSnapshot();
  }

  // --- Phase Handlers ---

  private executeFetch(): void {
    if (isIrvineTrap(this.eip)) {
      executeIrvineHLE(this, this.eip);
      return;
    }

    this.oldEip = this.eip;
    this.mar = this.eip;

    // Fetch up to 12 bytes from Code Memory to decode variable-length x86 instruction
    const windowBytes: number[] = [];
    for (let i = 0; i < 12; i++) {
      windowBytes.push(this.memory.readByte(this.eip + i));
    }
    const decoded = decodeInstructionFromBytes(windowBytes, 0);
    const byteLen = Math.max(1, decoded.byteLength ?? 4);

    this.fetchedDecoded = decoded;
    this.irBytes = windowBytes.slice(0, byteLen);
    this.instLength = byteLen;
    this.ir = decoded.raw;

    const oldEip = this.eip;
    this.eip = toUint32(this.eip + byteLen);

    this.activeBuses = [
      'EIP_TO_MAR',
      'MAR_TO_CODE_MEM',
      'CODE_MEM_TO_IR',
      'EIP_INCREMENT',
    ];

    const hexSeq = formatBytesHex(this.irBytes);
    const formalRTL = `MAR <- EIP (${toHex32(oldEip)}); IR <- MEM[${toHex32(this.mar)}..+${byteLen}B] (${hexSeq}); EIP <- EIP + ${byteLen} (${toHex32(this.eip)})`;
    const studentEnglish = `Fetch: Read ${byteLen}-byte x86 instruction [${hexSeq}] at ${toHex32(oldEip)} into IR; advanced EIP by +${byteLen} byte${byteLen === 1 ? '' : 's'} to ${toHex32(this.eip)}.`;

    this.addTrace(
      'FETCH',
      formalRTL,
      `Fetched ${byteLen}-byte x86 instruction at ${toHex32(oldEip)}`,
      studentEnglish
    );

    this.phase = 'FETCH';
    this.nextPhase = 'DECODE';
  }

  private executeDecode(): void {
    this.decoded = this.fetchedDecoded ?? decodeInstruction(this.ir);
    const { mnemonic, opcode, dest, src } = this.decoded;

    if (opcode === OPCODES.HLT) {
      this.phase = 'HALTED';
      this.nextPhase = 'HALTED';
      this.halted = true;
      this.activeBuses = ['IR_TO_CU'];
      this.addTrace(
        'DECODE',
        'HLT instruction decoded. CPU halted.',
        'Processor clock stopped.',
        'Decode: HLT instruction encountered. Stopping processor clock.'
      );
      return;
    }

    let latchASource = 'NONE';
    let latchBSource = 'NONE';
    this.latchBIsImmediate = false;

    if (dest.type === 'REG' && (dest.reg !== undefined || dest.segReg)) {
      this.latchA = this.readRegister(
        dest.reg ?? 0,
        dest.is16Bit,
        dest.is8Bit,
        dest.is8BitHigh,
        dest.segReg
      );
      latchASource = `REG(${dest.rawString})`;
    } else if (dest.type === 'MEM') {
      const ea = this.computeEffectiveAddress(dest);
      this.latchA = ea;
      latchASource = `EA(${dest.rawString})`;
    } else if (dest.type === 'IMM' && dest.imm !== undefined) {
      this.latchA = dest.imm;
      latchASource = `IMM(${dest.imm})`;
    } else {
      this.latchA = 0;
    }

    if (src.type === 'REG' && (src.reg !== undefined || src.segReg)) {
      this.latchB = this.readRegister(
        src.reg ?? 0,
        src.is16Bit,
        src.is8Bit,
        src.is8BitHigh,
        src.segReg
      );
      latchBSource = `REG(${src.rawString})`;
    } else if (src.type === 'IMM' && src.imm !== undefined) {
      this.latchB = src.imm;
      latchBSource = `IMM(${src.imm})`;
      this.latchBIsImmediate = true;
    } else if (src.type === 'MEM') {
      const ea = this.computeEffectiveAddress(src);
      this.latchB = ea;
      latchBSource = `EA(${src.rawString})`;
    } else {
      this.latchB = 0;
    }

    this.latchASource = latchASource;
    this.latchBSource = latchBSource;

    this.activeBuses = ['IR_TO_CU', 'IR_TO_REG_READ', 'REGS_TO_LATCHES'];

    const formalRTL = `Decoded: ${this.decoded.assemblyString}; Latch_A <- ${latchASource} (${toHex32(this.latchA)}); Latch_B <- ${latchBSource} (${toHex32(this.latchB)})`;

    let studentEnglish: string;
    if (src.type === 'IMM' && src.imm !== undefined) {
      studentEnglish = `Decode: Identified '${this.decoded.assemblyString}'. Read ${dest.rawString || 'dest'} into Latch A; extracted immediate ${src.imm} into Latch B.`;
    } else if (src.type === 'REG') {
      studentEnglish = `Decode: Identified '${this.decoded.assemblyString}'. Read ${dest.rawString} into Latch A and ${src.rawString} into Latch B.`;
    } else if (src.type === 'MEM' || dest.type === 'MEM') {
      studentEnglish = `Decode: Identified '${this.decoded.assemblyString}'. Evaluated SIB/displacement address components into latches.`;
    } else {
      studentEnglish = `Decode: Identified '${this.decoded.assemblyString}'. Prepared control signals for Execution stage.`;
    }

    this.addTrace(
      'DECODE',
      formalRTL,
      `Decoded ${mnemonic} (${this.instLength}B)`,
      studentEnglish,
      { name: latchASource, type: dest.type, value: this.latchA },
      { name: latchBSource, type: src.type, value: this.latchB }
    );

    this.phase = 'DECODE';
    this.nextPhase = 'EXECUTE';
  }

  private executeExecute(): void {
    if (!this.decoded) return;
    const { opcode, mnemonic, dest, src, imm2, repPrefix } = this.decoded;

    switch (opcode) {
      case OPCODES.NOP: {
        this.activeBuses = [];
        this.addTrace(
          'EXECUTE',
          'NOP',
          'No operation performed',
          'Execute: NOP (0x90) executed. Pipeline state maintained without modification.'
        );
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.MOV_RR:
      case OPCODES.MOV_RI: {
        this.aluOut = toUint32(this.latchB);
        this.activeBuses =
          src.type === 'IMM'
            ? ['IMM_TO_ALU', 'ALU_TO_ALU_OUT']
            : ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT'];
        const studentText = `Execute: Routed ${this.latchBSource} (value ${toInt32(this.aluOut)}) through ALU toward writeback.`;
        this.addTrace(
          'EXECUTE',
          `ALU_Out <- ${toHex32(this.aluOut)} (MOV transfer)`,
          `Prepared value for register writeback`,
          studentText
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'WRITEBACK';
        break;
      }

      case OPCODES.MOVH: {
        const upper = ((src.imm ?? 0) & 0xffff) << 16;
        const lower = this.latchA & 0xffff;
        this.aluOut = toUint32(upper | lower);
        this.activeBuses = ['IMM_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace(
          'EXECUTE',
          `ALU_Out <- ${toHex32(this.aluOut)} (MOVH upper 16-bits)`,
          `Loaded upper 16 bits into high half of register`,
          `Execute: Loaded upper 16 bits (0x${((src.imm ?? 0) & 0xffff).toString(16)}) while preserving lower 16 bits.`
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'WRITEBACK';
        break;
      }

      case OPCODES.MOV_RM:
      case OPCODES.MOVB_RM:
      case OPCODES.MOVW_RM: {
        this.aluOut = this.computeEffectiveAddress(src);
        this.activeBuses = ['LATCHES_TO_ALU', 'IMM_TO_ALU', 'ALU_TO_ALU_OUT'];
        const szLabel = opcode === OPCODES.MOVB_RM ? '8-bit Byte' : opcode === OPCODES.MOVW_RM ? '16-bit Word' : '32-bit Dword';
        this.addTrace(
          'EXECUTE',
          `Effective Address <- ${toHex32(this.aluOut)} (${src.rawString})`,
          `Computed effective address for ${szLabel} load`,
          `Execute: Calculated effective memory address ${toHex32(this.aluOut)} for ${src.rawString}.`
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'MEMORY';
        break;
      }

      case OPCODES.MOV_MR:
      case OPCODES.MOVB_MR:
      case OPCODES.MOVW_MR:
      case OPCODES.MOV_MI: {
        this.aluOut = this.computeEffectiveAddress(dest);
        this.activeBuses = ['LATCHES_TO_ALU', 'IMM_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace(
          'EXECUTE',
          `Effective Address <- ${toHex32(this.aluOut)} (${dest.rawString})`,
          `Computed effective address for memory store`,
          `Execute: Calculated target memory address ${toHex32(this.aluOut)} for ${dest.rawString}.`
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'MEMORY';
        break;
      }

      case OPCODES.MOVZX:
      case OPCODES.MOVSX: {
        let rawVal = 0;
        let is16Source = false;
        if (src.type === 'REG') {
          rawVal = this.readRegister(src.reg ?? 0, src.is16Bit, src.is8Bit, src.is8BitHigh, src.segReg);
          is16Source = Boolean(src.is16Bit);
        } else if (src.type === 'MEM') {
          rawVal = this.readMemoryOperandValue(src);
          is16Source = Boolean(src.isWord);
        }
        if (opcode === OPCODES.MOVZX) {
          this.aluOut = is16Source ? rawVal & 0xffff : rawVal & 0xff;
        } else {
          this.aluOut = toUint32(is16Source ? signExtend16(rawVal) : signExtend8(rawVal));
        }
        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace(
          'EXECUTE',
          `${mnemonic}: ${dest.rawString} <- ${toHex32(this.aluOut)}`,
          `${opcode === OPCODES.MOVZX ? 'Zero' : 'Sign'}-extended source operand`,
          `Execute: ${opcode === OPCODES.MOVZX ? 'Zero' : 'Sign'}-extended ${src.rawString} to ${toHex32(this.aluOut)}.`
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'WRITEBACK';
        break;
      }

      case OPCODES.LEA: {
        this.aluOut = this.computeEffectiveAddress(src);
        this.activeBuses = ['LATCHES_TO_ALU', 'IMM_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace(
          'EXECUTE',
          `LEA: ${dest.rawString} <- Effective Address (${toHex32(this.aluOut)})`,
          'Calculated SIB/displacement effective address without memory access',
          `Execute: Computed effective address ${toHex32(this.aluOut)} from ${src.rawString}.`
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'WRITEBACK';
        break;
      }

      case OPCODES.XCHG: {
        if (dest.type === 'REG' && src.type === 'REG') {
          const vA = this.readRegister(dest.reg ?? 0, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);
          const vB = this.readRegister(src.reg ?? 0, src.is16Bit, src.is8Bit, src.is8BitHigh);
          this.writeRegister(dest.reg ?? 0, vB, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);
          this.writeRegister(src.reg ?? 0, vA, src.is16Bit, src.is8Bit, src.is8BitHigh);
          this.activeBuses = ['REGS_TO_LATCHES', 'ALU_OUT_TO_REG_WB'];
          this.addTrace(
            'EXECUTE',
            `XCHG: ${dest.rawString} <-> ${src.rawString} (${toHex32(vA)} <-> ${toHex32(vB)})`,
            'Swapped register contents',
            `Execute: Exchanged values between ${dest.rawString} and ${src.rawString}.`
          );
        } else if (dest.type === 'MEM' && src.type === 'REG') {
          const addr = this.computeEffectiveAddress(dest);
          const vMem = this.readMemoryOperandValue(dest, addr);
          const vReg = this.readRegister(src.reg ?? 0, src.is16Bit, src.is8Bit, src.is8BitHigh);
          this.writeMemoryOperandValue(dest, vReg, addr);
          this.writeRegister(src.reg ?? 0, vMem, src.is16Bit, src.is8Bit, src.is8BitHigh);
          this.addTrace('EXECUTE', `XCHG ${dest.rawString}, ${src.rawString}`, 'Exchanged memory and register');
        }
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.XADD: {
        const vA =
          dest.type === 'MEM'
            ? this.readMemoryOperandValue(dest)
            : this.readRegister(dest.reg ?? 0, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);
        const vB = this.readRegister(src.reg ?? 0, src.is16Bit, src.is8Bit, src.is8BitHigh);
        const res = ALU.execute('ADD', vA, vB);
        this.applyALUFlags(res.flags);
        this.writeRegister(src.reg ?? 0, vA, src.is16Bit, src.is8Bit, src.is8BitHigh);
        if (dest.type === 'MEM') {
          this.writeMemoryOperandValue(dest, res.result);
        } else {
          this.writeRegister(dest.reg ?? 0, res.result, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);
        }
        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT', 'ALU_TO_FLAGS'];
        this.addTrace('EXECUTE', `XADD: ${dest.rawString} <- ${toHex32(res.result)}, ${src.rawString} <- ${toHex32(vA)}`, 'Exchange and Add');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.CMPXCHG: {
        const eaxVal = this.readRegister(0, dest.is16Bit, dest.is8Bit, false);
        const destVal =
          dest.type === 'MEM'
            ? this.readMemoryOperandValue(dest)
            : this.readRegister(dest.reg ?? 0, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);
        const srcVal = this.readRegister(src.reg ?? 0, src.is16Bit, src.is8Bit, src.is8BitHigh);
        const cmpRes = ALU.execute('SUB', eaxVal, destVal);
        this.applyALUFlags(cmpRes.flags);

        if (eaxVal === destVal) {
          this.flags.zf = true;
          if (dest.type === 'MEM') {
            this.writeMemoryOperandValue(dest, srcVal);
          } else {
            this.writeRegister(dest.reg ?? 0, srcVal, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);
          }
          this.addTrace('EXECUTE', `CMPXCHG Equal: ${dest.rawString} <- ${toHex32(srcVal)} (ZF=1)`, 'Compare and Exchange');
        } else {
          this.flags.zf = false;
          this.writeRegister(0, destVal, dest.is16Bit, dest.is8Bit, false);
          this.addTrace('EXECUTE', `CMPXCHG Not Equal: EAX <- ${toHex32(destVal)} (ZF=0)`, 'Compare and Exchange');
        }
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.PUSH: {
        let valToPush = 0;
        if (dest.type === 'IMM') {
          valToPush = dest.imm ?? 0;
        } else if (dest.type === 'MEM') {
          valToPush = this.readMemoryOperandValue(dest);
        } else {
          valToPush = this.latchA;
        }
        const oldSp = this.readRegister(7);
        const newSp = toUint32(oldSp - 4);
        this.writeRegister(7, newSp);
        this.memory.writeWord(newSp, valToPush);
        this.lastModifiedMem = newSp;
        this.mar = newSp;
        this.mdr = valToPush;
        this.activeBuses = ['REGS_TO_LATCHES', 'ALU_OUT_TO_MAR', 'MDR_TO_DATA_MEM'];
        this.addTrace(
          'EXECUTE',
          `PUSH: ESP <- ESP - 4 (${toHex32(newSp)}); RAM[${toHex32(newSp)}] <- ${toHex32(valToPush)}`,
          'Pushed value onto stack',
          `Execute: Decremented stack pointer ESP to ${toHex32(newSp)} and wrote ${toHex32(valToPush)} to stack top.`
        );
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.POP: {
        const oldSp = this.readRegister(7);
        const poppedVal = this.memory.readWord(oldSp);
        const newSp = toUint32(oldSp + 4);
        this.writeRegister(7, newSp);
        if (dest.type === 'MEM') {
          this.writeMemoryOperandValue(dest, poppedVal);
        } else if (dest.reg !== undefined || dest.segReg) {
          this.writeRegister(dest.reg ?? 0, poppedVal, dest.is16Bit, dest.is8Bit, dest.is8BitHigh, dest.segReg);
        }
        this.mar = oldSp;
        this.mdr = poppedVal;
        this.activeBuses = ['MEM_TO_MDR', 'MDR_TO_REG_WB'];
        this.addTrace(
          'EXECUTE',
          `POP: ${dest.rawString} <- RAM[${toHex32(oldSp)}] (${toHex32(poppedVal)}); ESP <- ESP + 4 (${toHex32(newSp)})`,
          'Popped value from stack',
          `Execute: Popped ${toHex32(poppedVal)} from stack top at ${toHex32(oldSp)} into ${dest.rawString}; ESP = ${toHex32(newSp)}.`
        );
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.PUSHAD: {
        // Standard x86 PUSHAD order: EAX, ECX, EDX, EBX, original ESP, EBP, ESI, EDI
        const origEsp = this.readRegister(7);
        const order: RegisterId[] = [0, 2, 3, 1, 7, 6, 4, 5];
        let sp = origEsp;
        for (const r of order) {
          sp = toUint32(sp - 4);
          const val = r === 7 ? origEsp : this.readRegister(r);
          this.memory.writeWord(sp, val);
        }
        this.writeRegister(7, sp);
        this.lastModifiedMem = sp;
        this.activeBuses = ['REGS_TO_LATCHES', 'MDR_TO_DATA_MEM'];
        this.addTrace('EXECUTE', `PUSHAD: Pushed EAX..EDI (32 bytes); ESP <- ${toHex32(sp)}`, 'Pushed all general registers');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.POPAD: {
        // Standard x86 POPAD order: EDI, ESI, EBP, (skip ESP), EBX, EDX, ECX, EAX
        const order: RegisterId[] = [5, 4, 6, 7, 1, 3, 2, 0];
        let sp = this.readRegister(7);
        for (const r of order) {
          const val = this.memory.readWord(sp);
          sp = toUint32(sp + 4);
          if (r !== 7) {
            this.writeRegister(r, val);
          }
        }
        this.writeRegister(7, sp);
        this.activeBuses = ['MEM_TO_MDR', 'MDR_TO_REG_WB'];
        this.addTrace('EXECUTE', `POPAD: Restored EDI..EAX (32 bytes); ESP <- ${toHex32(sp)}`, 'Popped all general registers');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.PUSHFD: {
        const flagsWord =
          (this.flags.cf ? 1 << 0 : 0) |
          (1 << 1) |
          (this.flags.zf ? 1 << 6 : 0) |
          (this.flags.sf ? 1 << 7 : 0) |
          (this.flags.df ? 1 << 10 : 0) |
          (this.flags.of ? 1 << 11 : 0);
        const sp = toUint32(this.readRegister(7) - 4);
        this.writeRegister(7, sp);
        this.memory.writeWord(sp, flagsWord);
        this.lastModifiedMem = sp;
        this.addTrace('EXECUTE', `PUSHFD: Stack[${toHex32(sp)}] <- EFLAGS (${toHex32(flagsWord)})`, 'Pushed EFLAGS onto stack');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.POPFD: {
        const sp = this.readRegister(7);
        const flagsWord = this.memory.readWord(sp);
        this.writeRegister(7, toUint32(sp + 4));
        this.flags.cf = (flagsWord & (1 << 0)) !== 0;
        this.flags.zf = (flagsWord & (1 << 6)) !== 0;
        this.flags.sf = (flagsWord & (1 << 7)) !== 0;
        this.flags.df = (flagsWord & (1 << 10)) !== 0;
        this.flags.of = (flagsWord & (1 << 11)) !== 0;
        this.addTrace('EXECUTE', `POPFD: EFLAGS <- ${toHex32(flagsWord)}`, 'Popped EFLAGS from stack');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.ENTER: {
        const allocBytes = (dest.imm ?? 0) & 0xffff;
        const oldEbp = this.readRegister(6);
        let sp = toUint32(this.readRegister(7) - 4);
        this.memory.writeWord(sp, oldEbp);
        this.writeRegister(6, sp); // EBP = ESP
        sp = toUint32(sp - allocBytes);
        this.writeRegister(7, sp);
        this.lastModifiedMem = sp;
        this.addTrace('EXECUTE', `ENTER ${allocBytes}, 0: EBP <- ${toHex32(this.readRegister(6))}, ESP <- ${toHex32(sp)}`, 'Created stack frame');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.LEAVE: {
        const framePtr = this.readRegister(6); // EBP
        const savedEbp = this.memory.readWord(framePtr);
        this.writeRegister(6, savedEbp);
        this.writeRegister(7, toUint32(framePtr + 4));
        this.addTrace('EXECUTE', `LEAVE: ESP <- EBP + 4 (${toHex32(framePtr + 4)}); EBP <- ${toHex32(savedEbp)}`, 'Destroyed stack frame');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.CALL: {
        const returnAddr = this.eip;
        const oldSp = this.readRegister(7);
        const newSp = toUint32(oldSp - 4);
        this.writeRegister(7, newSp);
        this.memory.writeWord(newSp, returnAddr);
        this.lastModifiedMem = newSp;
        this.mar = newSp;
        this.mdr = returnAddr;

        const target = dest.imm ?? 0;
        this.eip = toUint32(target);
        this.activeBuses = ['BRANCH_TARGET_TO_EIP', 'MDR_TO_DATA_MEM'];
        this.addTrace(
          'EXECUTE',
          `CALL: Stack[${toHex32(newSp)}] <- Return Addr (${toHex32(returnAddr)}); EIP <- ${toHex32(this.eip)}`,
          'Subroutine call',
          `Execute: Pushed return address ${toHex32(returnAddr)} to stack and jumped to procedure at ${toHex32(this.eip)}.`
        );
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.RET:
      case OPCODES.RET_IMM: {
        const popBytes = opcode === OPCODES.RET_IMM ? (dest.imm ?? 0) & 0xffff : 0;
        const oldSp = this.readRegister(7);
        const returnAddr = this.memory.readWord(oldSp);
        const newSp = toUint32(oldSp + 4 + popBytes);
        this.writeRegister(7, newSp);
        this.eip = toUint32(returnAddr);
        this.mar = oldSp;
        this.mdr = returnAddr;
        this.activeBuses = ['MEM_TO_MDR', 'BRANCH_TARGET_TO_EIP'];
        this.addTrace(
          'EXECUTE',
          `RET${popBytes ? ' ' + popBytes : ''}: EIP <- Stack[${toHex32(oldSp)}] (${toHex32(returnAddr)}); ESP <- ${toHex32(newSp)}`,
          'Subroutine return',
          `Execute: Popped return address ${toHex32(returnAddr)} into EIP and adjusted ESP to ${toHex32(newSp)}.`
        );
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.LOOP:
      case OPCODES.LOOPE:
      case OPCODES.LOOPNE: {
        const oldEcx = this.readRegister(2);
        const newEcx = toUint32(oldEcx - 1);
        this.writeRegister(2, newEcx);
        const target = dest.imm ?? 0;
        let cond = newEcx !== 0;
        if (opcode === OPCODES.LOOPE) cond = cond && this.flags.zf;
        if (opcode === OPCODES.LOOPNE) cond = cond && !this.flags.zf;

        if (cond) {
          this.eip = toUint32(target);
          this.activeBuses = ['BRANCH_TARGET_TO_EIP'];
          this.addTrace(
            'EXECUTE',
            `${mnemonic} Taken: ECX <- ${newEcx}; Branch to ${toHex32(this.eip)}`,
            'Loop condition met'
          );
        } else {
          this.activeBuses = [];
          this.addTrace(
            'EXECUTE',
            `${mnemonic} Complete: ECX <- ${newEcx}; Sequential execution continues`,
            'Loop terminated'
          );
        }
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.JECXZ: {
        const ecx = this.readRegister(2);
        const target = dest.imm ?? 0;
        if (ecx === 0) {
          this.eip = toUint32(target);
          this.activeBuses = ['BRANCH_TARGET_TO_EIP'];
          this.addTrace('EXECUTE', `JECXZ Taken: ECX == 0 -> EIP <- ${toHex32(this.eip)}`, 'Jumped on ECX == 0');
        } else {
          this.addTrace('EXECUTE', `JECXZ Not Taken: ECX = ${ecx}`, 'Sequential flow');
        }
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.CBW: {
        const al = signExtend8(this.readRegister(0, false, true, false));
        this.writeRegister(0, al & 0xffff, true);
        this.addTrace('EXECUTE', `CBW: AX <- sign_extend(AL) = 0x${(al & 0xffff).toString(16).toUpperCase()}`, 'Convert byte to word');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.CWDE: {
        const ax = signExtend16(this.readRegister(0, true));
        this.writeRegister(0, toUint32(ax));
        this.addTrace('EXECUTE', `CWDE: EAX <- sign_extend(AX) = ${toHex32(ax)}`, 'Convert word to dword');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.CWD: {
        const ax = signExtend16(this.readRegister(0, true));
        const dx = ax < 0 ? 0xffff : 0x0000;
        this.writeRegister(3, dx, true);
        this.addTrace('EXECUTE', `CWD: DX:AX <- sign_extend(AX)`, 'Convert word to doubleword in DX:AX');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.CDQ: {
        const eax = toInt32(this.readRegister(0));
        const edx = eax < 0 ? 0xffffffff : 0x00000000;
        this.writeRegister(3, edx);
        this.addTrace('EXECUTE', `CDQ: EDX:EAX <- sign_extend(EAX) (EDX=${toHex32(edx)})`, 'Sign-extended EAX into EDX:EAX');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.LAHF: {
        const ah =
          (this.flags.cf ? 1 << 0 : 0) |
          (1 << 1) |
          (this.flags.zf ? 1 << 6 : 0) |
          (this.flags.sf ? 1 << 7 : 0);
        this.writeRegister(0, ah, false, true, true);
        this.addTrace('EXECUTE', `LAHF: AH <- 0x${ah.toString(16).toUpperCase()}`, 'Loaded status flags into AH');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.SAHF: {
        const ah = this.readRegister(0, false, true, true);
        this.flags.cf = (ah & (1 << 0)) !== 0;
        this.flags.zf = (ah & (1 << 6)) !== 0;
        this.flags.sf = (ah & (1 << 7)) !== 0;
        this.addTrace('EXECUTE', `SAHF: Status flags <- AH (0x${ah.toString(16).toUpperCase()})`, 'Stored AH into status flags');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.FLAG_OP: {
        const imm = dest.imm ?? 0;
        let desc = '';
        if (imm === 0) {
          this.flags.cf = false;
          desc = 'CLC (Clear Carry Flag: CF = 0)';
        } else if (imm === 1) {
          this.flags.cf = true;
          desc = 'STC (Set Carry Flag: CF = 1)';
        } else if (imm === 2) {
          this.flags.cf = !this.flags.cf;
          desc = `CMC (Complement Carry Flag: CF = ${this.flags.cf ? 1 : 0})`;
        } else if (imm === 3) {
          this.flags.df = false;
          desc = 'CLD (Clear Direction Flag: DF = 0, forward string ops)';
        } else if (imm === 4) {
          this.flags.df = true;
          desc = 'STD (Set Direction Flag: DF = 1, backward string ops)';
        }
        this.activeBuses = ['ALU_TO_FLAGS'];
        this.addTrace('EXECUTE', desc, 'Modified EFLAGS', `Execute: ${desc}.`);
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.STRING_OP: {
        this.executeStringInstruction(mnemonic, repPrefix);
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.CMOVCC: {
        const condMet = this.checkCondition(mnemonic);
        if (condMet) {
          const val =
            src.type === 'MEM'
              ? this.readMemoryOperandValue(src)
              : this.readRegister(src.reg ?? 0, src.is16Bit, src.is8Bit, src.is8BitHigh);
          this.aluOut = toUint32(val);
          this.writeRegister(dest.reg ?? 0, this.aluOut, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);
          this.addTrace('EXECUTE', `${mnemonic} Taken: ${dest.rawString} <- ${toHex32(this.aluOut)}`, 'Conditional move performed');
        } else {
          this.addTrace('EXECUTE', `${mnemonic} Not Taken: ${dest.rawString} unchanged`, 'Conditional move skipped');
        }
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.SETCC: {
        const condMet = this.checkCondition(mnemonic);
        const byteVal = condMet ? 1 : 0;
        if (dest.type === 'MEM') {
          this.writeMemoryOperandValue({ ...dest, isByte: true }, byteVal);
        } else {
          this.writeRegister(dest.reg ?? 0, byteVal, false, true, dest.is8BitHigh);
        }
        this.addTrace('EXECUTE', `${mnemonic}: ${dest.rawString} <- ${byteVal}`, 'Set byte on condition');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.BIT_OP: {
        this.executeBitOperation(mnemonic, dest, src);
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.INC:
      case OPCODES.DEC:
      case OPCODES.NEG:
      case OPCODES.NOT: {
        let aluOp: ALUOperation = 'INC';
        if (opcode === OPCODES.DEC) aluOp = 'DEC';
        else if (opcode === OPCODES.NEG) aluOp = 'NEG';
        else if (opcode === OPCODES.NOT) aluOp = 'NOT';

        const inputVal =
          dest.type === 'MEM' ? this.readMemoryOperandValue(dest) : this.latchA;
        const res = ALU.execute(aluOp, inputVal, 0, this.flags.cf);
        this.aluOut = res.result;
        this.applyALUFlags(res.flags);
        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT', 'ALU_TO_FLAGS'];

        if (dest.type === 'MEM') {
          this.writeMemoryOperandValue(dest, this.aluOut);
          this.addTrace('EXECUTE', `${mnemonic} ${dest.rawString} <- ${toHex32(this.aluOut)}`, `Updated memory operand`);
          this.instructionCount++;
          this.phase = 'EXECUTE';
          this.nextPhase = 'FETCH';
        } else {
          this.addTrace(
            'EXECUTE',
            `ALU_Out <- ${mnemonic}(${toHex32(inputVal)}) = ${toHex32(this.aluOut)}`,
            `Computed ${mnemonic} operation`
          );
          this.phase = 'EXECUTE';
          this.nextPhase = 'WRITEBACK';
        }
        break;
      }

      case OPCODES.SHL:
      case OPCODES.SHR:
      case OPCODES.SAR:
      case OPCODES.ROL:
      case OPCODES.ROR: {
        let aluOp: ALUOperation = 'SHL';
        if (opcode === OPCODES.SHR) aluOp = 'SHR';
        else if (opcode === OPCODES.SAR) aluOp = 'SAR';
        else if (opcode === OPCODES.ROL) aluOp = 'ROL';
        else if (opcode === OPCODES.ROR) aluOp = 'ROR';

        const inputVal =
          dest.type === 'MEM' ? this.readMemoryOperandValue(dest) : this.latchA;
        const res = ALU.execute(aluOp, inputVal, this.latchB, this.flags.cf);
        this.aluOut = res.result;
        this.applyALUFlags(res.flags);
        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT', 'ALU_TO_FLAGS'];

        if (dest.type === 'MEM') {
          this.writeMemoryOperandValue(dest, this.aluOut);
          this.instructionCount++;
          this.phase = 'EXECUTE';
          this.nextPhase = 'FETCH';
        } else {
          this.addTrace(
            'EXECUTE',
            `ALU_Out <- ${mnemonic}(${toHex32(inputVal)}, ${this.latchB & 0x1f}) = ${toHex32(this.aluOut)}`,
            `Shift/Rotate operation`
          );
          this.phase = 'EXECUTE';
          this.nextPhase = 'WRITEBACK';
        }
        break;
      }

      case OPCODES.MUL: {
        const srcVal =
          src.type === 'MEM' ? this.readMemoryOperandValue(src) : this.latchB;

        if (mnemonic === 'IMUL' && (dest.reg !== 0 || imm2 !== undefined || src.type === 'IMM')) {
          const factorA = imm2 !== undefined ? toInt32(srcVal) : toInt32(this.latchA);
          const factorB = imm2 !== undefined ? toInt32(imm2) : toInt32(srcVal);
          const prod = BigInt(factorA) * BigInt(factorB);
          this.aluOut = Number(BigInt.asIntN(32, prod)) >>> 0;
          const overflow = prod > 2147483647n || prod < -2147483648n;
          this.flags.cf = overflow;
          this.flags.of = overflow;
          this.flags.zf = this.aluOut === 0;
          this.flags.sf = (this.aluOut & 0x80000000) !== 0;
          this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT', 'ALU_TO_FLAGS'];
          this.addTrace(
            'EXECUTE',
            `IMUL: ${dest.rawString} <- (${factorA} * ${factorB}) = ${toInt32(this.aluOut)}`,
            'Signed multiply'
          );
          this.phase = 'EXECUTE';
          this.nextPhase = 'WRITEBACK';
        } else {
          const eax = toUint32(this.readRegister(0));
          const prod =
            mnemonic === 'IMUL'
              ? BigInt(toInt32(eax)) * BigInt(toInt32(srcVal))
              : BigInt(eax) * BigInt(toUint32(srcVal));
          const low32 = Number(prod & 0xffffffffn) >>> 0;
          const high32 = Number((prod >> 32n) & 0xffffffffn) >>> 0;
          this.writeRegister(0, low32);
          this.writeRegister(3, high32);
          const hasUpper = high32 !== 0 && !(mnemonic === 'IMUL' && high32 === 0xffffffff && (low32 & 0x80000000) !== 0);
          this.flags.cf = hasUpper;
          this.flags.of = hasUpper;
          this.flags.zf = low32 === 0 && high32 === 0;
          this.flags.sf = (low32 & 0x80000000) !== 0;
          this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT', 'ALU_TO_FLAGS'];
          this.addTrace(
            'EXECUTE',
            `${mnemonic}: EDX:EAX <- ${toHex32(high32)}:${toHex32(low32)}`,
            '64-bit product in EDX:EAX'
          );
          this.instructionCount++;
          this.phase = 'EXECUTE';
          this.nextPhase = 'FETCH';
        }
        break;
      }

      case OPCODES.DIV: {
        const divisor = toUint32(
          src.type === 'MEM' ? this.readMemoryOperandValue(src) : this.latchB
        );
        if (divisor === 0) {
          this.consoleOutput.push({
            id: this.nextConsoleId++,
            cycle: this.cycles,
            type: 'system',
            text: '[CPU EXCEPTION #DE]: Divide by zero error! Execution halted.',
            timestamp: Date.now(),
          });
          this.halted = true;
          this.phase = 'HALTED';
          this.nextPhase = 'HALTED';
          return;
        }
        const eax = toUint32(this.readRegister(0));
        const edx = toUint32(this.readRegister(3));
        const dividend = (BigInt(edx) << 32n) | BigInt(eax);
        const quot = Number(dividend / BigInt(divisor));
        const rem = Number(dividend % BigInt(divisor));
        this.writeRegister(0, quot);
        this.writeRegister(3, rem);
        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace('EXECUTE', `DIV: EAX <- ${quot}, EDX <- ${rem}`, 'Unsigned divide');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.IDIV: {
        const divisor = toInt32(
          src.type === 'MEM' ? this.readMemoryOperandValue(src) : this.latchB
        );
        if (divisor === 0) {
          this.consoleOutput.push({
            id: this.nextConsoleId++,
            cycle: this.cycles,
            type: 'system',
            text: '[CPU EXCEPTION #DE]: Signed divide by zero error! Execution halted.',
            timestamp: Date.now(),
          });
          this.halted = true;
          this.phase = 'HALTED';
          this.nextPhase = 'HALTED';
          return;
        }
        const eax = toInt32(this.readRegister(0));
        const quot = Math.trunc(eax / divisor);
        const rem = eax % divisor;
        this.writeRegister(0, toUint32(quot));
        this.writeRegister(3, toUint32(rem));
        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace('EXECUTE', `IDIV: EAX <- ${quot}, EDX <- ${rem}`, 'Signed divide');
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.ALU_MEM:
      case OPCODES.ADD_RR:
      case OPCODES.ADD_RI:
      case OPCODES.SUB_RR:
      case OPCODES.SUB_RI:
      case OPCODES.AND_RR:
      case OPCODES.AND_RI:
      case OPCODES.OR_RR:
      case OPCODES.OR_RI:
      case OPCODES.XOR_RR:
      case OPCODES.XOR_RI:
      case OPCODES.ADC_RR:
      case OPCODES.ADC_RI:
      case OPCODES.SBB_RR:
      case OPCODES.SBB_RI:
      case OPCODES.CMP_RR:
      case OPCODES.CMP_RI:
      case OPCODES.TEST_RR:
      case OPCODES.TEST_RI: {
        const valA =
          dest.type === 'MEM' ? this.readMemoryOperandValue(dest) : this.latchA;
        const valB =
          src.type === 'MEM' ? this.readMemoryOperandValue(src) : this.latchB;

        let op: ALUOperation = 'ADD';
        if (mnemonic === 'SUB' || mnemonic === 'CMP') op = 'SUB';
        else if (mnemonic === 'AND' || mnemonic === 'TEST') op = 'AND';
        else if (mnemonic === 'OR') op = 'OR';
        else if (mnemonic === 'XOR') op = 'XOR';
        else if (mnemonic === 'ADC') op = 'ADC';
        else if (mnemonic === 'SBB') op = 'SBB';

        const res = ALU.execute(op, valA, valB, this.flags.cf);
        this.aluOut = res.result;
        this.applyALUFlags(res.flags);

        if (mnemonic === 'CMP' || mnemonic === 'TEST') {
          this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_FLAGS'];
          this.addTrace(
            'EXECUTE',
            `${mnemonic}: (${toHex32(valA)}, ${toHex32(valB)}); EFLAGS: ZF=${this.flags.zf ? 1 : 0}, SF=${this.flags.sf ? 1 : 0}, OF=${this.flags.of ? 1 : 0}, CF=${this.flags.cf ? 1 : 0}`,
            `Compared/tested operands and updated condition flags`
          );
          this.instructionCount++;
          this.phase = 'EXECUTE';
          this.nextPhase = 'FETCH';
          break;
        }

        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT', 'ALU_TO_FLAGS'];
        if (dest.type === 'MEM') {
          this.writeMemoryOperandValue(dest, this.aluOut);
          this.addTrace(
            'EXECUTE',
            `${mnemonic} ${dest.rawString} <- ${toHex32(this.aluOut)}`,
            `Computed ${mnemonic} on memory operand`
          );
          this.instructionCount++;
          this.phase = 'EXECUTE';
          this.nextPhase = 'FETCH';
        } else {
          this.addTrace(
            'EXECUTE',
            `ALU_Out <- ${mnemonic}(${toHex32(valA)}, ${toHex32(valB)}) = ${toHex32(this.aluOut)}`,
            `Computed ${mnemonic} and updated EFLAGS`
          );
          this.phase = 'EXECUTE';
          this.nextPhase = 'WRITEBACK';
        }
        break;
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
        const target = dest.imm ?? 0;
        const taken = opcode === OPCODES.JMP ? true : this.checkCondition(mnemonic);

        if (taken) {
          this.eip = toUint32(target);
          this.activeBuses = ['BRANCH_TARGET_TO_EIP'];
          this.addTrace(
            'EXECUTE',
            `${mnemonic} Taken: EIP <- ${toHex32(this.eip)}`,
            `Branch condition met; jumped to ${toHex32(this.eip)}`
          );
        } else {
          this.activeBuses = [];
          this.addTrace(
            'EXECUTE',
            `${mnemonic} Not Taken: Sequential EIP maintained (${toHex32(this.eip)})`,
            `Branch condition not met; continued sequentially`
          );
        }
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.SYSCALL: {
        this.executeSyscall(dest.imm ?? 0x80);
        break;
      }
    }
  }

  private executeStringInstruction(mnemonic: Mnemonic, repPrefix?: 'REP' | 'REPE' | 'REPNE'): void {
    const elemSize = mnemonic.endsWith('B') ? 1 : mnemonic.endsWith('W') ? 2 : 4;
    const stepDelta = (this.flags.df ? -1 : 1) * elemSize;

    const runSingleIteration = (): void => {
      const esi = this.readRegister(4);
      const edi = this.readRegister(5);

      if (mnemonic.startsWith('MOVS')) {
        const opSpec: Operand = {
          type: 'MEM',
          isByte: elemSize === 1,
          isWord: elemSize === 2,
          rawString: '',
        };
        const val = this.readMemoryOperandValue(opSpec, esi);
        this.writeMemoryOperandValue(opSpec, val, edi);
        this.writeRegister(4, toUint32(esi + stepDelta));
        this.writeRegister(5, toUint32(edi + stepDelta));
      } else if (mnemonic.startsWith('STOS')) {
        const eax = this.readRegister(0, elemSize === 2, elemSize === 1, false);
        const opSpec: Operand = {
          type: 'MEM',
          isByte: elemSize === 1,
          isWord: elemSize === 2,
          rawString: '',
        };
        this.writeMemoryOperandValue(opSpec, eax, edi);
        this.writeRegister(5, toUint32(edi + stepDelta));
      } else if (mnemonic.startsWith('LODS')) {
        const opSpec: Operand = {
          type: 'MEM',
          isByte: elemSize === 1,
          isWord: elemSize === 2,
          rawString: '',
        };
        const val = this.readMemoryOperandValue(opSpec, esi);
        this.writeRegister(0, val, elemSize === 2, elemSize === 1, false);
        this.writeRegister(4, toUint32(esi + stepDelta));
      } else if (mnemonic.startsWith('CMPS')) {
        const opSpec: Operand = {
          type: 'MEM',
          isByte: elemSize === 1,
          isWord: elemSize === 2,
          rawString: '',
        };
        const vSrc = this.readMemoryOperandValue(opSpec, esi);
        const vDst = this.readMemoryOperandValue(opSpec, edi);
        const res = ALU.execute('SUB', vSrc, vDst);
        this.applyALUFlags(res.flags);
        this.writeRegister(4, toUint32(esi + stepDelta));
        this.writeRegister(5, toUint32(edi + stepDelta));
      } else if (mnemonic.startsWith('SCAS')) {
        const opSpec: Operand = {
          type: 'MEM',
          isByte: elemSize === 1,
          isWord: elemSize === 2,
          rawString: '',
        };
        const eax = this.readRegister(0, elemSize === 2, elemSize === 1, false);
        const vDst = this.readMemoryOperandValue(opSpec, edi);
        const res = ALU.execute('SUB', eax, vDst);
        this.applyALUFlags(res.flags);
        this.writeRegister(5, toUint32(edi + stepDelta));
      }
    };

    if (!repPrefix) {
      runSingleIteration();
      this.addTrace('EXECUTE', `${mnemonic} executed (ESI=${toHex32(this.readRegister(4))}, EDI=${toHex32(this.readRegister(5))})`, 'String primitive executed');
      return;
    }

    let ecx = toUint32(this.readRegister(2));
    let count = 0;
    const isCompareOrScan = mnemonic.startsWith('CMPS') || mnemonic.startsWith('SCAS');
    while (ecx > 0 && count < 4096) {
      runSingleIteration();
      ecx = toUint32(ecx - 1);
      this.writeRegister(2, ecx);
      count++;
      if (isCompareOrScan) {
        if (repPrefix === 'REPNE' && this.flags.zf) break;
        if ((repPrefix === 'REP' || repPrefix === 'REPE') && !this.flags.zf) break;
      }
    }
    this.addTrace(
      'EXECUTE',
      `${repPrefix} ${mnemonic}: Completed ${count} iteration(s) (ECX=${ecx})`,
      'Hardware repeat string operation completed'
    );
  }

  private executeBitOperation(mnemonic: Mnemonic, dest: Operand, src: Operand): void {
    if (mnemonic === 'BSWAP') {
      const val = toUint32(this.readRegister(dest.reg ?? 0));
      const swapped =
        (((val & 0xff) << 24) |
          (((val >>> 8) & 0xff) << 16) |
          (((val >>> 16) & 0xff) << 8) |
          ((val >>> 24) & 0xff)) >>>
        0;
      this.writeRegister(dest.reg ?? 0, swapped);
      this.addTrace('EXECUTE', `BSWAP ${dest.rawString}: ${toHex32(val)} -> ${toHex32(swapped)}`, 'Byte-swapped endianness');
      return;
    }

    const srcVal =
      src.type === 'IMM'
        ? src.imm ?? 0
        : src.type === 'MEM'
        ? this.readMemoryOperandValue(src)
        : this.readRegister(src.reg ?? 0, src.is16Bit, src.is8Bit, src.is8BitHigh);

    if (mnemonic === 'BSF' || mnemonic === 'BSR') {
      const u = toUint32(srcVal);
      if (u === 0) {
        this.flags.zf = true;
      } else {
        this.flags.zf = false;
        let bitIdx = 0;
        if (mnemonic === 'BSF') {
          while (bitIdx < 32 && ((u >>> bitIdx) & 1) === 0) bitIdx++;
        } else {
          bitIdx = 31;
          while (bitIdx >= 0 && ((u >>> bitIdx) & 1) === 0) bitIdx--;
        }
        this.writeRegister(dest.reg ?? 0, bitIdx, dest.is16Bit);
      }
      this.addTrace('EXECUTE', `${mnemonic} ${dest.rawString}, ${src.rawString} (ZF=${this.flags.zf ? 1 : 0})`, 'Bit scan');
      return;
    }

    // BT, BTS, BTR, BTC
    const bitPos = srcVal & 0x1f;
    let targetVal =
      dest.type === 'MEM'
        ? this.readMemoryOperandValue(dest)
        : this.readRegister(dest.reg ?? 0, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);

    this.flags.cf = ((targetVal >>> bitPos) & 1) === 1;
    if (mnemonic === 'BTS') targetVal = toUint32(targetVal | (1 << bitPos));
    else if (mnemonic === 'BTR') targetVal = toUint32(targetVal & ~(1 << bitPos));
    else if (mnemonic === 'BTC') targetVal = toUint32(targetVal ^ (1 << bitPos));

    if (mnemonic !== 'BT') {
      if (dest.type === 'MEM') {
        this.writeMemoryOperandValue(dest, targetVal);
      } else {
        this.writeRegister(dest.reg ?? 0, targetVal, dest.is16Bit, dest.is8Bit, dest.is8BitHigh);
      }
    }
    this.addTrace('EXECUTE', `${mnemonic} ${dest.rawString}, ${bitPos} -> CF=${this.flags.cf ? 1 : 0}`, 'Bit test/modify');
  }

  private executeSyscall(intNumRaw: number): void {
    const intNum = intNumRaw & 0xff;
    const syscallNum = toInt32(this.readRegister(0)); // EAX

    if (intNum === 0x80 || intNum === 0x21 || intNum === 0) {
      switch (syscallNum) {
        case 1: {
          const status = toInt32(this.readRegister(1));
          this.consoleOutput.push({
            id: this.nextConsoleId++,
            cycle: this.cycles,
            type: 'system',
            text: `[SYSCALL sys_exit]: Process exited normally with status ${status}.`,
            timestamp: Date.now(),
          });
          this.halted = true;
          this.phase = 'HALTED';
          this.nextPhase = 'HALTED';
          this.addTrace('EXECUTE', `INT 0x80 -> sys_exit(status=${status})`, 'Process terminated by system call');
          return;
        }

        case 4: {
          const fd = toInt32(this.readRegister(1));
          const bufAddr = toUint32(this.readRegister(2));
          let count = toInt32(this.readRegister(3));

          if (count <= 0) {
            let cur = bufAddr;
            count = 0;
            while (count < 256 && this.memory.readByte(cur) !== 0) {
              count++;
              cur++;
            }
          }

          const bytes: number[] = [];
          for (let i = 0; i < count; i++) {
            bytes.push(this.memory.readByte(bufAddr + i));
          }

          const text = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
          this.consoleOutput.push({
            id: this.nextConsoleId++,
            cycle: this.cycles,
            type: 'output',
            text: fd === 2 ? `[STDERR]: ${text}` : text,
            timestamp: Date.now(),
          });

          this.writeRegister(0, count);
          this.activeBuses = ['REGS_TO_LATCHES', 'REG_TO_CONSOLE'];
          this.addTrace(
            'EXECUTE',
            `INT 0x80 -> sys_write(fd=${fd}, buf=0x${bufAddr.toString(16)}, count=${count})`,
            `Output string: "${text.replace(/\n/g, '\\n')}"`
          );
          break;
        }

        case 5: {
          const val = toInt32(this.readRegister(1));
          this.consoleOutput.push({
            id: this.nextConsoleId++,
            cycle: this.cycles,
            type: 'output',
            text: `[SYSCALL]: ${val} (${toHex32(val)})`,
            timestamp: Date.now(),
          });
          this.activeBuses = ['REGS_TO_LATCHES', 'REG_TO_CONSOLE'];
          this.addTrace('EXECUTE', `INT 0x80 -> sys_print_int(${val})`, 'Printed integer to system console');
          break;
        }

        case 11: {
          const charCode = this.readRegister(1) & 0xff;
          const charStr = String.fromCharCode(charCode);
          this.consoleOutput.push({
            id: this.nextConsoleId++,
            cycle: this.cycles,
            type: 'output',
            text: charStr,
            timestamp: Date.now(),
          });
          this.activeBuses = ['REGS_TO_LATCHES', 'REG_TO_CONSOLE'];
          this.addTrace('EXECUTE', `INT 0x80 -> sys_print_char('${charStr}')`, 'Printed character to system console');
          break;
        }

        default: {
          this.consoleOutput.push({
            id: this.nextConsoleId++,
            cycle: this.cycles,
            type: 'system',
            text: `[SYSCALL]: Unknown syscall number EAX = ${syscallNum} (EBX = ${this.readRegister(1)})`,
            timestamp: Date.now(),
          });
          break;
        }
      }
    }

    this.instructionCount++;
    this.phase = 'EXECUTE';
    this.nextPhase = 'FETCH';
  }

  private executeMemory(): void {
    if (!this.decoded) return;
    const { opcode, dest, src } = this.decoded;

    if (opcode === OPCODES.MOV_RM || opcode === OPCODES.MOVB_RM || opcode === OPCODES.MOVW_RM) {
      const readSpec: Operand = {
        ...src,
        isByte: opcode === OPCODES.MOVB_RM || src.isByte,
        isWord: opcode === OPCODES.MOVW_RM || src.isWord,
      };
      this.readMemoryOperandValue(readSpec, this.aluOut);
      this.activeBuses = ['ALU_OUT_TO_MAR', 'MEM_TO_MDR'];
      this.addTrace(
        'MEMORY',
        `MAR <- ${toHex32(this.mar)}; MDR <- Data_RAM[${toHex32(this.mar)}] (${toHex32(this.mdr)})`,
        `Loaded value from memory`
      );
      this.phase = 'MEMORY';
      this.nextPhase = 'WRITEBACK';
    } else if (
      opcode === OPCODES.MOV_MR ||
      opcode === OPCODES.MOVB_MR ||
      opcode === OPCODES.MOVW_MR ||
      opcode === OPCODES.MOV_MI
    ) {
      const writeSpec: Operand = {
        ...dest,
        isByte: opcode === OPCODES.MOVB_MR || dest.isByte,
        isWord: opcode === OPCODES.MOVW_MR || dest.isWord,
      };
      const valToWrite = opcode === OPCODES.MOV_MI ? (src.imm ?? 0) : this.latchB;
      this.writeMemoryOperandValue(writeSpec, valToWrite, this.aluOut);
      this.activeBuses = ['ALU_OUT_TO_MAR', 'LATCH_TO_MDR', 'MDR_TO_DATA_MEM'];
      this.addTrace(
        'MEMORY',
        `MAR <- ${toHex32(this.mar)}; MDR <- ${toHex32(this.mdr)}; Data_RAM[${toHex32(this.mar)}] <- MDR`,
        `Stored value to Data RAM`
      );
      this.instructionCount++;
      this.phase = 'MEMORY';
      this.nextPhase = 'FETCH';
    } else {
      this.instructionCount++;
      this.phase = 'MEMORY';
      this.nextPhase = 'FETCH';
    }
  }

  private executeWriteback(): void {
    if (!this.decoded) return;
    const { opcode, dest } = this.decoded;

    if (dest.type === 'REG' && (dest.reg !== undefined || dest.segReg)) {
      let writeVal = this.aluOut;

      if (opcode === OPCODES.MOV_RM || opcode === OPCODES.MOVB_RM || opcode === OPCODES.MOVW_RM) {
        writeVal = this.mdr;
        this.activeBuses = ['MDR_TO_REG_WB'];
      } else {
        this.activeBuses = ['ALU_OUT_TO_REG_WB'];
      }

      this.writeRegister(
        dest.reg ?? 0,
        writeVal,
        dest.is16Bit,
        dest.is8Bit,
        dest.is8BitHigh,
        dest.segReg
      );

      const regName = dest.rawString;
      this.addTrace(
        'WRITEBACK',
        `${regName} <- ${toHex32(writeVal)}`,
        `Updated destination register ${regName}`,
        `Writeback: Stored computed result ${toHex32(writeVal)} (${toInt32(writeVal)}) into ${regName}.`
      );
    }

    this.instructionCount++;
    this.phase = 'WRITEBACK';
    this.nextPhase = 'FETCH';
  }

  private addTrace(
    phase: CPUPhase,
    microOp: string,
    details: string,
    studentExplanation?: string,
    latchAProvenance?: OperandProvenance,
    latchBProvenance?: OperandProvenance
  ): void {
    const record: TraceRecord = {
      id: this.nextTraceId++,
      cycle: this.cycles,
      instructionCount: this.instructionCount,
      eip: this.eip,
      phase,
      microOp,
      studentExplanation: studentExplanation || microOp,
      details,
      activeBuses: [...this.activeBuses],
      latchAProvenance,
      latchBProvenance,
      timestamp: Date.now(),
    };
    this.traceLog.push(record);
    if (this.traceLog.length > 200) {
      this.traceLog.shift();
    }
  }

  public getSnapshot(): CPUMicroState {
    const isInitialHalted = this.phase === 'HALTED' && this.cycles === 0;
    return {
      eip: this.eip,
      oldEip: this.oldEip,
      ir: this.ir,
      irBytes: [...this.irBytes],
      instLength: this.instLength,
      mar: this.mar,
      mdr: this.mdr,
      aluOut: this.aluOut,
      latchA: this.latchA,
      latchB: this.latchB,
      latchASource: this.latchASource,
      latchBSource: this.latchBSource,
      latchBIsImmediate: this.latchBIsImmediate,
      registers: new Uint32Array(this.registers),
      segments: { ...this.segments },
      flags: { ...this.flags },
      phase: this.phase,
      stepPhase: this.stepPhase,
      codeWord: isInitialHalted ? 0 : this.ir,
      decoded: this.decoded ? { ...this.decoded } : null,
      activeBuses: [...this.activeBuses],
      cycles: this.cycles,
      instructionCount: this.instructionCount,
      halted: this.halted,
      lastModifiedReg: this.lastModifiedReg,
      lastModifiedMem: this.lastModifiedMem,
      consoleOutput: [...this.consoleOutput],
      memorySize: this.memory.getSize(),
      dataStart: this.memory.getDataStart(),
      dataEnd: this.memory.getDataEnd(),
      ramPreview: [
        this.memory.readWord(this.memory.getDataStart()),
        this.memory.readWord(this.memory.getDataStart() + 4),
        this.memory.readWord(this.memory.getDataStart() + 8),
        this.memory.readWord(this.memory.getDataStart() + 12),
      ],
    };
  }
}
