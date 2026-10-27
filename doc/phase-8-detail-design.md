# AliceType - Phase 8 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 8: Remaining Practice Modes - Quote, Custom, Zen |
| Status | Implemented and verified in automated unit/Chromium tests; manual screen-reader verification pending (see implementation plan) |
| Source design | [Technical Design Document](./tech-design.md), section 5.1 |
| Preceding phase | [Phase 7 Detail Design](./phase-7-detail-design.md) |
| Implementation plan | [Phase 8 Technical Implementation Plan](./phase-8-implementation-plan.md) |
| Existing practice contracts | [Phase 4 Detail Design](./phase-4-detail-design.md) and [Phase 5 Detail Design](./phase-5-detail-design.md) |

## 2. Purpose and interpretation

Make all five advertised practice modes functional without changing the established Timed/Words experience, physical keyboard mapping, or browser-only privacy model.

- **Quote** presents a random, locally bundled literary quotation for target-copying practice.
- **Custom** lets the user paste or enter a passage in an ordinary editor, review its normalized target, and practice copying it.
- **Zen** is free writing, not an endless generated target. It has no time, word, or character completion limit, no correctness comparison, and no changing UI outside the writing area during a run. WPM is calculated when the user explicitly stops.

The product's "literary or movie quote" requirement is satisfied initially by literary quotations with reviewed redistribution rights. A movie database or copyrighted movie-dialogue collection is not required. Custom remains within the existing printable-ASCII typing contract after explicit whitespace/typography normalization; arbitrary Unicode typing, multiline key entry, and IME support are not claimed.

This phase supersedes the earlier deferral of Quote, Custom, and Zen only. Difficulty rules and other deferred product features remain outside this phase.

## 3. Scope

### 3.1 In scope

- Five working, keyboard-operable mode buttons within the existing Practice panel.
- A bundled quote catalog with stable IDs, attribution, provenance, redistribution evidence, validation, random selection, and a Next quote action.
- A Custom text editor, deterministic normalization, explicit validation errors, target preview, Apply text, Edit text, and Clear text actions.
- Finite Quote/Custom sessions using the existing correction, attempt-based accuracy, visual feedback, sound preference, and completion behavior.
- A targetless Zen engine path, bounded DOM rendering of long writing, manual Stop, and honest final metrics.
- Mode-specific settings, progress, instructions, completion messages, and restart semantics.
- Preferences schema v5, preserving all supported existing migrations and settings.
- Backward-compatible session-history records and Stats presentation for all modes.
- Focus, input, audio, local-data privacy, error recovery, and regression coverage across all affected surfaces.

### 3.2 Out of scope

- Expert/Master difficulty, new failure rules, automatic pausing, leaderboards, accounts, telemetry, synchronization, or remote quote requests.
- Quote search, author/length filters, favorites, imports, custom passage libraries, file uploads, or text export.
- Persisting quote text, custom drafts/targets, Zen writing, raw keystrokes, or a recoverable unfinished session.
- Unicode grapheme editing, translated word banks, IME/composition typing, Enter/Tab as target characters, or paste into the practice capture control.
- New frameworks, dependencies, storage services, keyboard permissions, firmware access, or changes to keyboard-test behavior.

## 4. Technical decisions

| Concern | Phase 8 contract |
| --- | --- |
| Stack | Keep Svelte 5, TypeScript, Vite, existing styles, Vitest, and Playwright. |
| Mode ownership | Extend the existing shared `PracticeMode` union to `timed`, `words`, `quote`, `custom`, and `zen`; use exhaustive branches instead of treating every non-timed mode as Words. |
| Configuration | Use mode-discriminated session configurations. Only Timed/Words carry generator settings; Quote carries `quoteId`; Custom/Zen carry only their mode. |
| Content ownership | Keep quote/custom target snapshots and Zen writing in transient session state, never preferences or history. |
| Text model | Preserve one printable ASCII character per accepted action. Normalize source text before creating a finite target; never normalize individual practice keystrokes. |
| Quote delivery | Bundle reviewed catalog data with the app; do not fetch quotations at runtime. |
| Custom start | Applying valid text creates a ready session; typing the first accepted character starts its clock. |
| Zen timing | First accepted printable character starts the clock; explicit Stop ends it. No deadline, refill, progress bar, or live metric calculation. |
| Zen accuracy | Not applicable: there is no target. Display "Not applicable - free writing", never an invented 100% accuracy. |
| History | Add a discriminated record format and read legacy Timed/Words records without rewriting the database. Keep IndexedDB database version 1 and the existing store/index. |
| Preferences | Write schema v5; read/migrate v1-v4 while preserving all valid fields. Persist mode only among the new mode-specific choices. |
| Privacy | No content persistence, logging, URL encoding, external analytics, or content in error messages. |

