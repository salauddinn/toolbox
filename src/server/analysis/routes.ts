import type { CallExpression, Expression, MemberExpression, StringLiteral } from "@babel/types";
import type { HttpMethod, RouteEvidence, UnsupportedSyntaxEvidence } from "@/core/analysis";
import type { NormalizedPath } from "@/core/paths";
import type { RepositoryFile } from "@/core/repository";
import { traverse } from "./babel-traverse";
import { parseJavaScript, snippetAround } from "./parse";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all", "use"]);

type Mount = { prefix: string; routerBinding: string; file: NormalizedPath; line: number };
type UnsupportedRouteSyntax = UnsupportedSyntaxEvidence & { routerBinding?: string };

export type RouteExtraction = {
  routes: RouteEvidence[];
  mounts: Mount[];
  unsupported: UnsupportedRouteSyntax[];
};

function isStringLiteral(node: Expression | null | undefined): node is StringLiteral {
  return Boolean(node && node.type === "StringLiteral");
}

function memberName(node: MemberExpression): string | null {
  if (node.computed || node.property.type !== "Identifier") return null;
  return node.property.name;
}

function requireRequest(node: Expression | null | undefined): string | undefined {
  if (
    node?.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "require" &&
    node.arguments[0]?.type === "StringLiteral"
  ) {
    return node.arguments[0].value;
  }
  return undefined;
}

function handlerNamesFromArgs(args: CallExpression["arguments"]): string[] {
  const names: string[] = [];
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.type === "Identifier") names.push(arg.name);
    else if (arg.type === "FunctionExpression") names.push(arg.id?.name ?? "<inline>");
    else if (arg.type === "ArrowFunctionExpression") names.push("<inline>");
    else if (
      arg.type === "MemberExpression" &&
      !arg.computed &&
      arg.property.type === "Identifier"
    ) {
      names.push(arg.property.name);
    }
  }
  return names;
}

function isSupportedHandler(arg: CallExpression["arguments"][number] | undefined): boolean {
  return Boolean(
    arg &&
    (arg.type === "Identifier" ||
      arg.type === "FunctionExpression" ||
      arg.type === "ArrowFunctionExpression" ||
      (arg.type === "MemberExpression" && !arg.computed && arg.property.type === "Identifier")),
  );
}

function unsupportedHandlers(
  args: CallExpression["arguments"],
  file: NormalizedPath,
  line: number,
  content: string,
): UnsupportedRouteSyntax[] {
  const handlers = args.slice(1);
  if (!handlers.length) {
    return [
      {
        kind: "handler",
        reason: "missing_route_handler",
        file,
        line,
        snippet: snippetAround(content, line),
      },
    ];
  }
  return handlers.flatMap((handler) =>
    isSupportedHandler(handler)
      ? []
      : [
          {
            kind: "handler" as const,
            reason: "unsupported_handler_shape" as const,
            file,
            line,
            snippet: snippetAround(content, line),
          },
        ],
  );
}

function bindingKey(file: NormalizedPath, name: string): string {
  return `${file}::${name}`;
}

/**
 * Extract only calls made on application/router variables proven to originate
 * from `require("express")`. This intentionally excludes unrelated APIs such
 * as config.get().
 */
