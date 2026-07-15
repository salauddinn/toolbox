import type { Evidence } from "@/core/evidence";
import { assertNormalizedPath, normalizeRepositoryPath, type NormalizedPath } from "@/core/paths";
import type { SourceSnapshot } from "@/core/repository";
import type { SafetyReasonCode, SafetyRejection, SafetyScreeningResult } from "@/core/safety";

const SENSITIVE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "credentials.json",
  "service-account.json",
]);

const SENSITIVE_SUFFIXES = [".pem", ".key", ".p12", ".pfx", ".keystore"];

const SUSPICIOUS_LIFECYCLE_RE =
  /\b(curl|wget|fetch)\b.*\|\s*(ba)?sh\b|\b(curl|wget)\b[^\n]*\b-o\b[^\n]*&&\s*(ba)?sh|\bnode\s+-e\b.*https?:\/\//i;

/** Strip comments so narrative text like "require (static edge)" is not a false positive. */
function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const LIFECYCLE_KEYS = [
  "preinstall",
  "install",
  "postinstall",
  "preuninstall",
  "postuninstall",
  "prepare",
] as const;

function evidenceFor(
  ruleId: string,
  message: string,
  file: NormalizedPath,
  line: number,
  snippet: string,
): Evidence {
  return {
    ruleId,
    message,
    severity: "critical",
    file,
    line,
    snippet: snippet.slice(0, 200),
  };
}

function rejection(
  code: SafetyReasonCode,
  message: string,
  evidence: Evidence[] = [],
): SafetyRejection {
  return { code, message, evidence };
}

function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function isSensitivePath(path: string): boolean {
  const base = baseName(path).toLowerCase();
  if (SENSITIVE_NAMES.has(base)) {
    return true;
  }
  if (base.startsWith(".env.")) {
    return true;
  }
  return SENSITIVE_SUFFIXES.some((suffix) => base.endsWith(suffix));
}

/**
 * Heuristic for obfuscated/minified application source.
 * Avoid flagging normal short files; require long single-line density.
 */
export function looksObfuscatedOrMinified(content: string): boolean {
  const lines = content.split(/\r?\n/);
  if (content.length < 2000) {
    return false;
  }
  const longLines = lines.filter((line) => line.length > 500);
  if (longLines.length === 0) {
    return false;
  }
  const longest = Math.max(...lines.map((l) => l.length));
  const avg = content.length / Math.max(lines.length, 1);
  return longest > 2000 || (avg > 300 && longLines.length >= 3);
}

function lineOfMatch(content: string, index: number): number {
  if (index <= 0) return 1;
  return content.slice(0, index).split(/\r?\n/).length;
}

function screenLifecycleScripts(pkgContent: string): SafetyRejection[] {
  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(pkgContent) as { scripts?: Record<string, string> };
  } catch {
    return [];
  }
  const scripts = pkg.scripts ?? {};
  const out: SafetyRejection[] = [];
  for (const key of LIFECYCLE_KEYS) {
    const value = scripts[key];
    if (!value) continue;
    if (SUSPICIOUS_LIFECYCLE_RE.test(value)) {
      out.push(
        rejection(
          "SAFETY_SUSPICIOUS_LIFECYCLE_SCRIPT",
          `Recognized download-and-execute pattern in npm lifecycle script "${key}"`,
          [
            evidenceFor(
              "SAFETY_SUSPICIOUS_LIFECYCLE_SCRIPT",
              `Suspicious ${key} script`,
              assertNormalizedPath("package.json"),
              1,
              value,
            ),
          ],
        ),
      );
    }
  }
  return out;
}

/**
 * Deterministic Safety Screening before analysis or AI use.
 * Passing is not malware certification.
 */
