// PulseCISC-32 High-Level Emulation (HLE) Engine for Irvine32 Library
import { toHex32, toUint32, toInt32 } from './isa';

export const IRVINE_TRAP_BASE = 0x00f00000;
export const IRVINE_TRAP_END = 0x00f000ff;

export const IRVINE_ROUTINES: Record<string, number> = {
  writestring:  IRVINE_TRAP_BASE + 0x00,
  writeint:     IRVINE_TRAP_BASE + 0x04,
  writedec:     IRVINE_TRAP_BASE + 0x08,
  writehex:     IRVINE_TRAP_BASE + 0x0c,
  writehexb:    IRVINE_TRAP_BASE + 0x10,
  writebin:     IRVINE_TRAP_BASE + 0x14,
  writechar:    IRVINE_TRAP_BASE + 0x18,
  crlf:         IRVINE_TRAP_BASE + 0x1c,
  dumpregs:     IRVINE_TRAP_BASE + 0x20,
  dumpmem:      IRVINE_TRAP_BASE + 0x24,
  readint:      IRVINE_TRAP_BASE + 0x28,
  readdec:      IRVINE_TRAP_BASE + 0x2c,
  readchar:     IRVINE_TRAP_BASE + 0x30,
  readstring:   IRVINE_TRAP_BASE + 0x34,
  randomize:    IRVINE_TRAP_BASE + 0x38,
  randomrange:  IRVINE_TRAP_BASE + 0x3c,
  random32:     IRVINE_TRAP_BASE + 0x40,
  clrscr:       IRVINE_TRAP_BASE + 0x44,
  waitmsg:      IRVINE_TRAP_BASE + 0x48,
  delay:        IRVINE_TRAP_BASE + 0x4c,
  exitprocess:  IRVINE_TRAP_BASE + 0x50,
  exit:         IRVINE_TRAP_BASE + 0x50,
};

export const IRVINE_TRAP_MAP = new Map<number, string>(
  Object.entries(IRVINE_ROUTINES).map(([name, addr]) => [addr, name])
);

export function isIrvineTrap(address: number): boolean {
  return address >= IRVINE_TRAP_BASE && address <= IRVINE_TRAP_END;
}

export function getIrvineRoutineName(address: number): string | undefined {
  return IRVINE_TRAP_MAP.get(address);
}

/**
 * Executes an Irvine32 routine directly in host TypeScript (High-Level Emulation).
 * Emulates the routine's side-effects on CPU state, console output, and automatically
 * pops the return address from the stack to resume execution seamlessly.
 */
