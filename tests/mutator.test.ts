import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { generateMutantsForFiles, runMutator } from "../src/mutator/index.js";
import { parseProjectFiles } from "../src/scanner.js";

function withTempWorkspace(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "react-ub-mutator-test-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("mutator", () => {
  it("flags tests with zero assertions and implementation-detail coupling", () => {
    withTempWorkspace((dir) => {
      writeFileSync(
        join(dir, "Widget.tsx"),
        `export function Widget({ open }: { open: boolean }) {
  return <div>{open && <span>Open</span>}</div>;
}
`,
      );
      writeFileSync(
        join(dir, "Widget.test.tsx"),
        `import { describe, it } from "node:test";
import { Widget } from "./Widget";

describe("Widget", () => {
  it("looks at internals without asserting", () => {
    const container = { querySelector: (_s: string) => null };
    container.querySelector(".badge");
    Widget({ open: true });
  });
});
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runMutator(files, { rootDir: dir, execute: false });
      const kinds = new Set(report.auditIssues.map((i) => i.kind));

      assert.equal(report.passed, false);
      assert.ok(kinds.has("no-assertions"));
      assert.ok(kinds.has("implementation-coupling"));
    });
  });

  it("generates JSX and TypeScript mutants and executes mutation testing in an isolated sandbox", () => {
    withTempWorkspace((dir) => {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "mutator-fixture", type: "module" }),
      );
      const sourcePath = join(dir, "discount.js");
      const originalCode = `export function isEligible(active, total) {
  if (active === true && total > 10) {
    return true;
  }
  return false;
}
`;
      writeFileSync(sourcePath, originalCode);
      writeFileSync(
        join(dir, "discount.test.js"),
        `import assert from "node:assert/strict";
import { it } from "node:test";
import { isEligible } from "./discount.js";

it("grants discount when active and total > 10", () => {
  assert.equal(isEligible(true, 11), true);
  assert.equal(isEligible(false, 20), false);
});
`,
      );

      const files = parseProjectFiles(dir, dir);
      const candidates = generateMutantsForFiles(files);
      assert.ok(candidates.length >= 4);

      const report = runMutator(files, {
        rootDir: dir,
        execute: true,
        testCmd: "node --test discount.test.js",
        minMutationScore: 50,
      });

      assert.equal(report.executed, true);
      assert.ok(report.killed >= 3);
      assert.ok(report.mutationScore !== null && report.mutationScore > 0);
      assert.equal(readFileSync(sourcePath, "utf8"), originalCode);
    });
  });
});
