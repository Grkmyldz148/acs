/* lib.mjs — shared helpers for the create-acs-sound skill build pipeline.
 *
 * No external deps. Pure ESM. Mirrors the @web-kits/audio create-sound skill
 * lib.mjs in spirit, adapted for ACS's @sound DSL output.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Parse a markdown file with YAML-frontmatter.
 *
 * Returns `{ frontmatter, body }`. Frontmatter is a flat object;
 * the `example` key (if present) is preserved verbatim including
 * leading newlines so it can be round-tripped through the ACS parser.
 */
export function parseRule(text) {
  if (!text.startsWith("---")) {
    throw new Error("rule has no frontmatter");
  }
  const end = text.indexOf("\n---", 3);
  if (end < 0) throw new Error("rule frontmatter not closed");
  const fm = text.slice(3, end).trim();
  const body = text.slice(end + 4).trimStart();

  const frontmatter = {};
  let key = null;
  let buf = "";
  let inBlock = false;

  for (const rawLine of fm.split("\n")) {
    if (!inBlock) {
      const m = rawLine.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
      if (m) {
        if (key) frontmatter[key] = buf.trim().replace(/^["']|["']$/g, "");
        key = m[1];
        buf = "";
        const v = m[2];
        if (v === "|" || v === ">-" || v === ">" || v === "|-") {
          inBlock = true;
        } else {
          buf = v;
        }
      } else {
        buf += " " + rawLine.trim();
      }
    } else {
      // block scalar — preserve indentation past the first non-space col
      if (rawLine.match(/^\S/) && rawLine.trim() !== "") {
        // exited block
        frontmatter[key] = buf;
        inBlock = false;
        const m = rawLine.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
        if (m) {
          key = m[1];
          buf = m[2];
        }
      } else {
        buf += (buf ? "\n" : "") + rawLine.replace(/^  /, "");
      }
    }
  }
  if (key) frontmatter[key] = buf.trimEnd();

  return { frontmatter, body };
}

/**
 * Load every `rules/*.md` file (excluding `_*.md` index files) and
 * return them sorted by category then by name.
 */
export function loadRules(rulesDir) {
  const files = readdirSync(rulesDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();

  return files.map((file) => {
    const text = readFileSync(join(rulesDir, file), "utf8");
    const { frontmatter, body } = parseRule(text);
    const category = file.split("-")[0];   // pipeline / event / mood / layer / effect / interpret / validate
    return {
      file,
      category,
      slug: file.replace(/\.md$/, ""),
      frontmatter,
      body,
    };
  });
}

/**
 * Group rules by category, preserving raphael's section order.
 */
export const CATEGORY_ORDER = [
  "pipeline",
  "event",
  "mood",
  "layer",
  "effect",
  "interpret",
  "validate",
];

export function groupByCategory(rules) {
  const buckets = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, []]));
  for (const r of rules) {
    if (!buckets[r.category]) buckets[r.category] = [];
    buckets[r.category].push(r);
  }
  return buckets;
}

/**
 * Lightweight ACS sanity check on an example block.
 *
 * The skill ships with a stripped-down validator; the full parser lives
 * in `acs-audio/parse`. We verify only the rough shape: matching braces,
 * presence of `@sound <name> { ... }`, no unclosed quotes.
 */
export function quickValidateAcsExample(src) {
  // Strip comments before structural checks so a /* @sound … */ snippet doesn't
  // trip the at-rule shape check (this is a doc validator, not a parser).
  const cleaned = src.replace(/\/\*[\s\S]*?\*\//g, "");

  const errors = [];
  let depth = 0;
  let inString = false;
  let stringChar = null;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (ch === stringChar && cleaned[i - 1] !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth < 0) {
        errors.push("unmatched closing brace");
        break;
      }
    }
  }
  if (depth !== 0) errors.push(`${depth} unclosed brace(s)`);
  if (inString) errors.push("unclosed string literal");

  if (cleaned.includes("@sound") && !/@sound\s+[\w-]+\s*\{/.test(cleaned)) {
    errors.push("@sound at-rule missing name or body");
  }

  return errors;
}
