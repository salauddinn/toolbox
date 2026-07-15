import { deflateRawSync } from "node:zlib";

/**
 * Minimal ZIP writer (deflate or store). No third-party dependency.
 * Spec: APPNOTE.TXT local file header + central directory + EOCD.
 */
export type ZipEntry = {
  path: string;
  content: Buffer | string;
  /** Prefer deflate for text; store for already-compressed blobs. */
  method?: "store" | "deflate";
};

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function dosDateTime(date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { time: dosTime, date: dosDate };
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/**
 * Build a ZIP archive buffer from entries. Paths use forward slashes.
 */
export function buildZip(entries: readonly ZipEntry[], now = new Date()): Buffer {
  const { time, date } = dosDateTime(now);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
    const nameBuf = Buffer.from(name, "utf8");
    const data =
      typeof entry.content === "string" ? Buffer.from(entry.content, "utf8") : entry.content;
    const method = entry.method ?? "deflate";
    const compressed = method === "store" ? data : deflateRawSync(data, { level: 6 });
    const useStore = method === "store" || compressed.length >= data.length;
    const payload = useStore ? data : compressed;
    const compressionMethod = useStore ? 0 : 8;
    const checksum = crc32(data);

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(compressionMethod),
      u16(time),
      u16(date),
      u32(checksum),
      u32(payload.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      payload,
    ]);

    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(compressionMethod),
      u16(time),
      u16(date),
      u32(checksum),
      u32(payload.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = Buffer.concat(centrals);
  const localBlob = Buffer.concat(locals);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(localBlob.length),
    u16(0),
  ]);

  return Buffer.concat([localBlob, centralDir, eocd]);
}
