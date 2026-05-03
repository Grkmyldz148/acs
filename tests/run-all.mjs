#!/usr/bin/env node
/* run-all.mjs — run every test file in tests/.
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tests = readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

let totalFails = 0;
for (const t of tests) {
  console.log(`\n=== ${basename(t)} ===`);
  const r = spawnSync(process.execPath, [resolve(__dirname, t)], {
    stdio: "inherit",
  });
  totalFails += r.status || 0;
}

console.log("\n");
if (totalFails === 0) {
  console.log("✓ All test files passed.");
  process.exit(0);
} else {
  console.log(`✗ ${totalFails} total failures.`);
  process.exit(totalFails);
}
