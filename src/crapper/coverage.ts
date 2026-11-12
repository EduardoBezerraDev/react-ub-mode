import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface LineCoverageData {
  readonly lineHits: ReadonlyMap<number, number>;
  readonly filePercent: number;
}

export interface CoverageReport {
  readonly sourcePath: string;
  readonly files: ReadonlyMap<string, LineCoverageData>;
}

const DEFAULT_COVERAGE_CANDIDATES = [
  "coverage/coverage-final.json",
  "coverage/lcov.info",
  "coverage/coverage-summary.json",
];

export function loadCoverage(
  rootDir: string,
  explicitPath?: string,
): CoverageReport | null {
  const candidate = explicitPath
    ? resolve(rootDir, explicitPath)
    : DEFAULT_COVERAGE_CANDIDATES.map((p) => resolve(rootDir, p)).find((p) =>
        existsSync(p),
      );

  if (!candidate || !existsSync(candidate)) {
    return null;
  }

  const raw = readFileSync(candidate, "utf8");
  if (candidate.endsWith(".info") || candidate.includes("lcov")) {
    return parseLcov(candidate, raw);
  }
  if (candidate.endsWith("coverage-summary.json")) {
    return parseIstanbulSummary(candidate, raw);
  }
  return parseIstanbulFinal(candidate, raw);
}

export function getUnitCoveragePercent(
  coverage: CoverageReport | null,
  absFilePath: string,
  startLine: number,
  endLine: number,
): number {
  if (!coverage) {
    return 0;
  }

  const normalizedTarget = normalizePath(absFilePath);
  const fileCov = findFileCoverage(coverage.files, normalizedTarget);
  if (!fileCov) {
    return 0;
  }

  if (fileCov.lineHits.size === 0) {
    return fileCov.filePercent;
  }

  let totalLines = 0;
  let coveredLines = 0;
  for (const [line, hits] of fileCov.lineHits.entries()) {
    if (line >= startLine && line <= endLine) {
      totalLines += 1;
      if (hits > 0) {
        coveredLines += 1;
      }
    }
  }

  if (totalLines === 0) {
    return fileCov.filePercent;
  }
  return (coveredLines / totalLines) * 100;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function findFileCoverage(
  files: ReadonlyMap<string, LineCoverageData>,
  normalizedTarget: string,
): LineCoverageData | undefined {
  const exact = files.get(normalizedTarget);
  if (exact) {
    return exact;
  }
  for (const [key, value] of files.entries()) {
    if (
      normalizedTarget.endsWith(`/${key}`) ||
      key.endsWith(`/${normalizedTarget}`) ||
      key === normalizedTarget
    ) {
      return value;
    }
  }
  return undefined;
}

interface LcovState {
  currentFile: string;
  lineHits: Map<number, number>;
  linesFound: number;
  linesHit: number;
}

function recordLcovDa(line: string, state: LcovState): void {
  const [lineNumStr, hitsStr] = line.slice(3).split(",");
  const lineNum = Number(lineNumStr);
  const hits = Number(hitsStr);
  if (Number.isFinite(lineNum) && Number.isFinite(hits)) {
    state.lineHits.set(lineNum, (state.lineHits.get(lineNum) ?? 0) + hits);
  }
}

function finalizeLcovRecord(
  state: LcovState,
  files: Map<string, LineCoverageData>,
): void {
  if (!state.currentFile) {
    return;
  }
  const filePercent =
    state.linesFound > 0 ? (state.linesHit / state.linesFound) * 100 : 0;
  files.set(state.currentFile, { lineHits: state.lineHits, filePercent });
  state.currentFile = "";
}

function processLcovLine(
  line: string,
  state: LcovState,
  files: Map<string, LineCoverageData>,
): void {
  if (line.startsWith("SF:")) {
    state.currentFile = normalizePath(line.slice(3));
    state.lineHits = new Map<number, number>();
    state.linesFound = 0;
    state.linesHit = 0;
  } else if (line.startsWith("DA:")) {
    recordLcovDa(line, state);
  } else if (line.startsWith("LF:")) {
    state.linesFound = Number(line.slice(3)) || 0;
  } else if (line.startsWith("LH:")) {
    state.linesHit = Number(line.slice(3)) || 0;
  } else if (line === "end_of_record") {
    finalizeLcovRecord(state, files);
  }
}

function parseLcov(sourcePath: string, raw: string): CoverageReport {
  const files = new Map<string, LineCoverageData>();
  const state: LcovState = {
    currentFile: "",
    lineHits: new Map<number, number>(),
    linesFound: 0,
    linesHit: 0,
  };

  for (const rawLine of raw.split(/\r?\n/)) {
    processLcovLine(rawLine.trim(), state, files);
  }

  return { sourcePath, files };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function parseIstanbulSummary(sourcePath: string, raw: string): CoverageReport {
  const parsed = parseJsonObject(raw);
  const files = new Map<string, LineCoverageData>();

  if (!parsed) {
    return { sourcePath, files };
  }

  for (const [fileKey, entry] of Object.entries(parsed)) {
    if (fileKey === "total" || typeof entry !== "object" || entry === null) {
      continue;
    }
    const linesObj = (entry as { lines?: { pct?: unknown } }).lines;
    const pct =
      typeof linesObj?.pct === "number" && Number.isFinite(linesObj.pct)
        ? linesObj.pct
        : 0;
    files.set(normalizePath(fileKey), {
      lineHits: new Map<number, number>(),
      filePercent: pct,
    });
  }

  return { sourcePath, files };
}

interface IstanbulFileEntry {
  statementMap?: Record<string, { start?: { line?: number } }>;
  s?: Record<string, number>;
}

function extractIstanbulFileCoverage(
  typed: IstanbulFileEntry,
): LineCoverageData {
  const lineHits = new Map<number, number>();
  const map = typed.statementMap ?? {};
  const counts = typed.s ?? {};

  for (const [stmtId, loc] of Object.entries(map)) {
    const line = loc.start?.line;
    const hits = counts[stmtId] ?? 0;
    if (typeof line === "number") {
      lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
    }
  }

  const total = lineHits.size;
  const covered = [...lineHits.values()].filter((h) => h > 0).length;
  const filePercent = total > 0 ? (covered / total) * 100 : 0;
  return { lineHits, filePercent };
}

function parseIstanbulFinal(sourcePath: string, raw: string): CoverageReport {
  const parsed = parseJsonObject(raw);
  const files = new Map<string, LineCoverageData>();

  if (!parsed) {
    return { sourcePath, files };
  }

  for (const [fileKey, entry] of Object.entries(parsed)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    files.set(
      normalizePath(fileKey),
      extractIstanbulFileCoverage(entry as IstanbulFileEntry),
    );
  }

  return { sourcePath, files };
}
