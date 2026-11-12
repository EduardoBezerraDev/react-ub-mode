import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import ts from "typescript";
import { getCalleeName } from "./ast-utils.js";
import type { ParsedFile, SourceUnit, UnitKind } from "./types.js";

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-test",
  "build",
  ".next",
  ".nuxt",
  ".vite",
  ".parcel-cache",
  "coverage",
  ".git",
  ".turbo",
  ".cache",
  "out",
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

export function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return (
    TEST_FILE_PATTERN.test(normalized) ||
    normalized.includes("/__tests__/") ||
    normalized.startsWith("__tests__/")
  );
}

export function collectSourceFiles(targetPath: string): string[] {
  const absTarget = resolve(targetPath);
  const stat = statSync(absTarget);

  if (stat.isFile()) {
    return isSupportedSourceFile(absTarget) ? [absTarget] : [];
  }

  const collected: string[] = [];
  walkDirectory(absTarget, collected);
  collected.sort();
  return collected;
}

function isSupportedSourceFile(filePath: string): boolean {
  if (filePath.endsWith(".d.ts")) {
    return false;
  }
  return SOURCE_EXTENSIONS.has(extname(filePath));
}

function walkDirectory(dir: string, acc: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, acc);
    } else if (entry.isFile() && isSupportedSourceFile(fullPath)) {
      acc.push(fullPath);
    }
  }
}

function getScriptKind(filePath: string): ts.ScriptKind {
  const ext = extname(filePath);
  switch (ext) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

export function parseProjectFiles(
  targetPath: string,
  rootDir = resolve(targetPath),
): ParsedFile[] {
  const files = collectSourceFiles(targetPath);
  return files.map((filePath) => parseSingleFile(filePath, rootDir));
}

export function parseSingleFile(
  filePath: string,
  rootDir: string,
): ParsedFile {
  const content = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );
  const rel = relative(rootDir, filePath) || filePath;
  const units = extractSourceUnits(sourceFile, rel);

  return {
    filePath,
    relativePath: rel,
    isTest: isTestFile(rel),
    sourceFile,
    units,
  };
}

function resolveWrapperCallName(parent: ts.Node): string | null {
  if (!ts.isCallExpression(parent)) {
    return null;
  }
  const callee = getCalleeName(parent.expression);
  if (callee !== "memo" && callee !== "forwardRef") {
    return null;
  }
  const grand = parent.parent;
  if (ts.isVariableDeclaration(grand) && ts.isIdentifier(grand.name)) {
    return grand.name.text;
  }
  return null;
}

function resolveVariableOrWrapperName(node: ts.Node): string | null {
  const parent = node.parent;
  if (
    (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) &&
    ts.isIdentifier(parent.name)
  ) {
    return parent.name.text;
  }
  return resolveWrapperCallName(parent);
}

function resolveNamedDeclaration(node: ts.Node): string | null {
  if (ts.isFunctionDeclaration(node)) {
    if (node.name) {
      return node.name.text;
    }
    const isDefault = node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
    );
    return isDefault ? "DefaultExport" : null;
  }
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  return null;
}

function resolveFunctionName(node: ts.Node): string | null {
  const declName = resolveNamedDeclaration(node);
  if (declName) {
    return declName;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (node.name && ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return resolveVariableOrWrapperName(node);
  }
  return null;
}

function containsJsx(node: ts.Node): boolean {
  let found = false;
  function visit(child: ts.Node): void {
    if (found) {
      return;
    }
    if (
      ts.isJsxElement(child) ||
      ts.isJsxSelfClosingElement(child) ||
      ts.isJsxFragment(child)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

function hasReactComponentTypeAnnotation(node: ts.Node): boolean {
  const parent = node.parent;
  if (!ts.isVariableDeclaration(parent) || !parent.type) {
    return false;
  }
  const typeText = parent.type.getText();
  return /\b(FC|FunctionComponent|ReactNode|JSX\.Element)\b/.test(typeText);
}

function classifyUnitKind(name: string, node: ts.Node): UnitKind {
  if (/^use[A-Z0-9]/.test(name)) {
    return "hook";
  }
  if (
    /^[A-Z][A-Za-z0-9]*$/.test(name) &&
    (containsJsx(node) || hasReactComponentTypeAnnotation(node))
  ) {
    return "component";
  }
  if (ts.isMethodDeclaration(node)) {
    return "method";
  }
  return "function";
}

function isTopLevelOrDeclarationUnit(node: ts.Node): boolean {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return Boolean(node.body);
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return resolveFunctionName(node) !== null;
  }
  return false;
}

export function extractSourceUnits(
  sourceFile: ts.SourceFile,
  relativePath: string,
): SourceUnit[] {
  const units: SourceUnit[] = [];

  function visit(node: ts.Node): void {
    if (isTopLevelOrDeclarationUnit(node)) {
      const name = resolveFunctionName(node) ?? "<anonymous>";
      const start = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const startLine = start.line + 1;
      const endLine = end.line + 1;
      units.push({
        id: `${relativePath}:${startLine}:${name}`,
        name,
        kind: classifyUnitKind(name, node),
        filePath: relativePath,
        startLine,
        endLine,
        lineCount: endLine - startLine + 1,
        node,
        sourceFile,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return units;
}