## 5. Shared practice and session models

### 5.1 Settings and configuration

Extend `PracticeSettings.mode` and keep its existing duration, word limit, vocabulary, punctuation, and numbers fields unchanged. Those fields remain the inactive Timed/Words choices when another mode is selected. Defaults stay Timed, 30 seconds, 25 words, vocabulary 200, modifiers off.

Refactor the current configuration union so generator-only properties do not leak into unrelated modes:

```ts
type SessionConfiguration =
  | (GeneratorSettings & { readonly mode: 'timed'; readonly durationSeconds: Duration })
  | (GeneratorSettings & { readonly mode: 'words'; readonly wordLimit: WordLimit })
  | { readonly mode: 'quote'; readonly quoteId: string }
  | { readonly mode: 'custom' }
  | { readonly mode: 'zen' };
```

`Duration` and `WordLimit` refer to the existing literal unions derived from the exported option arrays. `GeneratorSettings` retains the existing vocabulary and modifier fields. Keep these shared types in the existing typing modules unless a small shared type module is necessary to avoid a circular import.

- `generateExercise` accepts only the Timed/Words configuration subset. Its output, randomization, and base-word metadata remain unchanged.
- Narrow or replace `getConfiguration` so it cannot silently turn Quote/Custom/Zen settings into a Words configuration. Quote preparation requires a selected catalog entry; Custom preparation requires an applied valid target; Zen requires neither.
- Validate unknown runtime mode/configuration values explicitly. Use existing domain-error patterns for recoverable preparation failures; propagate unexpected programming errors.
- Session configuration is an immutable snapshot. Preference changes, draft editing, and asynchronous keyboard-layout resolution cannot mutate a running session.

### 5.2 Session shape and invariants

Keep the `ready -> running -> completed` lifecycle. Discriminate target-copying sessions from Zen sessions by configuration mode:

- Timed/Words preserve `target`, `input`, total/correct attempts, optional legacy configuration support, and generated `wordEnds`.
- Quote/Custom require a nonempty printable-ASCII target and configuration. They do not require generated base-word boundaries.
- Zen has writing content and total printable attempts, but no target, correct-attempt count, word boundaries, or missed-key scoring. Model these differences in types, not dummy empty targets or synthetic correct counts.
- Preserve the existing configuration-less finite-session API used by typing-engine tests, or update those callers deliberately without changing its finite-copying semantics.
- The first printable action, including a space or an incorrect target character, starts a ready session. Backspace on empty input does not start it.
- Repeat, composition, unsupported characters, and Ctrl/Alt/Meta shortcuts remain ignored. Shift-derived printable characters remain supported.
- Backspace removes the final retained character and never decrements historical attempt counters. Finite target errors corrected later still affect accuracy.
- Completed sessions ignore subsequent input. Completion delivery is idempotent and produces at most one logical history record per run.

### 5.3 Engine operations

Keep input translation pure and shared. Extend session creation/action/metric helpers with explicit mode branches and add a pure `stopSession(session, now)` operation for Zen.

| Operation | Timed | Words | Quote / Custom | Zen |
| --- | --- | --- | --- | --- |
| Create | Existing generated target | Existing generated target | Validated finite target | Empty free-writing session |
| Character | Compare with target | Compare with target | Compare with target | Append writing without comparison |
| Backspace | Existing behavior | Existing behavior | Existing behavior | Remove final writing character |
| Expire | Exact configured deadline | No-op | No-op | No-op |
| Extend target | Existing refill | Rejected | Rejected | Rejected |
| Automatic completion | Deadline only | Final target position | Final target position | Never |
| Stop | Not offered | Not offered | Not offered | Complete running session at `now` |
| Progress | Elapsed seconds | Completed base words | Consumed target characters | Not applicable |

`stopSession` is idempotent for a completed Zen session and leaves a ready Zen session unchanged. Calling it for a non-Zen session is a domain error. A running Zen session can be stopped after deleting all its writing; it still has attempts and a valid zero-WPM result.

