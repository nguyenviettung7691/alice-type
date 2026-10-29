# AliceType Phase 5 Implementation Plan

## Goal and design analysis

Implement [Phase 5 Detail Design](./phase-5-detail-design.md) on the existing Svelte 5 application. Add versioned preferences, completed-session history, Settings/Stats navigation, accessible first-use onboarding, optional typing sound, and caret/live-stat controls. Preserve Phase 2-4 input, generation, deadline, correction, metric, progress, and visualizer behavior.

The current `App.svelte` owns practice settings and the running flag; `PracticePanel.svelte` owns sessions and focused input. Extend these boundaries rather than adding a store or second input path. Browser storage and audio stay outside the pure typing engine.

## Resolved contracts

- Preferences use `alicetype.preferences`, `{ version: 1, settings }`, strict runtime validation, and existing practice defaults plus block caret, sound off, live stats on, onboarding incomplete. Version 1 is the first release: there is no legacy migration. Future schema changes must supply real migrations. Invalid/future data stays untouched until an explicit settings change or confirmed reset; dismissing onboarding must not overwrite it.
- Initialize validated preferences before mounting practice. Persist explicit changes synchronously; failures keep in-memory selections and offer retry/dismiss. Failed reads retry reading rather than overwriting data.
- Keep the practice panel mounted while viewing Settings/Stats to preserve its ready/completed state. Disable mode and view navigation during a running session; users can Restart before changing views/settings. No timer pauses or hidden background capture.
- Keep only practice configuration in the generator's `settings` prop; pass display and audio preferences separately. Presentation changes must not regenerate an exercise. Settings uses the existing practice controls through the Practice view, rather than duplicating generator controls.
- IndexedDB `alicetype` v1 has `sessions` keyed by `id`, indexed by `completedAt`. Validate records on writes and reads, wait for transaction completion (not just request success), close on `versionchange`/teardown, and report blocked or unavailable storage.
- Generate a session ID once on its first accepted character. At completion, create a text-free immutable record with frozen engine metrics and a wall-clock completion timestamp. For delayed timed expiry, derive the wall-clock end from the session's monotonic elapsed duration rather than the delayed callback.
- Count incorrect printable attempts by physical `code`, excluding missing/`Unidentified` identities, without subtracting corrections. Include the final accepted character. Do not change engine data or formulas.
- The app owns pending immutable records and retry state, so restarting or navigating cannot lose failed saves. Idempotent `put` uses the same ID. Saving succeeds only after transaction commit.
- Stats derives count, best/mean WPM, mean per-session accuracy, newest-first history, and physical-code error totals from validated records. Clear requires confirmation, waits for commit, and must not race pending saves. No text/raw events are stored.
- First-use onboarding is a native modal dialog. Explicit primary activation starts optional layout-map access and focuses the input immediately; do not wait for the optional promise to focus. Escape/secondary dismiss without starting typing. Optional map results supply an explicitly labeled sample of OS-layout legends, never hardware identity or automatic alteration of the generic SVG.
- Audio uses one lazily created Web Audio context, a quiet 25 ms generated click, and explicit opt-in. Accepted printable actions alone trigger clicks (including the completing action); expiry/ignored actions do not. Failures disable sound in memory and surface an error; cleanup closes the context.
- Use existing Vitest for pure validation/aggregation tests and real Chromium tests for audio and IndexedDB transactions, blocked upgrades, retry, and deletion. Do not add a fake database dependency solely for tests.

## Execution steps

### 1. Preferences and history contracts

1. Add storage error, preference, and session-history modules with typed schemas and unknown-input guards.
2. Validate all supported practice limits and booleans, display enums, history counters, finite metrics, timestamps, and physical-code counts.
3. Add Vitest coverage for absent/corrupt/future records, complete preference round trips, getter/write failures, malformed session records, ordering/summary arithmetic, and text-free serialization.
4. Implement native IndexedDB open/upgrade, blocked handling, idempotent writes, ordered reads, clear, connection invalidation, and teardown.

**Exit:** invalid storage cannot enter generator/UI state; failed operations reject explicitly.

### 2. Practice completion integration

