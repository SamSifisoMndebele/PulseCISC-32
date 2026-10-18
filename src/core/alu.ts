// PulseCISC-32 32-bit Arithmetic Logic Unit (ALU)
import type { EFLAGS } from './types';
import { toUint32, toInt32 } from './isa';

export type ALUOperation =
  | 'ADD'
  | 'ADC'
  | 'SUB'
  | 'SBB'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'NOT'
  | 'NEG'
  | 'INC'
  | 'DEC'
  | 'SHL'
  | 'SHR'
  | 'SAR'
  | 'ROL'
  | 'ROR'
  | 'PASS_A'
  | 'PASS_B';

export interface ALUResult {
  result: number;
  flags: EFLAGS;
}

export class ALU {
  /**
   * Computes ALU operation on two 32-bit operands and generates EFLAGS (ZF, SF, OF, CF).
   */
  public static execute(
    op: ALUOperation,
    a: number,
    b: number,
    carryIn: boolean = false
  ): ALUResult {
    const uA = toUint32(a);
    const uB = toUint32(b);
    const sA = toInt32(a);
    const sB = toInt32(b);

    let rawResult = 0;
    let overflow = false;
    let carry = false;

    switch (op) {
      case 'ADD': {
        const sum = uA + uB;
        rawResult = toUint32(sum);
        carry = sum > 0xffffffff;
        const sRes = toInt32(rawResult);
        overflow = (sA > 0 && sB > 0 && sRes < 0) || (sA < 0 && sB < 0 && sRes >= 0);
        break;
      }
      case 'ADC': {
        const cVal = carryIn ? 1 : 0;
        const sum = uA + uB + cVal;
        rawResult = toUint32(sum);
        carry = sum > 0xffffffff;
        const sRes = toInt32(rawResult);
        overflow = (sA > 0 && sB > 0 && sRes < 0) || (sA < 0 && sB < 0 && sRes >= 0);
        break;
      }
      case 'SUB': {
        rawResult = toUint32(uA - uB);
        carry = uA < uB; // Borrow
        const sRes = toInt32(rawResult);
        overflow = (sA > 0 && sB < 0 && sRes < 0) || (sA < 0 && sB > 0 && sRes >= 0);
        break;
      }
      case 'SBB': {
        const bVal = carryIn ? 1 : 0;
        rawResult = toUint32(uA - uB - bVal);
        carry = uA < uB + bVal; // Borrow
        const sRes = toInt32(rawResult);
        overflow = (sA > 0 && sB < 0 && sRes < 0) || (sA < 0 && sB > 0 && sRes >= 0);
        break;
      }
      case 'INC': {
        rawResult = toUint32(uA + 1);
        carry = carryIn; // Standard x86: INC preserves CF!
        overflow = sA === 0x7fffffff;
        break;
      }
      case 'DEC': {
        rawResult = toUint32(uA - 1);
        carry = carryIn; // Standard x86: DEC preserves CF!
        overflow = sA === -2147483648;
        break;
      }
      case 'NEG': {
        rawResult = toUint32(0 - uA);
        carry = uA !== 0; // CF set if operand != 0
        overflow = sA === -2147483648;
        break;
      }
      case 'NOT': {
        rawResult = toUint32(~uA);
        carry = carryIn;
        overflow = false;
        break;
      }
      case 'AND': {
        rawResult = toUint32(uA & uB);
        carry = false;
        overflow = false;
        break;
      }
      case 'OR': {
        rawResult = toUint32(uA | uB);
        carry = false;
        overflow = false;
        break;
      }
      case 'XOR': {
        rawResult = toUint32(uA ^ uB);
        carry = false;
        overflow = false;
        break;
      }
      case 'SHL': {
        const count = uB & 0x1f;
        if (count === 0) {
          rawResult = uA;
          carry = carryIn;
          overflow = false;
        } else {
          carry = ((uA >>> (32 - count)) & 1) === 1;
          rawResult = toUint32(uA << count);
          overflow = ((rawResult ^ (rawResult << 1)) & 0x80000000) !== 0;
        }
        break;
      }
      case 'SHR': {
        const count = uB & 0x1f;
        if (count === 0) {
          rawResult = uA;
          carry = carryIn;
          overflow = false;
        } else {
          carry = ((uA >>> (count - 1)) & 1) === 1;
          rawResult = toUint32(uA >>> count);
          overflow = (uA & 0x80000000) !== 0;
        }
        break;
      }
      case 'SAR': {
        const count = uB & 0x1f;
        if (count === 0) {
          rawResult = uA;
          carry = carryIn;
          overflow = false;
        } else {
          carry = ((sA >> (count - 1)) & 1) === 1;
          rawResult = toUint32(sA >> count);
          overflow = false;
        }
        break;
      }
      case 'ROL': {
        const count = uB & 0x1f;
        if (count === 0) {
          rawResult = uA;
          carry = carryIn;
        } else {
          rawResult = toUint32((uA << count) | (uA >>> (32 - count)));
          carry = (rawResult & 1) === 1;
          overflow = ((rawResult >>> 31) ^ (carry ? 1 : 0)) === 1;
        }
        break;
      }
      case 'ROR': {
        const count = uB & 0x1f;
        if (count === 0) {
          rawResult = uA;
          carry = carryIn;
        } else {
          rawResult = toUint32((uA >>> count) | (uA << (32 - count)));
          carry = (rawResult & 0x80000000) !== 0;
          overflow = ((rawResult >>> 31) ^ ((rawResult >>> 30) & 1)) === 1;
        }
        break;
      }
      case 'PASS_A': {
        rawResult = uA;
        carry = carryIn;
        overflow = false;
        break;
      }
      case 'PASS_B': {
        rawResult = uB;
        carry = carryIn;
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
        cf: carry,
      },
    };
  }
}
