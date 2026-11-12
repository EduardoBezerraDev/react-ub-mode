import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  raw = "{}";
}

let workspacePaths = [];
try {
  const payload = JSON.parse(raw || "{}");
  if (Array.isArray(payload.workspacePaths)) {
    workspacePaths = payload.workspacePaths;
  }
} catch {
  workspacePaths = [];
}

const hasReact = workspacePaths.some((ws) => {
  const pkgPath = resolve(String(ws), "package.json");
  if (!existsSync(pkgPath)) {
    return false;
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Boolean(deps && (deps.react || deps.next));
  } catch {
    return false;
  }
});

if (hasReact) {
  console.log(
    JSON.stringify({
      injectSteps: [
        {
          ephemeralMessage:
            "react-ub-mode is active: follow First Make it Work -> Then Make it Right -> Follow Practice, and verify React/TS changes with `react-ub gate`.",
        },
      ],
    }),
  );
} else {
  console.log("{}");
}
