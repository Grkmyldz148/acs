# Section headings used by `src/build.mjs` to group rules in SKILL.md

## 4. Event base layers

_Pick exactly one based on the prompt's strongest event-class signal._

## 5. Mood overlays

_Apply each in `pipeline-apply-mood`'s declared order. Multiple may stack._

## 6. Layer shapes

_Decide single vs multi-layer in `pipeline-decide-layering`, then look up the shape._

## 7. Effect recipes

_Add these to per-element rules (not to the `@sound` itself) — they live in the cascade._

## 8. Audio interpretation

_Sub-steps for the audio-input path. Each emits a fragment; `pipeline-emit-and-render` merges them._

## 9. Validation

_Run after emit. Reject and refine if any tolerance fails._