Refactor `getProgress` to return a discriminated progress result or `null` for Zen, not a fictional maximum. Quote/Custom character progress is `input.length / target.length`, counts consumed positions even if incorrect, and can decrease on Backspace. Completion occurs on the final position, even with errors, exactly as Words does today.

### 5.4 Metrics and time

- Finite modes retain current WPM: currently correct characters divided by five, divided by elapsed minutes; round as today. Accuracy remains correct printable attempts divided by all printable attempts, rounded to one decimal.
- Zen WPM is retained printable characters divided by five, divided by elapsed minutes. Spaces count as characters. Deletions reduce retained character count, not total attempts. Label the result **Free-writing WPM**, with an explanation that it is not target-verified.
- Zen accuracy and correct attempts are not applicable. Do not feed Zen into target-accuracy or most-missed-key calculations.
- Zero elapsed time yields WPM 0, not Infinity/NaN. Zero retained Zen characters also yields 0.
- Use `performance.now()` for elapsed time and the existing wall-clock start anchor for `completedAt`. Focus loss and background time do not pause any running session.
- Run the existing 100 ms expiry/update interval only where necessary for Timed/Words/Quote/Custom UI. Zen must not install a practice metric interval or call its WPM calculation until Stop. Counters and timestamps can update internally on accepted input.

## 6. Quote mode

### 6.1 Bundled catalog and rights

Add a readonly catalog under `src/lib/typing/`, separate from random-word generation. Each entry contains:

| Field | Contract |
| --- | --- |
| `id` | Stable, unique catalog ID, independent of array position. |
| `text` | Reviewed, nonempty printable-ASCII practice target, 40-1,000 characters, no leading/trailing whitespace or repeated spaces. |
| `author` | Correct author attribution, not an inferred speaker. |
| `workTitle` | Identifiable literary work containing the passage. |
| `sourceUrl` | Reviewable source for the specific passage/edition. |
| `rights` | Rights basis and redistribution jurisdiction/limitations; do not assume an author's age proves a particular edition is unrestricted. |
| `reviewedAt` | Date the text, attribution, source, and rights were reviewed. |
| `adaptationNote` | Explicit typography/whitespace changes, if any; no unmarked paraphrase presented as a quotation. |

Initial implementation acceptance requires at least 12 distinct eligible passages across at least three reviewed works. The implementation must source and verify actual entries; this document does not supply or authorize an unreviewed quote collection. Use rights-cleared original-language editions, not modern translations or annotations without permission. Do not scrape a quote aggregator, fabricate attribution, or assume a short movie quote is automatically redistributable.

Provide a bundled attribution/rights notice and any required license texts, discoverable through the UI without a network request. A source link may open externally only on explicit user action; no source-page embedding, prefetching, tracking, or runtime dependency.

Validate catalog IDs, text bounds, duplicate texts, required provenance, and source URL schemes in unit tests/build-time data checks. Selection from invalid or empty data must report an explicit catalog error rather than switch to a generated exercise.

### 6.2 Selection and lifecycle

- On entering Quote, choose an entry uniformly using an injectable random source with the existing finite `[0, 1)` validation convention.
- Keep the current entry in transient state. **Restart** resets metrics/input but reuses this exact quote. **Next quote** selects uniformly from entries other than the current ID and resets to ready; it is enabled only when not running.
- Catalog validation requires multiple entries; a single-entry/empty catalog is an explicit preparation error, not a reason to loop indefinitely.
- Show author/work attribution outside the target; neither is typed or counted in metrics. Render all catalog text as escaped text.
- Quote has no duration, word-limit, vocabulary, punctuation, or numbers controls. Existing modifier preferences never alter the source passage.
- A new quote selection is not persisted. Reloading Quote chooses a new entry.

## 7. Custom mode

### 7.1 Editor and data lifecycle

Show a labeled, native textarea with a visible statement: "Paste text here to prepare an exercise. Your text stays in memory and is not saved." Normal browser editing, selection, multiline paste, and shortcuts work in this editor; it is not the practice capture input.

