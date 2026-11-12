import type { DryerMatch, DryerReport, ParsedFile, SourceUnit } from "../types.js";
import {
  buildShingles,
  computeMultisetSimilarity,
  extractNormalizedTokens,
} from "./normalize.js";

export interface DryerOptions {
  readonly threshold?: number;
  readonly minTokens?: number;
  readonly minLines?: number;
}

interface PreparedUnit {
  readonly unit: SourceUnit;
  readonly tokenCount: number;
  readonly shingles: Map<string, number>;
}

function areOverlappingUnits(a: SourceUnit, b: SourceUnit): boolean {
  if (a.filePath !== b.filePath) {
    return false;
  }
  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}

function suggestRefactoring(left: SourceUnit, right: SourceUnit): string {
  if (left.kind === "hook" || right.kind === "hook") {
    return "Extract shared stateful logic into a single reusable custom hook.";
  }
  if (left.kind === "component" && right.kind === "component") {
    return "Extract a shared presentational component or compound slot pattern.";
  }
  return "Extract duplicated logic into a shared pure helper function.";
}

function prepareDryerUnits(
  files: readonly ParsedFile[],
  minLines: number,
  minTokens: number,
): PreparedUnit[] {
  const prepared: PreparedUnit[] = [];
  for (const file of files) {
    if (file.isTest) {
      continue;
    }
    for (const unit of file.units) {
      if (unit.lineCount < minLines) {
        continue;
      }
      const tokens = extractNormalizedTokens(unit.node);
      if (tokens.length >= minTokens) {
        prepared.push({
          unit,
          tokenCount: tokens.length,
          shingles: buildShingles(tokens),
        });
      }
    }
  }
  return prepared;
}

function comparePair(
  left: PreparedUnit,
  right: PreparedUnit,
  threshold: number,
): DryerMatch | null {
  if (areOverlappingUnits(left.unit, right.unit)) {
    return null;
  }
  const ratio =
    Math.min(left.tokenCount, right.tokenCount) /
    Math.max(left.tokenCount, right.tokenCount);
  if (ratio < threshold * 0.75) {
    return null;
  }
  const similarity = computeMultisetSimilarity(left.shingles, right.shingles);
  if (similarity < threshold) {
    return null;
  }
  return {
    leftName: left.unit.name,
    leftFile: left.unit.filePath,
    leftLine: left.unit.startLine,
    rightName: right.unit.name,
    rightFile: right.unit.filePath,
    rightLine: right.unit.startLine,
    similarity,
    suggestion: suggestRefactoring(left.unit, right.unit),
  };
}

export function runDryer(
  files: readonly ParsedFile[],
  options: DryerOptions = {},
): DryerReport {
  const threshold = options.threshold ?? 0.8;
  const minTokens = options.minTokens ?? 24;
  const minLines = options.minLines ?? 5;
  const prepared = prepareDryerUnits(files, minLines, minTokens);

  const matches: DryerMatch[] = [];
  let pairsChecked = 0;

  for (let i = 0; i < prepared.length; i += 1) {
    for (let j = i + 1; j < prepared.length; j += 1) {
      pairsChecked += 1;
      const match = comparePair(prepared[i], prepared[j], threshold);
      if (match) {
        matches.push(match);
      }
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    threshold,
    pairsChecked,
    matches,
    passed: matches.length === 0,
  };
}
