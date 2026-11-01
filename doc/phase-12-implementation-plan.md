# AliceType Phase 12 Technical Implementation Plan

> **Status:** M1-M4 implementation and automated verification are integrated.
> Real-board, assistive-technology and fluent Vietnamese release gates remain open.
> Contract: [Phase 12 Detail Design](./phase-12-detail-design.md).

## Goal

Deliver user-owned board identities and personalization without conflating
catalog layouts, browser-visible key output and physical hardware detection.
Use the existing Svelte/TypeScript stack, storage warnings, localization,
confirmation dialogs, layout resolver and Stats aggregators.

## Work packages

| ID | Work | Prerequisites | Exit evidence / status |
| --- | --- | --- | --- |
| P12-01 | Requirements analysis, product/README updates and detailed contract | None | Scope/observability decisions documented |
| P12-02 | Board types, bounds, lifecycle helpers and preferences v8 | P12-01 | Migration, validation and quota tests |
| P12-03 | Board snapshot, history v5 and filtering helpers | P12-02 | Legacy compatibility and isolation tests |
| P12-04 | Header switcher and Keyboard Details manager | P12-02 | Accessible localized lifecycle UI |
| P12-05 | Application/layout/test lifecycle and snapshot wiring | P12-03, P12-04 | No stale board state, running locks and retry attribution |
| P12-06 | Stats scope selector across all aggregate surfaces | P12-03, P12-05 | Active/all/unassigned/deleted filtering tests |
| P12-07 | M1 verification and documentation checkpoint | P12-06 | Check, unit, build and focused Chromium results |
| P12-08 | Sourced four-family geometry presets | P12-07 | Implemented; source/family tests and explicit preview/apply |
| P12-09 | Layer bindings and focused command-drill engine | P12-07, P12-08 | Implemented; supported output scoring, modifiers and focus behavior |
| P12-10 | Command history schema and localized practice/Stats UI | P12-09 | Implemented; history v6 validation and typing-summary isolation |
| P12-11 | Per-board adaptive drill selection/generation | P12-07 | Implemented; attempt/session/candidate thresholds and deterministic sampling |
| P12-12 | Guided mod-tap experiments | P12-09, P12-10 | Implemented; browser timing and self-report limits are explicit |
| P12-13 | Setup fingerprints and bounded active-time windows | P12-07 | Implemented; completed windows, blur/idle and grouping tests |
| P12-14 | Comparable-setup longitudinal insights | P12-13 | Implemented; attempts/sessions/days gates and matched comparisons |
| P12-15 | Final Phase 12 sign-off | P12-08, P12-10, P12-11, P12-12, P12-14 | Automated gates integrated; manual release gates remain |

M1 ended at P12-07. M2-M4 are implemented without claiming that browser-
invisible firmware behavior is measured. P12-15 remains open for manual release
gates and integrated browser acceptance evidence.

P12-01 through P12-14 are implemented and covered by automated checks. The
remaining P12-15 gates require physical boards/firmware, assistive technology,
native key interception and fluent Vietnamese review.

## M1 execution

1. Establish a clean baseline. Inventory preference consumers, layout async
   resolution, session completion, Stats filters and keyboard-test remounts.
2. Add a pure user-keyboard domain module. Reuse existing board-setting
   validators; avoid storing global language/sound/mode on each board.
3. Extend the single preference envelope to v8. Migrate earlier versions once.
   Capture active settings on changes/switches, validate inactive profiles,
   reject corrupt collections without replacing saved data, preserve retry.
4. Implement create/edit/duplicate/delete with a 20-board limit and last-board
   protection. Preserve history on delete and collection on Restore defaults.
5. Add history v5 snapshot validation and pure filtering by stable board ID.
   Leave IndexedDB database v1 and older records untouched.
6. Add the localized header select and focus shortcut. Use the existing native
   form/select styling and ConfirmationDialog for destructive actions.
7. Remount board-specific UI on switching. Clear/cancel previous layout async
   results; apply changes only while idle. Do not overwrite another board's
   import when a stale load completes. Connection grants remain independent.
8. Capture board context for each practice instance and retain it in pending
   saves. Ensure drills' B-hand and base keymap follow the selected board.
9. Scope every Stats derivation to one filtered collection; preserve language
   filters and global clear semantics. List historical deleted-board IDs.
10. Run tests below, then update exact implemented status and remaining gates.

## M1 acceptance matrix

| ID | Verification |
| --- | --- |
| A01 | v1-v7 migrate to one board preserving settings and only one storage write |
| A02 | All board metadata and scoped settings round-trip; globals do not leak |
| A03 | Corrupt/duplicate IDs, unknown enums, numeric bounds and orphan active ID fail visibly |
| A04 | Add and duplicate create distinct IDs; edits do not share mutable nested data |
| A05 | Switching same-catalog boards restores notes, B-hand, confirmation and imports |
| A06 | Delete needs confirmation, preserves scores and cannot remove the last board |
| A07 | Running sessions lock switcher and edits; hotkey cannot interfere with capture/modal |
| A08 | New scores retain correct board metadata after edits, switching and save retry |
| A09 | Legacy/unassigned scores are excluded from active-board Stats but remain accessible |
| A10 | All Stats surfaces use the same board scope, including misses and per-key attempts |
| A11 | Preferences failure/retry keeps in-memory selections and does not partially persist |
| A12 | English/Vietnamese labels, keyboard form navigation and narrow layout work |
| A13 | Reset preserves collection; switching resets idle Practice/Test state |

## Validation commands and baseline

- `npm run check`: baseline 0 errors and 0 warnings.
- `npm test`: baseline 28 files / 649 tests passed.
- Focus new unit tests with the existing Vitest runner, then run all unit tests
  because preference/history compatibility crosses all earlier phases.
