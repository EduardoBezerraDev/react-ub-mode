import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runDryer } from "../src/dryer/index.js";
import { parseProjectFiles } from "../src/scanner.js";

function withTempWorkspace(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "react-ub-dryer-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("dryer", () => {
  it("flags structurally duplicated React hooks even when identifiers differ", () => {
    withTempWorkspace((dir) => {
      writeFileSync(
        join(dir, "hooks.ts"),
        `import { useEffect, useState } from "react";

export function useUserFetch(userId: string) {
  const [user, setUser] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/users/" + userId)
      .then((res) => res.json())
      .then((payload) => {
        if (active) {
          setUser(payload);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);
  return { user, loading };
}

export function useOrderFetch(orderId: string) {
  const [order, setOrder] = useState<unknown>(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let mounted = true;
    setBusy(true);
    fetch("/api/orders/" + orderId)
      .then((response) => response.json())
      .then((data) => {
        if (mounted) {
          setOrder(data);
          setBusy(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [orderId]);
  return { order, busy };
}
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runDryer(files, { threshold: 0.8 });

      assert.equal(report.passed, false);
      assert.equal(report.matches.length, 1);
      assert.ok(report.matches[0].similarity >= 0.8);
      assert.match(report.matches[0].suggestion, /custom hook/i);
    });
  });

  it("passes when components have distinct structures", () => {
    withTempWorkspace((dir) => {
      writeFileSync(
        join(dir, "components.tsx"),
        `export function GreetingCard({ title }: { title: string }) {
  return (
    <article>
      <h1>{title}</h1>
      <p>Welcome back</p>
    </article>
  );
}

export function CounterButton({ count, onInc }: { count: number; onInc: () => void }) {
  return (
    <button type="button" onClick={onInc}>
      Clicked {count} times
    </button>
  );
}
`,
      );

      const files = parseProjectFiles(dir, dir);
      const report = runDryer(files, { threshold: 0.8 });

      assert.equal(report.passed, true);
      assert.equal(report.matches.length, 0);
    });
  });
});
