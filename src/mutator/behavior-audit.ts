import { basename, dirname, extname, normalize, resolve } from "node:path";
import ts from "typescript";
import { getCalleeName } from "../ast-utils.js";
import type { MutatorAuditIssue, ParsedFile } from "../types.js";

const TEST_RUNNER_CALLS = new Set(["it", "test"]);
const ASSERTION_CALLS = new Set([
  "expect",
  "assert",
  "fail",
  "throws",
  "rejects",
  "doesNotThrow",
]);
const IMPL_COUPLING_METHODS = new Set(["querySelector", "querySelectorAll"]);
const IMPL_COUPLING_PROPS = new Set(["innerHTML"]);

function hasImplementationCoupling(body: ts.Node): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }
    if (ts.isPropertyAccessExpression(node)) {
      const prop = node.name.text;
      if (
        IMPL_COUPLING_PROPS.has(prop) ||
        prop.startsWith("__reactProps$") ||
        prop.startsWith("__reactFiber$")
      ) {
        found = true;
        return;
      }
      if (IMPL_COUPLING_METHODS.has(prop) && ts.isCallExpression(node.parent)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return found;
}

function isAssertionNode(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) {
    return false;
  }
  const leaf = getCalleeName(node.expression);
  if (leaf && ASSERTION_CALLS.has(leaf)) {
    return true;
  }
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "assert"
  ) {
    return true;
  }
  return false;
}

function hasAssertion(body: ts.Node): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }
    if (isAssertionNode(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return found;
}

function extractRelativeImportTargets(file: ParsedFile): string[] {
  const targets: string[] = [];
  const baseDir = dirname(file.relativePath);
  for (const stmt of file.sourceFile.statements) {
    const spec =
      ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : ts.isExportDeclaration(stmt) &&
            stmt.moduleSpecifier &&
            ts.isStringLiteral(stmt.moduleSpecifier)
          ? stmt.moduleSpecifier.text
          : null;
    if (spec && spec.startsWith(".")) {
      const joined = normalize(resolve("/", baseDir, spec))
        .slice(1)
        .replace(/\.(js|jsx|ts|tsx)$/, "")
        .toLowerCase();
      targets.push(joined);
    }
  }
  return targets;
}

function collectTestImports(
  testFiles: readonly ParsedFile[],
  sourceFiles: readonly ParsedFile[],
): Set<string> {
  const byStemPath = new Map<string, ParsedFile>();
  for (const src of sourceFiles) {
    const stemPath = normalize(src.relativePath)
      .replace(/\.(ts|tsx|js|jsx)$/, "")
      .toLowerCase();
    byStemPath.set(stemPath, src);
  }

  const covered = new Set<string>();
  const queue: string[] = [];

  for (const file of testFiles) {
    covered.add(
      basename(file.relativePath)
        .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, "")
        .toLowerCase(),
    );
    for (const target of extractRelativeImportTargets(file)) {
      queue.push(target);
    }
  }

  while (queue.length > 0) {
    const next = queue.pop()!;
    if (covered.has(next)) {
      continue;
    }
    covered.add(next);
    covered.add(basename(next));
    const resolved = byStemPath.get(next);
    if (resolved) {
      for (const dep of extractRelativeImportTargets(resolved)) {
        queue.push(dep);
      }
    }
  }

  return covered;
}

function isSkippableSourceForTestAudit(file: ParsedFile): boolean {
  const name = basename(file.relativePath, extname(file.relativePath));
  return (
    name === "index" ||
    name === "types" ||
    name === "main" ||
    name === "cli" ||
    file.units.length === 0
  );
}

export function auditTests(files: readonly ParsedFile[]): MutatorAuditIssue[] {
  const issues: MutatorAuditIssue[] = [];
  const testFiles = files.filter((f) => f.isTest);
  const sourceFiles = files.filter((f) => !f.isTest);

  for (const file of testFiles) {
    auditSingleTestFile(file, issues);
  }

  if (testFiles.length > 0) {
    const coveredStems = collectTestImports(testFiles, sourceFiles);
    for (const src of sourceFiles) {
      if (isSkippableSourceForTestAudit(src)) {
        continue;
      }
      const relStem = normalize(src.relativePath)
        .replace(/\.(ts|tsx|js|jsx)$/, "")
        .toLowerCase();
      const baseStem = basename(relStem);
      if (!coveredStems.has(relStem) && !coveredStems.has(baseStem)) {
        issues.push({
          kind: "uncovered-file",
          filePath: src.relativePath,
          line: 1,
          message: `Source file '${src.relativePath}' is not referenced by any test file.`,
        });
      }
    }
  }

  return issues;
}

function auditSingleTestFile(
  file: ParsedFile,
  issues: MutatorAuditIssue[],
): void {
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const name = getCalleeName(node.expression);
      if (name && TEST_RUNNER_CALLS.has(name)) {
        const cb = node.arguments[1];
        if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
          if (!hasAssertion(cb.body)) {
            const lc = file.sourceFile.getLineAndCharacterOfPosition(
              node.getStart(file.sourceFile),
            );
            issues.push({
              kind: "no-assertions",
              filePath: file.relativePath,
              line: lc.line + 1,
              message:
                "Test block has no assertions (it would still pass if functions returned nothing).",
            });
          }
          if (hasImplementationCoupling(cb.body)) {
            const lc = file.sourceFile.getLineAndCharacterOfPosition(
              node.getStart(file.sourceFile),
            );
            issues.push({
              kind: "implementation-coupling",
              filePath: file.relativePath,
              line: lc.line + 1,
              message:
                "Test couples to DOM/React internals; prefer accessible queries (getByRole, getByLabelText, getByText).",
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(file.sourceFile);
}
