import ts from "typescript";

const PRESERVED_REACT_APIS = new Set([
  "useState",
  "useEffect",
  "useMemo",
  "useCallback",
  "useRef",
  "useReducer",
  "useContext",
  "useLayoutEffect",
  "useTransition",
  "useDeferredValue",
  "useId",
]);

function tokenForIdentifier(node: ts.Identifier): string {
  const text = node.text;
  if (PRESERVED_REACT_APIS.has(text)) {
    return `HOOK:${text}`;
  }
  const parent = node.parent;
  const isJsxTag =
    ts.isJsxOpeningElement(parent) ||
    ts.isJsxSelfClosingElement(parent) ||
    ts.isJsxClosingElement(parent);
  if (isJsxTag && parent.tagName === node && /^[a-z]/.test(text)) {
    return `TAG:${text}`;
  }
  return "$ID";
}

function tokenForNode(node: ts.Node): string {
  if (ts.isIdentifier(node)) {
    return tokenForIdentifier(node);
  }
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isJsxText(node)
  ) {
    return "$STR";
  }
  if (ts.isNumericLiteral(node)) {
    return "$NUM";
  }
  return ts.SyntaxKind[node.kind] ?? `K${node.kind}`;
}

export function extractNormalizedTokens(root: ts.Node): string[] {
  const tokens: string[] = [];

  function visit(node: ts.Node): void {
    tokens.push(tokenForNode(node));
    ts.forEachChild(node, visit);
  }

  visit(root);
  return tokens;
}

export function buildShingles(
  tokens: readonly string[],
  shingleSize = 4,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (tokens.length < shingleSize) {
    return counts;
  }

  for (let i = 0; i <= tokens.length - shingleSize; i += 1) {
    const gram = tokens.slice(i, i + shingleSize).join("|");
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function computeMultisetSimilarity(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  let leftTotal = 0;
  let rightTotal = 0;

  for (const [gram, count] of left.entries()) {
    leftTotal += count;
    const other = right.get(gram);
    if (other !== undefined) {
      intersection += Math.min(count, other);
    }
  }
  for (const count of right.values()) {
    rightTotal += count;
  }

  const union = leftTotal + rightTotal - intersection;
  if (union === 0) {
    return 0;
  }
  return Math.round((intersection / union) * 1000) / 1000;
}
