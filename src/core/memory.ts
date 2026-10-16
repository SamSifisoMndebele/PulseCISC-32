// PulseRISC-32 4 KB Segmented Byte-Addressable Memory
import { toUint32 } from './isa';

export const MEMORY_SIZE = 4096; // 4 KB
export const CODE_START = 0x0000;
export const CODE_END = 0x07ff; // 2048 bytes (up to 512 instructions)
export const DATA_START = 0x0800;
export const DATA_END = 0x0fff; // 2048 bytes (up to 512 32-bit words)

export class Memory {
  private bytes: Uint8Array;
  private lastModifiedAddress: number | null = null;
  private lastAccessedAddress: number | null = null;

  constructor() {
    this.bytes = new Uint8Array(MEMORY_SIZE);
  }

  /**
   * Resets all memory contents to 0.
   */
  public reset(): void {
    this.bytes.fill(0);
    this.lastModifiedAddress = null;
    this.lastAccessedAddress = null;
  }

  /**
   * Loads assembled machine code bytes into the Code Segment (starting at 0x0000).
   */
  public loadCode(codeBytes: Uint8Array): void {
    // Clear code segment first
    for (let i = CODE_START; i <= CODE_END; i++) {
      this.bytes[i] = 0;
    }
    const len = Math.min(codeBytes.length, CODE_END - CODE_START + 1);
    this.bytes.set(codeBytes.subarray(0, len), CODE_START);
  }

  /**
   * Loads initialized data bytes (e.g. from DB directives) into Data Segment (starting at 0x0800).
   */
  public loadData(dataBytes: Uint8Array, offset: number = DATA_START): void {
    const start = Math.max(DATA_START, Math.min(DATA_END, offset));
    const len = Math.min(dataBytes.length, DATA_END - start + 1);
    this.bytes.set(dataBytes.subarray(0, len), start);
  }

  /**
   * Reads a single byte at address.
   */
  public readByte(addr: number): number {
    const a = addr & 0xfff; // wrap to 4KB
    this.lastAccessedAddress = a;
    return this.bytes[a];
  }

  /**
   * Writes a single byte at address.
   */
  public writeByte(addr: number, val: number): void {
    const a = addr & 0xfff;
    this.bytes[a] = val & 0xff;
    this.lastModifiedAddress = a;
    this.lastAccessedAddress = a;
  }

  /**
   * Reads a 32-bit word in Little-Endian format.
   * Address is aligned to 4 bytes.
   */
  public readWord(addr: number): number {
    const aligned = (addr & 0xfff) & ~0x3;
    this.lastAccessedAddress = aligned;
    const b0 = this.bytes[aligned];
    const b1 = this.bytes[aligned + 1];
    const b2 = this.bytes[aligned + 2];
    const b3 = this.bytes[aligned + 3];
    return toUint32((b3 << 24) | (b2 << 16) | (b1 << 8) | b0);
  }

  /**
   * Writes a 32-bit word in Little-Endian format.
   * Address is aligned to 4 bytes.
   */
  public writeWord(addr: number, value: number): void {
    const aligned = (addr & 0xfff) & ~0x3;
    const u32 = toUint32(value);
    this.bytes[aligned] = u32 & 0xff;
    this.bytes[aligned + 1] = (u32 >>> 8) & 0xff;
    this.bytes[aligned + 2] = (u32 >>> 16) & 0xff;
    this.bytes[aligned + 3] = (u32 >>> 24) & 0xff;
    this.lastModifiedAddress = aligned;
    this.lastAccessedAddress = aligned;
  }

  /**
   * Returns a copy of the raw byte buffer.
   */
  public getRawBytes(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  public getLastModifiedAddress(): number | null {
    return this.lastModifiedAddress;
  }

  public getLastAccessedAddress(): number | null {
    return this.lastAccessedAddress;
  }

  public clearChangeFlags(): void {
    this.lastModifiedAddress = null;
  }
}
