#!/usr/bin/env node
/* build.mjs — emit a SLIM SKILL.md as an INDEX into rules/*.md.
 *
 * Same progressive-disclosure pattern as create-acs-sound: SKILL.md is
 * `src/preamble.md` + a one-line-per-rule index grouped by category.
 * Rule bodies stay in `rules/<slug>.md` and the agent reads each on
 * demand when the pipeline reaches a step that needs it.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

const CATEGORY_ORDER = ["pipeline", "token", "archetype", "validate"];

const CATEGORY_HEADINGS = {
  pipeline: "Pipeline (orchestration)",
  token: "Token mappings — design system → sound parameters",
  archetype: "Archetypes — starting templates (depart from them, never copy)",
  validate: "Validation — run after the .acs file is written",
};

const CATEGORY_INTROS = {
  pipeline: "Read in pipeline order. Each is a procedural step.",
  token: "Open the rules that match the project's actual tokens. A site with no shadow scale doesn't need `token-shadow`.",
  archetype: "These are reference points, not recipes. Read at most one or two; then deviate based on tokens.",
  validate: "Open before each check; the thresholds are explicit.",
};

// Lightweight frontmatter parser — enough for our flat schema. Keeps the
// skill build self-contained (no shared dep on create-acs-sound).
function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { frontmatter: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { frontmatter: {}, body: text };
  const fm = text.slice(3, end).trim();
  const body = text.slice(end + 4).trimStart();
  const frontmatter = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (m) frontmatter[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return { frontmatter, body };
}

function loadRules() {
  return readdirSync(RULES_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort()
    .map((file) => {
      const text = readFileSync(join(RULES_DIR, file), "utf8");
      const { frontmatter } = parseFrontmatter(text);
      return {
        file,
        slug: file.replace(/\.md$/, ""),
        category: file.split("-")[0],
        frontmatter,
      };
    });
}

function renderIndexRow(rule) {
  const slug = `\`${rule.slug}\``;
  const impact = rule.frontmatter.impact || "";
  const triggers = (rule.frontmatter.prompt || "").trim();
  const why = (rule.frontmatter.impactDescription || "").trim();
  const tail = triggers
    ? `triggers: ${triggers}`
    : why
      ? why.replace(/\.$/, "")
      : "";
  return `- ${slug} _(${impact})_ — ${tail}`;
}

function build() {
  const rules = loadRules();
  const buckets = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, []]));
  for (const r of rules) {
    if (!buckets[r.category]) buckets[r.category] = [];
    buckets[r.category].push(r);
  }
  for (const c of CATEGORY_ORDER) {
    buckets[c].sort((a, b) => {
      const ai = IMPACT_ORDER[a.frontmatter.impact] ?? 9;
      const bi = IMPACT_ORDER[b.frontmatter.impact] ?? 9;
      if (ai !== bi) return ai - bi;
      return a.slug.localeCompare(b.slug);
    });
  }

  const preamble = readFileSync(PREAMBLE, "utf8").trimEnd();
  let out = preamble + "\n";

  for (const c of CATEGORY_ORDER) {
    const items = buckets[c];
    if (!items?.length) continue;
    out += `\n### ${CATEGORY_HEADINGS[c]}\n\n_${CATEGORY_INTROS[c]}_\n\n`;
    for (const rule of items) out += renderIndexRow(rule) + "\n";
  }

  out += "\n## Reference\n\n";
  out += "- ACS runtime source: `poc/runtime/`\n";
  out += "- Built-in 49 presets: `poc/defaults.acs` (use as inspiration, not as bindings)\n";
  out += "- Linter: `tools/lint-acs.mjs`\n";
  out += "- Sister skill (single-preset author): `skills/create-acs-sound/SKILL.md`\n";

  writeFileSync(OUT, out);
  const bytes = Buffer.byteLength(out, "utf8");
  console.log(
    `[build] wrote ${OUT} — ${rules.length} rules indexed, ` +
    `${bytes} bytes (~${Math.round(bytes / 3.5)} tokens).`
  );
}

build();
