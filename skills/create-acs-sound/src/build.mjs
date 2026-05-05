#!/usr/bin/env node
/* build.mjs — emit a SLIM SKILL.md as an INDEX into rules/*.md.
 *
 * Old behavior (pre-2026-05-05): concatenated every rule's full body
 * into SKILL.md, producing a ~22k-token document the agent skimmed
 * and confabulated from.
 *
 * New behavior: SKILL.md = `src/preamble.md` + an auto-generated
 * one-line-per-rule index grouped by category. Rule bodies stay in
 * `rules/*.md`; the agent reads each rule on demand via the Read
 * tool when the pipeline reaches a step that needs it. This is the
 * progressive-disclosure pattern Anthropic skills are designed for.
 *
 * Output size target: <2.5k tokens. Original was 22k.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRules, groupByCategory, CATEGORY_ORDER } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const RULES_DIR = join(ROOT, "rules");
const PREAMBLE = join(__dirname, "preamble.md");
const OUT = join(ROOT, "SKILL.md");

const IMPACT_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  "MEDIUM-HIGH": 2,
  MEDIUM: 3,
  LOW: 4,
};

const CATEGORY_HEADINGS = {
  pipeline: "Pipeline (orchestration)",
  event: "Event base layers — pick one",
  mood: "Mood overlays — stack as needed",
  layer: "Layer shapes — single vs multi",
  effect: "Effect recipes — applied at element level, not in @sound",
  interpret: "Audio interpretation — for prompt+audio path",
  validate: "Validation — run after emit",
};

const CATEGORY_INTROS = {
  pipeline: "Read these in pipeline order; each is a procedural step.",
  event: "Match the prompt's strongest event signal against `Triggers`. Open exactly one file.",
  mood: "Map prompt adjectives to mood files. Multiple may stack — open each you apply.",
  layer: "Pick a layer shape from `pipeline-decide-layering`, then open the corresponding file.",
  effect: "These describe per-element decls (room, filter, mood-mix). Read when the user asks for room/space/character.",
  interpret: "Sub-steps of audio analysis. Open each in order when the input includes a sample.",
  validate: "Open before each check; the thresholds are specific (decay caps, gain budgets, frequency bounds).",
};

function pickTriggers(rule) {
  const p = rule.frontmatter.prompt || "";
  // Strip surrounding quotes (already done by parseRule, but defensive).
  return p.replace(/^["']|["']$/g, "").trim();
}

function pickWhy(rule) {
  return (rule.frontmatter.impactDescription || "").trim();
}

function renderIndexRow(rule) {
  const slug = `\`${rule.slug}\``;
  const impact = rule.frontmatter.impact || "";
  const triggers = pickTriggers(rule);
  const why = pickWhy(rule);
  // Compact: slug | impact | triggers (or why if no triggers) — one line.
  // Use a description list-ish format for readability without table noise.
  const tail = triggers
    ? `triggers: ${triggers}`
    : why
      ? why.replace(/\.$/, "")
      : "";
  return `- ${slug} _(${impact})_ — ${tail}`;
}

function build() {
  const rules = loadRules(RULES_DIR);
  const buckets = groupByCategory(rules);

  for (const category of CATEGORY_ORDER) {
    buckets[category].sort((a, b) => {
      const ai = IMPACT_ORDER[a.frontmatter.impact] ?? 9;
      const bi = IMPACT_ORDER[b.frontmatter.impact] ?? 9;
      if (ai !== bi) return ai - bi;
      return a.slug.localeCompare(b.slug);
    });
  }

  const preamble = readFileSync(PREAMBLE, "utf8").trimEnd();

  let out = preamble + "\n";

  for (const category of CATEGORY_ORDER) {
    const items = buckets[category];
    if (!items?.length) continue;
    out += `\n### ${CATEGORY_HEADINGS[category]}\n\n`;
    out += `_${CATEGORY_INTROS[category]}_\n\n`;
    for (const rule of items) {
      out += renderIndexRow(rule) + "\n";
    }
  }

  out += "\n## Reference\n\n";
  out += "- ACS runtime source: `poc/runtime/`\n";
  out += "- Built-in 49 presets: `poc/defaults.acs` (preset names go in `sound:` declarations)\n";
  out += "- Linter (catches typo'd preset names + unknown properties): `tools/lint-acs.mjs`\n";
  out += "- Audition any preset in VSCode: ▶ CodeLens above the `@sound` line\n";

  writeFileSync(OUT, out);

  // Report: total rules, output bytes, rough token estimate.
  const bytes = Buffer.byteLength(out, "utf8");
  const tokens = Math.round(bytes / 3.5);
  console.log(
    `[build] wrote ${OUT} — ${rules.length} rules indexed, ` +
    `${bytes} bytes (~${tokens} tokens). ` +
    `Rule bodies remain in rules/*.md for on-demand Read.`
  );
}

build();