export function extractRoutes(files: readonly RepositoryFile[]): RouteExtraction {
  const routes: RouteEvidence[] = [];
  const mounts: Mount[] = [];
  const unsupported: UnsupportedRouteSyntax[] = [];
  const expressBindings = new Set<string>();
  const routerBindings = new Set<string>();

  // First establish Express factories and the app/router variables created by them.
  for (const file of files) {
    if (!file.path.endsWith(".js")) continue;
    const parsed = parseJavaScript(file.content, file.path);
    if (!parsed.ok) continue;
    traverse(parsed.ast, {
      VariableDeclarator(path) {
        const { id, init } = path.node;
        if (id.type !== "Identifier" || !init) return;
        if (requireRequest(init) === "express") {
          expressBindings.add(bindingKey(file.path, id.name));
          return;
        }
        if (init.type !== "CallExpression") return;
        const callee = init.callee;
        if (
          callee.type === "Identifier" &&
          expressBindings.has(bindingKey(file.path, callee.name))
        ) {
          routerBindings.add(bindingKey(file.path, id.name));
        } else if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.object.type === "Identifier" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "Router" &&
          expressBindings.has(bindingKey(file.path, callee.object.name))
        ) {
          routerBindings.add(bindingKey(file.path, id.name));
        }
      },
      AssignmentExpression(path) {
        const { left, right } = path.node;
        if (left.type !== "Identifier" || right.type !== "CallExpression") return;
        const callee = right.callee;
        if (
          callee.type === "Identifier" &&
          expressBindings.has(bindingKey(file.path, callee.name))
        ) {
          routerBindings.add(bindingKey(file.path, left.name));
        } else if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.object.type === "Identifier" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "Router" &&
          expressBindings.has(bindingKey(file.path, callee.object.name))
        ) {
          routerBindings.add(bindingKey(file.path, left.name));
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
        const call = path.node;
        const line = call.loc?.start.line ?? 1;
        const callee = call.callee;

        // router.route('/x').get(handler) is recognized but intentionally unsupported.
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          HTTP_METHODS.has(callee.property.name) &&
          callee.object.type === "CallExpression" &&
          callee.object.callee.type === "MemberExpression" &&
          !callee.object.callee.computed &&
          callee.object.callee.object.type === "Identifier" &&
          callee.object.callee.property.type === "Identifier" &&
          callee.object.callee.property.name === "route" &&
          routerBindings.has(bindingKey(file.path, callee.object.callee.object.name))
        ) {
          unsupported.push({
            kind: "route",
            reason: "chained_route_registration",
            file: file.path,
            line,
            snippet: snippetAround(file.content, line),
          });
          return;
        }

        if (callee.type !== "MemberExpression" || callee.object.type !== "Identifier") return;
        const object = callee.object.name;
        if (!routerBindings.has(bindingKey(file.path, object))) return;

        if (callee.computed) {
          unsupported.push({
            kind: "route",
            reason: "computed_route_method",
            file: file.path,
            line,
            snippet: snippetAround(file.content, line),
          });
          return;
        }
        const method = memberName(callee);
        if (!method || !HTTP_METHODS.has(method)) return;
        const args = call.arguments;
        const first = args[0] as Expression | undefined;

        if (method === "use") {
          // app.use(express.json()) is middleware, not a mount or route.
          if (!isStringLiteral(first)) {
            if (args.length >= 2) {
              const target = args[args.length - 1];
              unsupported.push({
                kind: "mount",
                reason: "computed_or_non_literal_mount_prefix",
                file: file.path,
                line,
                snippet: snippetAround(file.content, line),
                routerBinding: mountTargetBinding(target),
              });
            }
            return;
          }
          const target = args[args.length - 1];
          const targetBinding = mountTargetBinding(target);
          if (targetBinding) {
            mounts.push({
              prefix: first.value,
              routerBinding: targetBinding,
              file: file.path,
              line,
            });
          }
          const unsupportedReason =
            args.length > 2
              ? "middleware_before_router_mount"
              : requireRequest(target as Expression | undefined)
                ? "direct_require_mount_target"
                : undefined;
          if (unsupportedReason) {
            unsupported.push({
              kind: "mount",
              reason: unsupportedReason,
              file: file.path,
              line,
              snippet: snippetAround(file.content, line),
              routerBinding: targetBinding,
            });
          }
          return;
        }

        if (!isStringLiteral(first)) {
          unsupported.push({
            kind: "route",
            reason: "computed_or_non_literal_route_path",
            file: file.path,
            line,
            snippet: snippetAround(file.content, line),
          });
          return;
        }
        routes.push({
          method: method as HttpMethod,
          path: first.value,
          file: file.path,
          line,
          handlerNames: handlerNamesFromArgs(args),
        });
        unsupported.push(...unsupportedHandlers(args, file.path, line, file.content));
      },
    });
  }
  return { routes, mounts, unsupported };
}

function mountTargetBinding(
  arg: CallExpression["arguments"][number] | undefined,
): string | undefined {
  if (arg?.type === "Identifier") return arg.name;
  const request = requireRequest(arg as Expression | undefined);
  if (request) return `__require__:${request}`;
  if (arg?.type !== "MemberExpression" || arg.computed) return undefined;
  if (arg.object.type === "Identifier") return arg.object.name;
  const memberRequest = requireRequest(arg.object as Expression);
  return memberRequest ? `__require__:${memberRequest}` : undefined;
}

export function applyMountPrefixes(
  routes: RouteEvidence[],
  mounts: RouteExtraction["mounts"],
  requireMap: Map<string, string>,
): RouteEvidence[] {
  const prefixByFile = new Map<string, string>();
  for (const mount of mounts) {
    const resolved = requireMap.get(mount.routerBinding);
    if (!resolved) continue;
    prefixByFile.set(resolved, mount.prefix);
    if (resolved.endsWith("/index.js")) {
      const dir = resolved.replace(/\/index\.js$/, "");
      for (const route of routes) {
        if (route.file.startsWith(`${dir}/`) && route.file.endsWith(".routes.js")) {
          prefixByFile.set(route.file, mount.prefix);
        }
      }
    }
  }
  return routes.map((route) => {
    if (route.mountPrefix) return route;
    const prefix = prefixByFile.get(route.file);
    if (!prefix) return route;
    if (
      route.path === prefix ||
      route.path.startsWith(`${prefix}/`) ||
      route.path.startsWith(prefix)
    ) {
      return { ...route, mountPrefix: prefix };
    }
    return {
      ...route,
      mountPrefix: prefix,
      path: `${prefix.replace(/\/$/, "")}${route.path.startsWith("/") ? route.path : `/${route.path}`}`,
    };
  });
}

/** Collect local and direct require targets for one mounting file. */
export function collectNamedRequires(
  file: RepositoryFile,
  resolve: (from: NormalizedPath, request: string) => NormalizedPath | null,
): Map<string, string> {
  const map = new Map<string, string>();
  const parsed = parseJavaScript(file.content, file.path);
  if (!parsed.ok) return map;
  const resolvedRequest = (request: string): string | undefined =>
    resolve(file.path, request) ?? undefined;
  traverse(parsed.ast, {
    CallExpression(path) {
      const request = requireRequest(path.node as Expression);
      if (request) {
        const resolved = resolvedRequest(request);
        if (resolved) map.set(`__require__:${request}`, resolved);
      }
    },
    VariableDeclarator(path) {
      const { id, init } = path.node;
      if (id.type !== "Identifier" || !init) return;
      const request = requireRequest(init);
      if (request) {
        const resolved = resolvedRequest(request);
        if (resolved) map.set(id.name, resolved);
      } else if (
        init.type === "MemberExpression" &&
        init.object.type === "Identifier" &&
        !init.computed
      ) {
        const resolved = map.get(init.object.name);
        if (resolved) map.set(id.name, resolved);
      }
    },
  });
  return map;
}
