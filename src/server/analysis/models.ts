import type { Expression, ObjectExpression, ObjectProperty, StringLiteral } from "@babel/types";
import type { ModelAccessEvidence, ModelAccessKind, ModelEvidence } from "@/core/analysis";
import type { NormalizedPath } from "@/core/paths";
import type { RepositoryFile } from "@/core/repository";
import { traverse } from "./babel-traverse";
import { parseJavaScript, snippetAround } from "./parse";

const WRITE_METHODS = new Set([
  "create",
  "insertMany",
  "save",
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findByIdAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
  "findByIdAndDelete",
  "remove",
  "findOneAndRemove",
]);

const READ_METHODS = new Set([
  "find",
  "findOne",
  "findById",
  "countDocuments",
  "estimatedDocumentCount",
  "exists",
  "aggregate",
  "distinct",
  "where",
]);

export type ModelExtraction = {
  models: ModelEvidence[];
  access: ModelAccessEvidence[];
  unsupported: Array<{ file: NormalizedPath; line: number; reason: string; snippet: string }>;
  /** filePath::localName -> model name */
  bindings: Map<string, string>;
};

function propertyKeyName(prop: ObjectProperty): string | null {
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "StringLiteral") return prop.key.value;
  return null;
}

function collectionFromSchemaOptions(options: Expression | undefined): string | undefined {
  if (!options || options.type !== "ObjectExpression") return undefined;
  for (const prop of (options as ObjectExpression).properties) {
    if (prop.type !== "ObjectProperty") continue;
    if (propertyKeyName(prop) !== "collection") continue;
    if (prop.value.type === "StringLiteral") return prop.value.value;
  }
  return undefined;
}

/**
 * Extract mongoose.model / Schema declarations and classified CRUD access.
 */
export function extractModels(files: readonly RepositoryFile[]): ModelExtraction {
  const models: ModelEvidence[] = [];
  const access: ModelAccessEvidence[] = [];
  const unsupported: ModelExtraction["unsupported"] = [];
  const bindings = new Map<string, string>();
  // filePath::schemaVar -> collection name
  const schemaCollections = new Map<string, string>();

  for (const file of files) {
    if (!file.path.endsWith(".js")) continue;
    const parsed = parseJavaScript(file.content, file.path);
    if (!parsed.ok) continue;

    traverse(parsed.ast, {
      NewExpression(path) {
        const callee = path.node.callee;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "Schema" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "mongoose"
        ) {
          const options = path.node.arguments[1];
          const collection = collectionFromSchemaOptions(
            options && options.type !== "SpreadElement" ? (options as Expression) : undefined,
          );
          if (!collection) return;
          const parent = path.parentPath;
          if (parent?.isVariableDeclarator() && parent.node.id.type === "Identifier") {
            schemaCollections.set(`${file.path}::${parent.node.id.name}`, collection);
          }
        }
      },
      CallExpression(path) {
        const callee = path.node.callee;
        const line = path.node.loc?.start.line ?? 1;

        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "model" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "mongoose"
        ) {
          const nameArg = path.node.arguments[0];
          if (!nameArg || nameArg.type !== "StringLiteral") {
            unsupported.push({
              file: file.path,
              line,
              reason: "non_literal_model_name",
              snippet: snippetAround(file.content, line),
            });
            return;
          }
          const modelName = (nameArg as StringLiteral).value;
          let collectionName: string | undefined;
          const schemaArg = path.node.arguments[1];
          if (schemaArg && schemaArg.type === "Identifier") {
            collectionName = schemaCollections.get(`${file.path}::${schemaArg.name}`);
          }

          models.push({
            modelName,
            collectionName,
            file: file.path,
            line,
            schemaFingerprint: `${modelName}@${file.path}:${line}`,
          });

          const parent = path.parentPath;
          if (parent?.isVariableDeclarator() && parent.node.id.type === "Identifier") {
            bindings.set(`${file.path}::${parent.node.id.name}`, modelName);
          } else if (parent?.isAssignmentExpression() && parent.node.left.type === "Identifier") {
            bindings.set(`${file.path}::${parent.node.left.name}`, modelName);
          } else if (
            parent?.isLogicalExpression() &&
            parent.parentPath?.isVariableDeclarator() &&
            parent.parentPath.node.id.type === "Identifier"
          ) {
            bindings.set(`${file.path}::${parent.parentPath.node.id.name}`, modelName);
          } else if (
            parent?.isLogicalExpression() &&
            parent.parentPath?.isAssignmentExpression() &&
            parent.parentPath.node.left.type === "Identifier"
          ) {
            bindings.set(`${file.path}::${parent.parentPath.node.left.name}`, modelName);
          }
        }
      },
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
          const base = request.split("/").pop()?.replace(/\.js$/, "") ?? "";
          if (base && /^[A-Z]/.test(base)) {
            bindings.set(`${file.path}::${id.name}`, base);
          }
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
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier") return;
        const methodName = callee.property.name;
        if (callee.object.type !== "Identifier") return;
        const binding = callee.object.name;
        const modelName = bindings.get(`${file.path}::${binding}`);
        if (!modelName) return;

        let kind: ModelAccessKind = "unknown";
        if (WRITE_METHODS.has(methodName)) kind = "write";
        else if (READ_METHODS.has(methodName)) kind = "read";
        else return;

        access.push({
          modelName,
          kind,
          methodName,
          file: file.path,
          line: path.node.loc?.start.line ?? 1,
        });
      },
    });
  }

  const seen = new Set<string>();
  const deduped = models.filter((m) => {
    const key = `${m.modelName}@${m.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { models: deduped, access, unsupported, bindings };
}

export function classifyModelMethod(methodName: string): ModelAccessKind | null {
  if (WRITE_METHODS.has(methodName)) return "write";
  if (READ_METHODS.has(methodName)) return "read";
  return null;
}
