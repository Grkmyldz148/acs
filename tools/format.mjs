#!/usr/bin/env node
/* format.mjs — pretty-printer for .acs files.
 *
 * Usage:
 *   node tools/format.mjs file.acs              # print formatted to stdout
 *   node tools/format.mjs file.acs --write      # overwrite in place
 *   node tools/format.mjs poc/*.acs --write     # batch
 *
 * Rules:
 *   - 2-space indentation
 *   - one declaration per line
 *   - empty line between top-level rules
 *   - preserves /* ... *\/ comment blocks
 *   - @media / @sound bodies handled recursively (nested blocks supported)
 *
 * Logic mirrored in tools/vscode-acs/extension.js — keep in sync.
 */

import { readFileSync, writeFileSync } from "node:fs";

function splitDecls(body) {
  const out = [];
  let pdepth = 0;
  let bdepth = 0;
  let buf = "";
  for (const c of body) {
    if (c === "(") { pdepth++; buf += c; continue; }
    if (c === ")") { pdepth--; buf += c; continue; }
    if (c === "{") { bdepth++; buf += c; continue; }
    if (c === "}") { bdepth--; buf += c; continue; }
    if (c === ";" && pdepth === 0 && bdepth === 0) {
      const t = buf.trim();
      if (t) out.push(t);
      buf = "";
      continue;
    }
    buf += c;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

function matchBrace(src, open) {
  let depth = 1;
  let j = open + 1;
  const len = src.length;
  while (j < len && depth > 0) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") depth--;
    if (depth > 0) j++;
  }
  return j;
}

function bodyHasNestedBlock(body) {
  let pdepth = 0;
  let bdepth = 0;
  for (const c of body) {
    if (c === "(") pdepth++;
    else if (c === ")") pdepth--;
    else if (c === "{" && pdepth === 0 && bdepth === 0) return true;
    else if (c === "{") bdepth++;
    else if (c === "}") bdepth--;
  }
  return false;
}

function formatBlock(src, indent = "") {
  let out = "";
  let i = 0;
  const len = src.length;
  const atTop = indent === "";

  while (i < len) {
    while (i < len && /\s/.test(src[i])) i++;
    if (i >= len) break;

    if (src.slice(i, i + 2) === "/*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) { out += indent + src.slice(i).trim() + "\n"; break; }
      const block = src.slice(i, end + 2);
      out += block
        .split("\n")
        .map((l, idx) => (idx === 0 ? indent + l.trim() : indent + " " + l.trim()))
        .join("\n") + "\n";
      i = end + 2;
      while (i < len && /\s/.test(src[i])) {
        if (src[i] === "\n") { i++; break; }
        i++;
      }
      continue;
    }

    let k = i;
    let pdepth = 0;
    let nextSemi = -1;
    let nextBrace = -1;
    while (k < len) {
      const c = src[k];
      if (c === "(") pdepth++;
      else if (c === ")") pdepth--;
      else if (pdepth === 0) {
        if (c === ";") { nextSemi = k; break; }
        if (c === "{") { nextBrace = k; break; }
        if (c === "}") break;
      }
      k++;
    }

    if (nextSemi !== -1 && (nextBrace === -1 || nextSemi < nextBrace)) {
      const decl = src.slice(i, nextSemi).trim();
      if (decl) out += `${indent}${decl};\n`;
      i = nextSemi + 1;
      continue;
    }

    if (nextBrace === -1) {
      const rest = src.slice(i).trim();
      if (rest) out += indent + rest + "\n";
      break;
    }

    const selector = src.slice(i, nextBrace).trim();
    const close = matchBrace(src, nextBrace);
    const body = src.slice(nextBrace + 1, close);

    if (bodyHasNestedBlock(body)) {
      out += `${indent}${selector} {\n`;
      out += formatBlock(body, indent + "  ");
      out += `${indent}}\n`;
      out += atTop ? "\n" : "";
    } else {
      const decls = splitDecls(body);
      out += `${indent}${selector} {\n`;
      for (const d of decls) out += `${indent}  ${d};\n`;
      out += `${indent}}\n`;
      out += atTop ? "\n" : "";
    }

    i = close + 1;
  }

  return out;
}

export function format(src) {
  return formatBlock(src).trim() + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const files = args.filter((a) => !a.startsWith("--"));
  if (!files.length) {
    console.error("Usage: node tools/format.mjs <file.acs>... [--write]");
    process.exit(1);
  }
  let changed = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const formatted = format(src);
    if (write) {
      if (formatted !== src) {
        writeFileSync(f, formatted);
        console.log(`formatted ${f}`);
        changed++;
      }
    } else {
      process.stdout.write(formatted);
    }
  }
  if (write) console.log(`\n${changed} file(s) changed.`);
}
