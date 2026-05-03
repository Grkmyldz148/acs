#!/usr/bin/env node
/* quality.test.mjs — verify quality.js profile knob.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");
const q = await import(`${RUNTIME}/quality.js`);

let fails = 0;
function check(label, condition) {
  if (!condition) { fails++; console.error(`FAIL [${label}]`); }
  else console.log(`OK   [${label}]`);
}

// 1. Default is medium.
check("default quality is medium", q.getQuality() === "medium");
const defaultProfile = q.getQualityProfile();
check("medium voiceCap is 8", defaultProfile.voiceCap === 8);
check("medium reverbScale is 1.0", defaultProfile.reverbScale === 1.0);

// 2. setQuality switches profile.
q.setQuality("low");
check("setQuality(low) switches", q.getQuality() === "low");
check("low voiceCap is 4", q.getQualityProfile().voiceCap === 4);
check("low modalPartials is 3", q.getQualityProfile().modalPartials === 3);
check("low reverbScale is 0.6", q.getQualityProfile().reverbScale === 0.6);

q.setQuality("high");
check("setQuality(high) switches", q.getQuality() === "high");
check("high voiceCap is 16", q.getQualityProfile().voiceCap === 16);
check("high modalPartials is 16", q.getQualityProfile().modalPartials === 16);

// 3. Unknown values are ignored (don't crash, keep current).
q.setQuality("ridiculous");
check("unknown level kept previous", q.getQuality() === "high");
q.setQuality(null);
check("null ignored", q.getQuality() === "high");
q.setQuality(undefined);
check("undefined ignored", q.getQuality() === "high");

// 4. Case-insensitive + whitespace-tolerant.
q.setQuality("  LOW  ");
check("trims + lowercases", q.getQuality() === "low");

// Reset for other tests.
q.setQuality("medium");

if (fails === 0) console.log("\n✓ All quality tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
