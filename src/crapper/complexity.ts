import ts from "typescript";
import type { SourceUnit } from "../types.js";

const LOGICAL_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function isSeparateNamedUnit(node: ts.Node, rootUnitNode: ts.Node): boolean {
  if (node === rootUnitNode) {
    return false;
  }
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return true;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    return ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name);
  }
  return false;
}

const DECISION_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
]);

function isDecisionNode(node: ts.Node): boolean {
  if (DECISION_KINDS.has(node.kind)) {
    return true;
  }
  if (ts.isBinaryExpression(node)) {
    return LOGICAL_OPERATORS.has(node.operatorToken.kind);
  }
  return false;
}

export function calculateCyclomaticComplexity(unit: SourceUnit): number {
  let complexity = 1;

  function visit(node: ts.Node): void {
    if (isSeparateNamedUnit(node, unit.node)) {
      return;
    }
    if (isDecisionNode(node)) {
      complexity += 1;
    }
    ts.forEachChild(node, visit);
  }

  visit(unit.node);
  return complexity;
}
