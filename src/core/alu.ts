// PulseCISC-32 32-bit Arithmetic Logic Unit (ALU)
import type { EFLAGS } from './types';
import { toUint32, toInt32 } from './isa';

export type ALUOperation = 'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR' | 'PASS_A' | 'PASS_B';

export interface ALUResult {
  result: number;
  flags: EFLAGS;
}

export class ALU {
  /**
   * Computes ALU operation on two 32-bit operands and generates EFLAGS (ZF, SF, OF).
   */
  public static execute(op: ALUOperation, a: number, b: number): ALUResult {
    const uA = toUint32(a);
    const uB = toUint32(b);
    const sA = toInt32(a);
    const sB = toInt32(b);

    let rawResult = 0;
    let overflow = false;

    switch (op) {
      case 'ADD': {
        rawResult = toUint32(uA + uB);
        const sRes = toInt32(rawResult);
        overflow = (sA > 0 && sB > 0 && sRes < 0) || (sA < 0 && sB < 0 && sRes >= 0);
        break;
      }
      case 'SUB': {
        rawResult = toUint32(uA - uB);
        const sRes = toInt32(rawResult);
        overflow = (sA > 0 && sB < 0 && sRes < 0) || (sA < 0 && sB > 0 && sRes >= 0);
        break;
      }
      case 'AND': {
        rawResult = toUint32(uA & uB);
        overflow = false;
        break;
      }
      case 'OR': {
        rawResult = toUint32(uA | uB);
        overflow = false;
        break;
      }
      case 'XOR': {
        rawResult = toUint32(uA ^ uB);
        overflow = false;
        break;
      }
      case 'PASS_A': {
        rawResult = uA;
        overflow = false;
        break;
      }
      case 'PASS_B': {
        rawResult = uB;
        overflow = false;
        break;
      }
    }

    const zf = rawResult === 0;
    const sf = (rawResult & 0x80000000) !== 0;

    return {
      result: rawResult,
      flags: {
        zf,
        sf,
        of: overflow,
      },
    };
  }
}
