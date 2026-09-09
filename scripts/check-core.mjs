import { spawn } from "node:child_process";
import { buildContent, root, writeJson } from "./content.mjs";
await buildContent("rhine", { stage: false });
const files = [
  "archive",
  "loop",
  "motion",
  "appearance",
  "assembly",
  "ui-motion",
  "archive-pathtracing",
  "rendering",
  "decryption",
  "internal-optics",
  "shell",
];
const results = await Promise.all(
  files.map(
    (test) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [`scripts/check-${test}.mjs`], {
          cwd: root,
        });
        let output = "";
        child.stdout.on("data", (chunk) => (output += chunk));
        child.stderr.on("data", (chunk) => (output += chunk));
        child.on("exit", (code) =>
          resolve({ test, passed: code === 0, output: output.trim() }),
        );
        child.on("error", (error) =>
          resolve({ test, passed: false, output: error.message }),
        );
      }),
  ),
);
await writeJson(`${root}/verification/template/core-report.json`, results);
for (const result of results)
  console.log(
    `${result.passed ? "PASS" : "FAIL"} ${result.test}${result.passed ? "" : ": " + result.output}`,
  );
if (results.some((result) => !result.passed)) process.exitCode = 1;
