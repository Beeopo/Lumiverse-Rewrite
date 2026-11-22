# Changelog

All notable changes to this extension are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [1.4.0] — 2026-11-22

A redesigned panel: one text card, a compact style grid, and streamed results.

### Added
- **Streaming.** Rewrites appear word by word as the model writes them (`spindle.generate.quietStream`), with a live word count.
- **Multi-style runs.** **Multi** picks several styles; chips show the pick order. **In order** runs one pass per style, each on the last pass's output. **Merged** combines the styles into one instruction with a short helper call, then runs once. Works for multi-message selections too.
- **Style grid controls.** Three rows show by default with **Show all**. **Edit** reorders styles by dragging and hides any style (built-in, your own, or the chat style) with the eye. Order and hidden styles are saved.
- **Progress on the Run button.** While a run is going, the Cancel button fills from left to right: one step per pass (and per message for multi-message selections), plus the merge call in Merged mode, and it fills within a pass as text streams in.
- **Details** under the text card lists every context source with its switch and token cost; a switched-off source shows what it would add. Length moved here too.

### Fixed
- **Point of view holds.** A first- or second-person passage now gets an explicit note to stay that way; small models were turning "I walked" into "He strolled", especially on your own messages.
- **Changes works on large selections.** Long texts are aligned sentence by sentence, then diffed word by word, instead of falling back to plain text past ~500 words.
- **Run updated.** After a run, the button reads Run again until you change the style, picks, context, length, connection or text; then it reads Run updated.

### Changed
- **One text card** switches between **Original**, **Rewrite** and **Changes**, and fills the panel down to the Run button.
- **One main button:** Run, Cancel while running, then Apply once a result for a captured selection is ready (Run again sits beside it).
- **Connection** moved to Options; the Rewrite tab shows it as a badge that opens Options.
- **Styles tab** replaces Architect: your styles, creating one, writing one with AI, and hiding built-ins.
- **Options** are collapsible groups with one-line summaries. "Show diff" became "Open on Changes", which picks the view a finished run opens on.

## [1.3.0] — 2026-11-22

Hardening for multi-user hosts, checked against Lumiverse 1.3.0.

### Fixed
- **Replies only reach the requesting user.** Every backend message now names its target
  user. On an operator-scoped install, untargeted sends went to every connected user,
  including config, debug entries and rewrite results.
- **Stale results are dropped.** Each run carries a request id. A late reply from a run the
  watchdog gave up on, or a reply meant for another open tab, no longer lands on the panel
  or triggers auto-apply.
- **Undo history can't lose entries.** Apply, multi-apply, undo, redo and reset now run one
  at a time per user instead of racing on the same history file.
- **Auto-profile no longer overwrites settings.** It re-reads config after its generation
  instead of saving the copy it read before the call.
- **Config is validated on the backend.** Stored and incoming settings go through the same
  checks as settings import; wrong-typed values are dropped instead of persisted.
- **Malformed apply offsets are rejected.** Non-integer or NaN span offsets now fail the
  bounds check instead of slipping past it.

### Changed
- **Settings and undo history are per user** (`spindle.userStorage`). Existing users keep
  their settings: with no per-user file yet, the old shared file is read.
- **Manifest:** dropped the unused `chats` and `ui_panels` permissions (drawer tabs and the
  active-chat lookup are free). `minimum_lumiverse_version` is now 1.1.0, what the
  extension was built against.
- Typecheck now uses `lumiverse-spindle-types` 0.6.81 as a dev dependency.

## [1.2.0] — 2026-08-05

### Added
- **Configurable request timeout** — `Options → Behaviour → Timeout (s)` sets how long a
  model call may run before it is aborted (10–600s, default 120s, was hard-coded). The
  frontend watchdog follows it automatically, and the value is included in settings
  export/import.

### Fixed
- **Timeouts no longer masquerade as cancels** — a timed-out generation reported the same
  "Cancelled." as pressing Cancel, since both surface as an `AbortError`. It now reads
  "Timed out after Ns — raise Timeout in Options." across rewrite, multi-rewrite, refine,
  architect, and auto-profile.

## [1.1.0] — 2026-07-12

Formatting-preserving rewrites, and user-configurable generation parameters.

### Added
- **Generation sampler controls** — a new **Sampling** group in the Options tab exposes
  temperature, top-P, top-K, max tokens, and frequency/presence penalties. Any field left blank
  inherits from the selected connection's preset; the temperature/top-P defaults (0.7 / 0.9)
  reproduce the previously hard-coded values, so existing users see no change until they touch
  them. A **"Use these for AI helper calls too"** toggle extends the same values to the Refine /
  AI-generate-style / per-chat-voice calls (off by default — those keep their task-tuned
  temperatures otherwise). All values persist and round-trip through export/import.

### Fixed
- **Rewrites stripped `<font>` tags and markdown.** The model was fed the *rendered*
  (formatting-free) selection and told to emit no markdown, and its plain output then overwrote
  the raw span that held the markup — so whole-message and font-wrapped rewrites lost all
  formatting. The rewrite now feeds the model the **raw markdown slice** of the selection (located
  through the same render→raw alignment the splice uses), the prompt instructs preserving HTML
  tags and markdown exactly (and never inventing a balancing tag/mark for a fragment), and output
  quote-stripping is skipped when the input was itself quote-wrapped. Inline markup outside the
  selected span was already safe; this closes the in-span and whole-message cases.
- **Length target inflated by markup.** The target word count is now measured from the rendered
  selection, so tags and markdown carried in the raw slice no longer skew it.

## [1.0.3] — 2026-07-05

Post-1.0.2 polish — fixes surfaced from real-world use.

### Fixed
- **Full-message rewrites failed on very large messages.** A full-content selection has nothing to bracket outside `[0, n)`, so the windowed anchor path always returned null. The LCS isn't needed here — the whole rendered content maps to the whole raw content by definition. Shortcut added; oversized full-message rewrites now splice in under a millisecond regardless of length.
- **"Couldn't locate the selection" on multi-paragraph messages.** The `alignExact` cell cap was 4M (~2000×2000 chars), which realistic 10-paragraph messages tripped. Cap bumped to 16M (~4000×4000, ~64MB dp allocation — modern browsers handle it fine). For anything above 16M, the windowed anchor retry loop now keeps the first-found anchor per side and only overwrites empty slots — a message uniquely anchoring left at LEN=60 but right at LEN=40 no longer falls to null.
- **"Couldn't locate" on markdown-link and HTML-tag spans.** The stale-capture guard required strict equality after normalization, which broke any selection whose raw form carried URL letters or attribute values. Now uses a subsequence check — sel's characters must appear in order in rawSpan — which still rejects the mid-word substring-bypass class while accepting real markdown content.
- **Rewrite output flashing then disappearing.** Single-capture `doCapture` wasn't idempotent — any stray `selectionchange` producing the same Capture cleared `outputEl` and wiped the just-rendered result. Now short-circuits identical captures, mirroring the multi-capture sig check.
- **Watch mode not picking up new selections after a rewrite.** The `resultPending` freeze in `onSelectionChange` was too aggressive — reselecting after a result is the user moving on. Now only freezes while a rewrite is actually in flight.
- **Hide-built-ins checkbox stealing focus mid-toggle.** The sig-cache only skipped renders on unrelated config echoes; profile mutations now pre-sync the sig cache so the incoming echo matches and the re-render is skipped entirely.

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

[1.1.0]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.1.0
[1.0.3]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.0.3
[1.0.2]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.0.2
[1.0.1]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.0.1
[1.0.0]: https://github.com/Beeopo/Lumiverse-Rewrite/releases/tag/v1.0.0
