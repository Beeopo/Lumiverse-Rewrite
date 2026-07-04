# Changelog

All notable changes to this extension are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [1.0.2] — 2026-07-04

Comb-driven correctness + isolation pass — 35 verified findings, 5 batches.

### Fixed
- **Splice guard bypass.** The stale-capture check used `sel.includes(rawSpan) || rawSpan.includes(sel)`, which admitted mid-word substring matches — selecting three words that overlapped two remaining words in an edited message could silently apply the rewrite to only the two. Now requires equality after normalization.
- **Surrogate-pair splice boundaries** are rejected so an emoji or CJK codepoint can't be split into orphan half-surrogates.
- **Single-char bold/italic tokens** ('I', 'a', a name initial) no longer bail the splicer via island-demotion pathology.
- **`apply_multi` history loss.** A mid-loop `updateMessage` throw used to leave the successfully-applied writes un-undoable. History is now saved before reporting.
- **Watch-mode wrong-target apply.** A stray selection between Run and result-arrival could swap the capture — auto-apply then landed on the wrong message. `onSelectionChange` and `Alt+R` are now gated on `running` too.
- **Failed apply left the panel stuck.** `apply_error` now clears `resultPending`, `multiCapture`, and `outputEl.readOnly`, mirroring the success paths.
- **Multi-apply skipped the frontend stale-check** the single path enforces; every segment now gets `liveRenderedFor` verified before dispatch.
- **`update_config` silently dropped disk writes.** Persist failures now surface via `persisted: false` and show a "settings not saved" status.
- **`reset_config` and mid-multi-batch cancels** now report partial state instead of failing silently.
- **Focus theft** on the Hide-built-ins toggles — the config echo only rebuilds the checkboxes when profile sets actually changed.

### Changed
- **Per-user isolation** on shared multi-user Lumiverse hosts: `cancel` only aborts the caller's in-flight rewrites; undo/redo only pop entries the caller owns; `get_debug` filters the ring buffer to the caller's entries.
- **Cancellability** extends to `refine_prompt`, `architect_style`, and `gen_autoprofile` (they used to run to completion regardless of Cancel).
- **`undo` / `redo` gate on `chat_mutation`** with the same friendly error the apply paths use.
- **AI-action buttons (Refine / AI generate style / Style this chat)** now have watchdogs so a dropped backend reply can't leave them disabled forever.
- **Diff view** now refreshes when the input textarea is edited (was only listening to output edits).
- **CJK word-count fallback** only trips when a no-space script is actually detected, so long-average-word English prose no longer produces nonsense counts.
- **Export/import parity** — `historyDepth` and `showDiff` now round-trip.
- **`sanitizeImport`** rejects empty-string profile entries a crafted file could inject.

### Removed
- Redundant `outputEl.readOnly = true` in `rewrite_multi_result`, pre-`get_history` `redoBtn.disabled` flash, throwaway setup renders, and `?? default` fallbacks on non-optional config fields.

## [1.0.1] — 2026-06-26

### Fixed
- "Couldn't locate the selection" on multi-paragraph rewrites: the selection-end offset was
  computed from `Selection.toString()` (which inserts paragraph newlines) in `Range.toString()`
  coordinates, so it overshot `R.length` on messages with paragraph breaks and the splice was
  rejected. The end is now probed with a `Range`, in consistent coordinates.
- Watch mode could swap the apply target out from under a finished-but-unapplied result; the
  capture is now frozen while a result is shown, so a stray selection can't hijack it.

### Changed
- Type now scales with the host text-size setting and transitions use the host motion tokens,
  matching the native Lumiverse panels.
- Denser style chips — two columns at every panel width, compact height.

### Added
- Empty state for the saved-styles list, and a "Rewriting…" status while a rewrite is in flight.

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

[1.0.2]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.0.2
[1.0.1]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.0.1
[1.0.0]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.0.0