1. Add optional completion callback, presentation props, and accepted-character audio callback without changing fixture defaults.
2. Track per-session identity and incorrect physical codes, clearing both on restart/configuration reset.
3. Submit final frozen records once on both timer and input completion paths. Do not save generation errors, abandoned runs, or ready exercises.
4. Lift failed-save queues/retry to `App.svelte`, preserving immutable results through restart/navigation.

**Exit:** one completion produces one text-free history record; persistence failure cannot corrupt typing.

### 3. Settings, Stats, and navigation

1. Load preferences before practice mounts; wire explicit changes and retry/dismiss/error handling.
2. Activate Settings/Stats header controls; disable view changes during runs and preserve practice while hidden.
3. Add caret, sound, live-stat toggles, practice-settings navigation, and confirmed restore defaults.
4. Add accessible summaries, recent-history table, most-missed keys, empty/loading/error states, refresh, and confirmed clear. Disable clear while saves are pending.
5. Ensure errors and confirmations have explicit labels and sensible focus behavior.

**Exit:** settings persist across reload and Stats reflects committed local history.

### 4. Onboarding, optional layout access, and audio

1. Add native modal dialog with explicit start/skip/Escape flow and no global key listener.
2. Keep optional layout-map failures nonblocking and explain browser capability limits; ignore late results after teardown.
3. Add generated quiet clicks, user-gesture context resume, bounded resource lifecycle, and explicit sound failures.
4. Apply caret variants and live-stat visibility without regenerating targets or changing engine behavior.

**Exit:** first use, keyboard-only access, sound opt-in, and optional capability failures work without changing typing ownership.

### 5. Verification and documentation

1. Adapt Phase 2-4 browser setup to bypass onboarding in those regression tests. Replace the obsolete “no persistence” expectation with no external requests and recoverable storage failure.
2. Add Phase 5 browser tests covering reload/defaults, corrupt/future preferences, read/write denial/retry, onboarding keyboard/focus/permission flows, accepted-key audio and cleanup, display variants, local history privacy and aggregates, Timed/Words completion, final-key errors, duplicate prevention, retry after restart, blocked/versionchange/failed transactions, clear confirmation, and narrow screens.
3. Run `npm test`, `npm run check`, `npm run build`, and `npm run test:e2e`; fix all introduced failures. Browser tests exercise real IndexedDB rather than a proxy.
4. Inspect built UI at desktop and 320 px, including dialog, Settings, Stats, and persisted history.
5. Update README, detail design status/contracts, and this plan with actual verification results. Mark implementation complete only after checks pass.

### 6. Commit and push

1. Review only Phase 5 changes, including the preceding design/README work requested in this session; run `git diff --check`.
2. Commit on existing `main` with the required Copilot co-author trailer.
3. Push `main` to configured `origin` without force; verify remote hash equals local HEAD and worktree is clean.
4. If publication is blocked, preserve verified local work and report the exact failure rather than overwriting remote work.

## Scope boundary

No additional practice modes, difficulty rules, themes, test-matrix effects/counts, hardware identification/catalog, backend, telemetry, synchronization, or new runtime dependencies.

## Verification record

Implementation completed on 2026-10-25. All execution steps above are implemented without dependency or manifest changes.

