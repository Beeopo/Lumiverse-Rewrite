# Changelog

All notable changes to this extension are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-06-26

Initial release. A native Lumiverse Spindle port of the Marinara Engine "Rewrite-Assistant"
browser extension, with full feature parity plus a redesigned, accessible panel.

### Added

**Rewriting**
- In-place rewrite of a highlighted message span via corruption-safe render→raw LCS alignment.
- Watch mode (auto-capture on selection) and `Alt+R` on-demand capture.
- Multi-message rewrite across several bubbles in one pass.
- Editable output, word-level diff preview, and live word-count delta before applying.
- Multi-level undo/redo with configurable history depth; optional auto-apply.
- Cancel in-flight generations.

**Styles**
- Built-in style profiles, plus user-authored custom styles (create / edit / delete / hide).
- Architect tools: AI-refine a prompt, or generate a full style from a description.
- Per-chat "voice" auto-profiles generated from the character card.
- One-off custom instructions with a recent-prompts history.

**Context**
- Toggleable, gracefully-degrading context injection: previous messages, character card,
  user persona, speaker-awareness, memory/cortex, and world-book/lore.

**Cost & control**
- Live token-cost estimation with a per-source breakdown.
- Length control as a target word-count range; CJK-aware word counting.
- Per-rewrite connection picker (rewrite with a different model than the active chat).
- Concise-prompt mode, automatic quote-stripping.
- Settings export / import, reset to defaults, and debug-log export.

**Interface**
- Three-tab panel (Rewrite / Architect / Options) with a collapsible style chip-grid.
- Accessibility: ARIA tablist with arrow-key navigation, visible focus rings, `aria-live`
  status regions, container-query responsive layout, and `prefers-reduced-motion` support.
- Single-source design tokens keyed off the host theme; minified backend and frontend bundles.

[1.0.0]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.0.0
