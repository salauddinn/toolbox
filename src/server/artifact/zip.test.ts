import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildZip } from "./zip";

function readZipEntries(zip: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 4 <= zip.length) {
    const sig = zip.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const method = zip.readUInt16LE(offset + 8);
    const compSize = zip.readUInt32LE(offset + 18);
    const uncompSize = zip.readUInt32LE(offset + 22);
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const payload = zip.subarray(dataStart, dataStart + compSize);
    const content = method === 0 ? Buffer.from(payload) : inflateRawSync(payload);
    expect(content.length).toBe(uncompSize);
    out.set(name, content);
    offset = dataStart + compSize;
  }
  return out;
}

describe("buildZip", () => {
  it("round-trips text entries with deflate", () => {
    const zip = buildZip([
      { path: "toolbox-validation-report.json", content: '{"ok":true}' },
      { path: "repository/app.js", content: "module.exports = {};\n" },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const entries = readZipEntries(zip);
    expect(entries.get("toolbox-validation-report.json")?.toString("utf8")).toBe('{"ok":true}');
    expect(entries.get("repository/app.js")?.toString("utf8")).toContain("module.exports");
  });
});