export function screenRepositorySafety(snapshot: SourceSnapshot): SafetyScreeningResult {
  const rejections: SafetyRejection[] = [];
  const files = [...snapshot.files.values()];

  for (const file of files) {
    // Lockfiles and manifests other than package.json are not application source.
    if (
      file.path.endsWith("package-lock.json") ||
      file.path.endsWith("yarn.lock") ||
      file.path.endsWith("pnpm-lock.yaml")
    ) {
      continue;
    }

    const pathCheck = normalizeRepositoryPath(file.path);
    if (!pathCheck.ok) {
      rejections.push(
        rejection("SAFETY_PATH_TRAVERSAL", pathCheck.message, [
          evidenceFor(
            "SAFETY_PATH_TRAVERSAL",
            pathCheck.message,
            assertNormalizedPath("package.json"),
            1,
            file.path,
          ),
        ]),
      );
      continue;
    }

    if (isSensitivePath(file.path)) {
      rejections.push(
        rejection("SAFETY_SENSITIVE_FILE", `Recognized sensitive file path: ${file.path}`, [
          evidenceFor(
            "SAFETY_SENSITIVE_FILE",
            "Sensitive file path rejected; content redacted",
            file.path,
            1,
            "[redacted]",
          ),
        ]),
      );
    }

    // Only application JavaScript is screened for minification/dynamic code.
    if (!file.path.endsWith(".js")) {
      continue;
    }

    if (looksObfuscatedOrMinified(file.content)) {
      rejections.push(
        rejection(
          "SAFETY_OBFUSCATED_OR_MINIFIED",
          `Obfuscated or minified application source: ${file.path}`,
          [
            evidenceFor(
              "SAFETY_OBFUSCATED_OR_MINIFIED",
              "Minified/obfuscated source",
              file.path,
              1,
              file.content.slice(0, 80),
            ),
          ],
        ),
      );
    }

    if (hasDynamicCodeSignal(file.content)) {
      const cleaned = stripJsComments(file.content);
      const match =
        /\beval\s*\(|\bnew\s+Function\s*\(/.exec(cleaned) ??
        /\brequire\s*\(\s*[^'"`)]/.exec(cleaned) ??
        /\bimport\s*\(\s*[^'"`)]/.exec(cleaned);
      const index = match?.index ?? 0;
      rejections.push(
        rejection(
          "SAFETY_DYNAMIC_CODE_EXECUTION",
          `Dynamic code execution signal in ${file.path}`,
          [
            evidenceFor(
              "SAFETY_DYNAMIC_CODE_EXECUTION",
              "Dynamic code signal",
              file.path,
              lineOfMatch(file.content, index),
              file.content.slice(Math.max(0, index), Math.max(0, index) + 80),
            ),
          ],
        ),
      );
    }
  }

  const pkg = files.find((f) => f.path === "package.json");
  if (pkg) {
    rejections.push(...screenLifecycleScripts(pkg.content));
  }

  if (rejections.length > 0) {
    return { passed: false, rejections };
  }
  return { passed: true };
}

/**
 * Screen raw archive path entries before materialization (path risk fixtures).
 */
export function screenArchivePath(
  rawPath: string,
  options?: { symlink?: boolean },
): SafetyRejection | null {
  if (options?.symlink) {
    return rejection("SAFETY_SYMLINK", "Symbolic links are not allowed", []);
  }
  const normalized = normalizeRepositoryPath(rawPath);
  if (!normalized.ok) {
    if (normalized.code === "PATH_TRAVERSAL" || normalized.code === "PATH_ABSOLUTE") {
      return rejection("SAFETY_PATH_TRAVERSAL", normalized.message, []);
    }
    return rejection("SAFETY_PATH_TRAVERSAL", normalized.message, []);
  }
  if (isSensitivePath(normalized.path)) {
    return rejection("SAFETY_SENSITIVE_FILE", `Sensitive path: ${normalized.path}`, []);
  }
  return null;
}

export function hasBinaryContent(content: string | Buffer): boolean {
  const buf = typeof content === "string" ? Buffer.from(content) : content;
  return buf.includes(0);
}

/** Exposed for false-positive tests. */
export function hasDynamicCodeSignal(content: string): boolean {
  const cleaned = stripJsComments(content);
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(cleaned)) {
    return true;
  }
  const requireRe = /\brequire\s*\(\s*([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = requireRe.exec(cleaned))) {
    const arg = (match[1] ?? "").trim();
    if (!/^['"`]/.test(arg)) {
      return true;
    }
  }
  const importRe = /\bimport\s*\(\s*([^)]*)\)/g;
  while ((match = importRe.exec(cleaned))) {
    const arg = (match[1] ?? "").trim();
    if (!/^['"`]/.test(arg)) {
      return true;
    }
  }
  return false;
}
