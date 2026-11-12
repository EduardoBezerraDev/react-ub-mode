import type {
  CrapperReport,
  DryerReport,
  GateReport,
  MutatorReport,
  ReactAuditReport,
} from "./types.js";

function statusTag(passed: boolean): string {
  return passed ? "PASS" : "FAIL";
}

export function formatCrapperReport(report: CrapperReport): string {
  const lines: string[] = [
    `[crapper] ${statusTag(report.passed)} (threshold < ${report.threshold}, units=${report.totalUnits}, failing=${report.failingUnits})`,
  ];
  if (!report.coverageSource) {
    lines.push(
      "  note: no coverage report found (coverage=0% assumed; pass --coverage <path> or generate coverage/coverage-final.json)",
    );
  } else {
    lines.push(`  coverage source: ${report.coverageSource}`);
  }
  const shown = report.metrics.filter((m) => !m.passed).slice(0, 15);
  for (const m of shown) {
    lines.push(
      `  FAIL ${m.filePath}:${m.startLine} [${m.kind}] ${m.unitName} -> CRAP=${m.crapScore} (comp=${m.complexity}, cov=${m.coveragePercent}%)`,
    );
  }
  return lines.join("\n");
}

function formatSection<T>(
  header: string,
  items: readonly T[],
  limit: number,
  renderItem: (item: T) => readonly string[],
): string {
  const lines = [header];
  for (const item of items.slice(0, limit)) {
    lines.push(...renderItem(item));
  }
  return lines.join("\n");
}

export function formatDryerReport(report: DryerReport): string {
  const header = `[dryer] ${statusTag(report.passed)} (threshold >= ${report.threshold}, pairsChecked=${report.pairsChecked}, matches=${report.matches.length})`;
  return formatSection(header, report.matches, 15, (m) => [
    `  CLONE (${m.similarity}): ${m.leftFile}:${m.leftLine} ${m.leftName} <-> ${m.rightFile}:${m.rightLine} ${m.rightName}`,
    `    suggestion: ${m.suggestion}`,
  ]);
}

export function formatReactAuditReport(report: ReactAuditReport): string {
  const lines = [
    `[react-audit] ${statusTag(report.passed)} (files=${report.filesScanned}, errors=${report.errors}, warnings=${report.warnings})`,
    ...report.diagnostics.slice(0, 25).flatMap((d) => [
      `  ${d.severity.toUpperCase()} [${d.ruleId}] ${d.filePath}:${d.line}:${d.column} - ${d.message}`,
      `    fix: ${d.suggestion}`,
    ]),
  ];
  return lines.join("\n");
}

export function formatMutatorReport(report: MutatorReport): string {
  const scoreText =
    report.mutationScore === null ? "n/a (dry-run)" : `${report.mutationScore}%`;
  const lines: string[] = [
    `[mutator] ${statusTag(report.passed)} (tests=${report.testFilesScanned}, auditIssues=${report.auditIssues.length}, mutants=${report.mutantsGenerated}, score=${scoreText})`,
  ];
  for (const issue of report.auditIssues.slice(0, 15)) {
    lines.push(
      `  ${issue.kind.toUpperCase()} ${issue.filePath}:${issue.line} - ${issue.message}`,
    );
  }
  const survivors = report.results.filter((r) => r.status === "survived");
  for (const s of survivors.slice(0, 15)) {
    lines.push(
      `  SURVIVED ${s.id} ${s.filePath}:${s.line} (${s.kind}): "${s.original}" -> "${s.mutated}"`,
    );
  }
  return lines.join("\n");
}

export function formatGateReport(report: GateReport): string {
  return [
    `react-ub gate: ${statusTag(report.passed)} (${report.rootDir})`,
    "",
    formatCrapperReport(report.crapper),
    "",
    formatDryerReport(report.dryer),
    "",
    formatReactAuditReport(report.reactAudit),
    "",
    formatMutatorReport(report.mutator),
  ].join("\n");
}
