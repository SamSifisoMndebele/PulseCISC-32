// PulseCISC-32 Variable-Length x86 Disassembler
import { decodeInstruction, decodeInstructionFromBytes, formatBytesHex, toHex32 } from './isa';
import type { DecodedInstruction } from './types';

export interface DisassembledLine {
  address: number;
  byteLength: number;
  hex: string;
  decoded: DecodedInstruction;
  assembly: string;
}

export class Disassembler {
  public static disassembleWord(rawWord: number, eip: number = 0): DisassembledLine {
    const decoded = decodeInstruction(rawWord);
    return {
      address: eip,
      byteLength: decoded.byteLength ?? 4,
      hex: decoded.bytes ? formatBytesHex(decoded.bytes) : toHex32(rawWord),
      decoded,
      assembly: decoded.assemblyString,
    };
  }

  public static disassembleBuffer(bytes: Uint8Array, startAddress: number = 0): DisassembledLine[] {
    const lines: DisassembledLine[] = [];
    let offset = 0;

    while (offset < bytes.length) {
      const addr = startAddress + offset;
      const decoded = decodeInstructionFromBytes(bytes, offset);
      const len = Math.max(1, decoded.byteLength ?? 1);
      const rawBytes = decoded.bytes ?? Array.from(bytes.subarray(offset, offset + len));

      lines.push({
        address: addr,
        byteLength: len,
        hex: formatBytesHex(rawBytes),
        decoded,
        assembly: decoded.assemblyString,
      });

      offset += len;
    }

    return lines;
  }
}
