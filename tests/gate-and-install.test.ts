import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { main } from "../src/cli.js";
import { runGate } from "../src/gate.js";
import { getPromptText, installSkill } from "../src/install.js";
import { runProjectInit, runSetup } from "../src/onboard.js";

function withTempWorkspace(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "react-ub-gate-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("gate, install, and cli", () => {
  it("passes full gate on a clean, covered React workspace", () => {
    withTempWorkspace((dir) => {
      mkdirSync(join(dir, "atoms"), { recursive: true });
      writeFileSync(
        join(dir, "atoms/StatusPill.tsx"),
        `export function StatusPill({ active }: { readonly active: boolean }) {
  return <span>{active ? "Active" : "Paused"}</span>;
}
`,
      );
      writeFileSync(
        join(dir, "atoms/StatusPill.test.tsx"),
        `import assert from "node:assert/strict";
import { it } from "node:test";
import { StatusPill } from "./StatusPill";

it("renders active label", () => {
  const el = StatusPill({ active: true });
  assert.ok(el);
});
`,
      );
      mkdirSync(join(dir, "coverage"), { recursive: true });
      writeFileSync(
        join(dir, "coverage/coverage-summary.json"),
        JSON.stringify({
          total: { lines: { pct: 100 } },
          "atoms/StatusPill.tsx": { lines: { pct: 100 } },
        }),
      );

      const report = runGate({ targetPath: dir, strictWarnings: true });
      assert.equal(report.passed, true);
      assert.equal(report.crapper.passed, true);
      assert.equal(report.dryer.passed, true);
      assert.equal(report.reactAudit.passed, true);
      assert.equal(report.mutator.passed, true);
    });
  });

  it("installs skill and plugin idempotently into a project .agents directory", () => {
    withTempWorkspace((dir) => {
      const first = installSkill({ target: "local", cwd: dir, withPlugin: true });
      const second = installSkill({ target: "local", cwd: dir, withPlugin: true });

      assert.equal(first.length, 2);
      assert.equal(second.length, 2);

      const skillPath = join(dir, ".agents/skills/react-ub-mode/SKILL.md");
      const pluginJsonPath = join(dir, ".agents/plugins/react-ub-mode/plugin.json");
      const rulesPath = join(dir, ".agents/plugins/react-ub-mode/rules/AGENTS.md");

      assert.equal(existsSync(skillPath), true);
      assert.equal(existsSync(pluginJsonPath), true);
      assert.equal(existsSync(rulesPath), true);
      assert.match(readFileSync(skillPath, "utf8"), /name: react-ub-mode/);
    });
  });

  it("installs VS Code Copilot instructions/skills and generates ChatGPT prompts", () => {
    withTempWorkspace((dir) => {
      const fakeHome = join(dir, "fake-home");
      const projectDir = join(dir, "my-react-app");
      mkdirSync(fakeHome, { recursive: true });
      mkdirSync(projectDir, { recursive: true });

      const copilotResults = installSkill({
        target: "copilot",
        cwd: projectDir,
        homeDir: fakeHome,
      });
      assert.equal(copilotResults.length, 3);
      const instrPath = join(
        projectDir,
        ".github/instructions/react-ub-mode.instructions.md",
      );
      assert.equal(existsSync(instrPath), true);
      assert.match(readFileSync(instrPath, "utf8"), /applyTo: "\*\*\/\*\.\{ts,tsx,js,jsx\}"/);
      assert.equal(
        existsSync(join(projectDir, ".github/skills/react-ub-mode/SKILL.md")),
        true,
      );
      assert.equal(
        existsSync(join(fakeHome, ".copilot/skills/react-ub-mode/SKILL.md")),
        true,
      );

      const chatgptResults = installSkill({
        target: "chatgpt",
        cwd: projectDir,
        homeDir: fakeHome,
      });
      assert.equal(chatgptResults.length, 1);
      const promptPath = join(projectDir, "react-ub-mode-chatgpt.md");
      assert.equal(existsSync(promptPath), true);
      assert.match(readFileSync(promptPath, "utf8"), /Atomic Design/);

      const compactPrompt = getPromptText({ compact: true });
      assert.ok(compactPrompt.length <= 1500);
      assert.match(compactPrompt, /Atomic Design/);
      assert.equal(main(["prompt", "--compact"]), 0);
    });
  });

  it("runs global setup and one-command project init idempotently", () => {
    withTempWorkspace((dir) => {
      const fakeHome = join(dir, "home");
      const reactApp = join(dir, "react-app");
      mkdirSync(fakeHome, { recursive: true });
      mkdirSync(reactApp, { recursive: true });
      writeFileSync(
        join(reactApp, "package.json"),
        JSON.stringify({ name: "react-app", scripts: { dev: "vite" } }, null, 2),
      );

      const setupReport = runSetup({
        homeDir: fakeHome,
        copyToClipboard: true,
        clipboardRunner: (text) => text.includes("Atomic Design"),
      });
      assert.ok(setupReport.installed.length >= 7);
      assert.equal(setupReport.copiedToClipboard, true);
      assert.equal(existsSync(setupReport.chatGptPromptFile), true);
      const prevHome = process.env.HOME;
      try {
        process.env.HOME = fakeHome;
        assert.equal(main(["setup"]), 0);
      } finally {
        process.env.HOME = prevHome;
      }
      assert.equal(
        existsSync(join(fakeHome, ".gemini/config/plugins/react-ub-mode/plugin.json")),
        true,
      );
      assert.equal(
        existsSync(join(fakeHome, ".copilot/skills/react-ub-mode/SKILL.md")),
        true,
      );

      const initFirst = runProjectInit({
        projectDir: reactApp,
        homeDir: fakeHome,
        withChatGpt: true,
      });
      assert.equal(initFirst.atomicDirsCreated.length, 5);
      assert.deepEqual(initFirst.scriptsAdded, ["ub:gate", "ub:audit", "ub:mutate"]);
      assert.equal(existsSync(join(reactApp, "src/atoms/.gitkeep")), true);
      assert.equal(
        existsSync(join(reactApp, ".github/instructions/react-ub-mode.instructions.md")),
        true,
      );
      assert.equal(
        existsSync(join(reactApp, ".agents/skills/react-ub-mode/SKILL.md")),
        true,
      );

      const initSecond = runProjectInit({
        projectDir: reactApp,
        homeDir: fakeHome,
      });
      assert.equal(initSecond.atomicDirsCreated.length, 0);
      assert.equal(initSecond.scriptsAdded.length, 0);
      assert.equal(main(["init", reactApp, "--json"]), 0);
    });
  });

  it("returns expected CLI exit codes for subcommands and formats reports", () => {
    withTempWorkspace((dir) => {
      mkdirSync(join(dir, "atoms"), { recursive: true });
      writeFileSync(
        join(dir, "atoms/Card.tsx"),
        `export function Card({ title }: { readonly title: string }) {
  return <article><h2>{title}</h2></article>;
}
`,
      );
      writeFileSync(
        join(dir, "atoms/Card.test.tsx"),
        `import assert from "node:assert/strict";
import { it } from "node:test";
import { Card } from "./Card";

it("renders title", () => {
  assert.ok(Card({ title: "Hi" }));
});
`,
      );
      mkdirSync(join(dir, "coverage"), { recursive: true });
      writeFileSync(
        join(dir, "coverage/coverage-summary.json"),
        JSON.stringify({ "atoms/Card.tsx": { lines: { pct: 100 } } }),
      );

      assert.equal(main(["help"]), 0);
      assert.equal(main(["crapper", dir, "--max-crap=10", "--json"]), 0);
      assert.equal(main(["dryer", dir, "--threshold", "0.8"]), 0);
      assert.equal(main(["react-audit", dir, "--strict"]), 0);
      assert.equal(main(["mutator", dir]), 0);
      assert.equal(main(["gate", dir]), 0);
      const prevCwd = process.cwd();
      try {
        process.chdir(dir);
        assert.equal(main(["install", "--local", "--plugin", "--json"]), 0);
      } finally {
        process.chdir(prevCwd);
      }
      assert.equal(main(["install", "--target=invalid"]), 2);
      assert.equal(main(["unknown-cmd"]), 2);
    });
  });
});
