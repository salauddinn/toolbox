import type { Expression, ObjectExpression, ObjectProperty, StringLiteral } from "@babel/types";
import type {
  ModelAccessEvidence,
  ModelAccessKind,
  ModelEvidence,
  UnsupportedSyntaxEvidence,
} from "@/core/analysis";
import type { NormalizedPath } from "@/core/paths";
import type { RepositoryFile } from "@/core/repository";
import { resolveRelativeRequire } from "./graph";
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
  unsupported: Array<UnsupportedSyntaxEvidence>;
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
export function extractModels(
  files: readonly RepositoryFile[],
  resolve?: (from: NormalizedPath, request: string) => NormalizedPath | null,
): ModelExtraction {
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
              kind: "model",
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
    });
  }

  // A local import is a model binding only when its resolved target actually
  // contains a recognized mongoose.model registration. Basenames are not proof.
  const fileSet = new Set(
    files.filter((file) => file.path.endsWith(".js")).map((file) => file.path),
  );
  const resolveImport =
    resolve ??
    ((from: NormalizedPath, request: string) => resolveRelativeRequire(from, request, fileSet));
  const modelsByFile = new Map<string, string>();
  for (const model of models) {
    if (!modelsByFile.has(model.file)) modelsByFile.set(model.file, model.modelName);
  }
  for (const file of files) {
    if (!file.path.endsWith(".js")) continue;
    const parsed = parseJavaScript(file.content, file.path);
    if (!parsed.ok) continue;
    traverse(parsed.ast, {
      VariableDeclarator(path) {
        const { id, init } = path.node;
        if (
          id.type !== "Identifier" ||
          init?.type !== "CallExpression" ||
          init.callee.type !== "Identifier" ||
          init.callee.name !== "require" ||
          init.arguments[0]?.type !== "StringLiteral"
        )
          return;
        const target = resolveImport(file.path, init.arguments[0].value);
        const modelName = target ? modelsByFile.get(target) : undefined;
        if (modelName) bindings.set(`${file.path}::${id.name}`, modelName);
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
        if (callee.type !== "MemberExpression" || callee.object.type !== "Identifier") return;
        const binding = callee.object.name;
        const modelName = bindings.get(`${file.path}::${binding}`);
        if (!modelName) return;

        const line = path.node.loc?.start.line ?? 1;
        if (callee.computed || callee.property.type !== "Identifier") {
          unsupported.push({
            kind: "crud",
            file: file.path,
            line,
            reason: "computed_crud_method",
            snippet: snippetAround(file.content, line),
          });
          return;
        }

        const methodName = callee.property.name;
        let kind: ModelAccessKind = "unknown";
        if (WRITE_METHODS.has(methodName)) kind = "write";
        else if (READ_METHODS.has(methodName)) kind = "read";
        else {
          unsupported.push({
            kind: "crud",
            file: file.path,
            line,
            reason: "unsupported_crud_method",
            snippet: snippetAround(file.content, line),
          });
          return;
        }

        access.push({
          modelName,
          kind,
          methodName,
          file: file.path,
          line,
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
