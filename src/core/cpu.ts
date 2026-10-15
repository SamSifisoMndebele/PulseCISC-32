// PulseCISC-32 Multi-Cycle CPU Simulation Engine
import type {
  ActiveBusId,
  CPUMicroState,
  CPUPhase,
  DecodedInstruction,
  EFLAGS,
  RegisterId,
  TraceRecord,
} from './types';
import { decodeInstruction, toHex32, toUint32, OPCODES, REGISTER_NAMES, SUB_REGISTER_NAMES } from './isa';
import { Memory } from './memory';
import { ALU } from './alu';
import type { ALUOperation } from './alu';

export class CPU {
  public memory: Memory;

  // Architectural 32-bit Registers: EAX(0) through ESP(7)
  public registers: Uint32Array = new Uint32Array(8);

  // Special Registers
  public eip: number = 0;
  public ir: number = 0;
  public mar: number = 0;
  public mdr: number = 0;
  public aluOut: number = 0;
  public latchA: number = 0;
  public latchB: number = 0;

  // EFLAGS
  public flags: EFLAGS = {
    zf: false,
    sf: false,
    of: false,
  };

  // State Machine
  public phase: CPUPhase = 'FETCH';
  public decoded: DecodedInstruction | null = null;
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

  constructor(memory?: Memory) {
    this.memory = memory ?? new Memory();
    this.reset();
  }

  /**
   * Resets all architectural state to initial values.
   */
  public reset(): void {
    this.eip = 0x0000;
    this.ir = 0;
    this.mar = 0;
    this.mdr = 0;
    this.aluOut = 0;
    this.latchA = 0;
    this.latchB = 0;
    this.registers.fill(0);
    // ESP (Stack Pointer) defaults to 0x0FFC (top of Data Segment)
    this.registers[7] = 0x0ffc;

    this.flags = { zf: false, sf: false, of: false };
    this.phase = 'FETCH';
    this.decoded = null;
    this.activeBuses = [];
    this.cycles = 0;
    this.instructionCount = 0;
    this.halted = false;
    this.lastModifiedReg = null;
    this.lastModifiedMem = null;
    this.traceLog = [];
    this.nextTraceId = 1;
    this.memory.clearChangeFlags();
  }

  /**
   * Reads from a register, optionally taking only the lower 16 bits if is16Bit is true.
   */
  public readRegister(regId: RegisterId, is16Bit: boolean = false): number {
    const full = this.registers[regId];
    return is16Bit ? (full & 0xffff) : full;
  }

