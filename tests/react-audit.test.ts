import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runReactAudit } from "../src/react-audit/index.js";
import { parseProjectFiles } from "../src/scanner.js";

function withTempWorkspace(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "react-ub-audit-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("react-audit", () => {
  it("catches React craftsmanship, type, boundary, hook, and a11y violations", () => {
    withTempWorkspace((dir) => {
      writeFileSync(
        join(dir, "BadComponent.tsx"),
        `import { useEffect, useState } from "react";

// @ts-ignore legacy api
export function BadComponent(props: any) {
  const [fullName, setFullName] = useState("");
  const width = window.innerWidth;
  const cached = JSON.parse(localStorage.getItem("prefs") || "{}");

  useEffect(() => {
    setFullName(props.first + " " + props.last);
  }, [props.first, props.last]);

  useEffect(() => {
    window.addEventListener("resize", () => {});
  }, []);

  return (
    <div>
      <img src="/logo.png" />
      <div onClick={() => props.onOpen(width, cached)}>Open</div>
      <div dangerouslySetInnerHTML={{ __html: props.rawHtml }} />
      <ul>
        {props.items.map((item: string, idx: number) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
      <span>{fullName}</span>
    </div>
  );
}
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runReactAudit(files);
      const rules = new Set(report.diagnostics.map((d) => d.ruleId));

      assert.equal(report.passed, false);
      assert.ok(rules.has("type-compiler-silence"));
      assert.ok(rules.has("type-any-usage"));
      assert.ok(rules.has("ssr-unsafe-global"));
      assert.ok(rules.has("boundary-unparsed-data"));
      assert.ok(rules.has("effect-derived-state"));
      assert.ok(rules.has("effect-missing-cleanup"));
      assert.ok(rules.has("a11y-missing-alt"));
      assert.ok(rules.has("a11y-clickable-non-semantic"));
      assert.ok(rules.has("security-dangerous-html"));
      assert.ok(rules.has("jsx-index-key"));
    });
  });

  it("passes on clean React TSX with boundary parsing, semantic HTML, and effect cleanup", () => {
    withTempWorkspace((dir) => {
      mkdirSync(join(dir, "organisms"), { recursive: true });
      writeFileSync(
        join(dir, "organisms/GoodProfile.tsx"),
        `import { useEffect, useState } from "react";

interface UserProfile {
  readonly id: string;
  readonly name: string;
}

function parseUserProfile(raw: string): UserProfile | null {
  const data: unknown = JSON.parse(raw);
  if (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "name" in data &&
    typeof data.id === "string" &&
    typeof data.name === "string"
  ) {
    return { id: data.id, name: data.name };
  }
  return null;
}

export function GoodProfile({
  firstName,
  lastName,
  items,
  onSelect,
}: {
  readonly firstName: string;
  readonly lastName: string;
  readonly items: readonly UserProfile[];
  readonly onSelect: (id: string) => void;
}) {
  const [viewportWidth, setViewportWidth] = useState<number>(1024);
  const fullName = firstName + " " + lastName;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const initial =
    typeof window !== "undefined"
      ? parseUserProfile(localStorage.getItem("profile") ?? "{}")
      : null;

  return (
    <section aria-label={fullName}>
      <img src="/avatar.png" alt={initial?.name ?? fullName} />
      <p>Width: {viewportWidth}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onSelect(item.id)}>
              {item.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
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

  it("warns on prop bloat and oversized components", () => {
    withTempWorkspace((dir) => {
      const filler = Array.from({ length: 155 }, (_, i) => `  const v${i} = ${i};`).join("\n");
      writeFileSync(
        join(dir, "Bloated.tsx"),
        `export function Bloated({
  a, b, c, d, e, f, g, h, i,
}: {
  a: string; b: string; c: string; d: string; e: string; f: string; g: string; h: string; i: string;
}) {
${filler}
  return <div>{a}{b}{c}{d}{e}{f}{g}{h}{i}{v0}</div>;
}
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runReactAudit(files);
      const rules = new Set(report.diagnostics.map((d) => d.ruleId));

      assert.ok(rules.has("component-prop-bloat"));
      assert.ok(rules.has("component-oversized"));
    });
  });
});
