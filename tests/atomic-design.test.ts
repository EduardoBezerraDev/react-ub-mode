import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runReactAudit } from "../src/react-audit/index.js";
import { parseProjectFiles } from "../src/scanner.js";

function withTempWorkspace(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "react-ub-atomic-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("atomic-design", () => {
  it("flags components outside Atomic Design layers, upward imports, and impure atoms/templates", () => {
    withTempWorkspace((dir) => {
      mkdirSync(join(dir, "atoms"), { recursive: true });
      mkdirSync(join(dir, "molecules"), { recursive: true });
      mkdirSync(join(dir, "templates"), { recursive: true });

      writeFileSync(
        join(dir, "LooseButton.tsx"),
        `export function LooseButton() { return <button type="button">Loose</button>; }\n`,
      );

      writeFileSync(
        join(dir, "atoms/BadAtom.tsx"),
        `import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "../molecules/SearchBar";

export function BadAtom() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/ping");
  }, []);
  return <div onClick={() => router.push("/")}><SearchBar /></div>;
}
`,
      );

      writeFileSync(
        join(dir, "molecules/SearchBar.tsx"),
        `export function SearchBar() { return <input aria-label="Search" />; }\n`,
      );

      writeFileSync(
        join(dir, "templates/BadTemplate.tsx"),
        `import { HomePage } from "../pages/HomePage";
export function BadTemplate() {
  fetch("/api/layout");
  return <main><HomePage /></main>;
}
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runReactAudit(files);
      const rules = new Set(report.diagnostics.map((d) => d.ruleId));

      assert.equal(report.passed, false);
      assert.ok(rules.has("atomic-unclassified-component"));
      assert.ok(rules.has("atomic-dependency-direction"));
      assert.ok(rules.has("atomic-atom-impurity"));
      assert.ok(rules.has("atomic-template-impurity"));
    });
  });

  it("passes on a clean downward Atomic Design hierarchy (pages -> templates -> organisms -> molecules -> atoms)", () => {
    withTempWorkspace((dir) => {
      for (const layer of ["atoms", "molecules", "organisms", "templates", "pages"]) {
        mkdirSync(join(dir, layer), { recursive: true });
      }

      writeFileSync(
        join(dir, "atoms/Button.tsx"),
        `export function Button({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return <button type="button" onClick={onClick}>{label}</button>;
}
`,
      );
      writeFileSync(
        join(dir, "molecules/ActionRow.tsx"),
        `import { Button } from "../atoms/Button";
export function ActionRow({ onSave }: { readonly onSave: () => void }) {
  return <div><Button label="Save" onClick={onSave} /></div>;
}
`,
      );
      writeFileSync(
        join(dir, "organisms/SettingsPanel.tsx"),
        `import { ActionRow } from "../molecules/ActionRow";
export function SettingsPanel({ onSave }: { readonly onSave: () => void }) {
  return <section><ActionRow onSave={onSave} /></section>;
}
`,
      );
      writeFileSync(
        join(dir, "templates/DashboardLayout.tsx"),
        `import type { ReactNode } from "react";
export function DashboardLayout({ children }: { readonly children: ReactNode }) {
  return <main>{children}</main>;
}
`,
      );
      writeFileSync(
        join(dir, "pages/SettingsPage.tsx"),
        `import { DashboardLayout } from "../templates/DashboardLayout";
import { SettingsPanel } from "../organisms/SettingsPanel";
export function SettingsPage() {
  return (
    <DashboardLayout>
      <SettingsPanel onSave={() => {}} />
    </DashboardLayout>
  );
}
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runReactAudit(files, { strictWarnings: true });

      assert.equal(report.errors, 0);
      assert.equal(report.warnings, 0);
      assert.equal(report.passed, true);
    });
  });
});