- `npm run build`.
- `npm run test:e2e -- tests/user-keyboards.spec.ts` followed by affected
  storage, keyboard, language, practice and Stats integration selectors.
- No separate lint command exists. Do not add tooling or dependencies.

## M2-M4 execution and release gates

- P12-08: sourced the four presets from reviewed bundled profiles, adding the
  pinned Keyhive Sofle split source; preview/apply retains explicit confirmation.
- P12-09/10: per-board bindings score only supported output; version 6 command
  records are excluded from typing summaries, charts and attribution.
- P12-11: stable seeded selection uses the active board/language; exact sample
  and candidate thresholds return an explicit insufficient-data result.
- P12-12: the guide measures browser Space/Shift event timing and user-classified
  outcomes only; outcomes are not persisted and firmware terms are not inferred.
- P12-13/14: deterministic 60-second windows pause on blur/hidden state, ignore
  >30-second idle gaps, group <=5-minute runs, and require >=100 attempts in
  each window, >=5 desk sessions and >=3 days.
- P12-15 manual gates: test Alice/Arisu/75%/two-piece hardware and VIA/Vial
  firmware; verify OS function-key interception and real mod-tap behavior;
  review Vietnamese copy with a fluent speaker and perform screen-reader/
  keyboard accessibility review. Synthetic tests cannot close these.

## M1 verification results (2026-11-01)

| Check | Result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings |
| `npm test` | 29 files / 680 tests passed |
| `npm run build` | Passed; Vite warns about the main chunk exceeding 500 kB |
| New `user-keyboards.spec.ts` | 8 browser acceptance cases |
| Affected Chromium regression selection below | 128 passed, excluding 6 independently reproduced baseline failures |
| `git diff --check` | Passed |

The affected selection is:

```sh
npm run test:e2e -- user-keyboards.spec.ts storage.spec.ts keyboard-details.spec.ts keyboard-layout.spec.ts keyboard-test.spec.ts keyboard-access.spec.ts language.spec.ts alice-practice.spec.ts remaining-modes.spec.ts stats.spec.ts ui-layout.spec.ts --workers=4 --grep-invert "keeps the generic Alice test map|suggests an exact ID match|primary activation focuses typing|denied layout access never blocks typing|optional layout API missing|optional layout API throws"
```

An initial unfiltered run exposed two Phase 12 regressions: header height broke
the diagram's `<450px` desktop top-position gate, and an old history aggregation
test needed to explicitly select All keyboards under the new default isolation.
Both were corrected; the existing geometric threshold was preserved, not relaxed.

Six other failures were reproduced on an isolated untouched checkout of HEAD
`282817a`, then the temporary checkout was removed:

- `keyboard-details.spec.ts`: old expected test count 60 versus current 73.
- `keyboard-layout.spec.ts`: outdated "Confirmed by you" caption assertion.
- `storage.spec.ts`: four outdated onboarding layout-access text assertions
  (primary activation, denied access, missing API, throwing API).

These are not skipped in source or fixed as unrelated work. This is a focused
regression result, not a claim that the entire existing browser suite passes.
The final run used four workers: an eight-worker run concurrent with a build
hit Chromium `net::ERR_NO_BUFFER_SPACE` while loading the app. The trace showed
a resource-load failure, not a finger-guide assertion failure; the final
reduced-concurrency run passed all 128 selected tests without test changes.

### Acceptance evidence

- A01-A04, A11: preference/domain tests cover all prior schema versions,
  collection limits, inactive-board validation, identity uniqueness, deep-copy
  isolation, measurements, round-trip persistence and migration write failure.
- A05, A07, A13: Chromium restores different imports/B-hand on two boards sharing
  a catalog geometry; hotkey focus, running locks, test reset and default-reset
  collection preservation are verified.
- A06, A08: Chromium verifies confirmed deletion, last-board protection,
  immutable historical names, and failed-score retry after switching boards.
- A09-A10: unit filters and Chromium exercise active/all/unassigned/deleted
  scopes, exact miss counts, per-key attempts, and language filtering after
  board isolation. Earlier Stats chart/virtualization regressions pass.
- A12: typed message-catalog checks, Svelte accessibility diagnostics and
  Chromium cover en/vi labels, form focus/validation, localized measurements
  and 390px overflow. Existing 375px/desktop layout regressions pass.

Manual physical-board behavior, native reserved-hotkey handling, screen-reader
review and fluent Vietnamese review remain pending. No firmware visibility,
new geometry presets, adaptive drills, mod-tap calibration or fatigue analytics
are claimed at M1.

## M2-M4 implementation and verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed; 0 errors and 0 warnings |
| `npm test` | Passed; 36 files / 705 tests |
| `npm run build` | Passed; Vite reports the existing main chunk is above 500 kB |
| Focused Phase 12 and affected Chromium regression selection | 130 passed |
| `git diff --check` | Passed |

The browser selection includes `phase12-followups.spec.ts` and the affected
keyboard profile, storage/migration, layout, practice, Stats, language,
accessibility and responsive-layout suites. It excludes the six browser cases
previously reproduced on untouched HEAD `282817a`, as detailed in the M1
verification record above.

Automated acceptance now covers sourced preset family mappings, explicit
preview/apply, board layer-binding persistence and observable command-output
history; exact board/language adaptive thresholds and deterministic targets;
mod-tap browser timing/self-report boundaries; v8-to-v9 preferences and v6
history validation; completed active-time windows, pause/idle/group behavior;
custom-target difficulty fingerprints that store no plaintext/hash; and
setup-insight sample gates, deduplication and matched comparisons. M2-M4 code
and automated verification are integrated. P12-15 remains open for real-board
and firmware checks, OS key interception, screen-reader/accessibility review,
and fluent Vietnamese editorial review.
