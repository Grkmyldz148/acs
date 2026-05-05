---
title: Inventory the project
impact: CRITICAL
impactDescription: You cannot design a project-specific soundscape without first knowing what the project IS. Skipping this step is how generic SaaS-tap output happens.
tags: pipeline, discovery, reading
---

## Inventory the project

The first thing you do is read. Open these files in this order with
the `Read` tool. Take notes — you will reference them in every
downstream step.

### Files to open (always)

1. **README.md** at the project root. What does this product DO?
   Who is it FOR? What's the founder's voice — terse and technical,
   warm and inviting, ironic, formal?
2. **package.json** — name, description, keywords. The keywords field
   often telegraphs the aesthetic (`terminal`, `cli`, `editorial`,
   `minimal`, `playful`).
3. **The global stylesheet.** Look in this order:
   - `app/globals.css` (Next.js)
   - `src/index.css` / `src/styles/global.css` (Vite/CRA)
   - `tailwind.config.{js,ts}` (extracts the design tokens directly)
   - `styles/tokens.css` or any file with CSS custom properties
4. **The hero/landing component.** Search for files named
   `Hero.{tsx,jsx,vue,svelte}`, `Landing.tsx`, `Home.tsx`, or the
   root page (`app/page.tsx`, `pages/index.tsx`, `index.html`).
   Read the actual COPY in the hero — the tagline tells you the
   tone in three words.
5. **The footer.** Often hides the brand voice (legal copy,
   "made with love in...", links to social).

### Files to open if present

- `BRAND.md`, `STYLE_GUIDE.md`, `DESIGN.md` — explicit identity docs.
- An `/about` or `/why` page — long-form voice.
- A `/manifesto` page — the rare gift of stated values.
- The favicon / OG image filename — often hints at the visual mood.

### What you produce

A short note (4–6 sentences) for your own use, covering:

- **Product**: what it is in one line.
- **Audience**: who uses it (engineers, designers, students, traders…).
- **Aesthetic** in 3–5 adjectives (e.g. _terminal, monochrome,
  type-driven, dry, programmer_).
- **Voice** of the copy in 1–2 adjectives (_terse and dry_, _warm
  and earnest_, _ironic_, _academic_).
- **Color story** in one sentence (e.g. _two-color: phosphor green
  on pure black_).
- **Motion** in one sentence (e.g. _fast cuts, no eased transitions,
  no scroll animation_).

Do **not** start writing `.acs` until this note exists. Every
later step references it.
