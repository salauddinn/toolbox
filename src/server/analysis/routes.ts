import type {
  CallExpression,
  Expression,
  Identifier,
  MemberExpression,
  ObjectExpression,
  StringLiteral,
} from "@babel/types";
import type { HttpMethod, RouteEvidence } from "@/core/analysis";
import type { NormalizedPath } from "@/core/paths";
import type { RepositoryFile } from "@/core/repository";
import { traverse } from "./babel-traverse";
import { parseJavaScript, snippetAround } from "./parse";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all", "use"]);

function isStringLiteral(node: Expression | null | undefined): node is StringLiteral {
  return Boolean(node && node.type === "StringLiteral");
}

function memberName(node: MemberExpression): string | null {
  if (node.computed) return null;
  if (node.property.type === "Identifier") return node.property.name;
  return null;
}

function objectName(node: MemberExpression): string | null {
  if (node.object.type === "Identifier") return node.object.name;
  return null;
}

function handlerNamesFromArgs(args: CallExpression["arguments"]): string[] {
  const names: string[] = [];
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.type === "Identifier") {
      names.push(arg.name);
    } else if (arg.type === "FunctionExpression") {
      names.push(arg.id?.name ?? "<inline>");
    } else if (arg.type === "ArrowFunctionExpression") {
      names.push("<inline>");
    } else if (
      arg.type === "MemberExpression" &&
      !arg.computed &&
      arg.property.type === "Identifier"
    ) {
      names.push(arg.property.name);
    }
  }
  return names;
}

export type RouteExtraction = {
  routes: RouteEvidence[];
  mounts: Array<{ prefix: string; routerBinding: string; file: NormalizedPath; line: number }>;
  unsupported: Array<{ file: NormalizedPath; line: number; reason: string; snippet: string }>;
};

/**
 * Extract conventional Express route registrations:
 * - router.<method>(literalPath, ...handlers)
 * - app.use(literalPrefix, importedRouter)
 */
export function extractRoutes(files: readonly RepositoryFile[]): RouteExtraction {
  const routes: RouteEvidence[] = [];
  const mounts: RouteExtraction["mounts"] = [];
  const unsupported: RouteExtraction["unsupported"] = [];

  // binding name -> file where express.Router() was assigned
  const routerBindings = new Map<string, NormalizedPath>();

  for (const file of files) {
    if (!file.path.endsWith(".js")) continue;
    const parsed = parseJavaScript(file.content, file.path);
    if (!parsed.ok) continue;

    traverse(parsed.ast, {
      VariableDeclarator(path) {
        const id = path.node.id;
        const init = path.node.init;
        if (id.type !== "Identifier" || !init) return;
        // const router = express.Router()
        if (
          init.type === "CallExpression" &&
          init.callee.type === "MemberExpression" &&
          objectName(init.callee) !== null &&
          memberName(init.callee) === "Router"
        ) {
          routerBindings.set(`${file.path}::${id.name}`, file.path);
        }
      },
      AssignmentExpression(path) {
        const left = path.node.left;
        const right = path.node.right;
        if (left.type !== "Identifier") return;
        if (
          right.type === "CallExpression" &&
          right.callee.type === "MemberExpression" &&
          memberName(right.callee) === "Router"
        ) {
          routerBindings.set(`${file.path}::${left.name}`, file.path);
        }
      },
    });
  }

  for (const file of files) {
    if (!file.path.endsWith(".js")) continue;
    const parsed = parseJavaScript(file.content, file.path);
    if (!parsed.ok) continue;

    traverse(parsed.ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.type !== "MemberExpression") return;
        const method = memberName(callee);
        if (!method || !HTTP_METHODS.has(method)) return;
        const obj = objectName(callee);
        if (!obj) return;

        const args = path.node.arguments;
        const first = args[0];
        const line = path.node.loc?.start.line ?? 1;

        // app.use(prefix, router)
        if (method === "use") {
          if (!isStringLiteral(first as Expression)) {
            if (first && first.type !== "StringLiteral") {
              unsupported.push({
                file: file.path,
                line,
                reason: "computed_or_non_literal_mount_prefix",
                snippet: snippetAround(file.content, line),
              });
            }
            return;
          }
          const prefix = (first as StringLiteral).value;
          const second = args[1];
          if (second && second.type === "Identifier") {
            mounts.push({
              prefix,
              routerBinding: second.name,
              file: file.path,
              line,
            });
          }
          // Also treat app.use('/x', handler) as a route when more handler-like
          if (args.length >= 2 && second && second.type !== "Identifier") {
            routes.push({
              method: "use",
              path: prefix,
              file: file.path,
              line,
              handlerNames: handlerNamesFromArgs(args),
              mountPrefix: prefix,
            });
          }
          return;
        }

        if (!isStringLiteral(first as Expression)) {
          unsupported.push({
            file: file.path,
            line,
            reason: "computed_or_non_literal_route_path",
            snippet: snippetAround(file.content, line),
          });
          return;
        }

        const routePath = (first as StringLiteral).value;
        routes.push({
          method: method as HttpMethod,
          path: routePath,
          file: file.path,
          line,
          handlerNames: handlerNamesFromArgs(args),
        });
      },
    });
  }

  // Attach mount prefixes when route file exports a router mounted under a prefix.
  // Heuristic: routes in file X get mountPrefix from app.use that requires X.
  return { routes, mounts, unsupported };
}

export function applyMountPrefixes(
  routes: RouteEvidence[],
  mounts: RouteExtraction["mounts"],
  requireMap: Map<string, string>,
): RouteEvidence[] {
  // requireMap: localBinding in entry -> resolved file path
  const prefixByFile = new Map<string, string>();
  for (const mount of mounts) {
    const resolved = requireMap.get(mount.routerBinding);
    if (resolved) {
      prefixByFile.set(resolved, mount.prefix);
    }
  }

  return routes.map((route) => {
    if (route.mountPrefix) return route;
    const prefix = prefixByFile.get(route.file);
    if (!prefix) return route;
    const joined =
      prefix.endsWith("/") || route.path.startsWith("/")
        ? `${prefix.replace(/\/$/, "")}${route.path.startsWith("/") ? route.path : `/${route.path}`}`
        : `${prefix}/${route.path}`;
    return { ...route, mountPrefix: prefix, path: joined || route.path };
  });
}

/** Collect require binding -> resolved path for an entry file. */
export function collectNamedRequires(
  file: RepositoryFile,
  resolve: (from: NormalizedPath, request: string) => NormalizedPath | null,
): Map<string, string> {
  const map = new Map<string, string>();
  const parsed = parseJavaScript(file.content, file.path);
  if (!parsed.ok) return map;

  traverse(parsed.ast, {
    VariableDeclarator(path) {
      const id = path.node.id;
      const init = path.node.init;
      if (id.type !== "Identifier" || !init) return;
      if (
        init.type === "CallExpression" &&
        init.callee.type === "Identifier" &&
        init.callee.name === "require" &&
        init.arguments[0]?.type === "StringLiteral"
      ) {
        const request = (init.arguments[0] as StringLiteral).value;
        const resolved = resolve(file.path, request);
        if (resolved) map.set(id.name, resolved);
      }
    },
  });
  return map;
}

export type { Identifier, ObjectExpression };