  /**
   * Writes to a register. If is16Bit is true, preserves bits [31:16] and updates [15:0].
   */
  public writeRegister(regId: RegisterId, value: number, is16Bit: boolean = false): void {
    const u32 = toUint32(value);
    if (is16Bit) {
      const upper = this.registers[regId] & 0xffff0000;
      const lower = u32 & 0xffff;
      this.registers[regId] = toUint32(upper | lower);
    } else {
      this.registers[regId] = u32;
    }
    this.lastModifiedReg = regId;
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

    switch (this.phase) {
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
    this.mar = this.eip;
    this.ir = this.memory.readWord(this.mar);
    const oldEip = this.eip;
    this.eip = toUint32(this.eip + 4);

    this.activeBuses = [
      'EIP_TO_MAR',
      'MAR_TO_CODE_MEM',
      'CODE_MEM_TO_IR',
      'EIP_INCREMENT',
    ];

    this.addTrace(
      'FETCH',
      `MAR <- EIP (${toHex32(oldEip)}); IR <- MEM[${toHex32(this.mar)}] (${toHex32(this.ir)}); EIP <- EIP + 4 (${toHex32(this.eip)})`,
      `Fetched 32-bit CISC instruction at ${toHex32(oldEip)}`
    );

    this.phase = 'DECODE';
  }

  private executeDecode(): void {
    this.decoded = decodeInstruction(this.ir);
    const { mnemonic, opcode, dest, src } = this.decoded;

    if (opcode === OPCODES.HLT) {
      this.phase = 'HALTED';
      this.halted = true;
      this.activeBuses = ['IR_TO_CU'];
      this.addTrace('DECODE', 'HLT instruction decoded. CPU halted.', 'Processor clock stopped.');
      return;
    }

    // Load operand values into Latches A & B
    if (dest.type === 'REG' && dest.reg !== undefined) {
      this.latchA = this.readRegister(dest.reg, dest.is16Bit);
    } else if (dest.type === 'MEM' && dest.memBaseReg !== undefined) {
      this.latchA = this.readRegister(dest.memBaseReg, false);
    } else {
      this.latchA = 0;
    }

    if (src.type === 'REG' && src.reg !== undefined) {
      this.latchB = this.readRegister(src.reg, src.is16Bit);
    } else if (src.type === 'IMM' && src.imm !== undefined) {
      this.latchB = src.imm;
    } else if (src.type === 'MEM' && src.memBaseReg !== undefined) {
      this.latchB = this.readRegister(src.memBaseReg, false);
    } else {
      this.latchB = 0;
    }

    this.activeBuses = ['IR_TO_CU', 'IR_TO_REG_READ', 'REGS_TO_LATCHES'];

    this.addTrace(
      'DECODE',
      `Decoded: ${this.decoded.assemblyString}; Latch_A <- ${toHex32(this.latchA)}; Latch_B <- ${toHex32(this.latchB)}`,
      `Decoded ${mnemonic} with operands (${dest.rawString}, ${src.rawString})`
    );

    this.phase = 'EXECUTE';
  }

  private executeExecute(): void {
    if (!this.decoded) return;
    const { opcode, mnemonic, dest, src } = this.decoded;

    switch (opcode) {
      case OPCODES.MOV_RR:
      case OPCODES.MOV_RI: {
        this.aluOut = toUint32(this.latchB);
        this.activeBuses = src.type === 'IMM' ? ['IMM_TO_ALU', 'ALU_TO_ALU_OUT'] : ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace(
          'EXECUTE',
          `ALU_Out <- ${toHex32(this.aluOut)} (MOV transfer)`,
          `Prepared value for register writeback`
        );
        this.phase = 'WRITEBACK';
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
          `Loaded upper 16 bits into high half of register`
        );
        this.phase = 'WRITEBACK';
        break;
      }

      case OPCODES.MOV_RM: {
        // Load: Effective address = BaseReg + Offset
        const offset = src.memOffset ?? 0;
        this.aluOut = toUint32(this.latchB + offset);
        this.activeBuses = ['LATCHES_TO_ALU', 'IMM_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace(
          'EXECUTE',
          `Effective Address <- Latch_B (${toHex32(this.latchB)}) + Offset (${offset}) = ${toHex32(this.aluOut)}`,
          `Computed memory address for load`
        );
        this.phase = 'MEMORY';
        break;
      }

      case OPCODES.MOV_MR: {
        // Store: Effective address = BaseReg + Offset
        const offset = dest.memOffset ?? 0;
        this.aluOut = toUint32(this.latchA + offset);
        this.activeBuses = ['LATCHES_TO_ALU', 'IMM_TO_ALU', 'ALU_TO_ALU_OUT'];
        this.addTrace(
          'EXECUTE',
          `Effective Address <- Latch_A (${toHex32(this.latchA)}) + Offset (${offset}) = ${toHex32(this.aluOut)}`,
          `Computed memory address for store`
        );
        this.phase = 'MEMORY';
        break;
      }

      case OPCODES.ADD_RR:
      case OPCODES.ADD_RI:
      case OPCODES.SUB_RR:
      case OPCODES.SUB_RI:
      case OPCODES.AND_RR:
      case OPCODES.AND_RI:
      case OPCODES.OR_RR:
      case OPCODES.OR_RI:
      case OPCODES.XOR_RR:
      case OPCODES.XOR_RI: {
        let op: ALUOperation = 'ADD';
        if (mnemonic === 'SUB') op = 'SUB';
        else if (mnemonic === 'AND') op = 'AND';
        else if (mnemonic === 'OR') op = 'OR';
        else if (mnemonic === 'XOR') op = 'XOR';

        const res = ALU.execute(op, this.latchA, this.latchB);
        this.aluOut = res.result;
        this.flags = res.flags;

        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT', 'ALU_TO_FLAGS'];
        this.addTrace(
          'EXECUTE',
          `ALU_Out <- ${mnemonic}(${toHex32(this.latchA)}, ${toHex32(this.latchB)}) = ${toHex32(this.aluOut)}; EFLAGS: ZF=${this.flags.zf ? 1 : 0}, SF=${this.flags.sf ? 1 : 0}, OF=${this.flags.of ? 1 : 0}`,
          `Computed ${mnemonic} and updated EFLAGS`
        );
        this.phase = 'WRITEBACK';
        break;
      }

      case OPCODES.CMP_RR:
      case OPCODES.CMP_RI: {
        // Compute A - B, discard result, update EFLAGS
        const res = ALU.execute('SUB', this.latchA, this.latchB);
        this.flags = res.flags;
        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_FLAGS'];
        this.addTrace(
          'EXECUTE',
          `CMP: (${toHex32(this.latchA)} - ${toHex32(this.latchB)}); EFLAGS: ZF=${this.flags.zf ? 1 : 0}, SF=${this.flags.sf ? 1 : 0}, OF=${this.flags.of ? 1 : 0}`,
          `Compared operands and updated condition flags`
        );
        // CMP has no writeback phase; finishes in Execute!
        this.instructionCount++;
        this.phase = 'FETCH';
        break;
      }

      case OPCODES.JE: {
        const target = dest.imm ?? 0;
        if (this.flags.zf) {
          this.eip = toUint32(target);
          this.activeBuses = ['BRANCH_TARGET_TO_EIP'];
          this.addTrace(
            'EXECUTE',
            `JE Taken (ZF=1): EIP <- ${toHex32(this.eip)}`,
            `Condition met; jumped to ${toHex32(this.eip)}`
          );
        } else {
          this.activeBuses = [];
          this.addTrace(
            'EXECUTE',
            `JE Not Taken (ZF=0): Sequential EIP maintained (${toHex32(this.eip)})`,
            `Condition false; sequential execution continues`
          );
        }
        this.instructionCount++;
        this.phase = 'FETCH';
        break;
      }

      case OPCODES.JNE: {
        const target = dest.imm ?? 0;
        if (!this.flags.zf) {
          this.eip = toUint32(target);
          this.activeBuses = ['BRANCH_TARGET_TO_EIP'];
          this.addTrace(
            'EXECUTE',
            `JNE Taken (ZF=0): EIP <- ${toHex32(this.eip)}`,
            `Condition met; jumped to ${toHex32(this.eip)}`
          );
        } else {
          this.activeBuses = [];
          this.addTrace(
            'EXECUTE',
            `JNE Not Taken (ZF=1): Sequential EIP maintained (${toHex32(this.eip)})`,
            `Condition false; sequential execution continues`
          );
        }
        this.instructionCount++;
        this.phase = 'FETCH';
        break;
      }

      case OPCODES.JMP: {
        const target = dest.imm ?? 0;
        this.eip = toUint32(target);
        this.activeBuses = ['JUMP_TARGET_TO_EIP'];
        this.addTrace(
          'EXECUTE',
          `JMP: EIP <- ${toHex32(this.eip)}`,
          `Unconditional jump to ${toHex32(this.eip)}`
        );
        this.instructionCount++;
        this.phase = 'FETCH';
        break;
      }
    }
  }

