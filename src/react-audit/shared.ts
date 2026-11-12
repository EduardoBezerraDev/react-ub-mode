import ts from "typescript";
import type { AuditDiagnostic, AuditRuleId, AuditSeverity } from "../types.js";

export function getLineCol(
  sourceFile: ts.SourceFile,
  pos: number,
): { line: number; column: number } {
  const lc = sourceFile.getLineAndCharacterOfPosition(pos);
  return { line: lc.line + 1, column: lc.character + 1 };
}

export function createDiagnostic(params: {
  readonly ruleId: AuditRuleId;
  readonly severity: AuditSeverity;
  readonly filePath: string;
  readonly sourceFile: ts.SourceFile;
  readonly pos: number;
  readonly symbol?: string;
  readonly message: string;
  readonly suggestion: string;
}): AuditDiagnostic {
  const { line, column } = getLineCol(params.sourceFile, params.pos);
  return {
    ruleId: params.ruleId,
    severity: params.severity,
    filePath: params.filePath,
    line,
    column,
    symbol: params.symbol,
    message: params.message,
    suggestion: params.suggestion,
  };
}
