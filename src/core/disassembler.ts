// PulseCISC-32 Disassembler
import { decodeInstruction, toHex32 } from './isa';
import type { DecodedInstruction } from './types';

export interface DisassembledLine {
  address: number;
  hex: string;
  decoded: DecodedInstruction;
  assembly: string;
}

export class Disassembler {
  public static disassembleWord(rawWord: number, eip: number = 0): DisassembledLine {
    const decoded = decodeInstruction(rawWord);
    return {
      address: eip,
      hex: toHex32(rawWord),
      decoded,
      assembly: decoded.assemblyString,
    };
  }

  public static disassembleBuffer(bytes: Uint8Array, startAddress: number = 0): DisassembledLine[] {
    const lines: DisassembledLine[] = [];
    const count = Math.floor(bytes.length / 4);

    for (let i = 0; i < count; i++) {
      const addr = startAddress + i * 4;
      const b0 = bytes[i * 4];
      const b1 = bytes[i * 4 + 1];
      const b2 = bytes[i * 4 + 2];
      const b3 = bytes[i * 4 + 3];
      const rawWord = ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
      lines.push(this.disassembleWord(rawWord, addr));
    }

    return lines;
  }
}
