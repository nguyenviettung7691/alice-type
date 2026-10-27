# AliceType Phase 8 Technical Implementation Plan

> **Status:** Implemented and verified in automated unit/Chromium tests. Browser accessibility-tree and visual smoke checks completed; actual screen-reader verification remains pending. See [Verification results](#verification-results).

## Goal and design analysis

Implement [Phase 8 Detail Design](./phase-8-detail-design.md) on the existing Svelte 5/TypeScript application. Deliver Quote, Custom, and Zen end-to-end while preserving generated Timed/Words exercises, confirmed keyboard layouts, keyboard-test behavior, local storage recovery, and browser-only privacy.

The detail design is the implementation contract; the [Technical Design Document](./tech-design.md) is the product source of truth. This plan specifies execution order, affected surfaces, dependencies, and evidence needed for sign-off. It does not expand scope to difficulty rules, Unicode/IME typing, content libraries, exports, accounts, or new dependencies.

### Current implementation constraints

- `exercise-generator.ts` exports shared practice types but currently supports only Timed/Words; its configuration builder and generator assume every non-timed mode is Words.
- `typing-engine.ts` requires a printable-ASCII target and generated word boundaries for configured sessions. Its completion/progress logic must distinguish finite text from targetless Zen.
- `PracticePanel.svelte` owns capture, input/target state, timer updates, visualizer feedback, metrics, and completion delivery. Its current settings, status, and result branches are binary.
- `App.svelte` owns navigation, preferences, typing sound, confirmed-layout application, and retryable completed-result saves. Practice stays mounted inside a hidden wrapper when another app view is selected.
- Preferences currently use schema v4. Earlier validators are reused by later versions, so simply widening the oldest mode validator would incorrectly accept new modes in historical records.
- History uses unversioned Timed/Words records in IndexedDB database version 1. Stats assumes numeric accuracy and a generated-mode limit for every row.
- `tests/support.ts` currently seeds v4 preferences. Browser assertions and fixtures also encode unavailable-mode, schema-version, and Timed/Words-only assumptions.

Preserve these ownership boundaries. Add explicit view-activity/content-reset signaling to the mounted practice panel rather than unmounting all practice sessions and changing existing Timed/Words navigation behavior.

## Resolved implementation contracts

1. **Mode/configuration separation:** five shared modes; generator settings only on Timed/Words configurations; Quote configuration references a stable quote ID; Custom/Zen configurations carry only their mode.
2. **Finite copying:** Quote/Custom finish at the final target position even with errors. They use character progress, existing correction/attempt metrics, physical-key feedback, and accepted-character sound.
3. **Quote sourcing:** at least 12 distinct eligible passages across three reviewed literary works, each 40-1,000 ASCII characters. Verify passage, edition, attribution, redistribution rights, review date, and adaptations; bundle notices. No runtime fetching or unsourced placeholder catalog.
4. **Custom preparation:** separate raw draft and applied target; enforce 10,000-code-unit raw and 10,000-character normalized bounds, exact normalization order, explicit errors, and escaped preview. Never silently truncate or strip unsupported characters.
5. **Zen semantics:** free writing, no target/correctness/progress/automatic completion. First printable action starts time; only explicit Stop completes/saves. Restart abandons the run without saving.
6. **Zen presentation:** no live metrics, metric interval, visualizer, key flashes, typing audio, or blinking caret during a run. Keep saved preferences unchanged, static controls/instructions available, and operational errors visible.
7. **Zen scale:** retain all writing in memory using incremental chunked editing; render at most 2,000 trailing characters. Backspace crosses window boundaries. No product-level writing/time cap.
8. **Content lifetime:** preserve Custom draft/applied target across mode switches inside Practice; clear them on leaving Practice, reload, or confirmed defaults reset. Clear Zen writing on restart, mode change, leaving Practice, or destruction. Never persist writing or include it in pending save records.
9. **Compatibility:** preferences v5 reads/migrates v1-v4 with historical validators; new history records use `version: 2`, while exact legacy validation remains supported. IndexedDB database version/store/index stay unchanged.
10. **Honest statistics:** Zen accuracy/correct attempts are null, missed keys empty, and free-writing WPM summarized separately from target-copying WPM/accuracy.

## Work packages and dependencies

| ID | Work package | Prerequisites | Primary outcome |
| --- | --- | --- | --- |
| P8-01 | Baseline and contract inventory | None | Known affected consumers and reproducible baseline |
| P8-02 | Shared types and compatibility foundation | P8-01 | Exhaustive types and legacy adapters without changing existing runs |
| P8-03 | Quote catalog and selection | P8-02 | Reviewed local content, notices, deterministic selection |
| P8-04 | Custom text preparation | P8-02 | Pure normalization and explicit bounded validation |
| P8-05 | Finite Quote/Custom engine paths | P8-02, P8-03, P8-04 | Correct finite sessions and character progress |
| P8-06 | Zen engine and windowed writing | P8-02 | Targetless writing, manual stop, bounded rendering projection |
| P8-07 | Practice UI and application lifecycle | P8-03, P8-04, P8-05, P8-06 | All mode flows, content cleanup, focus and presentation |
| P8-08 | Preferences, history, and Stats integration | P8-02, P8-05, P8-06, P8-07 | End-to-end persistence and mode-aware summaries |
| P8-09 | Browser, accessibility, and privacy verification | P8-07, P8-08 | Acceptance evidence and preserved regressions |
| P8-10 | Documentation and release sign-off | P8-03, P8-09 | Accurate user documentation and final verification record |

P8-03/P8-04 can proceed independently after the foundation; P8-06 does not depend on either content source. Implement tests alongside each package. Keep intermediate changes type-safe by updating shared-type consumers coherently; do not expose an unsupported mode merely because a type or record branch exists.

## Execution steps

### P8-01. Establish the baseline and affected contracts

1. Inspect the worktree and preserve unrelated changes. Read the detail design, current engine/generator tests, preference/history tests, and mode/practice/storage browser specs.
2. Inventory consumers of practice mode, session configuration, target/input, metrics/progress, record fields, and schema versions. Include root preference projection, reset callbacks, onboarding focus, audio callbacks, fixture pages, and test seeding.
3. Identify every binary mode fallback and replace it in the appropriate later package; do not limit the audit to mode navigation.
4. Run existing focused unit/browser suites plus type checking as a baseline using the commands below. Record failures separately; do not repair unrelated issues as Phase 8 work.
5. Confirm local quote-notice placement follows existing vocabulary/layout attribution patterns before adding assets.

**Exit:** the affected paths and baseline are known; no new dependencies or application behavior have been introduced.

### P8-02. Introduce shared types and compatibility foundations

1. Extend `PracticeMode`/`PracticeSettings` in `src/lib/typing/exercise-generator.ts`; retain defaults and inactive generated-mode settings.
2. Split generator-compatible configuration from the wider session configuration union. Narrow generator/configuration helpers so new modes cannot silently become Words; validate runtime mode values explicitly.
3. Add target-copying versus Zen session types and nullable/discriminated progress/metrics types in `src/lib/typing/typing-engine.ts`. Keep ready/running/completed timing invariants and configuration-less finite-session semantics.
4. Define the v2 history record union and an exact unversioned Timed/Words adapter in `src/lib/storage/session-history.ts`. New type branches must not synthesize targets, correctness, limits, or missing legacy elapsed values.
5. Prepare version-specific preference validation without yet widening v1-v4 modes. Keep intermediate serialization coherent; enable v5 writes with the complete migration work in P8-08.
6. Update current consumers with explicit narrowing and exhaustive mode handling. New-mode preparation remains unavailable until its engine/UI package is wired; no success-shaped fallback exercise.
7. Add focused type/runtime tests for unknown modes, rejected generator/refill modes, immutable configuration snapshots, legacy record preservation, and existing finite engine behavior.

**Exit:** existing Timed/Words behavior and storage remain valid, shared code type-checks, and new modes cannot reach binary fallback logic.

### P8-03. Build the sourced quote catalog

1. Add `src/lib/typing/quote-catalog.ts` and its unit test. Keep readonly data, validation, and injectable RNG selection independent of DOM/storage/Svelte.
2. Source at least 12 distinct passages from at least three reviewed works. Record stable IDs, author, work, specific edition/source URL, rights basis/jurisdiction, review date, and any typography/whitespace adaptation.
3. Verify each accepted passage is 40-1,000 printable ASCII characters without surrounding/repeated spaces. Review attribution and rights manually; automated shape tests do not establish redistribution permission.
4. Bundle a quote attribution/rights notice and required licenses in the existing public-asset pattern. Link it through `AppFooter.svelte`; source-page visits must be explicit, not embedded/prefetched.
5. Implement uniform selection and Next selection excluding the current ID without rejection loops. Validate finite RNG values in `[0, 1)`.
6. Test stable/unique IDs, duplicate text, bounds, provenance fields, URL schemes, deterministic endpoint choices, current-ID exclusion, invalid RNG, and insufficient/invalid catalogs.

**Exit:** reviewed content meets the actual passage/work thresholds, notices are bundled, and selection errors are explicit. Missing rights evidence blocks Quote completion; do not substitute generated text or invented quotations.

### P8-04. Implement deterministic Custom preparation

1. Add `src/lib/typing/custom-text.ts` and its unit test. Return the exact prepared target and whether normalization changed the draft; use a typed domain error with safe position/code-point details.
2. Enforce the raw 10,000 UTF-16-code-unit bound before normalization. Convert CRLF/CR/LF, tabs, ordinary spaces, and NBSP to spaces.
3. Apply exactly the documented curly-quote, en/em-dash, and ellipsis mappings; collapse ordinary-space runs and trim; then validate nonempty printable ASCII and the normalized 10,000-character bound.
4. Do not use a broad Unicode whitespace trim that silently removes unsupported controls/characters. Do not strip accents, parse HTML, or echo user passages in errors/logs.
5. Cover each mapping, order-sensitive combinations, single-character text, literal markup, whitespace-only input, controls/zero-width characters, accented/emoji rejection, preserved case/numbers/punctuation, 10,000/10,001 raw and normalized lengths, and ellipsis expansion overflow.

**Exit:** preparation is deterministic, bounded, and independently testable; failures retain a safe actionable explanation rather than returning an altered partial target.

### P8-05. Add finite Quote/Custom engine paths

1. Extend finite session creation to accept validated Quote/Custom targets without generated word-boundary metadata. Quote creation resolves a current catalog entry; Custom creation requires a successfully applied target.
2. Preserve first-printable-key timing, Backspace/attempt semantics, incorrect-final-position completion, zero-elapsed guards, shortcut/repeat/composition filtering, and frozen completed state.
3. Add character-based progress for Quote/Custom; leave Words base-word progress and Timed expiry/refill unchanged. Reject extension for all non-timed configurations.
4. Keep target/configuration snapshots immutable. Restart resets counters/input/times using the same quote or applied custom target; only Next quote changes a quote.
5. Add unit tests for incorrect-first/final keys, corrections, progress regression on Backspace, exact completion, metric rounding, restart snapshots, and no deadline/word-limit behavior.

**Exit:** Quote/Custom pure sessions are correct without changing generated modes or fabricating base-word metadata.

### P8-06. Implement targetless Zen and long-writing support

1. Add empty ready Zen creation and append/delete transitions with total printable attempts and incremental retained-character counts. Do not add a target, correct-attempt counter, or missed-key scoring.
2. Use chunked storage with bounded-size append/delete work. Keep past state logically immutable and avoid cloning/scanning the entire transcript or chunk index per key.
3. Expose a trailing-window projection capped at 2,000 characters, visiting only needed trailing chunks. Preserve older writing for Backspace across the window boundary.
4. Add pure `stopSession(session, now)`: ready Zen unchanged, running Zen completed at `now`, completed Zen unchanged, non-Zen rejected.
5. Calculate final Free-writing WPM from all retained characters and elapsed monotonic time only at Stop. Return nonapplicable accuracy, no progress, and no expiry/refill.
6. Test first space versus empty Backspace, zero elapsed, delete-all then Stop, repeated Stop, ignored post-completion actions, long elapsed time, chunk boundaries, and more than 100,000 accepted characters without completion.
7. In separate 60-second scenarios, verify 250 retained characters produce 50 WPM and 200 retained after 50 deletions produce 40 WPM; attempts remain 250. Assert window length never exceeds 2,000 and final metrics use full writing length.

**Exit:** Zen has no automatic completion/length threshold, no per-key WPM work, and correct editing/metrics beyond the rendered window.

### P8-07. Wire practice controls, application lifecycle, and accessibility

1. Replace coming-soon spans in `ModeNavigation.svelte` with five native `aria-pressed` buttons using existing selected/disabled styling.
2. Refactor `PracticePanel.svelte` preparation/rendering/status into exhaustive modes. Show generator controls only for Timed/Words, attribution/Next only for Quote, and editor/applied-target controls only for Custom.
3. Implement separate Custom draft, applied target, and editing state. Provide Apply, Edit, Cancel editing, Clear, preview/count, normalization notice, and associated inline errors. Invalid editing disables old-target capture until valid Apply or explicit Cancel.
4. Allow native paste/editing/Enter/shortcuts in the Custom textarea without engine attempts/audio. Do not rely on `maxlength` to silently truncate. Applying creates ready state and leaves focus on a retained Apply control; explicit Start focuses capture.
5. Implement Quote Restart/Next behavior and finite labels/progress/completion. Next/Restart retain initiating-button focus; finite completion does not unexpectedly move it.
6. Add Zen writing surface, steady saved-shape caret, static instructions, fixed Focus writing, Stop, Restart, and final-result presentation. Keep Stop available throughout; choose and test stable result-heading focus after Stop disables the button.
7. Gate practice intervals, derived metrics, feedback timers, visualizer rendering, character callbacks, and audio initialization by mode. Zen must not merely hide values that are still recalculated every key or interval.
8. Add an explicit active-view input to the mounted panel, passed from `App.svelte`. On leaving Practice, stop capture/feedback and clear Custom draft/applied target and Zen writing even though the component remains mounted. Preserve existing idle Timed/Words navigation behavior.
9. Preserve Custom content on practice-mode changes; clear Zen chunks whenever leaving Zen. Wire a dedicated content-reset signal for confirmed Restore defaults rather than depending on settings inequality, since resetting already-default settings can otherwise skip cleanup.
10. Keep root `running` locks and confirmed-layout application semantics. Accepted finite input retains existing sound/physical-code feedback; Zen never calls the sound path. Root pending records receive only the content-free projection.
11. Make onboarding focus mode-aware: focus the capture control only if present/ready; saved Custom with no applied target should focus its editor or a stable heading, not a missing input.
12. Retain focus-scoped capture, ignored shortcuts/repeat/composition, native Tab escape, non-pausing blur, 320 px wrapping, 200% zoom usability, visible focus, and operational alerts. Do not expose full Zen writing in an accessible label or announce each character.

**Exit:** all mode interactions work in memory, explicit lifetimes match the design, and Zen meets presentation/input/audio constraints without changing saved preferences.

### P8-08. Complete persistence, history, and Stats integration

1. Finish preferences v5 validation/read/write in `preferences.ts`. Migrate v1-v4 in memory, preserving every historical practice/display/onboarding/audio/device/layout value; write only final v5 once.
2. Preserve exact historical mode validation, unsupported/corrupt-record protection, `PreferenceMigrationError` in-memory retention, and Retry behavior. Update `App.svelte` practice projection and reset paths.
3. Serialize new history records with `version: 2` using explicit mode-specific field allowlists. Keep `alicetype` database version 1, `sessions`, `id`, and `completedAt` unchanged.
4. Preserve Timed/Words limits/generator fields; add Quote ID/target count/elapsed, Custom target count/elapsed, and Zen retained count/elapsed with null accuracy/correct attempts and empty missed keys.
5. Validate bounds, safe counters, finite elapsed/WPM, attempt/accuracy/missed-key consistency, and required branch shape. Historical quote IDs require syntax validity, not membership in today's catalog. Reject unknown versions/modes.
6. Adapt unversioned records through the legacy validator on read only. Do not rewrite old scores or fabricate unavailable elapsed/target data.
7. Keep completion delivery idempotent and reuse record IDs for `put` retries. Ready/abandoned runs never save; finite completion and Zen Stop each enqueue exactly one logical result without content.
8. Update summaries/`StatsPanel.svelte` for all modes, character/manual-stop labels, null accuracy, explicit target-copying population, and separate Zen WPM counts/best/means. Only-Zen target summaries show Not available; Zen never contributes missed keys.
9. Update `SettingsPanel.svelte` copy for five modes and Zen sound/live-stat overrides. Keep defaults/history confirmations and audio preference independence.
10. Add migration/record/summary tests, including malformed legacy modes, failed final migration writes, mixed/only-Zen history, removed quote IDs, extra content properties stripped during serialization, and invalid nullability/counts.
11. Update current-schema browser seeds to v5 while retaining explicit v1-v4 fixtures for migration tests. Update record-shape fixtures and storage assertions deliberately.

**Exit:** all modes complete through persistence and Stats; old data remains readable and retryable errors do not retain writing or falsely claim success.

### P8-09. Verify browser behavior, privacy, and regressions

1. Update `tests/modes.spec.ts`, `tests/practice.spec.ts`, and `tests/storage.spec.ts`; add focused `tests/quote.spec.ts`, `tests/custom.spec.ts`, and `tests/zen.spec.ts` if separation improves readability. Use existing Playwright clocks/fixtures, not new tooling.
2. Verify five-mode keyboard selection/locks, inactive generated settings, saved-mode reload, Quote attribution/Next/Restart, Custom normalization/errors/preview/edit/cancel/clear, and exactly-once history submission.
3. For Zen, instrument practice interval installation, WPM calculation through appropriate unit coverage, Web Audio initialization/playback, and rendered DOM. Assert no progress/live counters/feedback/visualizer/audio; advance a controlled clock without visible practice updates or completion.
4. Test Stop with keyboard and pointer in separate runs, focus loss and elapsed time, all-deleted writing, restart/reload abandonment, large input/windowing, and cross-window Backspace.
5. Test mounted-hidden Practice cleanup and noncapture while editing or using another app view; verify Custom survives only internal mode switches and defaults reset clears content even if default settings were already selected.
6. Seed valid/malformed legacy and current preferences/history. Exercise storage denial, migration-write failure/retry, pending save across restart/navigation, refresh/clear-history confirmation, and only-Zen Stats.
7. Use unique synthetic writing markers to inspect localStorage, IndexedDB, serialized/pending record shapes, URLs, requests, and captured console output for content leaks. Verify quote notices/licenses are local and no quote/source request occurs without explicit link activation.
8. Preserve confirmed layout/legends and 300 ms finite feedback, Timed exact expiry/refill, Words base-word progress, independent Keyboard Test sounds/counts, and Keyboard Details behavior.
9. Check 320 px layout, 200% zoom, reduced motion, visible focus, Tab/shortcuts, Custom errors, and final-result focus. Perform manual assistive-technology checks of editor/target/Zen-window descriptions without per-key live announcements.
10. Fix Phase 8 failures before proceeding; separate any reproducible unrelated baseline failures and do not claim blocked checks passed.

**Exit:** acceptance behavior is demonstrated, all changed paths pass focused checks, and accessibility/privacy evidence is recorded.

### P8-10. Update documentation and sign off

1. Update `README.md` current status, practice instructions, mode-specific Restart/Stop behavior, Custom ASCII/normalization boundaries, text lifetime, Zen overrides/metrics, separate Stats summaries, and storage compatibility.
2. Update the product roadmap and detail-design status only after implementation acceptance. Preserve earlier phase documents as historical contracts.
3. Record commands/results, quote-source/rights review, privacy checks, and manual accessibility results in a verification-results section of this plan. Keep unperformed/manual checks explicitly pending.
4. Run final full suites because shared session/settings/history types affect existing features. Require a clean type check and production build and inspect the final diff for unrelated changes/content persistence.

**Exit:** implementation, automated evidence, required manual review, and user-facing documentation agree; all five modes are genuinely available.

## Verification commands

Use the existing package scripts; no lint script is configured. Do not install dependencies unless a chosen command reports missing dependencies or a manifest change requires it.

### Baseline and targeted iterations

Run the smallest relevant selector as each package lands; combine related tests in one runner:

```powershell
npm run test -- src\lib\typing src\lib\storage
npm run check
npm run test:e2e -- 'tests[\\/]modes\.spec\.ts' 'tests[\\/]practice\.spec\.ts' 'tests[\\/]storage\.spec\.ts'
```

For content-helper iterations, narrow the unit command to the relevant new test file. Once focused mode browser files exist, include them in the same Playwright invocation:

```powershell
npm run test:e2e -- 'tests[\\/](modes|practice|storage|remaining-modes|quote|custom|zen)\.spec\.ts'
```

Playwright arguments are regular-expression filters; the separator class matches Windows paths as well as normalized runner paths. The current configuration runs Chromium and starts its own strict-port server on 4175. Do not start another server on that port or claim other-browser coverage.

### Final implementation gate

```powershell
npm run test
npm run test:e2e
npm run check
npm run build
git --no-pager diff --check
```

Resolve relative documentation/notice links and inspect bundled output as part of the final review. A documentation-only addition of this plan needs link/structure/whitespace validation, not application test execution.

## Acceptance evidence matrix

| Requirement | Required evidence | Owner package |
| --- | --- | --- |
| Generated modes unchanged | Existing engine/generator/browser regressions; exact deadlines, refill, base-word progress | P8-02, P8-05, P8-09 |
| Quote content is legitimate and functional | At least 12 passages/3 works; manual provenance/rights review; catalog tests; local notice fetch; Next/Restart/completion browser checks | P8-03, P8-09 |
| Custom target is explicit and bounded | Mapping/boundary tests; native editor paste; exact preview; invalid-draft recovery and content-lifetime browser checks | P8-04, P8-07, P8-09 |
| Zen completes only on Stop | Controlled-clock engine/browser runs; no autosave on abandonment; idempotent result submission | P8-06, P8-09 |
| Zen metrics are honest | 50/40/0 WPM fixtures; null accuracy; separate summary denominators; full retained length, not window length | P8-06, P8-08 |
| Zen remains distraction-free and scalable | No interval/audio/live UI; steady caret; 2,000-character DOM bound; more than 100,000 characters and cross-boundary deletion | P8-06, P8-07, P8-09 |
| Existing data survives | v1-v4 preference fixtures to v5, failed-write retry; exact legacy history reads; no database version bump | P8-02, P8-08, P8-09 |
| No user-writing persistence | Allowlist tests and marker inspection across persisted/pending records, storage, requests, URLs, console; hidden-view/default-reset cleanup | P8-07, P8-08, P8-09 |
| Accessibility and device features preserved | Keyboard/focus/zoom/manual assistive-technology checks; layout/legend/test-audio regressions | P8-07, P8-09 |

## Completion checklist

- [x] P8-01 baseline and affected-surface inventory complete.
- [x] P8-02 shared types and exact legacy adapters complete.
- [x] P8-03 quote count, provenance, rights review, selection, and bundled notices verified.
- [x] P8-04 Custom normalization/validation boundaries verified.
- [x] P8-05 Quote/Custom finite engine behavior verified.
- [x] P8-06 Zen manual-stop metrics, chunked writing, and window bounds verified.
- [x] P8-07 five-mode UI, mounted-view cleanup, reset, focus, and Zen overrides verified.
- [x] P8-08 preferences v5, history v2, retries, and separate Zen Stats verified.
- [x] P8-09 automated browser/privacy/accessibility checks and existing feature regressions complete; screen-reader check remains below.
- [x] P8-10 documentation updated and automated verification evidence recorded.
- [ ] Manual verification with an actual screen reader.

## Verification results

### Automated results (2026-10-27)

| Check | Result |
| --- | --- |
| Baseline unit suite | 280 tests passed before implementation |
| Baseline type check | 0 errors / 0 warnings |
| Full unit suite, `npm run test` | 468 tests passed across 16 files |
| Full browser suite, `npm run test:e2e` | 124 Chromium tests passed |
| `npm run check` | 0 errors / 0 warnings |
| `npm run build` | Production build passed; quote rights notice emitted as a local asset |

New tests live in `custom-text.test.ts`, `quote-catalog.test.ts`, `remaining-modes.test.ts`, and `tests/remaining-modes.spec.ts`, alongside expanded storage/migration tests and updated existing browser fixtures. Coverage includes normalization limits/unsupported Unicode, catalog integrity and selection, finite completion, 100,000-plus-character Zen engine editing with a 2,000-character window, exact 50/40/0 Zen WPM, input filtering, no Zen practice interval/audio/live UI, explicit Stop, content cleanup, safe pending-save retries, and mode-aware Stats. Existing keyboard/device/visualizer browser suites are included in the full pass.

The first integration runs exposed outdated schema/summary/attribution assertions, which were updated to the specified v5/v2 contracts. One full-run visualizer visibility assertion failed once and passed both focused rerun and the final full run without an application change; no retry setting was added.

### Quote review and privacy

The catalog contains 12 original-English passages across *Alice's Adventures in Wonderland* (1865), *Pride and Prejudice* (1813), and *The Adventures of Sherlock Holmes* (1892). Passages were checked against Project Gutenberg transcriptions ([Carroll](https://www.gutenberg.org/ebooks/11), [Austen](https://www.gutenberg.org/ebooks/1342), [Doyle](https://www.gutenberg.org/ebooks/1661)); the bundled notice records source editions, adaptations, US public-domain basis, and the need to check rights in other jurisdictions. Catalog shape tests do not replace that source review.

Browser tests verify local notice access with no runtime external quote request; Custom/Zen content is excluded from saved preferences/history and failed/pending save projections. Failed saves remain retryable after navigation without duplicate records. The mounted Practice panel receives explicit activity/reset signals so hidden views do not retain Custom/Zen content.

### Manual checks and remaining limits

The running app was inspected visually in Chromium and through its accessibility tree: Custom exposes its exact preview, labeled actions and character progress; Zen exposes a labeled writing input and static instructions with no target/progress/visualizer/live metric, a nonanimated caret, and keyboard-accessible Stop. Automated browser tests exercise 320 px layouts, focus behavior, and existing reduced-motion checks.

No actual screen-reader session, browser-level 200% zoom verification, physical-keyboard hardware validation, or non-Chromium browser run was performed. These remain explicit manual checks, not claimed passes. No new hardware capability is introduced by this phase.
