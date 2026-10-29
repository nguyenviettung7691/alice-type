# AliceType Phase 11 Technical Implementation Plan

> **Status:** Implemented with automated verification; manual gates pending. See [Verification results](#verification-results).

## Goal and governing contract

Implement the [Phase 11 Detail Design](./phase-11-detail-design.md) on the existing Svelte 5/TypeScript application:

- Alice Drills and Code practice modes.
- A cue-only finger guide with a B-key hand preference.
- Hand/finger load and per-key accuracy, with history record v4.
- VIA/Vial keymap file import onto the confirmed catalog layout.
- Preferences schema v7.

The [Technical Design Document](./tech-design.md) remains the product source of truth. Do **not** implement the
excluded or deferred items in detail design 2.2:

- spacebar alternation;
- the Space-as-Backspace penalty;
- layer-hold scoring;
- the rhythm arcade;
- runtime article fetching;
- Alice-versus-standard comparison;
- firmware protocol reads;
- QMK `keymap.json` import;
- difficulty levels.

Do not add a dependency, backend, or network call.

## Work packages and dependency graph

| ID | Work package | Prerequisites | Exit artifact/evidence |
| --- | --- | --- | --- |
| P11-01 | Baseline and affected-contract inventory | None | Baseline check/test/build/e2e results; consumers of `PRACTICE_MODES`, preferences, history, visualizer, layout resolution |
| P11-02 | Finger map and keycap side | P11-01 | `finger-map.ts` plus tests over generic and all bundled profiles |
| P11-03 | Drills generator | P11-01, P11-02 | `alice-drills.ts` plus seeded tests for en/vi and all types |
| P11-04 | Code snippet catalog | P11-01 | Original snippets, notice, validators, tests |
| P11-05 | Mode/configuration and preferences v7 | P11-03, P11-04 | Extended modes, configuration validation, v1-v6 to v7 migration tests |
| P11-06 | History v4 and aggregation | P11-02, P11-05 | v4 records, validators, `summarizeSessions` extensions, legacy compatibility tests |
| P11-07 | Practice UI: Drills, Code, live load | P11-05, P11-06 | Mode selectors, Next snippet, hand balance, recording of `keyAttempts` |
| P11-08 | Finger guide overlay | P11-02, P11-07 | Expected state in visualizer, caption/live region, layout-map inversion |
| P11-09 | Stats: hand balance, per-key accuracy, reach keys | P11-06 | Stats sections, language filter, older-session note |
| P11-10 | Catalog matrix dimensions and keymap import | P11-01 | Regenerated `index.json` with only `matrix` added; `keymap-import.ts`; Keyboard Details UI; v7 persistence |
| P11-11 | Localization and accessibility pass | P11-07, P11-08, P11-09, P11-10 | Complete en/vi keys; axe/keyboard checks |
| P11-12 | Verification and documentation sign-off | P11-11 | Acceptance evidence A01-A15; README/tech-design status updated |

- P11-02, P11-04, and P11-10 can proceed in parallel after the baseline.
- P11-10 touches only keyboard/catalog/details code until it joins preferences v7. Coordinate its type additions
  with P11-05.

## P11-01. Establish baseline and affected contracts

1. Inspect the worktree and preserve unrelated changes. Read the product design and detail designs for Phases 3, 5, 7,
   8, and 10.
2. Inventory every consumer of:
   - `PRACTICE_MODES`, `PracticeMode`, `SessionConfiguration`, and `requiresFinish`;
   - `ModeNavigation`;
   - Practice settings rendering;
   - `validatePreferences` and its migrations;
   - `validateSessionRecord`, `completedRecord`, and `summarizeSessions`;
   - `SessionProgressChart` mode shapes;
   - Stats mode labels;
   - `AliceKeyboardVisualizer` props;
   - `resolveImportedLayout` and App layout resolution.
3. Run `npm run check`, `npm test`, `npm run build`, and `npm run test:e2e`. Record existing failures (Phase 10
   recorded eight pre-existing Chromium failures) without fixing them here.

**Exit:** no runtime change; an inventory and baseline evidence.

## P11-02. Finger map and keycap side

Primary files: new `src/lib/keyboard/finger-map.ts` and `finger-map.test.ts`.

1. Add the static code-to-finger table from detail design 6.1, matching the generic Alice split (Digit6 left,
   Digit7 right).
2. Implement `fingerForCode(code, bKeyHand)`:
   - `KeyB` follows `bKeyHand`.
   - `Space` is a thumb with no hand.
   - Unknown codes return `null`.
3. Implement `keycapHand(cap, centreX)`:
   - generic keycaps use `half`;
   - imported keycaps use rotation sign, then centroid versus centre when `r = 0`.
4. Expose a helper resolving `(layout, code, bKeyHand)` to the keycap indices to mark. For duplicate `KeyB` it returns
   only the preferred side; for Space it returns all.
5. Tests:
   - every generic key;
   - for each bundled profile's default variant, every coded key is classified, and both B keycaps resolve to
     opposite sides where the profile has two;
   - unknown codes.

**Exit:** a pure tested module; no UI change.

## P11-03. Drills generator

Primary files: new `src/lib/typing/alice-drills.ts` and `alice-drills.test.ts`.

1. Build pools from the full 5,000-token bank per language, filtered to `^[a-z]+$`. Cache the pools per
   `(language, drillType, bKeyHand)`.
2. Implement the three selection rules and the cross-boundary 6/7 numbers exactly as in detail design 5.2.
3. Enforce the minimum pool of 20, throwing `ExerciseGenerationError`. Validate the random source as
   `generateExercise` does.
4. Return the existing `Exercise` shape with frozen configuration.
5. Tests:
   - for each type and language with a seeded source, every word satisfies its rule;
   - injected numbers contain 6/7 for cross-boundary;
   - word counts match limits;
   - no consecutive duplicate;
   - a small synthetic pool raises an error;
   - `bKeyHand` changes classification of B-only alternation.

**Exit:** a deterministic pure generator.

## P11-04. Code snippet catalog

Primary files: new `src/lib/typing/code-snippets.ts`, `src/lib/typing/code-snippets/{python,javascript,rust}.ts`,
`src/lib/typing/CODE-NOTICE.txt`, and `code-snippets.test.ts`.

1. Author at least 15 original single-line snippets per language that satisfy detail design 8.1. Do not copy
   third-party code.
2. Validate at module load:
   - printable ASCII, 30-160 characters;
   - no leading, trailing, or double spaces;
   - unique kebab-case IDs;
   - per-language coverage of `{ } [ ] |`, a backtick, and a digit.
3. Add `selectSnippet(codeLanguage, previousId, random)` without immediate repeat.
4. Tests: validation failures for each rule, coverage, and selection.

**Exit:** a validated catalog with an authorship notice.

## P11-05. Modes, configuration, and preferences v7

Primary files: `src/lib/typing/exercise-generator.ts`, `typing-engine.ts`, `src/lib/storage/preferences.ts`, and
their tests.

1. Extend `PRACTICE_MODES` with `drills` and `code`. Add `DrillType`, `CodeLanguage`, and the configuration union
   members.
2. Extend `validateConfiguration`:
   - unknown drill types, code languages, and snippet IDs are rejected;
   - Drills accept only `WORD_LIMITS`.
3. Update `requiresFinish`: Code never requires Finish; Drills follow the language registry.
4. Add the v7 fields and defaults from detail design section 10. Migrate v1-v6 by adding defaults, and write v7.
   Validate the `keyboardKeymapImport` shape against the catalog and the current confirmation.
5. Tests:
   - each historical version migrates to v7 with defaults;
   - invalid v7 values reset as before;
   - a stale import (profile, variant, or revision mismatch) is dropped;
   - an English Drills session auto-completes, a Vietnamese one requires Finish, and Code never requires it.

**Exit:** types compile; all existing preference tests still pass, with fixtures updated alongside types.

## P11-06. History v4 and aggregation

Primary files: `src/lib/storage/session-history.ts`, `session-history.test.ts`, and `session-timeline.ts` if the chart
needs new mode shapes.

1. Add the v4 schema from detail design 7.3, including `drills` and `code` record variants.
2. Extend `completedRecord` to take `keyAttempts` and `handAttempts`, and to write v4.
3. Validate:
   - misses never exceed attempts;
   - all counts are safe non-negative integers;
   - hand totals stay within `totalAttempts`;
   - code keys use the existing safe pattern.
4. Extend `summarizeSessions`:
   - hand totals;
   - per-key attempts and misses from v4 only;
   - a count of excluded older records;
   - per-key accuracy at a threshold of 20;
   - the reach and home-row aggregates.
5. Give `SessionProgressChart` shapes for the two new modes, and add both to the Stats mode labels.
6. Tests:
   - legacy, v2, v3, and v4 records coexist;
   - aggregates are correct;
   - invalid v4 records are rejected per item without losing valid ones.

**Exit:** compatible storage with no IndexedDB version bump.

## P11-07. Practice UI: Drills, Code, live load

Primary files: `ModeNavigation.svelte`, `PracticePanel.svelte`, new `HandBalance.svelte`, and `App.svelte`.

1. Add the two mode buttons. Drills shows the drill-type selector, word limit, numbers, and the IME note; tier and
   punctuation are hidden. Code shows a language selector and a Next snippet action.
2. In `commitNative`:
   - accumulate `keyAttempts[directCode]` for direct insertions;
   - classify into hand buckets with `fingerForCode`;
   - count non-direct committed insertions as `unattributed`;
   - reset with the session;
   - pass both maps to `completedRecord`.
3. Render `HandBalance` (split bar, text percentages, expandable finger detail) under live stats when the detail
   design 7.2 conditions hold.
4. Persist the drill type, code language, and B-key hand through the existing `onsettingschange` pattern. Lock them
   while running.
5. Playwright tests, in new `tests/alice-practice.spec.ts`:
   - Drills and Code start and complete;
   - live balance responds to direct typing;
   - live balance is hidden with live stats off and in Zen;
   - settings persist after reload;
   - the existing five modes are unaffected.

**Exit:** both modes are functional end to end and save v4 records.

## P11-08. Finger guide overlay

Primary files: `AliceKeyboardVisualizer.svelte`, `PracticePanel.svelte`, and new `src/lib/keyboard/key-for-character.ts`
with tests.

1. Implement character-to-code mapping:
   - an inverted browser layout map when legends were granted;
   - otherwise a US-QWERTY reference with Shift detection;
   - `null` for graphemes with no single key.
2. Add an `expected` prop (a code plus keycap indices) to the visualizer. Render an orange outline plus a non-color
   marker. Add "expected" to the assistive key list.
3. Add the Finger guide switch (default off, saved), the caption, and a polite live region that updates at word
   boundaries.
4. Tests:
   - unit tests for the mapping, including shifted characters and Vietnamese diacritics returning `null`;
   - Playwright: with an imported two-B profile confirmed, the guide marks only the preferred-side B, and switching
     the preference to Right moves the marker;
   - no marker in Zen;
   - the guide never changes the score.

**Exit:** the guide is an accessible cue only.

## P11-09. Stats additions

Primary files: `StatsPanel.svelte` and possibly new `KeyAccuracy.svelte`.

1. Add the Hand balance, Per-key accuracy, and High-strain reach keys sections described in detail design 7.4, with
   the "older sessions not included" note.
2. Reuse the language filter and mixed-language notes. Format with Phase 10 helpers and sort on raw values.
3. Playwright tests in `stats.spec.ts`: seeded v3 and v4 records show the correct exclusions, figures, and filtering.

**Exit:** honest Stats derived only from recorded attempts.

## P11-10. Catalog matrix dimensions and keymap import

Primary files:

- `scripts/import-keyboard-layouts.ts` and `src/lib/keyboard/layout-data/index.json`;
- `layout-catalog.ts` and `qmk-keycodes.ts`;
- new `keymap-import.ts` with tests;
- `KeyboardDetailsPanel.svelte` and/or `LayoutMatchPanel.svelte`;
- `App.svelte`.

### Steps

1. Add the VIA definition's `matrix` to each `index.json` entry in the import script. Re-run it at the existing pins
   (network access is needed; this is maintainer-only). Diff the result: only `matrix` may change. If anything else
   differs, stop and investigate rather than committing the drift.
2. Implement `parseKeymapFile(text, entry)`:
   - detect VIA versus Vial;
   - enforce the 256 KB limit, at most 32 layers, dimension checks, and the VIA `vendorProductId` check;
   - decode keycodes (strings, plus basic numeric codes);
   - collect ignored features;
   - return a typed preview or a typed localized error.
3. Implement `applyKeymap(profile, variant, layers)`. It is called by `resolveImportedLayout` through an optional
   argument and replaces base-layer codes and legends per matrix position. Tap/hold legends come from extended
   `qmkKeycodeInfo`. A code-less key becomes inert. Expose per-layer legends for the viewer.
4. UI in Keyboard Details › Layout:
   - file input;
   - preview (changed-key count plus up to 12 examples, layers, warnings);
   - Apply, refused when not eligible, with missing codes listed;
   - Clear;
   - a read-only layer selector;
   - the "file, not firmware" statement.
5. App wiring:
   - persist the import in v7;
   - clear it on profile, variant, or revision change, with a notice;
   - pass the applied layout to Practice, Keyboard Test, and Stats.
6. Tests:
   - unit fixtures, hand-built from documented formats: a VIA file for a bundled profile, a mismatched
     `vendorProductId`, a wrong layer length, a Vial file with matching and mismatched dims, numeric codes, over-size
     input, too many layers, and malformed JSON;
   - `applyKeymap` remaps and makes keys inert;
   - Playwright: upload via `setInputFiles`, preview, apply, the visualizer legend changes, a reload persists the
     import, changing the variant clears it, and no network request is made.

Upstream format references, read for design and not bundled:

- VIA `src/components/panes/configure-panes/save-load.tsx` (`saveLayout`/`loadLayout`) in `the-via/app`;
- Vial `src/main/python/protocol/keyboard_comm.py` (`save_layout`) in `vial-kb/vial-gui`.

Record the upstream commit inspected in the verification section.

**Exit:** a local-only, validated, reversible import.

## P11-11. Localization and accessibility pass

1. Add every new key to the `en.ts` and `vi.ts` catalogs and the message contract. The exact-coverage tests must
   pass.
2. Run the existing axe and keyboard checks on Practice (Drills, Code, guide on), Stats, and Keyboard Details import.
3. Check screenshots at 1280px and 360px in both languages, and the focus order through the new controls.

**Exit:** no missing keys and no new accessibility violations.

## P11-12. Verify the acceptance contract and sign off

### Automated commands

```powershell
npm run check
npx vitest run src\lib\keyboard src\lib\typing src\lib\storage src\lib\i18n
npx playwright test alice-practice.spec.ts practice.spec.ts remaining-modes.spec.ts stats.spec.ts keyboard-details.spec.ts keyboard-layout.spec.ts
```

Then run the regression and build sign-off:

```powershell
npm test
npm run build
npm run test:e2e
```

Playwright arguments are filename regex filters, not filesystem paths.

### Focused verification matrix

| Area | Required cases | Acceptance |
| --- | --- | --- |
| Drills | Each type × en/vi, seeded rule satisfaction, 6/7 numbers, minimum pool error, Finish rules | A01-A03 |
| Finger guide | Expected marker plus caption, preferred-side B on generic and two-B profiles, Shift, no-single-key, Zen hidden | A04 |
| Load and history | Direct-only attribution, thumb/unattributed buckets, v4 validation, legacy coexistence | A05-A06 |
| Stats | Hand balance, at-least-20 accuracy threshold, reach versus home row, language filter, excluded-count note | A07 |
| Code | Catalog validation, no repeat, auto-complete under en and vi UI | A08 |
| Keymap import | VIA/Vial accept and reject cases, preview, apply, persist, auto-clear, layer viewer, no network | A09-A11 |
| Preferences | v1-v6 to v7 defaults, invalid reset, stale import drop | A12 |
| i18n/a11y | Exact keys, axe, keyboard-only, responsive | A13 |
| Boundaries | No dependency, network, or upload; no claims of enforcement | A14-A15 |
| Regression | Five original modes, Keyboard Test, onboarding, device connection, layout confirmation | All |

Acceptance IDs A01-A15 correspond to items 1-15 in detail design section 12.

### Manual gates

1. With a real Alice-family board and its own VIA or Vial export, import the file. Confirm that legends and remaps
   match the board's actual behavior when typing in Practice and Keyboard Test.
2. Type Vietnamese drills with OS Telex/VNI on and off. Confirm that scoring stays correct and attribution counts only
   direct keystrokes.
3. Run a screen-reader smoke test of the guide caption, the hand-balance text, and the import preview and errors.
4. Get a fluent Vietnamese review of the new copy. This inherits the Phase 10 gate.
5. Review code snippets for originality and readability.

Record unavailable environments as **pending/blocked**. Do not claim them as passed.

### Documentation sign-off

1. Update the README feature sections and the phase table status. Update the product design's Phase 11 roadmap status
   only after verification.
2. Add `CODE-NOTICE.txt` to the attribution section. Confirm the catalog `NOTICE.txt` still matches the regenerated
   snapshot.
3. Record commands, results, acceptance evidence, inspected upstream commits, and remaining gates below.

## Verification results

Recorded on the working tree based on commit `3e8497c` (Windows, Chromium via Playwright, Vite dev server).

### Commands

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings |
| `npm test` | 28 files, 649 tests passed (baseline before Phase 11: 594) |
| `npm run build` | Succeeded |
| `npm run test:e2e` | 161 passed, 8 failed. The 8 failures are the pre-existing baseline failures recorded before Phase 11 started, with the same causes: `keyboard-details:73` (test-map wording), `keyboard-layout:49` (layout caption wording), `stats:258` (danger-button class), `storage:404`, `storage:423`, `storage:438` ?2 (onboarding layout-access copy), `visualizer:58` (mismatch color). |

`tests/alice-practice.spec.ts` adds 5 end-to-end cases. Existing specs were updated only for preferences v7, history record v4,
the new per-key accuracy table (history-table locators), and v7 fixtures. No new dependency was added
(`package.json` is unchanged).

### Acceptance evidence

| ID | Evidence |
| --- | --- |
| A01 | e2e: Drills and Code complete and save; all prior mode, Keyboard Test, onboarding, and layout specs still pass outside the baseline failures. |
| A02 | Unit: `alice-drills.test.ts` (rule classification, minimum pools for every type ? en/vi, seeded deterministic targets, `DrillPoolError`). |
| A03 | Unit: cross-boundary qualifying words and 6/7-only number injection. |
| A04 | e2e: outline plus `>` marker and caption, left-side B, opposite-hand Shift, polite announcement, hidden in Zen. Unit: `finger-map.test.ts` (preferred-side keycaps on generic and two-B profiles), `key-for-character.test.ts` (no single key for diacritic graphemes). |
| A05 | e2e: live Hand balance region; left + right + thumb + unattributed equals total attempts; 9 Space presses counted as thumb. Hidden in Zen and with live stats off (component condition). |
| A06 | Unit: `session-history.test.ts` (v4 round trip, legacy versions unchanged, aggregation from v4 only). e2e: saved record is v4 with consistent `keyAttempts`. |
| A07 | e2e: Stats shows Hand load and key accuracy, saved-session hand balance, and reach-key copy. Unit: 20-attempt threshold, reach versus home row. |
| A08 | Unit: `code-snippets.test.ts` (validation, no immediate repeat, no Finish in either language). e2e: Rust snippet, Next snippet, auto-complete, record `codeLanguage`. |
| A09 | e2e: VIA preview (difference, ignored macros), Apply, persistence across reload, `Backquote` replaces `Escape` in Practice, wrong-board and malformed errors, Clear keymap. Unit: wrong size. |
| A10 | Unit: Vial identity warning, malformed, 33 layers, and oversize rejections. e2e: read-only layer viewer shows the transparent marker on layer 1. |
| A11 | e2e: a stale saved keymap is removed on load with a notice. App drop rules also cover profile, revision, and matrix mismatches. |
| A12 | Unit: `preferences.test.ts` v1 through v6 to v7 migrations. e2e: v7 fixtures and a future v8 record are not overwritten. |
| A13 | Unit: message catalog contract validates every new key and parameter in en and vi. `svelte-check` reports no accessibility warnings. **Pending:** no axe tooling exists in the repository, and adding it would introduce a dependency, so automated axe checks were not run. |
| A14 | e2e: no non-local requests during Drills and keymap import. No dependency changes. |
| A15 | README, product design, and this plan describe the finger guide and drills as cues only; board comparison is listed as deferred. |

### Manual gates

| Gate | Status |
| --- | --- |
| 1. Real Alice-family board with its own VIA/Vial export | Pending/blocked: no physical board in this environment |
| 2. Vietnamese drills with OS Telex/VNI | Pending/blocked: no native input method in this environment |
| 3. Screen-reader smoke test | Pending |
| 4. Fluent Vietnamese review of new copy | Pending (inherits the Phase 10 gate) |
| 5. Code snippet originality and readability review | Pending |

Upstream catalog sources were not re-fetched. Every catalog entry carries matrix dimensions (unit-tested), and the
catalog `NOTICE.txt` is unchanged. `CODE-NOTICE.txt` is linked from the README attribution section.