- Keep a raw draft separate from the applied immutable target and running input.
- **Apply text** validates/normalizes the draft and displays the exact target preview with its character count. It creates a ready exercise without starting the clock or adding typing attempts.
- Explain the ASCII restriction and normalization before Apply. If normalization changes the draft, show "Whitespace/typography normalized; review the target before typing."
- **Edit text** returns to the editor from a ready/completed exercise without losing the raw draft. It is unavailable during a run.
- **Clear text** clears both draft and applied target while idle, returning to the empty editor. It does not erase saved numeric results.
- During a run, hide the editor and lock draft-changing actions. **Restart** discards unfinished input and prepares the same applied target; it does not re-read a changed draft.
- Preserve draft/applied text while switching practice modes within the mounted Practice view. Leaving that view, reloading, or restoring defaults clears both; state is not placed in root preferences or storage. Make the loss-on-leaving behavior visible near the editor.
- Reloading with saved mode Custom opens an empty editor, never a fallback generated passage. Pending numeric session-save retries survive navigation as they do today, without retaining content.

### 7.2 Deterministic text preparation

Use one pure preparation helper, shared by validation and preview. Bound both raw draft and normalized target at **10,000 UTF-16 code units**; accepted targets are ASCII, so their code-unit and character counts coincide. Do not silently truncate input or rely only on textarea `maxlength`, which can truncate a paste without explaining it. Allow an oversized draft to be corrected and show an explicit error; disable Apply until valid.

Apply these steps in order:

1. Reject a raw draft over 10,000 code units before normalization.
2. Convert CRLF/CR/LF, tabs, ordinary spaces, and nonbreaking spaces (`U+00A0`) into ordinary spaces.
3. Map curly single quotes (`U+2018`, `U+2019`) to `'`, curly double quotes (`U+201C`, `U+201D`) to `"`, en/em dashes (`U+2013`, `U+2014`) to `-`, and ellipsis (`U+2026`) to `...`.
4. Collapse runs of ordinary spaces and trim leading/trailing spaces.
5. Reject an empty target, a target over 10,000 characters, or any remaining character outside printable ASCII (`U+0020` through `U+007E`).

Everything else, including case, ASCII punctuation, and numbers, is preserved exactly. Do not strip accents, silently delete unsupported characters, replace arbitrary symbols with `?`, render HTML, or execute pasted content. Unsupported-character errors identify a character position and Unicode code point without echoing the passage into logs/errors. Null/control/zero-width characters are rejected, not silently removed.

The normalized preview is the authoritative target. Enter and Tab are not required while copying; their source whitespace has become spaces. No one-word minimum beyond at least one valid printable character is imposed.

### 7.3 Errors and recovery

- Show actionable inline errors associated with the textarea using `aria-invalid` and `aria-describedby`; announce a failed Apply through the existing alert pattern.
- Validation failure preserves the raw draft and does not replace a previously valid target with partial/invalid data.
- While editing an invalid draft, disable starting the old exercise; the user must apply valid text or explicitly cancel editing to return to the last applied target.
- Finite completion, metrics, sounds, keyboard highlights, and target scrolling otherwise match Quote/Words behavior.

## 8. Zen mode

### 8.1 Free-writing behavior

- Entering Zen creates an empty ready writing area with static instructions and no generated text.
- Focus alone does not start time. The first accepted printable ASCII key starts the run; Backspace edits the retained writing.
- There is no target, active expected character, correctness coloring, deadline, automatic completion, generated refill, or internal word/character completion threshold.
- **Stop** is a persistent native button, disabled while ready, enabled while running, and disabled after completion. Activation with keyboard or pointer uses the same pure stop operation.
- Stop freezes writing and calculates the final Free-writing WPM once, then submits one numeric history record. Repeated activation cannot duplicate records.
- **Restart** clears writing and resets to ready without saving an unfinished run. It remains available during running so the user can abandon a run and unlock navigation. No automatic save occurs on blur, navigation attempt, restart, destruction, or reload.
- After completion, show final WPM, elapsed time, retained characters, and total attempts; show accuracy as not applicable. **Restart** begins a new empty run.

### 8.2 Distraction-free rendering

The product promise applies to the ready-to-running transition and the period before explicit Stop:

- Only writing text/caret/scroll position may change visibly in response to accepted typing.
- Hide live WPM, accuracy, elapsed time, attempt/character counters, progress, dynamic completion messages, and visualizer/key flashes. Zen overrides `showLiveStats` without changing the saved preference.
- Suppress practice typing sounds and audio initialization/character callbacks in Zen without changing `soundEnabled`. Keyboard Test sound remains independent.
- Keep static instructions and Stop/Restart controls available. Navigation/settings controls may become disabled when a run starts, but no live session-status announcements repeat per key.
- Hide the Alice visualizer for Zen, including after Stop, rather than animating or rendering false correctness feedback.
- Use a steady, nonblinking caret during a running Zen session; keep the saved caret shape. This avoids periodic visible changes unrelated to writing. Other modes keep existing caret behavior.
- Do not hide actionable storage, device-disconnection, or other operational warnings to preserve visual silence. These are exceptional errors, not practice updates.

