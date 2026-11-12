import ts from "typescript";
import type { AuditDiagnostic, ParsedFile } from "../types.js";
import { createDiagnostic } from "./shared.js";

const SUBSCRIPTION_METHODS = new Set([
  "addEventListener",
  "setInterval",
  "setTimeout",
  "subscribe",
  "observe",
]);

function isUseEffectCall(node: ts.CallExpression): boolean {
  if (ts.isIdentifier(node.expression)) {
    return (
      node.expression.text === "useEffect" ||
      node.expression.text === "useLayoutEffect"
    );
  }
  if (ts.isPropertyAccessExpression(node.expression)) {
    return (
      node.expression.name.text === "useEffect" ||
      node.expression.name.text === "useLayoutEffect"
    );
  }
  return false;
}

function getEffectCallback(
  call: ts.CallExpression,
): ts.ArrowFunction | ts.FunctionExpression | null {
  const arg = call.arguments[0];
  if (!arg) {
    return null;
  }
  if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
    return arg;
  }
  return null;
}

function hasCleanupReturn(callback: ts.ArrowFunction | ts.FunctionExpression): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }
    if (node !== callback && ts.isFunctionLike(node)) {
      return;
    }
    if (ts.isReturnStatement(node) && node.expression) {
      if (
        ts.isArrowFunction(node.expression) ||
        ts.isFunctionExpression(node.expression) ||
        ts.isIdentifier(node.expression)
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(callback.body);
  return found;
}

function findSubscriptionsWithoutCleanup(
  callback: ts.ArrowFunction | ts.FunctionExpression,
): ts.CallExpression | null {
  let subscriptionCall: ts.CallExpression | null = null;

  function visit(node: ts.Node): void {
    if (subscriptionCall) {
      return;
    }
    if (node !== callback && ts.isFunctionLike(node)) {
      return;
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const name = ts.isIdentifier(expr)
        ? expr.text
        : ts.isPropertyAccessExpression(expr)
          ? expr.name.text
          : null;
      if (name && SUBSCRIPTION_METHODS.has(name)) {
        subscriptionCall = node;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(callback.body);
  return subscriptionCall;
}

const ASYNC_OR_EXTERNAL_APIS = new Set([
  ...SUBSCRIPTION_METHODS,
  "fetch",
  "then",
  "focus",
  "scrollIntoView",
]);

function isExternalEffectCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) {
    return false;
  }
  const expr = node.expression;
  const name = ts.isIdentifier(expr)
    ? expr.text
    : ts.isPropertyAccessExpression(expr)
      ? expr.name.text
      : null;
  return Boolean(name && ASYNC_OR_EXTERNAL_APIS.has(name));
}

function containsAsyncOrExternalSideEffect(body: ts.Node): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }
    if (ts.isAwaitExpression(node) || isExternalEffectCall(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return found;
}

function findDirectStateSetterCall(
  callback: ts.ArrowFunction | ts.FunctionExpression,
): ts.CallExpression | null {
  let setterCall: ts.CallExpression | null = null;

  function visit(node: ts.Node): void {
    if (setterCall) {
      return;
    }
    if (node !== callback && ts.isFunctionLike(node)) {
      return;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      /^set[A-Z]/.test(node.expression.text)
    ) {
      setterCall = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(callback.body);
  return setterCall;
}

export function checkHooks(file: ParsedFile): AuditDiagnostic[] {
  const diagnostics: AuditDiagnostic[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && isUseEffectCall(node)) {
      const callback = getEffectCallback(node);
      if (callback) {
        const subCall = findSubscriptionsWithoutCleanup(callback);
        if (subCall && !hasCleanupReturn(callback)) {
          diagnostics.push(
            createDiagnostic({
              ruleId: "effect-missing-cleanup",
              severity: "warning",
              filePath: file.relativePath,
              sourceFile: file.sourceFile,
              pos: subCall.getStart(file.sourceFile),
              message:
                "useEffect registers a subscription/timer/listener without returning a cleanup function.",
              suggestion:
                "Return a cleanup function (() => ...) so the effect survives unmount and React StrictMode double-invocation.",
            }),
          );
        }

        if (!containsAsyncOrExternalSideEffect(callback.body)) {
          const setter = findDirectStateSetterCall(callback);
          if (setter) {
            diagnostics.push(
              createDiagnostic({
                ruleId: "effect-derived-state",
                severity: "warning",
                filePath: file.relativePath,
                sourceFile: file.sourceFile,
                pos: setter.getStart(file.sourceFile),
                message:
                  "Synchronous state setter inside useEffect likely represents derived state.",
                suggestion:
                  "Compute derived values directly during render or lift the transition into the event handler.",
              }),
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(file.sourceFile);
  return diagnostics;
}
