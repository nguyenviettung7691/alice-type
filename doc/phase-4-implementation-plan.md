# AliceType Phase 4 Implementation Plan

## Goal and design analysis

Implement [Phase 4 Detail Design](./phase-4-detail-design.md) on the existing Svelte 5 + TypeScript app. Replace the fixed production exercise with generated vocabulary, independent punctuation/numbers modifiers, Timed and Words modes, and accessible progress. Preserve the focused input, cumulative accuracy, correct-buffer WPM, correction, and transient physical-key feedback established by Phases 2 and 3.

The existing pure engine completes at target length, so simply replacing its target would incorrectly finish Timed mode. Timed completion must instead be an explicit timestamp-based transition. The header currently owns placeholder navigation independently of the panel; lift only the shared configuration and running flag to `App.svelte`, passing props/callbacks through the header rather than adding a store.

## Resolved implementation details

### Configuration and data contracts

- Define a discriminated session configuration: Timed carries a supported duration; Words carries a supported base-word limit. Shared generation settings are bank tier, punctuation, and numbers.
- Keep UI preferences for both duration and word count so switching modes preserves the inactive choice. Defaults: Timed, 30 seconds, 25 words, 200-word tier, modifiers off.
- Snapshot and validate configuration for each generated exercise; disable all settings and mode selection while running. Ready/completed configuration changes generate a new ready exercise without stealing focus.
- Keep legacy `createSession(target)` semantics for pure-engine regression tests; production creates a mode-aware session with generator metadata.
- Record base-word completion positions as exclusive input offsets in the final modified target. A nonfinal base word completes after its separator. Never insert numbers after the final base word, ensuring 100% word progress coincides with final target completion.

### Word data and generation

- Bundle the first 5000 unique lowercase ASCII entries from the frequency-ranked English 2018 data in `hermitdave/FrequencyWords`. Its README explicitly licenses content under CC BY-SA 4.0.
- Preserve the source revision, transformation, attribution, license notice, and data license separately from application MIT licensing. Use local JSON prefixes for 200/1000/5000 tiers; no runtime retrieval or new packages.
- Validate tier sizes, uniqueness, word syntax, configuration, random values, and output metadata explicitly.
- Select base words with replacement using injected randomness. A repeated word is valid and avoids rejection loops with deterministic random sources.
- For punctuation, independently decorate roughly 25% of base words with a comma, period, or paired ASCII quotes. For numbers, independently insert a 1–3 digit token after roughly 20% of nonfinal base words. Both toggles can coexist; one space separates all tokens.
- Timed initial batches contain `durationSeconds * 5` base words; refill with the same settings when fewer than 80 target characters remain. Before accepting any printable input, ensure there is still target capacity. Append with exactly one separator; never regenerate the already-visible prefix.
- Keep the full target in engine state; render it in a bounded scroll area and bring the active character into view without scrolling the page.

### Engine, timing, and errors

- Extend session data with optional mode configuration and word completion offsets. Add pure helpers for expiry, target append, and progress; keep timers and randomness out of the engine.
- Check expiry before every handled action and every 100 ms refresh. At `now >= startedAt + durationMs`, complete with `endedAt` equal to the deadline, rejecting even a key arriving exactly at the boundary.
- Completion and restart clear key feedback and the refresh interval. Blur clears feedback but does not stop session time.
- Use existing formulas, including correct currently buffered punctuation/numbers in WPM and all printable attempts in accuracy. Clamp elapsed time at the deadline even before a delayed refresh processes completion.
- Catch only exercise-generation/extension failures at the UI boundary; show the actual error in a persistent alert, stop the refresh/capture path, clear feedback, and offer Restart. Never replace a failure with an empty target, success status, or silent default.

## Execution steps

### 1. Add licensed vocabulary and pure generation

Files: `src/lib/typing/word-banks/english.json`, its attribution/license files, `exercise-generator.ts`, and `exercise-generator.test.ts`.

1. Retrieve public source metadata and licensed data; bundle the validated first 5000 lowercase ASCII entries with provenance.
2. Define supported option constants, settings/configuration types, validation, immutable exercise output, and exclusive word-completion offsets.
3. Implement random selection and both modifiers with injectable randomness.
4. Add initial timed and refill batch generation.
5. Test exact vocabulary tier sizes, mutation safety, malformed input/random values, deterministic output, all modifier combinations, spacing, and completion offsets.

**Exit:** generated exercises are valid and reproducible, with exact base-word counts and no runtime network dependency.

### 2. Extend the typing engine

Files: `typing-engine.ts`, `typing-engine.test.ts`.

1. Preserve legacy fixed-target sessions and their tests.
2. Add validated mode-aware session construction, expiry, progress, and safe target extension.
3. Ensure deadline checks precede input and Backspace; ending a target never completes a Timed session.
4. Keep final metrics frozen at the deadline or Words completion timestamp.
5. Test all duration/word options, ready/no-attempt states, delayed timers, exact deadline input, correction/progress rollback, appended-prefix invariants, invalid metadata, and frozen metrics.