### 8.3 Long-session behavior

No product-level text-length, word, or duration cap is introduced for Zen. This does not promise infinite browser memory.

- Retain writing in memory with append/delete semantics and render at most **2,000 trailing characters** plus a caret in the live writing surface. Do not create a span for every historical character or expose the full transcript as an ever-growing accessible label.
- Keep all retained writing logically editable: Backspace can cross the rendered window boundary, restoring earlier text into the window. Retained-character totals and final WPM cover the whole session, not just visible text.
- Avoid rebuilding/scanning the entire transcript on each key. Use chunked text storage with incremental retained-character counts and small append/delete operations; window extraction visits only the trailing chunks needed. Do not introduce a general editor framework.
- Announce once in static instructions that only the recent writing is displayed. The capture input remains labeled "Zen writing", and the visible window is available to assistive technology without per-keystroke live-region announcements.
- Release all writing/chunks on restart, mode change, or view destruction. No transcript is copied into pending save records.
- Do not catch resource exhaustion and fabricate a completed score. Any recoverable content-processing error stops capture, shows an explicit error, and permits restart; it does not auto-submit history.

## 9. UI, navigation, focus, and accessibility

### 9.1 Mode surfaces

| Mode | Setup | Progress | Completion / result label |
| --- | --- | --- | --- |
| Timed | Existing duration, vocabulary, modifiers | Elapsed seconds | Time is up |
| Words | Existing word limit, vocabulary, modifiers | Completed base words | Word limit reached |
| Quote | Attribution, Next quote | Consumed target characters | Quote complete |
| Custom | Editor/apply or applied target/edit | Consumed target characters | Custom text complete |
| Zen | Static free-writing instructions | None | Zen stopped; Free-writing WPM |

Replace the unavailable spans with the same native mode-button pattern already used for Timed/Words (`aria-pressed`, selected styling, disabled while running). Keep mode selection inside Practice; do not move it to the app header or add another app view.

Preserve the charcoal theme and `#FF5D00` accent. Wrap five mode buttons and action groups at narrow widths without horizontal page overflow. Labels, errors, attribution, and editor controls must remain usable at 320 px viewport width and at 200% zoom. Do not rely on orange/red alone to explain state or errors.

### 9.2 Input and focus

- Keep practice keydown capture scoped to the focused capture control and active view. No new document/window typing listeners.
- Paste is supported only in the Custom editor, not in Quote/Custom/Zen practice capture. Native browser shortcuts and Tab navigation remain available.
- Applying Custom text leaves focus on Apply and announces readiness; an explicit Start typing action focuses capture. Next quote/Restart similarly leave focus on their initiating button.
- Finite completion does not unexpectedly move focus. Stop retains focus on Stop (or a stable result heading if disabling the focused button would lose focus); test a consistent implementation.
- Focus loss does not stop or pause a run. Zen offers a static Resume writing action when needed, but must not change its visible label on every focus transition during a run; use a fixed **Focus writing** button for both ready and running states.
- Mode/settings/app navigation remain locked while running. Explain statically that Restart discards an unfinished run; Zen Stop saves a result and unlocks navigation.
- Avoid embedding the whole 10,000-character Custom passage in an assertive/live announcement. Preserve an accessible target description and active-input instructions without announcing each keystroke.
- Escape, Enter, and Tab receive no new global shortcuts. Textarea Enter works normally before Custom preparation.

## 10. Preferences and history

### 10.1 Preferences v5

Continue using `alicetype.preferences` with `{ version: 5, settings: ... }`. No new persisted field is needed: the only expanded field is `mode`, now allowing five values.

- Add version-specific validation: v1-v4 accept only their historical Timed/Words modes; v5 accepts all five. Do not widen a reused old validator so malformed legacy records suddenly become valid.
- Migrate every supported v1-v4 record using the existing defaults for fields introduced in v2/v3/v4. Preserve duration, word limit, vocabulary, modifiers, caret, sound, live stats, onboarding, test audio, device notes/profile, and confirmed layout exactly.
- Migration writes v5 once. A failed migration write retains migrated settings in memory and follows `PreferenceMigrationError` and existing Retry behavior.
- Unsupported/corrupt records show existing explicit load warnings and are not silently overwritten. New-mode selection/save failures permit in-memory practice with the normal retry warning.
- Restore defaults keeps its confirmation and existing history behavior; also clear transient Custom and Zen content. Reset to default Timed settings.
- Update `App.svelte`'s explicit practice-preference projection and comparison paths, settings reset flow, test seed helpers, and migration fixtures. Do not persist transient targets by spreading session objects into preferences.

