---
title: Archetype reference list
impact: HIGH
impactDescription: The starting points for soundscape design. Pick one or two, then DEPART.
tags: archetype, reference, identity
---

## Archetype reference list

These are starting templates, not recipes. Every entry lists
representative parameter ranges, signature events, and the
acoustic references the archetype draws from. After picking
one in `pipeline-archetype`, deviate based on your token sheet.

Read the row(s) you picked. **Do not read all of them.**

---

### `terminal-crt`

For: CLI tools, dev terminals, hacker / tinkerer aesthetic, mono type.
References: mechanical keyboard, CRT phosphor, modem handshake,
line printer, dot-matrix.

| Parameter        | Range                                                      |
|------------------|------------------------------------------------------------|
| Body fundamentals| 80–250 Hz (typewriter thunk) or 800–1400 Hz (key click)     |
| Click attacks    | 0.5–1.5 ms                                                  |
| Click decays     | 20–50 ms                                                    |
| Body decays      | 60–120 ms                                                   |
| Filters          | Highpass on click noise (cutoff 2–4 kHz)                    |
| Saturation       | Slight tape-style on bodies; none on clicks                  |
| Rooms            | `none` everywhere except possibly `small-room` for page-enter|
| Signature events | Page-enter (CRT power-on warm-up), success (ASCII bell ding) |

Departure cues: warm color palette → add a warm body to the click.
Sans (not mono) type → reduce mechanical character; soften clicks.

---

### `editorial-paper`

For: magazines, longform publications, newsroom sites, serif heroes.
References: page turn, ink on paper, library reading lamp,
turntable surface noise, quiet bookshelf.

| Parameter        | Range                                                      |
|------------------|------------------------------------------------------------|
| Body fundamentals| 200–500 Hz (paper rustle) or 600–1000 Hz (ink stamp)       |
| Click attacks    | 5–12 ms (papery, never sharp)                              |
| Click decays     | 80–180 ms                                                   |
| Body decays      | 200–400 ms                                                  |
| Filters          | Bandpass on noise (1–3 kHz, Q 0.4–0.6) for paper textures   |
| Saturation       | Subtle tape; never clean digital                            |
| Rooms            | `small-room` globally; `medium-room` on featured articles   |
| Signature events | Article-open (page turn whoosh + soft thunk), nav (paper rustle)|

Departure cues: dark mode → lower fundamentals; cooler palette
→ shift bandpass center upward.

---

### `precision-metal`

For: trading platforms, banking, payments, enterprise security.
References: vault latch, calipers, machined metal, bell-tipped
hammer on steel.

| Parameter        | Range                                                      |
|------------------|------------------------------------------------------------|
| Body fundamentals| 600–1500 Hz (metal tap) with partials at 2.4× and 4.2×     |
| Click attacks    | 0.5–2 ms                                                    |
| Click decays     | 30–80 ms                                                    |
| Body decays      | 120–250 ms                                                  |
| Filters          | None or very gentle highpass; metal wants to ring           |
| Saturation       | None — clean and certain                                    |
| Rooms            | `none` on commits; `small-room` on ambient nav              |
| Signature events | Trade-confirm (single dry metal tap), denied (two-note minor descent)|

Departure cues: warmer accent color → soften top partials;
reduce ringing decay.

---

### `organic-wood`

For: art studios, design agencies, creative tools, woodworking
brands, slow craft.
References: wooden block, brushed canvas, soft mallet, hand-thrown
ceramic.

| Parameter        | Range                                                      |
|------------------|------------------------------------------------------------|
| Body fundamentals| 250–700 Hz with woody partials at 1.6×, 2.4×, 3.2×          |
| Click attacks    | 3–8 ms                                                      |
| Click decays     | 50–120 ms                                                   |
| Body decays      | 200–500 ms (`pluck:` primitive shines here)                  |
| Filters          | Lowpass at 3–5 kHz to remove digital sheen                   |
| Saturation       | Light, organic                                               |
| Rooms            | `small-room` globally; `medium-room` for showcase sections   |
| Signature events | Page-enter (soft mallet on wooden block), gallery-reveal (brush stroke)|

