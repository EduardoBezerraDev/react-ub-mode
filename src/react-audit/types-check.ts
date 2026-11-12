import ts from "typescript";
import type { AuditDiagnostic, ParsedFile } from "../types.js";
import { createDiagnostic } from "./shared.js";

const SUPPRESSION_PATTERN =
  /@ts-ignore\b|@ts-nocheck\b|@ts-expect-error\b|eslint-disable/;

function isExplicitAny(node: ts.Node): boolean {
  return node.kind === ts.SyntaxKind.AnyKeyword;
}

export function checkTypeDiscipline(file: ParsedFile): AuditDiagnostic[] {
  const diagnostics: AuditDiagnostic[] = [];
  const text = file.sourceFile.getFullText();
  const seenCommentPos = new Set<number>();

  function scanComments(node: ts.Node): void {
    const leading = ts.getLeadingCommentRanges(text, node.pos) ?? [];
    for (const range of leading) {
      if (seenCommentPos.has(range.pos)) {
        continue;
      }
      seenCommentPos.add(range.pos);
      const comment = text.slice(range.pos, range.end);
      const match = SUPPRESSION_PATTERN.exec(comment);
      if (match) {
        diagnostics.push(
          createDiagnostic({
            ruleId: "type-compiler-silence",
            severity: "error",
            filePath: file.relativePath,
            sourceFile: file.sourceFile,
            pos: range.pos,
            message: `Compiler/linter suppression '${match[0]}' silences type safety.`,
            suggestion:
              "Remove the suppression and fix the underlying TypeScript types or boundary parser.",
          }),
        );
      }
    }
  }

  function visit(node: ts.Node): void {
    scanComments(node);
    if (isExplicitAny(node)) {
      diagnostics.push(
        createDiagnostic({
          ruleId: "type-any-usage",
          severity: "error",
          filePath: file.relativePath,
          sourceFile: file.sourceFile,
          pos: node.getStart(file.sourceFile),
          message: "Explicit 'any' defeats TypeScript type discipline.",
          suggestion:
            "Replace 'any' with 'unknown' plus a boundary parser, a generic, or a discriminated union.",
        }),
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(file.sourceFile);
  return diagnostics;
}