### 10.2 Session record evolution

Existing records have no per-record schema version and assume Timed/Words. Add `version: 2` to newly written history records. Keep common fields `id`, `completedAt`, `wpm`, and `totalAttempts`; use the following mode branches:

| Record branch | Additional required fields |
| --- | --- |
| Timed | `mode`, existing duration `limit`, `wordBankTier`, `punctuation`, `numbers`, `accuracy`, `correctAttempts`, `missedKeys` |
| Words | `mode`, existing word `limit`, `wordBankTier`, `punctuation`, `numbers`, `accuracy`, `correctAttempts`, `missedKeys` |
| Quote | `mode`, `quoteId`, `targetCharacters`, `elapsedMs`, `accuracy`, `correctAttempts`, `missedKeys` |
| Custom | `mode`, `targetCharacters`, `elapsedMs`, `accuracy`, `correctAttempts`, `missedKeys` |
| Zen | `mode`, `retainedCharacters`, `elapsedMs`, `accuracy: null`, `correctAttempts: null`, empty `missedKeys` |

Quote IDs are catalog references, never the quotation or user content. Historical quote IDs need only satisfy the stable ID syntax, not membership in today's catalog; removing a catalog entry must not make valid history unreadable. Current quote preparation still requires catalog membership.

- `targetCharacters` is an integer from 1 through 10,000 for Custom and 40 through 1,000 for Quote. Finite completed records require `totalAttempts >= targetCharacters`.
- `retainedCharacters` is a nonnegative safe integer no greater than `totalAttempts`; elapsed times are finite and nonnegative. Every saved run has at least one printable attempt.
- Retain existing validation of dates, WPM, attempt totals, accuracy rounding, safe missed-key names/counts, and consistency between misses and incorrect attempts.
- Require the new record's mode-specific fields and nullability; reject unknown versions/modes and inconsistent fields rather than synthesizing generator limits or treating Zen as Words.
- Whitelist serialization fields so extra properties cannot leak text. Keep raw target, draft, input, author/source passage, and Zen chunks out of both persisted and pending records.
- For unversioned records, apply the exact legacy validator and project them to the new in-memory Timed/Words representation with `version: 2`. No unavailable elapsed or target-length values are fabricated.
- Continue opening IndexedDB `alicetype` at database version 1 with the `sessions` store keyed by `id` and `completedAt` index. The record format is additive and needs no index/store upgrade or destructive rewrite.
- Preserve retryable pending saves, idempotent `put` by record ID, errors, clear-history confirmation, and connection lifecycle. Abandoned/ready runs never save.

### 10.3 Stats and comparability

- Replace binary Timed/Words labels and empty-state copy with exhaustive presentation for all five modes.
- Show Timed seconds and Words base-word limits as today; Quote/Custom show target character count; Zen shows "Manual stop" and elapsed time, not an invented limit.
- Show Quote/Custom numeric accuracy and Zen "Not applicable". Clearly distinguish **Free-writing WPM** from target-verified WPM.
- Completed-session count includes all records. Existing best/average WPM and average accuracy summarize target-copying sessions only; label the population and count explicitly.
- Show a separate Zen session count and best/average free-writing WPM when Zen history exists. If there are only Zen records, target-copying summary values display "Not available", not misleading zero scores.
- Most-missed physical keys aggregate only target-copying sessions; Zen contributes none. Preserve ordering and missing-code behavior.
- Continue arithmetic per-session means, not time-weighted averages. Do not mix null Zen accuracy into a denominator or convert it to zero.

## 11. Module and integration responsibilities

