// PulseCISC-32 Multi-Cycle CPU Simulation Engine
import type {
  ActiveBusId,
  CPUMicroState,
  CPUPhase,
  ConsoleOutputEntry,
  DecodedInstruction,
  EFLAGS,
  OperandProvenance,
  RegisterId,
  TraceRecord,
} from './types';
import { decodeInstruction, toHex32, toUint32, toInt32, OPCODES, REGISTER_NAMES, SUB_REGISTER_NAMES } from './isa';
import { Memory } from './memory';
import { ALU } from './alu';
import type { ALUOperation } from './alu';

export class CPU {
  public memory: Memory;

  // Architectural 32-bit Registers: EAX(0) through ESP(7)
  public registers: Uint32Array = new Uint32Array(8);

  // Special Registers
  public eip: number = 0;
  public oldEip: number = 0;
  public ir: number = 0;
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
  };

  // State Machine
  public phase: CPUPhase = 'HALTED';
  public nextPhase: CPUPhase = 'FETCH';
  public stepPhase?: CPUPhase = 'HALTED';
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

  // System Console Output
  public consoleOutput: ConsoleOutputEntry[] = [];
  private nextConsoleId: number = 1;

  public defaultEsp: number | null = null;

  constructor(memory?: Memory) {
    this.memory = memory ?? new Memory();
    this.reset();
  }

  /**
   * Resets all architectural state to initial values.
   */
  public reset(): void {
    this.eip = 0x0000;
    this.oldEip = 0x0000;
    this.ir = 0;
    this.mar = 0;
    this.mdr = 0;
    this.aluOut = 0;
    this.latchA = 0;
    this.latchB = 0;
    this.latchASource = 'NONE';
    this.latchBSource = 'NONE';
    this.latchBIsImmediate = false;
    this.registers.fill(0);
    // ESP (Stack Pointer) defaults to top of Data Segment (e.g. 0xFFFC for 64KB)
    this.registers[7] = this.defaultEsp ?? (this.memory.getDataEnd() & ~0x3);

    this.flags = { zf: false, sf: false, of: false };
    this.phase = 'HALTED';
    this.nextPhase = 'FETCH';
    this.stepPhase = 'HALTED';
    this.decoded = null;
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
    this.oldEip = this.eip;
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

    const formalRTL = `MAR <- EIP (${toHex32(oldEip)}); IR <- MEM[${toHex32(this.mar)}] (${toHex32(this.ir)}); EIP <- EIP + 4 (${toHex32(this.eip)})`;
    const studentEnglish = `Fetch: Read memory address ${toHex32(oldEip)} into IR; advanced EIP to next instruction (+4 bytes to ${toHex32(this.eip)}).`;

    this.addTrace(
      'FETCH',
      formalRTL,
      `Fetched 32-bit CISC instruction at ${toHex32(oldEip)}`,
      studentEnglish
    );

    this.phase = 'FETCH';
    this.nextPhase = 'DECODE';
  }

  private executeDecode(): void {
    this.decoded = decodeInstruction(this.ir);
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

    // Load operand values into Latches A & B
    if (dest.type === 'REG' && dest.reg !== undefined) {
      this.latchA = this.readRegister(dest.reg, dest.is16Bit);
      const regName = dest.is16Bit ? SUB_REGISTER_NAMES[dest.reg] : REGISTER_NAMES[dest.reg];
      latchASource = `REG(${regName})`;
    } else if (dest.type === 'MEM' && dest.isDirect) {
      this.latchA = 0;
      latchASource = `ADDR(0x${(dest.memOffset ?? 0).toString(16).toUpperCase()})`;
    } else if (dest.type === 'MEM' && dest.memBaseReg !== undefined) {
      this.latchA = this.readRegister(dest.memBaseReg, false);
      latchASource = `MEM_BASE(${REGISTER_NAMES[dest.memBaseReg]})`;
    } else {
      this.latchA = 0;
    }

    if (src.type === 'REG' && src.reg !== undefined) {
      this.latchB = this.readRegister(src.reg, src.is16Bit);
      const regName = src.is16Bit ? SUB_REGISTER_NAMES[src.reg] : REGISTER_NAMES[src.reg];
      latchBSource = `REG(${regName})`;
    } else if (src.type === 'IMM' && src.imm !== undefined) {
      this.latchB = src.imm;
      latchBSource = `IMM(${src.imm})`;
      this.latchBIsImmediate = true;
    } else if (src.type === 'MEM' && src.isDirect) {
      this.latchB = 0;
      latchBSource = `ADDR(0x${(src.memOffset ?? 0).toString(16).toUpperCase()})`;
    } else if (src.type === 'MEM' && src.memBaseReg !== undefined) {
      this.latchB = this.readRegister(src.memBaseReg, false);
      latchBSource = `MEM_BASE(${REGISTER_NAMES[src.memBaseReg]})`;
    } else {
      this.latchB = 0;
    }

    this.latchASource = latchASource;
    this.latchBSource = latchBSource;

    this.activeBuses = ['IR_TO_CU', 'IR_TO_REG_READ', 'REGS_TO_LATCHES'];

    const formalRTL = `Decoded: ${this.decoded.assemblyString}; Latch_A <- ${latchASource} (${toHex32(this.latchA)}); Latch_B <- ${latchBSource} (${toHex32(this.latchB)})`;
    
    let studentEnglish: string;
    if (src.type === 'IMM' && src.imm !== undefined) {
      studentEnglish = `Decode: Identified '${this.decoded.assemblyString}'. Read ${dest.rawString} into Latch A; extracted literal constant ${src.imm} directly into Latch B.`;
    } else if (src.type === 'REG') {
      studentEnglish = `Decode: Identified '${this.decoded.assemblyString}'. Read register ${dest.rawString} into Latch A and register ${src.rawString} into Latch B.`;
    } else if (src.type === 'MEM') {
      studentEnglish = `Decode: Identified '${this.decoded.assemblyString}'. Read base address register ${src.rawString} into Latch B for memory address calculation.`;
    } else {
      studentEnglish = `Decode: Identified '${this.decoded.assemblyString}'. Loaded operands into ALU Latches A & B.`;
    }

    this.addTrace(
      'DECODE',
      formalRTL,
      `Decoded ${mnemonic} with operands (${dest.rawString}, ${src.rawString})`,
      studentEnglish,
      { name: latchASource, type: dest.type, value: this.latchA },
      { name: latchBSource, type: src.type, value: this.latchB }
    );

    this.phase = 'DECODE';
    this.nextPhase = 'EXECUTE';
  }

  private executeExecute(): void {
    if (!this.decoded) return;
    const { opcode, mnemonic, dest, src } = this.decoded;

    switch (opcode) {
      case OPCODES.MOV_RR:
      case OPCODES.MOV_RI: {
        this.aluOut = toUint32(this.latchB);
        this.activeBuses = src.type === 'IMM' ? ['IMM_TO_ALU', 'ALU_TO_ALU_OUT'] : ['LATCHES_TO_ALU', 'ALU_TO_ALU_OUT'];
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
        const studentText = `Execute: Loaded upper 16 bits (0x${((src.imm ?? 0) & 0xffff).toString(16)}) while preserving lower half.`;
        this.addTrace(
          'EXECUTE',
          `ALU_Out <- ${toHex32(this.aluOut)} (MOVH upper 16-bits)`,
          `Loaded upper 16 bits into high half of register`,
          studentText
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'WRITEBACK';
        break;
      }

      case OPCODES.MOV_RM: {
        // Load: Effective address = BaseReg + Offset (or Direct Address)
        const offset = src.memOffset ?? 0;
        this.aluOut = src.isDirect ? toUint32(offset) : toUint32(this.latchB + offset);
        this.activeBuses = ['LATCHES_TO_ALU', 'IMM_TO_ALU', 'ALU_TO_ALU_OUT'];
        const studentText = src.isDirect
          ? `Execute: Direct memory load address = 0x${toUint32(offset).toString(16).toUpperCase()} (${toHex32(this.aluOut)}).`
          : `Execute: Computed memory load address: ${this.latchBSource} (${toHex32(this.latchB)}) + offset (${offset}) = ${toHex32(this.aluOut)}.`;
        this.addTrace(
          'EXECUTE',
          src.isDirect
            ? `Effective Address <- Direct Address (${toHex32(this.aluOut)})`
            : `Effective Address <- Latch_B (${toHex32(this.latchB)}) + Offset (${offset}) = ${toHex32(this.aluOut)}`,
          `Computed memory address for load`,
          studentText
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'MEMORY';
        break;
      }

      case OPCODES.MOV_MR: {
        // Store: Effective address = BaseReg + Offset (or Direct Address)
        const offset = dest.memOffset ?? 0;
        this.aluOut = dest.isDirect ? toUint32(offset) : toUint32(this.latchA + offset);
        this.activeBuses = ['LATCHES_TO_ALU', 'IMM_TO_ALU', 'ALU_TO_ALU_OUT'];
        const studentText = dest.isDirect
          ? `Execute: Direct memory store address = 0x${toUint32(offset).toString(16).toUpperCase()} (${toHex32(this.aluOut)}).`
          : `Execute: Computed memory store address: ${this.latchASource} (${toHex32(this.latchA)}) + offset (${offset}) = ${toHex32(this.aluOut)}.`;
        this.addTrace(
          'EXECUTE',
          dest.isDirect
            ? `Effective Address <- Direct Address (${toHex32(this.aluOut)})`
            : `Effective Address <- Latch_A (${toHex32(this.latchA)}) + Offset (${offset}) = ${toHex32(this.aluOut)}`,
          `Computed memory address for store`,
          studentText
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'MEMORY';
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
        const studentText = `Execute: ALU calculated ${mnemonic}(${toInt32(this.latchA)}, ${toInt32(this.latchB)}) = ${toInt32(this.aluOut)} (${toHex32(this.aluOut)}); updated condition flags (ZF=${this.flags.zf ? 1 : 0}, SF=${this.flags.sf ? 1 : 0}, OF=${this.flags.of ? 1 : 0}).`;
        this.addTrace(
          'EXECUTE',
          `ALU_Out <- ${mnemonic}(${toHex32(this.latchA)}, ${toHex32(this.latchB)}) = ${toHex32(this.aluOut)}; EFLAGS: ZF=${this.flags.zf ? 1 : 0}, SF=${this.flags.sf ? 1 : 0}, OF=${this.flags.of ? 1 : 0}`,
          `Computed ${mnemonic} and updated EFLAGS`,
          studentText
        );
        this.phase = 'EXECUTE';
        this.nextPhase = 'WRITEBACK';
        break;
      }

      case OPCODES.CMP_RR:
      case OPCODES.CMP_RI: {
        // Compute A - B, discard result, update EFLAGS
        const res = ALU.execute('SUB', this.latchA, this.latchB);
        this.flags = res.flags;
        this.activeBuses = ['LATCHES_TO_ALU', 'ALU_TO_FLAGS'];
        const studentText = `Execute: Compared ${dest.rawString} (${toInt32(this.latchA)}) with ${src.rawString} (${toInt32(this.latchB)}). Updated flags (ZF=${this.flags.zf ? 1 : 0}, SF=${this.flags.sf ? 1 : 0}) and discarded difference.`;
        this.addTrace(
          'EXECUTE',
          `CMP: (${toHex32(this.latchA)} - ${toHex32(this.latchB)}); EFLAGS: ZF=${this.flags.zf ? 1 : 0}, SF=${this.flags.sf ? 1 : 0}, OF=${this.flags.of ? 1 : 0}`,
          `Compared operands and updated condition flags`,
          studentText
        );
        // CMP has no writeback phase; finishes in Execute!
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
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
            `Condition met; jumped to ${toHex32(this.eip)}`,
            `Execute: Branch condition met (ZF=1). Overrode sequential flow and jumped to address ${toHex32(this.eip)}.`
          );
        } else {
          this.activeBuses = [];
          this.addTrace(
            'EXECUTE',
            `JE Not Taken (ZF=0): Sequential EIP maintained (${toHex32(this.eip)})`,
            `Condition false; sequential execution continues`,
            `Execute: Branch condition false (ZF=0). Sequential flow maintained at ${toHex32(this.eip)}.`
          );
        }
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
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
            `Condition met; jumped to ${toHex32(this.eip)}`,
            `Execute: Not-equal condition met (ZF=0). Overrode sequential flow and jumped to address ${toHex32(this.eip)}.`
          );
        } else {
          this.activeBuses = [];
          this.addTrace(
            'EXECUTE',
            `JNE Not Taken (ZF=1): Sequential EIP maintained (${toHex32(this.eip)})`,
            `Condition false; sequential execution continues`,
            `Execute: Condition false (ZF=1). Sequential flow maintained at ${toHex32(this.eip)}.`
          );
        }
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.JMP: {
        const target = dest.imm ?? 0;
        this.eip = toUint32(target);
        this.activeBuses = ['JUMP_TARGET_TO_EIP'];
        this.addTrace(
          'EXECUTE',
          `JMP: EIP <- ${toHex32(this.eip)}`,
          `Unconditional jump to ${toHex32(this.eip)}`,
          `Execute: Unconditional jump. Loaded target address ${toHex32(this.eip)} into EIP.`
        );
        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.PRINT: {
        let printText = '';
        if (dest.type === 'REG' && dest.reg !== undefined) {
          const val = this.readRegister(dest.reg, dest.is16Bit);
          const regName = dest.is16Bit ? SUB_REGISTER_NAMES[dest.reg] : REGISTER_NAMES[dest.reg];
          printText = `[OUT]: ${regName} = ${toInt32(val)} (${toHex32(val)})`;
          this.activeBuses = ['REGS_TO_LATCHES', 'REG_TO_CONSOLE'];
        } else if (dest.type === 'IMM') {
          const val = dest.imm ?? 0;
          printText = `[OUT]: ${val} (${toHex32(val)})`;
          this.activeBuses = ['IMM_TO_ALU', 'REG_TO_CONSOLE'];
        }

        this.consoleOutput.push({
          id: this.nextConsoleId++,
          cycle: this.cycles,
          type: 'output',
          text: printText,
          timestamp: Date.now(),
        });

        this.addTrace(
          'EXECUTE',
          `Console <- ${printText}`,
          'Printed result to system console'
        );

        this.instructionCount++;
        this.phase = 'EXECUTE';
        this.nextPhase = 'FETCH';
        break;
      }

      case OPCODES.SYSCALL: {
        const intNum = (dest.imm ?? 0) & 0xff;
        const syscallNum = toInt32(this.readRegister(0)); // EAX

        if (intNum === 0x80 || intNum === 0x21 || intNum === 0) {
          switch (syscallNum) {
            case 1: {
              // sys_exit(EBX: status)
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
              this.addTrace(
                'EXECUTE',
                `INT 0x80 -> sys_exit(status=${status})`,
                'Process terminated by system call'
              );
              return;
            }

            case 4: {
              // sys_write(EBX: fd, ECX: buf, EDX: count)
              const fd = toInt32(this.readRegister(1));
              const bufAddr = toUint32(this.readRegister(2));
              let count = toInt32(this.readRegister(3));

              // If count <= 0, read until null terminator (max 256 bytes)
              if (count <= 0) {
                let cur = bufAddr;
                count = 0;
                while (count < 256 && this.memory.readByte(cur) !== 0) {
                  count++;
                  cur++;
                }
              }

              // Read bytes from memory
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

              // sys_write returns number of bytes written in EAX
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
              // sys_print_int: Print integer in EBX
              const val = toInt32(this.readRegister(1));
              this.consoleOutput.push({
                id: this.nextConsoleId++,
                cycle: this.cycles,
                type: 'output',
                text: `[SYSCALL]: ${val} (${toHex32(val)})`,
                timestamp: Date.now(),
              });
              this.activeBuses = ['REGS_TO_LATCHES', 'REG_TO_CONSOLE'];
              this.addTrace(
                'EXECUTE',
                `INT 0x80 -> sys_print_int(${val})`,
                'Printed integer to system console'
              );
              break;
            }

            case 11: {
              // sys_print_char: Print ASCII char in EBX
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
              this.addTrace(
                'EXECUTE',
                `INT 0x80 -> sys_print_char('${charStr}')`,
                'Printed character to system console'
              );
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
      const studentText = `Memory: Sent address ${toHex32(this.mar)} to RAM; loaded 32-bit word ${toHex32(this.mdr)} into MDR.`;
      this.addTrace(
        'MEMORY',
        `MAR <- ${toHex32(this.mar)}; MDR <- Data_RAM[${toHex32(this.mar)}] (${toHex32(this.mdr)})`,
        `Loaded 32-bit word from memory`,
        studentText
      );
      this.phase = 'MEMORY';
      this.nextPhase = 'WRITEBACK';
    } else if (opcode === OPCODES.MOV_MR) {
      // Store
      this.mar = this.aluOut;
      this.mdr = this.latchB;
      this.memory.writeWord(this.mar, this.mdr);
      this.lastModifiedMem = this.mar;

      // MMIO Console Port at 0x0FF0
      if (this.mar === 0x0ff0) {
        this.consoleOutput.push({
          id: this.nextConsoleId++,
          cycle: this.cycles,
          type: 'output',
          text: `[MMIO 0x0FF0]: ${toInt32(this.mdr)} (${toHex32(this.mdr)})`,
          timestamp: Date.now(),
        });
      }

      this.activeBuses = ['ALU_OUT_TO_MAR', 'LATCH_TO_MDR', 'MDR_TO_DATA_MEM'];
      const studentText = `Memory: Sent target address ${toHex32(this.mar)} into MAR and data ${toHex32(this.mdr)} into MDR; committed write to Data RAM.`;
      this.addTrace(
        'MEMORY',
        `MAR <- ${toHex32(this.mar)}; MDR <- ${toHex32(this.mdr)}; Data_RAM[${toHex32(this.mar)}] <- MDR`,
        `Stored word to Data RAM`,
        studentText
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

      const studentText = `Writeback: Stored computed result ${toHex32(writeVal)} (${toInt32(writeVal)}) into destination register ${regName}.`;
      this.addTrace(
        'WRITEBACK',
        `${regName} <- ${toHex32(writeVal)}`,
        `Updated destination register ${regName}`,
        studentText
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
      mar: this.mar,
      mdr: this.mdr,
      aluOut: this.aluOut,
      latchA: this.latchA,
      latchB: this.latchB,
      latchASource: this.latchASource,
      latchBSource: this.latchBSource,
      latchBIsImmediate: this.latchBIsImmediate,
      registers: new Uint32Array(this.registers),
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
