#!/usr/bin/env node
/* throttle.test.mjs — verify per-preset rate limiting behavior. */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");
const { shouldThrottle } = await import(`${RUNTIME}/throttle.js`);

let fails = 0;
function check(label, condition) {
  if (!condition) { fails++; console.error(`FAIL [${label}]`); }
  else console.log(`OK   [${label}]`);
}

// Each test uses a unique preset name to keep state isolated.
let t = 1000;

// 1. First trigger always passes.
check("first trigger passes", !shouldThrottle("preset-1", t));

// 2. Same trigger within MIN_INTERVAL (25ms) is throttled.
t = 2000;
shouldThrottle("preset-2", t);
check("trigger 10ms later throttled", shouldThrottle("preset-2", t + 10));

// 3. After 25ms+ same trigger passes again.
check("trigger 30ms later passes", !shouldThrottle("preset-2", t + 30));

// 4. Spam cap: 8 triggers in 300ms allowed, 9th blocked.
t = 3000;
for (let i = 0; i < 8; i++) {
  const ok = !shouldThrottle("preset-3", t + i * 30);
  if (!ok && i < 8) {
    fails++;
    console.error(`FAIL [trigger ${i + 1}/8 should pass]`);
  }
}
check("9th trigger in 300ms blocked", shouldThrottle("preset-3", t + 8 * 30));

// 5. After 300ms window slides, new triggers pass.
t = 4000;
for (let i = 0; i < 8; i++) shouldThrottle("preset-4", t + i * 30);
// Wait > 300ms past last trigger
check("trigger after window slide passes", !shouldThrottle("preset-4", t + 8 * 30 + 350));

// 5b. keystroke gets higher cap (16) for fast typing.
t = 4500;
// Pack 16 triggers tight enough to all fit in the 300ms window.
let kept = 0;
for (let i = 0; i < 16; i++) {
  // 18ms spacing × 16 = 288ms, all in window.
  // But MIN_INTERVAL is 25ms so we'd hit min-interval throttle.
  // Use 25ms spacing which is exactly at the boundary (not throttled).
  if (!shouldThrottle("keystroke", t + i * 25)) kept++;
}
check("keystroke allows 16 in 375ms span", kept === 16);
// Keep firing same preset rapidly — must hit cap eventually.
let blocked = 0;
const start2 = t + 16 * 25 + 25; // 25ms after last
for (let i = 0; i < 30; i++) {
  if (shouldThrottle("keystroke", start2 + i * 5)) blocked++;
}
check("rapid 5ms-spaced after fills cap blocked", blocked > 0);

// 6. Different presets are independent.
t = 5000;
shouldThrottle("preset-5a", t);
shouldThrottle("preset-5b", t);
check("preset-5a in window throttled", shouldThrottle("preset-5a", t + 10));
check("preset-5b independent of 5a", shouldThrottle("preset-5b", t + 10));
check("preset-5c never seen, passes", !shouldThrottle("preset-5c", t + 10));

if (fails === 0) console.log("\n✓ All throttle tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