| Verification | Actual outcome |
| --- | --- |
| `npm test` | Passed: 140 tests across five unit-test files; 42 preference/history contract cases added to the Phase 2-4 baseline. |
| `npm run check` | Passed: zero errors and zero warnings. |
| `npm run build` | Passed: production JavaScript approximately 128.74 kB / 49.46 kB gzip; vocabulary notice/license still emitted as readable same-origin files. |
| `npm run test:e2e -- --workers=4` | Passed: all 72 Chromium tests, including 29 Phase 5 scenarios and existing Phase 2-4 regressions. |
| Audio envelope follow-up | Focused accepted-key/audio lifecycle test passed again after adding exact assertions for gain `0.035` and click end at 25 ms; type checks also passed again. |
| Preferences | Reload restores every supported field and inactive limits; display changes do not regenerate targets. Corrupt/future data, denied access, failed writes, retry, confirmed reset, and onboarding after a load retry are covered. No unsupported historical migration was invented. |
| Session recording | Timed/Words completion stores one text-free record, final-key and corrected errors are retained, unavailable physical codes are omitted, and abandoned runs produce no record. Deadline-derived wall time is asserted under delayed callbacks. |
| Real IndexedDB | Tests cover schema/index creation, idempotent writes, ordered reads, blocked upgrades with late connection cleanup, `versionchange`, teardown during open, corrupt records, and aborts *after request success* for both save and clear. |
| Retry and deletion | Failed committed-session records remain retryable after Restart and navigation; deletion is disabled while saves are pending. Clear/reset require confirmation and preserve unrelated preferences/history. |
| Onboarding and audio | Keyboard start/skip/Escape, delayed/denied/missing/synchronously throwing layout access, generic legend labeling, sound opt-in/filtering/failure, context reuse, and real app teardown are covered. |
| Responsive/visual checks | Browser assertions pass at 1440, 768, and 320 px. Built onboarding, desktop Stats, and narrow Settings/Stats were visually inspected; the history table scrolls within its region without page overflow. |
| Final production smoke | Served the final built output locally; native Web Audio accepted typing, a completed exercise persisted through reload, and underline/sound preferences restored. No alerts, runtime errors, or external requests occurred. |
| Scope | No modes, difficulties, themes, test-matrix effects/counts, hardware catalog/identity, network services, dependencies, or engine formula changes added. |

The Phase 2-4 browser setup now seeds only the onboarding-complete default so regression tests retain their prior focus assumptions. The obsolete no-persistence assertion now verifies recoverable database denial and absence of external requests. Lifecycle fixtures keep standalone practice coverage and add full-app audio teardown coverage.

Final review includes `git diff --check`. The existing `main` branch and configured `origin` are the publication target; the commit and remote verification are reported in the delivery summary. Temporary preview processes and inspection screenshots are cleaned up after verification.

## Stats addendum: Recent-sessions progress chart

Implements [Phase 5 Detail Design §6.3.1](./phase-5-detail-design.md#631-recent-sessions-progress-chart-stats-addendum) without storage, preference, or dependency changes.

### Execution steps

1. **Timeline data:** `src/lib/storage/session-timeline.ts` builds the latest 10 target-copying points in chronological order (Zen excluded, ID tie-break, integer WPM, float accuracy, below-floor flag, legacy → English, scoring basis) and computes the WPM axis ceiling aligned to five accuracy intervals. Covered by `session-timeline.test.ts`.
2. **Formatting:** `formatTime` and `formatShortDay` in `src/lib/i18n/format.ts` provide localized axis labels.
3. **Chart component:** `src/lib/components/SessionProgressChart.svelte` renders an inline SVG with gridlines, dual axes, solid accent WPM line, dashed accuracy line with area fill, language-colored and mode-shaped nodes, below-floor markers, legend, language toggles, tooltip titles, accessible summary and point list, and empty states.
4. **Integration and style:** `StatsPanel.svelte` places the chart above the history table and supplies its mode/limit labels; chart styles live in `src/app.css`.
5. **Localization:** typed `stats-panel.*` chart messages added to the contract and the English and Vietnamese catalogs.
6. **Browser tests:** `tests/stats.spec.ts` covers placement above the table, the 10-point window, chronological left-to-right order, Zen exclusion, metadata and colors, below-floor marker, axis labels, accessible summary, filter behavior with stable slots, Zen-only empty state, and narrow-screen keyboard scrolling.

### Verification record

| Verification | Actual outcome |
| --- | --- |
| `npm run check` | Passed: zero errors and zero warnings. |
| `npm test` | Passed: 594 tests across 23 files, including the new timeline and formatter cases. |
| `npm run build` | Passed. |
| `npx playwright test tests/stats.spec.ts` | Both new chart scenarios pass. The only failure is the existing `destructive actions` Restart-test assertion, reproduced with the addendum changes stashed. |
| `npx playwright test --workers=4` | 156 passed; 8 failed — the same eight existing failures recorded in the [Phase 10 implementation plan](./phase-10-implementation-plan.md#existing-chromium-failures-reproduced-against-baseline). |
| Visual checks | English desktop, Vietnamese desktop, and 375 px narrow chart screenshots inspected: aligned dual axes, legend, filters, below-range marker, localized time/day labels, and contained horizontal scrolling. |
