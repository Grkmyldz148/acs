#!/usr/bin/env node
/* build.mjs — concatenate rules/*.md into SKILL.md.
 *
 * Walks rules/ in raphael-style category order:
 *   pipeline → event → mood → layer → effect → interpret → validate
 *
 * Within a category, rules are sorted by impact (CRITICAL, HIGH, MEDIUM-HIGH,
 * MEDIUM, LOW), then alphabetically. The output begins with the orchestrator
 * preamble (current SKILL.md's first ~6 sections — pipeline overview), then
 * the rules in order, each as its own `### <title>` section.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRules, groupByCategory, CATEGORY_ORDER } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const RULES_DIR = join(ROOT, "rules");
const OUT = join(ROOT, "SKILL.md");

const IMPACT_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  "MEDIUM-HIGH": 2,
  MEDIUM: 3,
  LOW: 4,
};

const CATEGORY_HEADINGS = {
  pipeline: "1. Generation Pipeline",
  event: "4. Event base layers",
  mood: "5. Mood overlays",
  layer: "6. Layer shapes",
  effect: "7. Effect recipes",
  interpret: "8. Audio interpretation",
  validate: "9. Validation",
};

const CATEGORY_INTROS = {
  pipeline: "Procedural steps the agent runs end-to-end. Start here when handling any create-acs-sound request.",
  event: "Pick exactly one based on the prompt's strongest event-class signal.",
  mood: "Apply each in `pipeline-apply-mood`'s declared order. Multiple may stack.",
  layer: "Decide single vs multi-layer in `pipeline-decide-layering`, then look up the shape.",
  effect: "Add these to per-element rules (not to the @sound itself) — they live in the cascade.",
  interpret: "Sub-steps for the audio-input path. Each emits a fragment; `pipeline-emit-and-render` merges them.",
  validate: "Run after emit. Reject and refine if any tolerance fails.",
};

function renderRule(rule, headingLevel = 3) {
  const { frontmatter, body } = rule;
  const head = "#".repeat(headingLevel);
  const impact = frontmatter.impact ? ` _(${frontmatter.impact})_` : "";
  const tags = frontmatter.tags ? `\n_tags_: \`${frontmatter.tags}\`\n` : "";

  // Body already contains its own H2 — strip it (we replace with our own H3).
  const bodyLines = body.split("\n");
  if (bodyLines[0]?.startsWith("## ")) bodyLines.shift();
  if (bodyLines[0] === "") bodyLines.shift();

  let out = `${head} \`${rule.slug}\`${impact}\n\n`;
  if (frontmatter.impactDescription) {
    out += `> ${frontmatter.impactDescription}\n\n`;
  }
  out += tags;
  out += bodyLines.join("\n").trimEnd();

  if (frontmatter.example) {
    out += "\n\n**Example:**\n\n```css\n" + frontmatter.example.trimEnd() + "\n```";
  }

  return out;
}

function build() {
  const rules = loadRules(RULES_DIR);
  const buckets = groupByCategory(rules);

  // Sort each bucket by impact, then by slug
  for (const category of CATEGORY_ORDER) {
    buckets[category].sort((a, b) => {
      const ai = IMPACT_ORDER[a.frontmatter.impact] ?? 9;
      const bi = IMPACT_ORDER[b.frontmatter.impact] ?? 9;
      if (ai !== bi) return ai - bi;
      return a.slug.localeCompare(b.slug);
    });
  }

  const preamble = readFileSync(join(ROOT, "SKILL.md"), "utf8")
    .split(/^## 4\./m)[0]
    .trimEnd();

  // For categories that already have hand-written content in the orchestrator
  // preamble (pipeline), skip auto-render — the preamble owns them.
  const skipAuto = new Set(["pipeline"]);

  let out = preamble + "\n\n";

  for (const category of CATEGORY_ORDER) {
    if (skipAuto.has(category)) continue;
    const items = buckets[category];
    if (!items?.length) continue;

    out += `\n## ${CATEGORY_HEADINGS[category]}\n\n`;
    out += `_${CATEGORY_INTROS[category]}_\n\n`;
    for (const rule of items) {
      out += renderRule(rule, 3) + "\n\n---\n\n";
    }
  }

  out += "\n## Reference\n\n";
  out += "- ACS runtime source: `poc/runtime/`\n";
  out += "- Built-in 49 presets: `poc/defaults.acs` (use these names in `sound:` declarations)\n";
  out += "- Linter (catches typo'd preset names): `tools/lint-acs.mjs`\n";
  out += "- Audition any preset in VSCode: ▶ CodeLens above the `@sound` line\n";

  writeFileSync(OUT, out);
  console.log(`[build] wrote ${OUT} — ${rules.length} rules across ${CATEGORY_ORDER.length} categories.`);
}

build();
