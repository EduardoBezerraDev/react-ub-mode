import ts from "typescript";
import type { AuditDiagnostic, ParsedFile, SourceUnit } from "../types.js";
import { createDiagnostic } from "./shared.js";

export interface JsxAuditOptions {
  readonly maxComponentLines?: number;
  readonly maxProps?: number;
}

function getJsxTagName(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
): string {
  return node.tagName.getText();
}

function getAttributeNames(
  attrs: ts.JsxAttributes,
): { names: Set<string>; hasSpread: boolean; byName: Map<string, ts.JsxAttribute> } {
  const names = new Set<string>();
  const byName = new Map<string, ts.JsxAttribute>();
  let hasSpread = false;

  for (const prop of attrs.properties) {
    if (ts.isJsxSpreadAttribute(prop)) {
      hasSpread = true;
    } else if (ts.isJsxAttribute(prop) && ts.isIdentifier(prop.name)) {
      names.add(prop.name.text);
      byName.set(prop.name.text, prop);
    }
  }
  return { names, hasSpread, byName };
}

function checkClickableNonSemantic(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  file: ParsedFile,
  diagnostics: AuditDiagnostic[],
): void {
  const tag = getJsxTagName(node);
  if (tag !== "div" && tag !== "span") {
    return;
  }
  const { names } = getAttributeNames(node.attributes);
  if (
    names.has("onClick") &&
    !(names.has("role") && (names.has("tabIndex") || names.has("onKeyDown")))
  ) {
    diagnostics.push(
      createDiagnostic({
        ruleId: "a11y-clickable-non-semantic",
        severity: "warning",
        filePath: file.relativePath,
        sourceFile: file.sourceFile,
        pos: node.getStart(file.sourceFile),
        message: `Clickable <${tag}> lacks keyboard/role semantics.`,
        suggestion:
          "Use a native <button type=\"button\"> or <a> element instead of a clickable <div>/<span>.",
      }),
    );
  }
}

function checkMissingAlt(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  file: ParsedFile,
  diagnostics: AuditDiagnostic[],
): void {
  if (getJsxTagName(node) !== "img") {
    return;
  }
  const { names, hasSpread } = getAttributeNames(node.attributes);
  if (!names.has("alt") && !hasSpread) {
    diagnostics.push(
      createDiagnostic({
        ruleId: "a11y-missing-alt",
        severity: "error",
        filePath: file.relativePath,
        sourceFile: file.sourceFile,
        pos: node.getStart(file.sourceFile),
        message: "<img> element is missing an 'alt' attribute.",
        suggestion:
          "Provide a descriptive 'alt' string, or alt=\"\" for purely decorative images.",
      }),
    );
  }
}

function checkDangerousHtml(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  file: ParsedFile,
  diagnostics: AuditDiagnostic[],
): void {
  const { byName } = getAttributeNames(node.attributes);
  const attr = byName.get("dangerouslySetInnerHTML");
  if (!attr || !attr.initializer) {
    return;
  }
  const initText = attr.initializer.getText(file.sourceFile);
  if (!/sanitize/i.test(initText)) {
    diagnostics.push(
      createDiagnostic({
        ruleId: "security-dangerous-html",
        severity: "error",
        filePath: file.relativePath,
        sourceFile: file.sourceFile,
        pos: attr.getStart(file.sourceFile),
        message:
          "dangerouslySetInnerHTML used without an explicit HTML sanitizer.",
        suggestion:
          "Render structured JSX instead, or sanitize HTML with DOMPurify.sanitize(...) before passing to __html.",
      }),
    );
  }
}

function checkMapIndexKey(
  call: ts.CallExpression,
  file: ParsedFile,
  diagnostics: AuditDiagnostic[],
): void {
  if (
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== "map"
  ) {
    return;
  }
  const cb = call.arguments[0];
  if (!cb || (!ts.isArrowFunction(cb) && !ts.isFunctionExpression(cb))) {
    return;
  }
  const indexParam = cb.parameters[1];
  if (!indexParam || !ts.isIdentifier(indexParam.name)) {
    return;
  }
  const indexName = indexParam.name.text;

  function visit(node: ts.Node): void {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "key" &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === indexName
    ) {
      diagnostics.push(
        createDiagnostic({
          ruleId: "jsx-index-key",
          severity: "error",
          filePath: file.relativePath,
          sourceFile: file.sourceFile,
          pos: node.getStart(file.sourceFile),
          message: `Array index '${indexName}' used as React key inside .map().`,
          suggestion:
            "Use a stable unique domain identifier (e.g. item.id) instead of the array index.",
        }),
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(cb.body);
}

function countDestructuredProps(unit: SourceUnit): number {
  const fnNode = unit.node;
  if (
    !ts.isFunctionDeclaration(fnNode) &&
    !ts.isArrowFunction(fnNode) &&
    !ts.isFunctionExpression(fnNode)
  ) {
    return 0;
  }
  const firstParam = fnNode.parameters[0];
  if (!firstParam || !ts.isObjectBindingPattern(firstParam.name)) {
    return 0;
  }
  return firstParam.name.elements.length;
}

function checkComponentStructure(
  unit: SourceUnit,
  options: JsxAuditOptions,
  diagnostics: AuditDiagnostic[],
): void {
  if (unit.kind !== "component") {
    return;
  }
  const maxLines = options.maxComponentLines ?? 150;
  const maxProps = options.maxProps ?? 8;

  if (unit.lineCount > maxLines) {
    diagnostics.push(
      createDiagnostic({
        ruleId: "component-oversized",
        severity: "warning",
        filePath: unit.filePath,
        sourceFile: unit.sourceFile,
        pos: unit.node.getStart(unit.sourceFile),
        symbol: unit.name,
        message: `Component '${unit.name}' is ${unit.lineCount} lines long (limit ${maxLines}).`,
        suggestion:
          "Extract pure domain logic into helpers and split cohesive subcomponents.",
      }),
    );
  }

  const propCount = countDestructuredProps(unit);
  if (propCount > maxProps) {
    diagnostics.push(
      createDiagnostic({
        ruleId: "component-prop-bloat",
        severity: "warning",
        filePath: unit.filePath,
        sourceFile: unit.sourceFile,
        pos: unit.node.getStart(unit.sourceFile),
        symbol: unit.name,
        message: `Component '${unit.name}' accepts ${propCount} destructured props (limit ${maxProps}).`,
        suggestion:
          "Group cohesive domain props or use composition (children / slots) to reduce prop surface.",
      }),
    );
  }
}

export function checkJsxAndA11y(
  file: ParsedFile,
  options: JsxAuditOptions = {},
): AuditDiagnostic[] {
  const diagnostics: AuditDiagnostic[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      checkClickableNonSemantic(node, file, diagnostics);
      checkMissingAlt(node, file, diagnostics);
      checkDangerousHtml(node, file, diagnostics);
    } else if (ts.isCallExpression(node)) {
      checkMapIndexKey(node, file, diagnostics);
    }
    ts.forEachChild(node, visit);
  }

  visit(file.sourceFile);

  for (const unit of file.units) {
    checkComponentStructure(unit, options, diagnostics);
  }

  return diagnostics;
}
