import ts from "typescript";
import { getCalleeName } from "../ast-utils.js";
import type { AuditDiagnostic, ParsedFile, SourceUnit } from "../types.js";
import { createDiagnostic } from "./shared.js";

const VALIDATOR_CALL_PATTERN =
  /^(parse|safeParse|validate|decode|assert|is[A-Z])/;
const STORAGE_METHOD_PATTERN = /^(getItem)$/;
const SAFE_EFFECT_HOOKS = new Set([
  "useEffect",
  "useLayoutEffect",
  "useInsertionEffect",
]);
const SSR_UNSAFE_GLOBALS = new Set(["window", "document", "localStorage", "sessionStorage"]);

function isWrappedInParserCall(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isCallExpression(current)) {
      const calleeText = getCalleeName(current.expression);
      if (calleeText && VALIDATOR_CALL_PATTERN.test(calleeText)) {
        return true;
      }
    }
    if (ts.isFunctionLike(current) || ts.isBlock(current)) {
      break;
    }
    current = current.parent;
  }
  return false;
}

function isUnparsedBoundaryCall(node: ts.CallExpression): string | null {
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) {
    return null;
  }
  const prop = expr.name.text;
  const objText = expr.expression.getText();
  if (objText === "JSON" && prop === "parse") {
    return "JSON.parse(...)";
  }
  if (
    (objText === "localStorage" || objText === "sessionStorage") &&
    STORAGE_METHOD_PATTERN.test(prop)
  ) {
    return `${objText}.${prop}(...)`;
  }
  if (prop === "json" && node.arguments.length === 0) {
    return `${objText}.json()`;
  }
  return null;
}

function isInsideBoundaryParserFunction(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      if (VALIDATOR_CALL_PATTERN.test(current.name.text)) {
        return true;
      }
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      if (VALIDATOR_CALL_PATTERN.test(current.name.text)) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function isTypeofExprGuard(condNode: ts.Node, globalName: string): boolean {
  const condText = condNode.getText();
  return (
    condText.includes(`typeof ${globalName}`) ||
    condText.includes("typeof window")
  );
}

function hasTypeofGuard(node: ts.Node, globalName: string): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isIfStatement(current) && isTypeofExprGuard(current.expression, globalName)) {
      return true;
    }
    if (
      ts.isConditionalExpression(current) &&
      isTypeofExprGuard(current.condition, globalName)
    ) {
      return true;
    }
    if (
      ts.isBinaryExpression(current) &&
      current.getText().includes(`typeof ${globalName}`)
    ) {
      return true;
    }
    if (ts.isFunctionLike(current)) {
      break;
    }
    current = current.parent;
  }
  return false;
}

function isEventHandlerName(name: string): boolean {
  return /^handle[A-Z]|^on[A-Z]/.test(name);
}

function isSafeHandlerFunction(fn: ts.Node): boolean {
  const callParent = fn.parent;
  if (ts.isCallExpression(callParent)) {
    const name = getCalleeName(callParent.expression);
    return Boolean(name && SAFE_EFFECT_HOOKS.has(name));
  }
  if (ts.isJsxExpression(callParent) && ts.isJsxAttribute(callParent.parent)) {
    return true;
  }
  if (ts.isVariableDeclaration(callParent) && ts.isIdentifier(callParent.name)) {
    return isEventHandlerName(callParent.name.text);
  }
  return ts.isFunctionDeclaration(fn) && Boolean(fn.name && isEventHandlerName(fn.name.text));
}

function isInsideEffectOrEventHandler(
  node: ts.Node,
  componentNode: ts.Node,
): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current && current !== componentNode) {
    if (ts.isFunctionLike(current) && isSafeHandlerFunction(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function checkSsrGlobalsInComponent(
  unit: SourceUnit,
  filePath: string,
  diagnostics: AuditDiagnostic[],
): void {
  if (unit.kind !== "component") {
    return;
  }

  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const globalName = node.expression.text;
      if (
        SSR_UNSAFE_GLOBALS.has(globalName) &&
        !isInsideEffectOrEventHandler(node, unit.node) &&
        !hasTypeofGuard(node, globalName)
      ) {
        diagnostics.push(
          createDiagnostic({
            ruleId: "ssr-unsafe-global",
            severity: "warning",
            filePath,
            sourceFile: unit.sourceFile,
            pos: node.getStart(unit.sourceFile),
            symbol: unit.name,
            message: `Direct access to '${globalName}' during render of component '${unit.name}'.`,
            suggestion:
              "Move browser-only access into useEffect/event handlers or guard with typeof window !== 'undefined'.",
          }),
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(unit.node);
}

export function checkBoundaries(file: ParsedFile): AuditDiagnostic[] {
  const diagnostics: AuditDiagnostic[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const label = isUnparsedBoundaryCall(node);
      if (
        label &&
        !isWrappedInParserCall(node) &&
        !isInsideBoundaryParserFunction(node)
      ) {
        diagnostics.push(
          createDiagnostic({
            ruleId: "boundary-unparsed-data",
            severity: "warning",
            filePath: file.relativePath,
            sourceFile: file.sourceFile,
            pos: node.getStart(file.sourceFile),
            message: `External data from ${label} is not validated at the boundary.`,
            suggestion:
              "Parse and validate external payloads once at the boundary (e.g. schema.parse(...) or a dedicated parse*/validate* function).",
          }),
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(file.sourceFile);

  for (const unit of file.units) {
    checkSsrGlobalsInComponent(unit, file.relativePath, diagnostics);
  }

  return diagnostics;
}
