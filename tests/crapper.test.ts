import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { computeCrapScore, runCrapper } from "../src/crapper/index.js";
import { parseProjectFiles } from "../src/scanner.js";

function withTempWorkspace(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "react-ub-crapper-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("crapper", () => {
  it("computes the exact CRAP score formula across coverage levels", () => {
    assert.equal(computeCrapScore(1, 0), 2);
    assert.equal(computeCrapScore(5, 0), 30);
    assert.equal(computeCrapScore(5, 100), 5);
    assert.equal(computeCrapScore(6, 50), 10.5);
  });

  it("measures JSX and hook cyclomatic complexity and fails uncovered complex components", () => {
    withTempWorkspace((dir) => {
      writeFileSync(
        join(dir, "UserBadge.tsx"),
        `
export function SimpleBadge({ name }: { name: string }) {
  return <span>{name}</span>;
}

export function ComplexPanel({
  status,
  isAdmin,
  items,
  fallback,
}: {
  status: "idle" | "loading" | "error" | "ready";
  isAdmin: boolean;
  items: string[];
  fallback?: string;
}) {
  if (status === "loading") {
    return <div>Loading...</div>;
  }
  if (status === "error") {
    return <div>{fallback ?? "Error"}</div>;
  }
  return (
    <section>
      {isAdmin && <span>Admin</span>}
      {items.length > 0 ? <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul> : <p>Empty</p>}
    </section>
  );
}
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runCrapper(files, { rootDir: dir, maxCrap: 10 });
      const complex = report.metrics.find((m) => m.unitName === "ComplexPanel");
      const simple = report.metrics.find((m) => m.unitName === "SimpleBadge");

      assert.ok(complex);
      assert.ok(simple);
      assert.equal(simple.kind, "component");
      assert.equal(simple.complexity, 1);
      assert.equal(simple.passed, true);
      assert.equal(complex.kind, "component");
      assert.ok(complex.complexity >= 6);
      assert.equal(complex.passed, false);
      assert.equal(report.passed, false);
    });
  });

  it("reads LCOV line coverage and lowers CRAP score when covered", () => {
    withTempWorkspace((dir) => {
      const srcFile = join(dir, "Panel.tsx");
      writeFileSync(
        srcFile,
        `export function Panel({ ok, label }: { ok: boolean; label?: string }) {
  if (!ok) {
    return <span>{label ?? "nope"}</span>;
  }
  return <span>{ok && "yes"}</span>;
}
`,
      );
      mkdirSync(join(dir, "coverage"), { recursive: true });
      writeFileSync(
        join(dir, "coverage/lcov.info"),
        `TN:
SF:Panel.tsx
DA:1,1
DA:2,1
DA:3,1
DA:4,1
DA:5,1
LF:5
LH:5
end_of_record
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runCrapper(files, { rootDir: dir, maxCrap: 10 });
      const panel = report.metrics.find((m) => m.unitName === "Panel");

      assert.ok(panel);
      assert.equal(panel.coveragePercent, 100);
      assert.equal(panel.crapScore, panel.complexity);
      assert.equal(panel.passed, true);
      assert.equal(report.passed, true);
    });
  });

  it("reads Istanbul coverage-final.json per-line statement hits", () => {
    withTempWorkspace((dir) => {
      const srcFile = join(dir, "Helper.tsx");
      writeFileSync(
        srcFile,
        `export function Helper(flag: boolean) {
  if (flag) {
    return <span>Yes</span>;
  }
  return <span>No</span>;
}
`,
      );
      mkdirSync(join(dir, "coverage"), { recursive: true });
      writeFileSync(
        join(dir, "coverage/coverage-final.json"),
        JSON.stringify({
          [srcFile]: {
            statementMap: {
              "0": { start: { line: 2 } },
              "1": { start: { line: 3 } },
              "2": { start: { line: 5 } },
            },
            s: { "0": 1, "1": 1, "2": 1 },
          },
        }),
      );

      const files = parseProjectFiles(dir, dir);
      const report = runCrapper(files, { rootDir: dir, maxCrap: 10 });
      assert.equal(report.passed, true);
      assert.equal(report.metrics[0].coveragePercent, 100);
    });
  });

  it("classifies FC-typed, memo, and forwardRef components accurately", () => {
    withTempWorkspace((dir) => {
      writeFileSync(
        join(dir, "Wrapped.tsx"),
        `import type { FC } from "react";
const TypedOnly: FC<{ label: string }> = ({ label }) => label as unknown as never;
const MemoCard = memo(({ title }: { title: string }) => <div>{title}</div>);
const ForwardInput = React.forwardRef<HTMLInputElement, { id: string }>((props, ref) => (
  <input id={props.id} ref={ref} />
));
export { TypedOnly, MemoCard, ForwardInput };
`,
      );

      const files = parseProjectFiles(dir, dir);
      const kinds = new Map(files[0].units.map((u) => [u.name, u.kind]));
      assert.equal(kinds.get("TypedOnly"), "component");
      assert.equal(kinds.get("MemoCard"), "component");
      assert.equal(kinds.get("ForwardInput"), "component");
    });
  });
});