**Exit:** pure unit tests prove actual limits and boundary behavior, not just UI approximations.

### 3. Wire Svelte controls and lifecycle

Files: `App.svelte`, `AppHeader.svelte`, `ModeNavigation.svelte`, `PracticePanel.svelte`, and scoped styles.

1. Lift shared settings/running state into `App.svelte` and connect header mode buttons to the panel.
2. Add labeled duration/word-count/bank selects and independent modifier checkboxes.
3. Create generated sessions when configuration changes outside a run; preserve focus and inactive mode preferences.
4. Wire 100 ms timestamp refresh, input-time expiry, refill, error presentation, restart, and feedback cleanup.
5. Render bounded, readable generated target text plus accessible mode progress and textual units.
6. Preserve unavailable Quote/Custom/Zen labels and all existing input/visualizer behavior.

**Exit:** both modes work end-to-end without global listeners, persistence, or later-phase behavior.

### 4. Verify user-visible behavior

Files: existing practice/visualizer tests and lifecycle fixture; add focused mode browser coverage if needed.

1. Adapt fixed production-text assertions to inspect generated targets. Retain existing input, shortcuts, native edits, feedback expiry/replacement, physical-code mapping, scrolling, and timer cleanup coverage.
2. Use Playwright's clock for progress, focus-away expiry, exact deadline suppression, final metrics, and restart cleanup.
3. Test every supported selector option, modifier combinations, disabled running controls, preserved inactive preferences, base-word progress, and timed refill.
4. Verify error alerts/recovery with a deliberately invalid random source, no external requests/storage, and no runtime errors.
5. Check accessible names/values, keyboard mode selection/entry, reduced motion, and page/panel overflow at 1440, 768, and 320 px.
6. Run `npm test`, `npm run check`, `npm run build`, and `npm run test:e2e`. Inspect the rendered desktop and narrow layouts with browser tools.

**Exit:** all relevant checks pass; measured deadline/progress behavior and Phase 2/3 regressions hold.

### 5. Document and publish

1. Update README usage, status, tests, word-data licensing, and document links; update footer copy.
2. Clarify modifier boundaries, data ownership, refill policy, and parent/child configuration wiring in the detail design.
3. Record actual verification results here and mark the detail design implemented only after checks pass.
4. Review the scoped diff and run `git diff --check`.
5. Commit the design, plan, implementation, tests, and directly related documentation with the required co-author trailer.
6. Push the existing `main` branch to `origin` without force. Verify the remote branch matches the local commit and the worktree is clean.

If remote permissions, authentication, or concurrent changes block publication, preserve verified local work and report the precise blocker. Do not overwrite remote work.

## Scope and verification record

No Quote/Custom/Zen implementation, difficulties, persistence, sound, permission overlay, keyboard matrix, hardware identity, backend, or dependency additions are planned.

Implementation completed on 2026-10-25. The file-level work above is implemented, including the shared settings wiring, licensed local vocabulary, pure generator/engine helpers, explicit error recovery, accessible progress, and Phase 2/3 browser regressions.

| Verification | Actual outcome |
| --- | --- |
| `npm test` | Passed: 98 unit tests across generator, typing engine, and Alice layout. |
| `npm run check` | Passed: zero errors and zero warnings. |
| `npm run build` | Passed: production assets emitted, including separate vocabulary NOTICE and CC BY-SA license assets. JavaScript is approximately 107 kB / 42.5 kB gzip. |
| `npm run test:e2e` | Passed: 43 Chromium browser tests. |
| Timing and lifecycle | All four durations enforce the deadline, including an input exactly at the boundary and a delayed callback. Running intervals are observed and verified cleared on timed completion and generation failure; existing tests retain restart, word completion, and teardown coverage. |
| Generator and progress boundaries | All four word limits tested with punctuation/numbers, number-token exclusion, progress rollback, and final-character completion. Timed refill preserves the original target prefix and typed characters. |
| Error recovery | Invalid randomness produces an explicit alert, stops capture/timing/feedback, does not claim completion, and can recover through Restart. |
| Responsive and visual inspection | Browser tests pass at 1440, 768, and 320 px. Desktop and narrow-screen rendering inspected; no page-level horizontal overflow, bounded target scrolling, contained Alice diagram scrolling, and labeled controls/progress. |
| Production smoke check | Served the built output on localhost, completed a 10-word exercise at 100% accuracy, and confirmed both footer notice/license assets return HTTP 200 with the expected contents. |
| Scope | No package/dependency changes, runtime external requests, storage, sound, permissions, other modes, or hardware features added. |

During verification, fixed exercise-specific browser expectations were migrated to deterministic generated targets. Exact-WPM tests now pause the browser clock, and focus tests allow the browser's native scroll-container focus stop while still proving Tab escapes input and keyboard activation resumes typing.

Attribution imports use `?url&no-inline` so the production notice remains a readable same-origin file rather than a potentially blocked top-level data URL. The temporary development/preview servers used for inspection are stopped after verification.

Publication target: the existing `main` branch and its configured `origin`. The final commit and remote verification are reported in the delivery summary.
