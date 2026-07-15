/**
 * Paths ignored for analysis and Change Set application.
 * Matches the supported repository contract (rough.md).
 */

const IGNORED_DIR_SEGMENTS = new Set([
  "node_modules",
  "bower_components",
  "vendor",
  "dist",
  "build",
  "out",
  "coverage",
  ".git",
  ".svn",
  ".hg",
  ".next",
  ".nuxt",
  ".cache",
  ".turbo",
  "tmp",
  "temp",
  "__pycache__",
]);

const IGNORED_FILE_NAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "npm-shrinkwrap.json",
  "composer.lock",
]);

const IGNORED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".zip",
  ".gz",
  ".tgz",
  ".tar",
  ".7z",
  ".rar",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".class",
  ".o",
  ".a",
  ".wasm",
  ".map",
  ".min.js",
  ".min.css",
]);

export function isIgnoredPath(posixPath: string): boolean {
  const lower = posixPath.toLowerCase();
  const segments = lower.split("/");
  for (const segment of segments) {
    if (IGNORED_DIR_SEGMENTS.has(segment)) {
      return true;
    }
  }
  const base = segments[segments.length - 1] ?? "";
  if (IGNORED_FILE_NAMES.has(base)) {
    return true;
  }
  for (const ext of IGNORED_EXTENSIONS) {
    if (base.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

/** Source files considered for static analysis after ignore filtering. */
export function isAnalyzableSourcePath(posixPath: string): boolean {
  if (isIgnoredPath(posixPath)) {
    return false;
  }
  return posixPath.endsWith(".js") || posixPath === "package.json";
}
