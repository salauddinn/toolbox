import traverseImport from "@babel/traverse";
import type { NodePath, Visitor } from "@babel/traverse";
import type { Node, File } from "@babel/types";

type TraverseFn = (
  parent: Node,
  opts: Visitor,
  scope?: unknown,
  state?: unknown,
  parentPath?: NodePath,
) => void;

/**
 * @babel/traverse CJS/ESM interop helper.
 */
export const traverse: TraverseFn =
  typeof traverseImport === "function"
    ? (traverseImport as unknown as TraverseFn)
    : (traverseImport as unknown as { default: TraverseFn }).default;

export type { NodePath, Visitor, File };
