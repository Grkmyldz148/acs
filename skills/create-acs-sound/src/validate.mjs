#!/usr/bin/env node
/* validate.mjs — sanity-check every rule's frontmatter and example block.
 *
 * Reports:
 *   - missing required frontmatter keys (title, impact, prompt, example)
 *   - example blocks that fail the lightweight ACS sanity check
 *   - duplicate slugs
 *   - impact values outside the canonical set
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRules, quickValidateAcsExample } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_DIR = join(dirname(__dirname), "rules");

const REQUIRED = ["title", "impact", "tags", "prompt", "example"];
const VALID_IMPACTS = new Set(["CRITICAL", "HIGH", "MEDIUM-HIGH", "MEDIUM", "LOW"]);

// Categories where `prompt` is allowed to be empty — these rules are invoked by
// the pipeline orchestrator, not by tokens in the user's prompt.
const EMPTY_PROMPT_OK = new Set(["pipeline", "validate", "interpret"]);

const rules = loadRules(RULES_DIR);
let failures = 0;

const seen = new Set();
for (const rule of rules) {
  const errors = [];

  for (const k of REQUIRED) {
    const v = rule.frontmatter[k];
    const isEmpty = !v || v.trim() === "";
    if (k === "prompt" && isEmpty && EMPTY_PROMPT_OK.has(rule.category)) continue;
    if (isEmpty) {
      errors.push(`missing or empty frontmatter key: ${k}`);
    }
  }

  if (rule.frontmatter.impact && !VALID_IMPACTS.has(rule.frontmatter.impact)) {
    errors.push(`impact "${rule.frontmatter.impact}" not in {CRITICAL,HIGH,MEDIUM-HIGH,MEDIUM,LOW}`);
  }

  if (seen.has(rule.slug)) {
    errors.push(`duplicate slug ${rule.slug}`);
  }
  seen.add(rule.slug);

  if (rule.frontmatter.example) {
    const exErrors = quickValidateAcsExample(rule.frontmatter.example);
    for (const e of exErrors) errors.push(`example: ${e}`);
  }

  if (errors.length) {
    failures += 1;
    console.error(`✗ ${rule.file}`);
    for (const e of errors) console.error(`    ${e}`);
  } else {
    console.log(`✓ ${rule.file}`);
  }
}

console.log("");
console.log(`${rules.length - failures}/${rules.length} rules passed`);
if (failures > 0) {
  process.exit(1);
}