Departure cues: monochrome / cold palette → reduce woody ratios;
keep cleaner partials.

---

### `brutalist-raw`

For: anti-design, manifestos, raw web, indie art collectives.
References: distorted radio, blown speaker cone, tape hiss,
analog overload.

| Parameter        | Range                                                      |
|------------------|------------------------------------------------------------|
| Body fundamentals| 100–400 Hz with intentional clipping                        |
| Click attacks    | 0.3–1 ms (no smoothing)                                     |
| Click decays     | 40–120 ms                                                   |
| Body decays      | 150–400 ms                                                  |
| Filters          | Bitcrush layer; lowpass on body for muddy character         |
| Saturation       | Heavy — intentional grit                                     |
| Rooms            | `none` (rooms imply care; brutalism rejects)                 |
| Signature events | Click (raw mid-frequency thump), nav (lo-fi tick with dropouts)|

Departure cues: this archetype rarely wants departure — the
inventory note is the project's identity statement already.

---

### `crystalline-luxury`

For: high-end goods, watchmakers, hotels, fashion houses, perfume.
References: cut crystal, fine bell, brushed silk, slow gong.

| Parameter        | Range                                                      |
|------------------|------------------------------------------------------------|
| Body fundamentals| 800–2000 Hz with bell partials (1, 2.76, 5.4)              |
| Click attacks    | 2–5 ms                                                      |
| Click decays     | 60–150 ms                                                   |
| Body decays      | 400–1200 ms (long, deliberate)                              |
| Filters          | None — purity is the signature                              |
| Saturation       | None                                                         |
| Rooms            | `medium-room` globally; `large-room` on signature events     |
| Signature events | Page-enter (soft bell + airy whoosh), purchase (crystal chord) |

Departure cues: tighter copy / smaller motion → shorten body
decays toward 400 ms.

---

### `arcade-warm`

For: indie games, playful products, learning tools for kids,
hobbyist communities.
References: 80s arcade chip, FM games console, plastic toy buttons.

| Parameter        | Range                                                      |
|------------------|------------------------------------------------------------|
| Body fundamentals| 400–1200 Hz, often with FM modulation                       |
| Click attacks    | 1–4 ms                                                      |
| Click decays     | 40–100 ms                                                   |
| Body decays      | 150–350 ms                                                  |
| Filters          | Bitcrush for chip character; bandpass for arcade-gritty     |
| Saturation       | Medium — chip-style                                          |
| Rooms            | `small-room` globally                                       |
| Signature events | Success (ascending chord, +5st), level-up (arpeggio)         |

Departure cues: muted palette → reduce chip character; lean toward
softer FM bell.

---

### `clinical-quiet`

For: medical, scientific instruments, legal, government.
References: lab equipment, soft plastic enter-key, minimal beep.

| Parameter        | Range                                                      |
|------------------|------------------------------------------------------------|
| Body fundamentals| 600–1000 Hz, very pure                                      |
| Click attacks    | 1–3 ms                                                      |
| Click decays     | 25–60 ms                                                    |
| Body decays      | 80–200 ms                                                   |
| Filters          | Lowpass at 5 kHz to keep things calm                        |
| Saturation       | None                                                         |
| Rooms            | `none` everywhere                                           |
| Signature events | Submit-form (single brief beep), error (two-note descent)    |

Departure cues: rare — clinical projects rarely want personality.

---

### Blends

Common useful blends:
- `terminal-crt` + `precision-metal` → modern dev-tool that's also enterprise
- `editorial-paper` + `crystalline-luxury` → high-end magazine / watchmaker journal
- `organic-wood` + `arcade-warm` → playful but grounded creative tool
- `brutalist-raw` + `terminal-crt` → manifesto written in a terminal

When blending, take 1–2 traits from each, never half from each.
The dominant archetype's room and decay character wins; the
secondary archetype provides a signature event or a single
mood overlay.
