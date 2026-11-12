import ts from "typescript";
import type { MutantCandidate, MutantKind, ParsedFile } from "../types.js";

const BINARY_MUTATIONS = new Map<
  ts.SyntaxKind,
  { readonly kind: MutantKind; readonly replacement: string }
>([
  [
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    { kind: "equality-flip", replacement: "!==" },
  ],
  [
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    { kind: "equality-flip", replacement: "===" },
  ],
  [
    ts.SyntaxKind.EqualsEqualsToken,
    { kind: "equality-flip", replacement: "!=" },
  ],
  [
    ts.SyntaxKind.ExclamationEqualsToken,
    { kind: "equality-flip", replacement: "==" },
  ],
  [
    ts.SyntaxKind.LessThanToken,
    { kind: "comparison-flip", replacement: ">=" },
  ],
  [
    ts.SyntaxKind.GreaterThanToken,
    { kind: "comparison-flip", replacement: "<=" },
  ],
  [
    ts.SyntaxKind.AmpersandAmpersandToken,
    { kind: "logical-flip", replacement: "||" },
  ],
  [
    ts.SyntaxKind.BarBarToken,
    { kind: "logical-flip", replacement: "&&" },
  ],
  [
    ts.SyntaxKind.QuestionQuestionToken,
    { kind: "nullish-to-or", replacement: "||" },
  ],
]);

function isInsideTypeNode(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isTypeNode(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isJsxConditionalExpression(node: ts.BinaryExpression): boolean {
  return (
    ts.isJsxExpression(node.parent) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
    (ts.isJsxElement(node.right) ||
      ts.isJsxSelfClosingElement(node.right) ||
      ts.isJsxFragment(node.right))
  );
}

export function generateMutantsForFiles(
  files: readonly ParsedFile[],
): MutantCandidate[] {
  const candidates: MutantCandidate[] = [];
  let counter = 0;

  for (const file of files) {
    if (file.isTest) {
      continue;
    }

    const pushMutant = (
      kind: MutantKind,
      start: number,
      end: number,
      original: string,
      mutated: string,
    ): void => {
      counter += 1;
      const lc = file.sourceFile.getLineAndCharacterOfPosition(start);
      candidates.push({
        id: `M${counter}`,
        filePath: file.relativePath,
        line: lc.line + 1,
        kind,
        start,
        end,
        original,
        mutated,
      });
    };

    function visit(node: ts.Node): void {
      if (isInsideTypeNode(node)) {
        return;
      }

      if (node.kind === ts.SyntaxKind.TrueKeyword) {
        pushMutant(
          "boolean-flip",
          node.getStart(file.sourceFile),
          node.getEnd(),
          "true",
          "false",
        );
      } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
        pushMutant(
          "boolean-flip",
          node.getStart(file.sourceFile),
          node.getEnd(),
          "false",
          "true",
        );
      } else if (ts.isBinaryExpression(node)) {
        if (isJsxConditionalExpression(node)) {
          pushMutant(
            "jsx-conditional-null",
            node.getStart(file.sourceFile),
            node.getEnd(),
            node.getText(file.sourceFile),
            "null",
          );
          return;
        }
        const mutation = BINARY_MUTATIONS.get(node.operatorToken.kind);
        if (mutation) {
          pushMutant(
            mutation.kind,
            node.operatorToken.getStart(file.sourceFile),
            node.operatorToken.getEnd(),
            node.operatorToken.getText(file.sourceFile),
            mutation.replacement,
          );
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(file.sourceFile);
  }

  return candidates;
}