| Surface | Required change |
| --- | --- |
| `src/lib/typing/exercise-generator.ts` | Extend shared mode/settings types, discriminate configuration, preserve generated-mode behavior and refill metadata. |
| `src/lib/typing/quote-catalog.ts` (new) | Readonly catalog/types, validation, injectable random selection, stable attribution references. |
| `src/lib/typing/custom-text.ts` (new) | Pure bounded normalization/validation and preparation error details. |
| `src/lib/typing/typing-engine.ts` | Finite versus free-writing session state, Zen stop and chunked writing, mode-aware metrics/progress/completion. Keep browser/storage APIs out. |
| `src/lib/components/ModeNavigation.svelte` | Five native working mode buttons with existing selection/lock behavior. |
| `src/lib/components/PracticePanel.svelte` | Mode dispatch, quote selection, Custom draft lifecycle/preview, Zen rendering/Stop, mode-aware timers, sound callbacks, focus, labels, and exactly-once completion. |
| `src/App.svelte` | Preference projection/reset, navigation lock, unchanged layout/audio behavior for finite modes, Zen audio suppression, content-free result submission/retries. |
| `src/lib/storage/preferences.ts` | Version-specific v1-v5 validation/migration and five-mode persistence. |
| `src/lib/storage/session-history.ts` | New record union, exact legacy adapter, safe serialization, mode-aware record creation and summaries. |
| `src/lib/components/StatsPanel.svelte` | Five-mode rows, null accuracy, separate Zen summaries, updated empty-state wording. |
| `src/lib/components/SettingsPanel.svelte` | Keep saved sound/live-stat/caret choices; document Zen overrides without toggling preferences. Wire content clearing on confirmed defaults reset. |
| `src/lib/components/AppFooter.svelte` and bundled notice assets | Discoverable quote attribution/rights notice, following existing vocabulary/layout attribution patterns. |
| `README.md` | On implementation, document supported modes, ASCII/normalization boundaries, ephemeral text, Zen metrics/overrides, and history compatibility. |

Use small presentation components only if needed to keep the practice panel understandable; do not create a second typing engine, parallel storage layer, or general-purpose mode plugin system.

## 12. Implementation sequence

1. Introduce discriminated configuration/session/history types and legacy adapters; keep existing generated-mode tests passing.
2. Implement and unit-test quote validation/selection and Custom preparation; bundle reviewed quote content and rights notices.
3. Implement finite Quote/Custom engine paths, character progress, and explicit status/result labels.
4. Implement targetless Zen actions, chunked writing/windowing, manual-stop metrics, and idempotent completion.
5. Wire all five mode controls, setup/editor flows, focus, settings locks, Zen UI/audio/timer suppression, and content cleanup.
6. Add preferences v5 migration, mode-aware result creation, Stats presentation/aggregation, and pending-save coverage.
7. Update browser regressions/fixtures and user documentation; run the checks below. Mark this document implemented only after acceptance evidence exists.

## 13. Verification and acceptance criteria

### 13.1 Unit coverage

- Existing generator output, exact Timed deadlines/refill, base-word progress, metrics, input filtering, and configuration-less finite-session tests retain their behavior.
- New configuration unions reject invalid modes and prevent generator/refill operations for Quote/Custom/Zen.
- Quote data meets the minimum passage/work counts, text bounds, uniqueness, attribution/rights requirements, and local-notice availability. Fixed RNG values exercise first/last eligible choices; invalid RNG and insufficient catalog fail explicitly; Next excludes the current ID.
- Custom tests cover CRLF/CR/LF/tab/NBSP, every typography mapping, collapse/trim order, preserved case/numbers/punctuation, whitespace-only input, controls/zero-width characters, accented text/emoji rejection, and no silent deletion.
- Test raw lengths 10,000/10,001 and normalized lengths 10,000/10,001, including ellipsis expansion that exceeds the limit. Test a valid one-character target and markup as literal text.
- Quote/Custom first-key timing, wrong final character completion, correction/attempt history, character progress, restart snapshot, and ignored unsupported input are deterministic.
- Zen tests cover first key versus empty Backspace, space input, corrections, no comparison/missed keys, no automatic completion at arbitrary length/time, ready/running/completed Stop, repeated Stop, and frozen metrics.
- In separate stop scenarios at a controlled 60,000 ms elapsed time, 250 retained Zen characters yield 50 WPM, while typing those characters and deleting 50 before Stop yields 40 WPM with attempts unchanged. Deleting all writing before Stop yields 0 WPM and a valid saved run; zero elapsed time yields 0.
- Exercise chunk-boundary Backspace and more than 100,000 accepted characters, verifying retained count, ordering, final metric calculation, and a render-window result no longer than 2,000 characters. These are test sizes, not product limits.
- Every v1-v4 preference fixture migrates to v5 with all old choices preserved; test all five v5 modes, invalid/unknown records, and migration-write failure/retry.
- History tests cover exact legacy reads, each v2 branch, round-trip whitelisting, unknown versions, nullability/consistency errors, quote IDs removed from the current catalog, separate Zen summary denominators, and target-only missed-key aggregation.

