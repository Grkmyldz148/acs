#!/usr/bin/env node
/* extract-tests.mjs — roll up every rule's example into test-cases.json.
 *
 * Each test case maps the rule's `prompt` (the trigger tokens) to its
 * `example` @sound. Downstream test runners can use these as fixtures
 * to verify that the agent, given the prompt, produces an @sound that
 * round-trips through the ACS parser AND has comparable structure to
 * the example (same source key, same approximate frequencies, etc.).
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRules } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const RULES_DIR = join(ROOT, "rules");
const OUT = join(ROOT, "test-cases.json");

const rules = loadRules(RULES_DIR);

const cases = rules
  .filter((r) => r.frontmatter.prompt && r.frontmatter.prompt.trim() !== "")
  .filter((r) => r.frontmatter.example && r.frontmatter.example.includes("@sound"))
  .map((r) => ({
    slug: r.slug,
    category: r.category,
    impact: r.frontmatter.impact,
    prompt: r.frontmatter.prompt,
    expected_acs: r.frontmatter.example.trim(),
  }));

writeFileSync(OUT, JSON.stringify({ version: 1, cases }, null, 2) + "\n");
console.log(`[extract-tests] wrote ${OUT} — ${cases.length} cases`);
