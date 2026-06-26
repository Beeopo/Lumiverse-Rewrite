# Rewrite

A [Lumiverse](https://github.com/lumiverse) Spindle extension that rewrites selected message
text **in place** with an LLM style profile. Highlight a passage, pick a style, hit Run — the
rewrite is spliced back into the exact span you selected, leaving the rest of the message
untouched.

It runs entirely against your own configured connections, so you can write the main chat with
one model and rewrite prose with another (e.g. a fast local model for quick edits).

## Features

**Styles**
- Built-in style profiles (expand, compress, add inner thoughts, show-don't-tell, more emotion, …).
- **Architect** tab for authoring your own styles: write a prompt, AI-refine it, or generate a
  whole style from a one-line description. Edit, delete, and hide built-ins.
- **Style this chat** — generate a per-chat "voice" profile from the character card.
- One-off custom instructions for throwaway rewrites, with a recent-prompts history.

**Capture & apply**
- **Watch mode** auto-captures whatever you highlight in a message; `Alt+R` captures on demand.
- Corruption-safe in-place splice (render→raw LCS alignment with an authoritative guard) so the
  rewrite lands exactly where you selected and nowhere else.
- **Multi-message** rewrite: select across several bubbles and rewrite each in one pass.
- Word-level **diff preview**, live word-count delta, and editable output before applying.
- Multi-level **undo/redo** with a configurable history depth; optional auto-apply.

**Context**
Each source is individually toggleable and degrades gracefully (skipped, never errors) if a
permission isn't granted: previous messages, character card, user persona, speaker-awareness,
memory/cortex, and world-book/lore.

**Cost & control**
- **Live token-cost estimation** with a per-source breakdown before you spend a request.
- Length control expressed as a target word-count range; CJK-aware word counting.
- Per-rewrite **connection picker** — rewrite with a different model than the active chat.
- Concise-prompt mode, automatic quote-stripping, cancel in-flight generations.
- Settings export/import, reset to defaults, and a debug-log export.

**Interface**
Three tabs — **Rewrite / Architect / Options** — built as accessible, native-feeling Lumiverse
UI: ARIA tablist with arrow-key navigation, visible focus rings, `aria-live` status, a
collapsible style chip-grid, and `prefers-reduced-motion` support.

## Install

This extension ships pre-built bundles in `dist/`. To use it in Lumiverse:

- **From the app:** install it through Lumiverse's extension manager using this repository's URL, **or**
- **Manually:** copy this folder into your Lumiverse extensions directory and restart the backend.

Requires Lumiverse `0.1.0` or newer. The extension requests these permissions (declared in
`spindle.json`): `generation`, `chats`, `chat_mutation`, `ui_panels`, `characters`, `personas`,
`memories`, `world_books`. Context sources you don't grant are simply skipped.

## Build from source

Requires [Bun](https://bun.sh).

```sh
bun install
bun run build      # → dist/backend.js, dist/frontend.js (minified)
bun run typecheck  # tsc --noEmit
bun test           # unit tests for alignment, multi-seg, profiles, quotes, etc.
```

`dist/` is committed so the extension is installable without a build step; rebuild after changing
anything under `src/`.

## Credits

The original browser extension lives at
[Beeopo/Marinara-Rewrite](https://github.com/Beeopo/Marinara-Rewrite) (the Marinara Engine
"Rewrite-Assistant"). This is a from-scratch rebuild of it as a native Lumiverse Spindle
extension — backend worker + in-host frontend panel.