### 13.2 Browser coverage

- Replace "coming soon" assertions with five enabled idle mode buttons; test Enter/Space selection, `aria-pressed`, lock/unlock, default Timed settings, inactive-setting preservation, and reload of all five saved modes.
- Quote shows a valid attributed target; Restart retains it; Next changes its ID; generated modifiers never alter it. Its final character saves exactly one correctly labeled record.
- Custom textarea supports native paste, shortcuts, Enter, and ordinary editing without engine capture/audio/attempts. Apply shows the exact normalized target; invalid drafts preserve content and show associated errors. Restart retains the applied snapshot; Edit/Cancel/Clear and view-leaving/reset cleanup follow the contract.
- Capture controls reject paste/composition/repeat without adding attempts, and no mode captures typing while another editor/view has focus. Browser shortcuts and Tab remain usable.
- Zen begins empty; only text/caret/scroll update during typing. Assert no progress, live metric, elapsed counter, correctness classes, key feedback, periodic practice interval, or practice audio initialization, even with saved sound/live stats enabled.
- With a controlled clock, Zen remains running after long elapsed time and large input, continues timing while unfocused, and only Stop completes it. Stop via pointer and keyboard each yields one result; Restart/reload of an unfinished run yields none.
- Verify Zen renders at most 2,000 writing characters after long input and allows Backspace across the window boundary. Stop displays full-session metrics, not window metrics.
- Test mixed legacy/new history, only-Zen history, empty history, failed save/retry after restart/navigation, unavailable IndexedDB/localStorage, preference migration failure, and clear-history/defaults confirmations.
- Inspect localStorage, IndexedDB, pending record shapes, URLs, network requests, and captured console output for absence of Custom/Zen content. Attribution notices load locally; no runtime quote network request occurs.
- Finite modes retain confirmed keyboard geometry/legends, feedback duration, sound, focus/scroll behavior, and final metrics. Keyboard Test audio/counts and Keyboard Details behavior remain independent.
- Verify narrow layout/zoom, keyboard-only editor/Stop operation, visible focus, meaningful labels, no per-key live announcements, and reduced-motion behavior. Perform a manual assistive-technology smoke check for the editor, targets, Zen window, and final results.

### 13.3 Validation commands and completion gate

During implementation, run focused suites first, using existing tooling:

```powershell
npm run test -- src/lib/typing src/lib/storage
npm run test:e2e -- tests/modes.spec.ts tests/practice.spec.ts tests/storage.spec.ts
npm run check
npm run build
```

Add focused Quote/Custom/Zen browser files if that makes coverage clearer and include them in the browser command. Update existing test support/fixtures rather than leaving historical "unavailable mode" assumptions behind. Because shared session/settings types affect other features, finish with the existing full unit and browser suites before implementation sign-off.

Acceptance requires all five modes to work end-to-end, old preferences/history to remain readable, no stored writing content, reviewed quote rights, and verified Zen manual-stop/distraction-free behavior. Updating this design document alone does not make the modes available. This documentation-only change requires document/link consistency checks, not application test execution.

## 14. Risks and safeguards

- **Binary assumptions:** Audit every `mode === 'timed' ? ... : ...` path in engine, practice UI, settings projection, history, Stats, and tests. Exhaustive mode branching prevents Quote/Custom/Zen from being mislabeled or given a word limit.
- **Quote rights/accuracy:** Catalog completion is blocked by missing provenance or redistribution evidence, not filled with plausible text. Review source editions and record typography adaptations.
- **Pasted text expectations:** Explain the ASCII boundary and exact normalized preview; never imply arbitrary-language support or silently rewrite unsupported content.
- **Zen score comparability:** Free writing cannot verify correctness. Null accuracy and separate WPM summaries are required, not optional polish.
- **Zen performance:** Window the rendered text, avoid whole-transcript per-key work, and test cross-window editing. Do not present a DOM window as a user input limit.
- **Text privacy:** Audit record construction, save retries, errors, reset/navigation lifetimes, and accessible DOM labels. No draft autosave or hidden transcript persistence.
- **Compatibility:** Preference schema and history record versions are separate concerns. Do not bump the IndexedDB database version merely to change record types or rewrite legacy scores.
