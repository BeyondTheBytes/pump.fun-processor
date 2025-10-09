export class BufferReader {
  private buffer: Buffer;
  private offset: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.offset = 8;
  }

  readLengthPrefixedString(offset: number = 4): { value: string, nextOffset: number } {
    const length = this.buffer.readUInt32LE(this.offset);
    this.offset += offset;

    const value = this.buffer.toString('utf8', this.offset, this.offset + length);
    this.offset += length;

    return { value, nextOffset: this.offset };
  };

  readBigUInt64(offset?: number): number {
    const start = offset ?? this.offset;
    if (start + 8 > this.buffer.length) {
      throw new RangeError(`Offset ${start} out of range for buffer length ${this.buffer.length}`);
    }

    const low = this.buffer.readUInt32LE(this.offset);
    const high = this.buffer.readUInt32LE(this.offset + 4);
    return high * 0x100000000 + low;
  }

  reset(buffer: Buffer): void {
    this.buffer = buffer;
    this.offset = 8;
  }

  getOffset(): number {
    return this.offset;
  }

  setOffset(offset: number): void {
    this.offset = offset;
  }
}