  private executeMemory(): void {
    if (!this.decoded) return;
    const { opcode } = this.decoded;

    if (opcode === OPCODES.MOV_RM) {
      // Load
      this.mar = this.aluOut;
      this.mdr = this.memory.readWord(this.mar);
      this.activeBuses = ['ALU_OUT_TO_MAR', 'MEM_TO_MDR'];
      this.addTrace(
        'MEMORY',
        `MAR <- ${toHex32(this.mar)}; MDR <- Data_RAM[${toHex32(this.mar)}] (${toHex32(this.mdr)})`,
        `Loaded 32-bit word from memory`
      );
      this.phase = 'WRITEBACK';
    } else if (opcode === OPCODES.MOV_MR) {
      // Store
      this.mar = this.aluOut;
      this.mdr = this.latchB;
      this.memory.writeWord(this.mar, this.mdr);
      this.lastModifiedMem = this.mar;
      this.activeBuses = ['ALU_OUT_TO_MAR', 'LATCH_TO_MDR', 'MDR_TO_DATA_MEM'];
      this.addTrace(
        'MEMORY',
        `MAR <- ${toHex32(this.mar)}; MDR <- ${toHex32(this.mdr)}; Data_RAM[${toHex32(this.mar)}] <- MDR`,
        `Stored word to Data RAM`
      );
      this.instructionCount++;
      this.phase = 'FETCH';
    } else {
      this.phase = 'FETCH';
    }
  }

  private executeWriteback(): void {
    if (!this.decoded) return;
    const { opcode, dest } = this.decoded;

    if (dest.type === 'REG' && dest.reg !== undefined) {
      const regName = dest.is16Bit ? SUB_REGISTER_NAMES[dest.reg] : REGISTER_NAMES[dest.reg];
      let writeVal = this.aluOut;

      if (opcode === OPCODES.MOV_RM) {
        writeVal = this.mdr;
        this.activeBuses = ['MDR_TO_REG_WB'];
      } else {
        this.activeBuses = ['ALU_OUT_TO_REG_WB'];
      }

      this.writeRegister(dest.reg, writeVal, dest.is16Bit);

      this.addTrace(
        'WRITEBACK',
        `${regName} <- ${toHex32(writeVal)}`,
        `Updated destination register ${regName}`
      );
    }

    this.instructionCount++;
    this.phase = 'FETCH';
  }

  private addTrace(phase: CPUPhase, microOp: string, details: string): void {
    const record: TraceRecord = {
      id: this.nextTraceId++,
      cycle: this.cycles,
      instructionCount: this.instructionCount,
      eip: this.eip,
      phase,
      microOp,
      details,
      activeBuses: [...this.activeBuses],
      timestamp: Date.now(),
    };
    this.traceLog.push(record);
    if (this.traceLog.length > 100) {
      this.traceLog.shift();
    }
  }

  public getSnapshot(): CPUMicroState {
    return {
      eip: this.eip,
      ir: this.ir,
      mar: this.mar,
      mdr: this.mdr,
      aluOut: this.aluOut,
      latchA: this.latchA,
      latchB: this.latchB,
      registers: new Uint32Array(this.registers),
      flags: { ...this.flags },
      phase: this.phase,
      decoded: this.decoded ? { ...this.decoded } : null,
      activeBuses: [...this.activeBuses],
      cycles: this.cycles,
      instructionCount: this.instructionCount,
      halted: this.halted,
      lastModifiedReg: this.lastModifiedReg,
      lastModifiedMem: this.lastModifiedMem,
    };
  }
}
