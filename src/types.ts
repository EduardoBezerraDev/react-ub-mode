import type ts from "typescript";

export type UnitKind = "component" | "hook" | "function" | "method";

export interface SourceUnit {
  readonly id: string;
  readonly name: string;
  readonly kind: UnitKind;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly lineCount: number;
  readonly node: ts.Node;
  readonly sourceFile: ts.SourceFile;
}

export interface ParsedFile {
  readonly filePath: string;
  readonly relativePath: string;
  readonly isTest: boolean;
  readonly sourceFile: ts.SourceFile;
  readonly units: readonly SourceUnit[];
}

export interface CrapMetric {
  readonly unitName: string;
  readonly kind: UnitKind;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly complexity: number;
  readonly coveragePercent: number;
  readonly crapScore: number;
  readonly passed: boolean;
}

export interface CrapperReport {
  readonly threshold: number;
  readonly coverageSource: string | null;
  readonly totalUnits: number;
  readonly failingUnits: number;
  readonly metrics: readonly CrapMetric[];
  readonly passed: boolean;
}

export interface DryerMatch {
  readonly leftName: string;
  readonly leftFile: string;
  readonly leftLine: number;
  readonly rightName: string;
  readonly rightFile: string;
  readonly rightLine: number;
  readonly similarity: number;
  readonly suggestion: string;
}

export interface DryerReport {
  readonly threshold: number;
  readonly pairsChecked: number;
  readonly matches: readonly DryerMatch[];
  readonly passed: boolean;
}

export type AuditSeverity = "error" | "warning";

export type AuditRuleId =
  | "boundary-unparsed-data"
  | "type-compiler-silence"
  | "type-any-usage"
  | "effect-derived-state"
  | "effect-missing-cleanup"
  | "jsx-index-key"
  | "a11y-clickable-non-semantic"
  | "a11y-missing-alt"
  | "security-dangerous-html"
  | "ssr-unsafe-global"
  | "component-oversized"
  | "component-prop-bloat"
  | "atomic-unclassified-component"
  | "atomic-dependency-direction"
  | "atomic-atom-impurity"
  | "atomic-template-impurity";

export interface AuditDiagnostic {
  readonly ruleId: AuditRuleId;
  readonly severity: AuditSeverity;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly symbol?: string;
  readonly message: string;
  readonly suggestion: string;
}

export interface ReactAuditReport {
  readonly filesScanned: number;
  readonly errors: number;
  readonly warnings: number;
  readonly diagnostics: readonly AuditDiagnostic[];
  readonly passed: boolean;
}

export type MutatorAuditKind =
  | "no-assertions"
  | "implementation-coupling"
  | "uncovered-file";

export interface MutatorAuditIssue {
  readonly kind: MutatorAuditKind;
  readonly filePath: string;
  readonly line: number;
  readonly message: string;
}

export type MutantKind =
  | "boolean-flip"
  | "equality-flip"
  | "comparison-flip"
  | "logical-flip"
  | "nullish-to-or"
  | "jsx-conditional-null";

export interface MutantCandidate {
  readonly id: string;
  readonly filePath: string;
  readonly line: number;
  readonly kind: MutantKind;
  readonly start: number;
  readonly end: number;
  readonly original: string;
  readonly mutated: string;
}

export type MutantStatus = "killed" | "survived" | "timeout" | "error";

export interface MutantResult {
  readonly id: string;
  readonly filePath: string;
  readonly line: number;
  readonly kind: MutantKind;
  readonly original: string;
  readonly mutated: string;
  readonly status: MutantStatus;
}

export interface MutatorReport {
  readonly testFilesScanned: number;
  readonly auditIssues: readonly MutatorAuditIssue[];
  readonly mutantsGenerated: number;
  readonly executed: boolean;
  readonly killed: number;
  readonly survived: number;
  readonly timeout: number;
  readonly mutationScore: number | null;
  readonly results: readonly MutantResult[];
  readonly passed: boolean;
}

export interface GateReport {
  readonly rootDir: string;
  readonly crapper: CrapperReport;
  readonly dryer: DryerReport;
  readonly reactAudit: ReactAuditReport;
  readonly mutator: MutatorReport;
  readonly passed: boolean;
}
