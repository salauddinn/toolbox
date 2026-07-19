import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { loadGitHubRepository } from "./fetch";

function packTar(files: Array<{ name: string; content: string }>): Buffer {
  // Minimal ustar tar builder for tests
  const chunks: Buffer[] = [];
  for (const file of files) {
    const content = Buffer.from(file.content, "utf8");
    const header = Buffer.alloc(512);
    header.write(file.name, 0, 100, "utf8");
    header.write("0000644\0", 100, 8, "utf8"); // mode
    header.write("0000000\0", 108, 8, "utf8"); // uid
    header.write("0000000\0", 116, 8, "utf8"); // gid
    const sizeOct = content.byteLength.toString(8).padStart(11, "0") + "\0";
    header.write(sizeOct, 124, 12, "utf8");
    header.write("00000000000\0", 136, 12, "utf8"); // mtime
    header.write("        ", 148, 8, "utf8"); // checksum placeholder
    header.write("0", 156, 1, "utf8"); // type file
    header.write("ustar\0", 257, 6, "utf8");
    header.write("00", 263, 2, "utf8");
    let sum = 0;
    for (let i = 0; i < 512; i += 1) sum += header[i]!;
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf8");
    chunks.push(header);
    chunks.push(content);
    const pad = 512 - (content.byteLength % 512 || 512);
    if (pad !== 512) chunks.push(Buffer.alloc(pad));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks));
}

describe("loadGitHubRepository", () => {
  it("rejects private repositories even when a token is present", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.github.com/repos/") && !url.includes("tarball")) {
        return new Response(JSON.stringify({ private: true, full_name: "acme/secret" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await loadGitHubRepository("https://github.com/acme/secret", {
      githubToken: "server-token",
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ELIGIBILITY_PRIVATE_REPOSITORY");
    }
  });

  it("loads a public repository archive into a SourceSnapshot", async () => {
    const tarball = packTar([
      {
        name: "acme-app-abc123/package.json",
        content: JSON.stringify({
          name: "app",
          main: "app.js",
          dependencies: { express: "^4.0.0", mongoose: "^8.0.0" },
        }),
      },
      {
        name: "acme-app-abc123/app.js",
        content: "const express = require('express');\nmodule.exports = express();\n",
      },
      {
        name: "acme-app-abc123/package-lock.json",
        content: '{"private":"lockfile-content-must-not-survive"}',
      },
    ]);

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.github.com/repos/") && !url.includes("tarball")) {
        return new Response(JSON.stringify({ private: false, full_name: "acme/app" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/tarball/")) {
        return new Response(new Uint8Array(tarball), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await loadGitHubRepository("https://github.com/acme/app", { fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.sourceLabel).toBe("https://github.com/acme/app");
      expect(result.snapshot.files.has("app.js" as never)).toBe(true);
      expect(result.snapshot.files.has("package.json" as never)).toBe(true);
      expect(result.snapshot.files.has("package-lock.json" as never)).toBe(false);
      expect(result.snapshot.packageManagerEvidence).toEqual([
        { path: "package-lock.json", manager: "npm" },
      ]);
      expect(JSON.stringify(result.snapshot)).not.toContain("lockfile-content-must-not-survive");
      expect(result.snapshot.contentHash.length).toBeGreaterThan(10);
    }
  });

  it("blocks redirects to non-GitHub hosts", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.github.com/repos/") && !url.includes("tarball")) {
        return new Response(JSON.stringify({ private: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/tarball/")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://evil.example.com/payload" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await loadGitHubRepository("https://github.com/acme/app", { fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GITHUB_REDIRECT_BLOCKED");
  });
});
