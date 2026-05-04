---
title: Detect input mode and route the request
impact: CRITICAL
impactDescription: First branch — wrong choice means running the wrong rules.
tags: pipeline, routing
prompt: ""
example: |
  /* Decision artifact, not an @sound:
   *   { input: "prompt+audio", plan: "interpret-* on out/click.wav, refine warm" }
   */
---

## Detect input mode and route the request

Before any rule fires, look at the user's message:

| Input                                    | Path                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| Prompt only                              | Skip `interpret-*`. Go to `pipeline-pick-base-layer`.                       |
| Audio only                               | Run all `interpret-*` rules. Skip `event-*` / `mood-*`.                     |
| Prompt + audio                           | Run `interpret-*` first; treat prompt adjectives as refinement.             |

Detect audio by file-extension match (`.wav`, `.mp3`, `.flac`, `.ogg`) or
by the user explicitly referencing a sample (`"like the sound at /tmp/x.wav"`).

If neither audio nor a prompt is present, ask one clarifying question — don't guess.
