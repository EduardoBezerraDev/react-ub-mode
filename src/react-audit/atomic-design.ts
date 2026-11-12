import ts from "typescript";
import { getCalleeName } from "../ast-utils.js";
import type { AuditDiagnostic, ParsedFile } from "../types.js";
import { createDiagnostic } from "./shared.js";

export type AtomicLayer =
  | "atoms"
  | "molecules"
  | "organisms"
  | "templates"
  | "pages";

const LAYER_RANK: Record<AtomicLayer, number> = {
  atoms: 0,
  molecules: 1,
  organisms: 2,
  templates: 3,
  pages: 4,
};

const LAYER_SEGMENT_PATTERN =
  /(?:^|\/)(atoms|molecules|organisms|templates|pages)(?:\/|$)/i;

const NEXT_ROUTE_PATTERN =
  /(?:^|\/)app\/(?:.+\/)?(page|layout|loading|error|not-found)\.(ts|tsx|js|jsx)$/i;

const STORYBOOK_PATTERN = /\.stories\.(ts|tsx|js|jsx)$/i;

const ROUTER_IMPORTS = new Set([
  "next/navigation",
  "next/router",
  "react-router",
  "react-router-dom",
]);

export function detectAtomicLayer(filePath: string): AtomicLayer | null {
  const normalized = filePath.replace(/\\/g, "/");
  const match = LAYER_SEGMENT_PATTERN.exec(normalized);
  if (match) {
    return match[1].toLowerCase() as AtomicLayer;
  }
  if (NEXT_ROUTE_PATTERN.test(normalized)) {
    return "pages";
  }
  return null;
}

function hasReactComponent(file: ParsedFile): boolean {
  return file.units.some((u) => u.kind === "component");
}

function checkComponentLayerPlacement(
  file: ParsedFile,
  layer: AtomicLayer | null,
  diagnostics: AuditDiagnostic[],
): void {
  if (layer || !hasReactComponent(file) || STORYBOOK_PATTERN.test(file.relativePath)) {
    return;
  }
  const firstComp = file.units.find((u) => u.kind === "component");
  diagnostics.push(
    createDiagnostic({
      ruleId: "atomic-unclassified-component",
      severity: "warning",
      filePath: file.relativePath,
      sourceFile: file.sourceFile,
      pos: firstComp ? firstComp.node.getStart(file.sourceFile) : 0,
      symbol: firstComp?.name,
      message: `Component file '${file.relativePath}' is not placed in an Atomic Design layer.`,
      suggestion:
        "Place React components inside atoms/, molecules/, organisms/, templates/, or pages/.",
    }),
  );
}

function checkImportDirections(
  file: ParsedFile,
  sourceLayer: AtomicLayer,
  diagnostics: AuditDiagnostic[],
): void {
  for (const stmt of file.sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) {
      continue;
    }
    const spec = stmt.moduleSpecifier.text;
    const targetLayer = detectAtomicLayer(spec);
    if (targetLayer && LAYER_RANK[targetLayer] > LAYER_RANK[sourceLayer]) {
      diagnostics.push(
        createDiagnostic({
          ruleId: "atomic-dependency-direction",
          severity: "error",
          filePath: file.relativePath,
          sourceFile: file.sourceFile,
          pos: stmt.getStart(file.sourceFile),
          message: `Atomic layer '${sourceLayer}' cannot import from higher layer '${targetLayer}' ('${spec}').`,
          suggestion:
            "Dependencies must flow downward (pages -> templates -> organisms -> molecules -> atoms). Pass higher-level UI via children/slots or extract shared primitives downward.",
        }),
      );
    }
    if (sourceLayer === "atoms" && ROUTER_IMPORTS.has(spec)) {
      diagnostics.push(
        createDiagnostic({
          ruleId: "atomic-atom-impurity",
          severity: "error",
          filePath: file.relativePath,
          sourceFile: file.sourceFile,
          pos: stmt.getStart(file.sourceFile),
          message: `Atom component imports router module '${spec}'.`,
          suggestion:
            "Keep atoms pure UI primitives; accept callbacks or href strings as props instead of coupling to routing.",
        }),
      );
    }
  }
}

function checkAtomAndTemplatePurity(
  file: ParsedFile,
  layer: AtomicLayer,
  diagnostics: AuditDiagnostic[],
): void {
  if (layer !== "atoms" && layer !== "templates") {
    return;
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = getCalleeName(node.expression);
      if (callee === "fetch") {
        diagnostics.push(
          createDiagnostic({
            ruleId:
              layer === "atoms"
                ? "atomic-atom-impurity"
                : "atomic-template-impurity",
            severity: layer === "atoms" ? "error" : "warning",
            filePath: file.relativePath,
            sourceFile: file.sourceFile,
            pos: node.getStart(file.sourceFile),
            message: `${layer === "atoms" ? "Atom" : "Template"} performs direct network fetch().`,
            suggestion:
              "Move data fetching into pages or feature hooks and pass data/slots down via props.",
          }),
        );
      } else if (layer === "atoms" && callee === "useEffect") {
        diagnostics.push(
          createDiagnostic({
            ruleId: "atomic-atom-impurity",
            severity: "error",
            filePath: file.relativePath,
            sourceFile: file.sourceFile,
            pos: node.getStart(file.sourceFile),
            message: "Atom component uses useEffect side effects.",
            suggestion:
              "Keep atoms pure and stateless/presentational; move side effects up to molecules, organisms, or custom hooks.",
          }),
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(file.sourceFile);
}

export function checkAtomicDesign(file: ParsedFile): AuditDiagnostic[] {
  const diagnostics: AuditDiagnostic[] = [];
  const layer =
    detectAtomicLayer(file.relativePath) ?? detectAtomicLayer(file.filePath);

  checkComponentLayerPlacement(file, layer, diagnostics);
  if (!layer) {
    return diagnostics;
  }

  checkImportDirections(file, layer, diagnostics);
  checkAtomAndTemplatePurity(file, layer, diagnostics);

  return diagnostics;
}