export function executeIrvineHLE(cpu: any, trapAddr: number): boolean {
  const routineName = IRVINE_TRAP_MAP.get(trapAddr) ?? 'unknown';

  switch (routineName) {
    case 'writestring': {
      // EDX points to a null-terminated string in memory
      const strAddr = toUint32(cpu.readRegister(3));
      let cur = strAddr;
      const bytes: number[] = [];

      while (bytes.length < 4096) {
        const b = cpu.memory.readByte(cur++);
        if (b === 0) break;
        bytes.push(b);
      }

      const text = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'output',
        text,
        timestamp: Date.now(),
      });
      break;
    }

    case 'writeint': {
      // EAX has 32-bit signed integer
      const val = toInt32(cpu.readRegister(0));
      const formatted = (val >= 0 ? '+' : '') + val.toString();
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'output',
        text: formatted,
        timestamp: Date.now(),
      });
      break;
    }

    case 'writedec': {
      // EAX has 32-bit unsigned integer
      const val = toUint32(cpu.readRegister(0));
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'output',
        text: val.toString(),
        timestamp: Date.now(),
      });
      break;
    }

    case 'writehex': {
      // EAX formatted as 8-digit hexadecimal
      const val = toUint32(cpu.readRegister(0));
      const formatted = val.toString(16).toUpperCase().padStart(8, '0') + 'h';
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'output',
        text: formatted,
        timestamp: Date.now(),
      });
      break;
    }

    case 'writehexb': {
      // AL formatted as 2-digit hexadecimal
      const val = cpu.readRegister(0, false, true) & 0xff;
      const formatted = val.toString(16).toUpperCase().padStart(2, '0') + 'h';
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'output',
        text: formatted,
        timestamp: Date.now(),
      });
      break;
    }

    case 'writebin': {
      // EAX formatted as 32-bit binary with nibble spaces
      const val = toUint32(cpu.readRegister(0));
      const binaryStr = val.toString(2).padStart(32, '0');
      const formatted = (binaryStr.match(/.{4}/g)?.join(' ') ?? binaryStr) + 'b';
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'output',
        text: formatted,
        timestamp: Date.now(),
      });
      break;
    }

    case 'writechar': {
      // AL contains ASCII character code
      const charCode = cpu.readRegister(0, false, true) & 0xff;
      const charStr = String.fromCharCode(charCode);
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'output',
        text: charStr,
        timestamp: Date.now(),
      });
      break;
    }

    case 'crlf': {
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'output',
        text: '\n',
        timestamp: Date.now(),
      });
      break;
    }

    case 'dumpregs': {
      const r = (id: number) => toHex32(cpu.readRegister(id));
      const flg = (b: boolean) => (b ? '1' : '0');

      const line1 = `  EAX=${r(0)}  EBX=${r(1)}  ECX=${r(2)}  EDX=${r(3)}`;
      const line2 = `  ESI=${r(4)}  EDI=${r(5)}  EBP=${r(6)}  ESP=${r(7)}`;
      const line3 = `  EFLAGS: CF=${flg(cpu.flags.cf)}  SF=${flg(cpu.flags.sf)}  ZF=${flg(cpu.flags.zf)}  OF=${flg(cpu.flags.of)}`;
      const full = `[Irvine32 DumpRegs]\n${line1}\n${line2}\n${line3}\n`;

      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'system',
        text: full,
        timestamp: Date.now(),
      });
      break;
    }

    case 'dumpmem': {
      const startAddr = toUint32(cpu.readRegister(4)); // ESI
      const count = Math.min(256, Math.max(1, toUint32(cpu.readRegister(2)))); // ECX
      const unitSize = [1, 2, 4].includes(cpu.readRegister(1)) ? cpu.readRegister(1) : 4; // EBX

      const lines: string[] = [`[Irvine32 DumpMem: 0x${startAddr.toString(16).toUpperCase()} (${count} units of ${unitSize}B)]`];
      for (let i = 0; i < count; i++) {
        const addr = startAddr + i * unitSize;
        let hexVal = '';
        if (unitSize === 1) {
          hexVal = cpu.memory.readByte(addr).toString(16).toUpperCase().padStart(2, '0');
        } else if (unitSize === 2) {
          hexVal = cpu.memory.readWord(addr).toString(16).toUpperCase().padStart(4, '0');
        } else {
          hexVal = toHex32(cpu.memory.readWord(addr));
        }
        lines.push(`  [0x${addr.toString(16).toUpperCase().padStart(4, '0')}]: ${hexVal}`);
      }

      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'system',
        text: lines.join('\n') + '\n',
        timestamp: Date.now(),
      });
      break;
    }

    case 'randomize': {
      // Re-seed RNG (using JS Math.random)
      break;
    }

    case 'randomrange': {
      // EAX has upper bound n; returns random in [0, n-1] in EAX
      const n = toInt32(cpu.readRegister(0));
      const res = n > 0 ? Math.floor(Math.random() * n) : 0;
      cpu.writeRegister(0, toUint32(res));
      break;
    }

    case 'random32': {
      // Returns 32-bit random integer in EAX
      const res = Math.floor(Math.random() * 0x100000000) >>> 0;
      cpu.writeRegister(0, res);
      break;
    }

    case 'readint': {
      // Emulate reading integer: default to 0 if no input queue
      cpu.writeRegister(0, 0);
      break;
    }

    case 'readdec': {
      cpu.writeRegister(0, 0);
      break;
    }

    case 'readchar': {
      cpu.writeRegister(0, 0, false, true);
      break;
    }

    case 'readstring': {
      // EDX points to buffer, ECX has max length; returns length in EAX
      cpu.writeRegister(0, 0);
      break;
    }

    case 'clrscr': {
      cpu.consoleOutput = [];
      break;
    }

    case 'waitmsg': {
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'system',
        text: 'Press [Enter] to continue...\n',
        timestamp: Date.now(),
      });
      break;
    }

    case 'delay': {
      // Delay in ms in EAX
      break;
    }

    case 'exitprocess':
    case 'exit': {
      cpu.halted = true;
      cpu.phase = 'HALTED';
      cpu.nextPhase = 'HALTED';
      cpu.addTrace(
        'EXECUTE',
        `Irvine32::${routineName}: CPU Halted`,
        `Program exited cleanly via Irvine32 ${routineName}`,
        `High-Level Emulation: Process terminated cleanly via Irvine32.${routineName}.`
      );
      return true;
    }

    default: {
      cpu.consoleOutput.push({
        id: cpu.nextConsoleId++,
        cycle: cpu.cycles,
        type: 'system',
        text: `[Irvine32 HLE]: Unhandled routine at 0x${trapAddr.toString(16).toUpperCase()}`,
        timestamp: Date.now(),
      });
      break;
    }
  }

  // Pop return address from stack and resume execution
  const currentSp = toUint32(cpu.readRegister(7));
  const returnAddress = toUint32(cpu.memory.readWord(currentSp));
  const newSp = toUint32(currentSp + 4);

  cpu.writeRegister(7, newSp);
  cpu.eip = returnAddress;
  cpu.activeBuses = ['REGS_TO_LATCHES', 'REG_TO_CONSOLE'];
  cpu.instructionCount++;
  cpu.phase = 'EXECUTE';
  cpu.nextPhase = 'FETCH';

  cpu.addTrace(
    'EXECUTE',
    `Irvine32::${routineName}: Stack[${toHex32(currentSp)}] -> EIP (${toHex32(returnAddress)}); ESP <- ${toHex32(newSp)}`,
    `Executed Irvine32 library procedure ${routineName}`,
    `High-Level Emulation: Executed Irvine32.${routineName} and returned to caller at ${toHex32(returnAddress)}.`
  );

  return true;
}
