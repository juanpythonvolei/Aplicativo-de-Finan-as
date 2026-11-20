import zlib from 'node:zlib';

export interface ArchiveEntry {
  /** POSIX forward-slash relative path inside the archive */
  path: string;
  content: Buffer | string;
  /** File mode, e.g. 0o755 for executables, 0o644 for normal files */
  mode?: number;
  mtime?: Date;
}

// --- CRC32 Table ---
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosTimeDate(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

/**
 * Pure TypeScript PKZIP archive generator (supports Deflate compression, UTF-8 names, UNIX mode bits).
 */
export function buildZipBuffer(entries: ArchiveEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const cleanPath = entry.path.replace(/^\/+/, '').replace(/\\/g, '/');
    const nameBuf = Buffer.from(cleanPath, 'utf8');
    const rawBuf = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8');
    const compressedBuf = zlib.deflateRawSync(rawBuf, { level: 6 });

    const useDeflate = compressedBuf.length < rawBuf.length;
    const payload = useDeflate ? compressedBuf : rawBuf;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(rawBuf);
    const { dosTime, dosDate } = toDosTimeDate(entry.mtime || new Date());
    const unixMode = (entry.mode ?? 0o644) & 0xffff;
    const externalAttr = ((0o100000 | unixMode) << 16) >>> 0;
    const flags = 0x0800; // UTF-8 filename encoding

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len

    localParts.push(localHeader, nameBuf, payload);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE((3 << 8) | 20, 4); // made by UNIX
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk start
    centralHeader.writeUInt16LE(0, 36); // internal attr
    centralHeader.writeUInt32LE(externalAttr, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

function writeTarOctal(buf: Buffer, offset: number, length: number, value: number) {
  const str = value.toString(8).padStart(length - 1, '0');
  buf.write(str.slice(-(length - 1)), offset, length - 1, 'ascii');
  buf[offset + length - 1] = 0;
}

/**
 * Pure TypeScript POSIX ustar .tar.gz builder preserving executable permissions for Linux installers.
 */
export function buildTarGzBuffer(entries: ArchiveEntry[]): Buffer {
  const chunks: Buffer[] = [];

  for (const entry of entries) {
    const cleanPath = entry.path.replace(/^\/+/, '').replace(/\\/g, '/');
    const dataBuf = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8');

    const header = Buffer.alloc(512, 0);
    let name = cleanPath;
    let prefix = '';

    if (Buffer.byteLength(cleanPath, 'utf8') > 100) {
      const idx = cleanPath.lastIndexOf('/');
      if (idx > 0 && idx <= 155 && cleanPath.length - idx - 1 <= 100) {
        prefix = cleanPath.slice(0, idx);
        name = cleanPath.slice(idx + 1);
      }
    }

    header.write(name, 0, Math.min(100, Buffer.byteLength(name, 'utf8')), 'utf8');
    writeTarOctal(header, 100, 8, entry.mode ?? 0o644);
    writeTarOctal(header, 108, 8, 0); // uid
    writeTarOctal(header, 116, 8, 0); // gid
    writeTarOctal(header, 124, 12, dataBuf.length);
    const mtimeSec = Math.floor((entry.mtime || new Date()).getTime() / 1000);
    writeTarOctal(header, 136, 12, mtimeSec);

    // Checksum placeholder (8 spaces)
    header.fill(0x20, 148, 156);
    header[156] = 0x30; // '0' regular file
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    header.write('root', 265, 4, 'ascii');
    header.write('root', 297, 4, 'ascii');
    if (prefix) {
      header.write(prefix, 345, Math.min(155, Buffer.byteLength(prefix, 'utf8')), 'utf8');
    }

    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    const checksumStr = checksum.toString(8).padStart(6, '0');
    header.write(checksumStr, 148, 6, 'ascii');
    header[154] = 0;
    header[155] = 0x20;

    chunks.push(header);
    chunks.push(dataBuf);

    const remainder = dataBuf.length % 512;
    if (remainder !== 0) {
      chunks.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  // Two 512-byte zero blocks mark end of archive
  chunks.push(Buffer.alloc(1024, 0));
  const tarBuf = Buffer.concat(chunks);
  return zlib.gzipSync(tarBuf, { level: 6 });
}
