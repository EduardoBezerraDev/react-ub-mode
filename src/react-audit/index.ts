import type { AuditDiagnostic, ParsedFile, ReactAuditReport } from "../types.js";
import { checkJsxAndA11y, type JsxAuditOptions } from "./a11y-jsx.js";
import { checkAtomicDesign } from "./atomic-design.js";
import { checkBoundaries } from "./boundaries.js";
import { checkHooks } from "./hooks.js";
import { checkTypeDiscipline } from "./types-check.js";

export interface ReactAuditOptions extends JsxAuditOptions {
  readonly strictWarnings?: boolean;
}

export function runReactAudit(
  files: readonly ParsedFile[],
  options: ReactAuditOptions = {},
): ReactAuditReport {
  const diagnostics: AuditDiagnostic[] = [];
  let filesScanned = 0;

  for (const file of files) {
    if (file.isTest) {
      continue;
    }
    filesScanned += 1;
    diagnostics.push(
      ...checkTypeDiscipline(file),
      ...checkBoundaries(file),
      ...checkHooks(file),
      ...checkJsxAndA11y(file, options),
      ...checkAtomicDesign(file),
    );
  }

  diagnostics.sort(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line,
  );

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  const passed = options.strictWarnings
    ? errors === 0 && warnings === 0
    : errors === 0;

  return {
    filesScanned,
    errors,
    warnings,
    diagnostics,
    passed,
  };
}
