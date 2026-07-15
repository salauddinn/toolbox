import { parse } from "@babel/parser";
import type { File } from "@babel/types";

export type ParseResult = { ok: true; ast: File } | { ok: false; message: string };

/**
 * Parse CommonJS JavaScript with Babel.
 * Strict enough for route/model extraction; rejects syntax errors.
 */
export function parseJavaScript(source: string, filename: string): ParseResult {
  try {
    const ast = parse(source, {
      sourceType: "script",
      sourceFilename: filename,
      allowReturnOutsideFunction: true,
      errorRecovery: false,
    });
    return { ok: true, ast };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function snippetAround(source: string, line: number, radius = 0): string {
  const lines = source.split(/\r?\n/);
  const index = Math.max(0, line - 1);
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join("\n").slice(0, 200);
}
