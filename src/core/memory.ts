// PulseRISC-32 / PulseCISC-32 Segmented Byte-Addressable Memory
import { toUint32 } from './isa';

export const DEFAULT_MEMORY_SIZE = 65536; // 64 KB (Updated standard)
export const DEFAULT_CODE_START = 0x0000;
export const DEFAULT_CODE_END = 0x1fff; // 8 KB Code Segment (up to 2048 instructions)
export const DEFAULT_DATA_START = 0x2000; // Data RAM Segment begins at 0x2000 (56 KB RAM)
export const DEFAULT_DATA_END = 0xffff;

// Exported variables for backward compatibility
export let MEMORY_SIZE = DEFAULT_MEMORY_SIZE;
export let CODE_START = DEFAULT_CODE_START;
export let CODE_END = DEFAULT_CODE_END;
export let DATA_START = DEFAULT_DATA_START;
export let DATA_END = DEFAULT_DATA_END;

export class Memory {
  private bytes: Uint8Array;
  private size: number;
  private mask: number;
  private codeStart: number;
  private codeEnd: number;
  private dataStart: number;
  private dataEnd: number;
  private lastModifiedAddress: number | null = null;
  private lastAccessedAddress: number | null = null;

  constructor(size: number = DEFAULT_MEMORY_SIZE, dataStart: number = DEFAULT_DATA_START) {
    this.size = size;
    this.mask = size > 0 && (size & (size - 1)) === 0 ? size - 1 : 0;
    this.codeStart = 0x0000;
    this.dataStart = Math.min(dataStart, Math.max(0, size - 4));
    this.codeEnd = Math.max(0, this.dataStart - 1);
    this.dataEnd = size - 1;
    this.bytes = new Uint8Array(size);

    // Synchronize legacy globals
    MEMORY_SIZE = this.size;
    CODE_START = this.codeStart;
    CODE_END = this.codeEnd;
    DATA_START = this.dataStart;
    DATA_END = this.dataEnd;
  }

  /**
   * Dynamically resizes the memory buffer and updates segmentation limits.
   */
  public resize(newSize: number, newDataStart: number = this.dataStart): void {
    const oldBytes = this.bytes;
    this.size = newSize;
    this.mask = newSize > 0 && (newSize & (newSize - 1)) === 0 ? newSize - 1 : 0;
    this.codeStart = 0x0000;
    this.dataStart = Math.min(newDataStart, Math.max(0, newSize - 4));
    this.codeEnd = Math.max(0, this.dataStart - 1);
    this.dataEnd = newSize - 1;
    this.bytes = new Uint8Array(newSize);

    // Retain previous overlapping memory contents
    const copyLen = Math.min(oldBytes.length, newSize);
    this.bytes.set(oldBytes.subarray(0, copyLen), 0);

    MEMORY_SIZE = this.size;
    CODE_START = this.codeStart;
    CODE_END = this.codeEnd;
    DATA_START = this.dataStart;
    DATA_END = this.dataEnd;
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
   * Loads assembled machine code bytes into the Code Segment (starting at codeStart).
   */
  public loadCode(codeBytes: Uint8Array): void {
    // Clear code segment first
    for (let i = this.codeStart; i <= this.codeEnd; i++) {
      this.bytes[i] = 0;
    }
    const len = Math.min(codeBytes.length, this.codeEnd - this.codeStart + 1);
    this.bytes.set(codeBytes.subarray(0, len), this.codeStart);
  }

  /**
   * Loads initialized data bytes (e.g. from DB directives) into Data Segment (starting at dataStart).
   */
  public loadData(dataBytes: Uint8Array, offset: number = this.dataStart): void {
    const start = Math.max(this.dataStart, Math.min(this.dataEnd, offset));
    const len = Math.min(dataBytes.length, this.dataEnd - start + 1);
    this.bytes.set(dataBytes.subarray(0, len), start);
  }

  /**
   * Reads a single byte at address (masked or wrapped within memory size).
   */
  public readByte(addr: number): number {
    const a = this.mask ? addr & this.mask : ((addr % this.size) + this.size) % this.size;
    this.lastAccessedAddress = a;
    return this.bytes[a];
  }

  /**
   * Writes a single byte at address.
   */
  public writeByte(addr: number, val: number): void {
    const a = this.mask ? addr & this.mask : ((addr % this.size) + this.size) % this.size;
    this.bytes[a] = val & 0xff;
    this.lastModifiedAddress = a;
    this.lastAccessedAddress = a;
  }

  /**
   * Reads a 32-bit word in Little-Endian format.
   * Address is aligned to 4 bytes.
   */
  public readWord(addr: number): number {
    const a = this.mask ? addr & this.mask : ((addr % this.size) + this.size) % this.size;
    const aligned = a & ~0x3;
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
    const a = this.mask ? addr & this.mask : ((addr % this.size) + this.size) % this.size;
    const aligned = a & ~0x3;
    const u32 = toUint32(value);
    this.bytes[aligned] = u32 & 0xff;
    this.bytes[aligned + 1] = (u32 >>> 8) & 0xff;
    this.bytes[aligned + 2] = (u32 >>> 16) & 0xff;
    this.bytes[aligned + 3] = (u32 >>> 24) & 0xff;
    this.lastModifiedAddress = aligned;
    this.lastAccessedAddress = aligned;
  }

  public getSize(): number {
    return this.size;
  }

  public getCodeStart(): number {
    return this.codeStart;
  }

  public getCodeEnd(): number {
    return this.codeEnd;
  }

  public getDataStart(): number {
    return this.dataStart;
  }

  public getDataEnd(): number {
    return this.dataEnd;
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
