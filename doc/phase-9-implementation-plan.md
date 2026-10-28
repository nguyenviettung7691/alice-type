# AliceType Phase 9 Technical Implementation Plan

> **Status:** Implemented and verified in automated unit/Chromium tests. Browser visual smoke checks completed at 1280px and 360px; actual screen-reader verification remains pending. See [Verification results](#verification-results).

## Goal and design analysis

Implement [Phase 9 Detail Design](./phase-9-detail-design.md) on the existing Svelte 5/TypeScript application. Add an explicit Keyboard Test mode selector with **One key at a time** (`guided`) and **Freestyle** (`freestyle`), reset the matrix on mode change, and hide count numbers in One key at a time. Preserve the Phase 6 guided sequence, Phase 7 confirmed-layout integration, test sound behavior, and browser-only privacy.

The detail design is the implementation contract; the [Technical Design Document](./tech-design.md) is the product source of truth. This plan specifies execution order, affected surfaces, dependencies, and evidence needed for sign-off. It does not add key timing, chatter detection, mode persistence, exports, new dependencies, or Practice/Stats changes.

### Current implementation constraints

- `src/lib/keyboard/keyboard-test.ts` defines one non-discriminated `KeyboardTestState { expectedIndex, correctCounts }`. `pressTestKey` returns the same object for every non-expected code; callers use that identity to detect a mismatch.
- `classifyTestKey(event, expectedCode)` decides Tab handling from the expected code. Freestyle has no expected code, so this signature must change to an explicit `captureTab` boolean.
- `KeyboardTestPanel.svelte` owns `testState`, held codes, the 600 ms error timer, sound playback generation, focus lifecycle, and Restart. Its eyebrow is hard-coded to "One key at a time"; instructions, progress, and status are guided-only.
- `AliceKeyboardVisualizer.svelte` is shared by Practice (no `testState`), Keyboard Test, Keyboard Details, and layout previews. It reads `testState.correctCounts` directly in `testStatus`, `data-feedback`, `data-count`, `.key-count` text, and Text key results, and always renders the Expected key and Mismatch legend entries in test mode.
- `App.svelte` remounts `KeyboardTestPanel` via `{#key appliedLayout}` and supplies `testLayout`, `testSequence`, `inertKeys`, sound preferences, and callbacks. No App change is required: mode state is panel-local and not persisted.
- `tests/keyboard-test.spec.ts` asserts visible `.key-count` text (`['0', '0']`, `['1', '1']`) and the results text `0 correct, expected`. These encode the old guided contract and must be updated deliberately. `tests/keyboard-layout.spec.ts` asserts `not tested` state and `not part of the guided test`, which remain valid in guided mode.
- Unit tests in `keyboard-test.test.ts` read `.expectedIndex` and `.correctCounts` and pass expected codes to `classifyTestKey`.

Keep the ownership boundaries: pure transitions in `keyboard-test.ts`, run lifecycle in the panel, presentation in the visualizer.

## Resolved implementation contracts

1. **Naming:** IDs `guided` and `freestyle`; labels **One key at a time** and **Freestyle**, exported once as `KEYBOARD_TEST_MODES` and used by both UI and tests.
2. **Discriminated state:** guided `{ mode, expectedIndex, correctCounts }`; Freestyle `{ mode, pressCounts, totalPresses }`. All count reads go through `testKeyCount(state, code)`; coverage reads go through `testedKeyCount(state, sequence)`.
3. **Identity semantics:** `pressTestKey` returns the same state object when nothing is counted, in both modes. The panel interprets identity as "Mismatch" only in guided mode and as "not counted" in Freestyle.
4. **Countable set:** both modes count every code in the active selected layout's `testSequence`, including Escape and mapped function keys; inert keys and codes outside the layout are not counted.
5. **Input filtering:** repeat, held duplicates, composition, and modified shortcuts stay ignored in both modes. `classifyTestKey(event, captureTab, captureEscape)` receives explicit capture flags; Escape is counted when mapped and while a run is active, and Shift+Tab always leaves.
6. **Reset:** one panel helper, `resetRun(mode)`, performs the existing `releaseFocus` cleanup (held codes, error timer, sound) and replaces state with `createKeyboardTest(mode)`. Restart calls it with the current mode and focuses the region. Mode change calls it with the new mode, keeps focus on the mode button, and sets the switch announcement. Selecting the active mode is a no-op.
7. **Presentation:** guided hides `.key-count` text and the results "N correct" count but keeps `data-count`; Freestyle shows counts (`999+` visual cap), a Neutral/Pressed legend, `pressed`/`unpressed`/`not tested` states, never `expected`, `unexpected`, or `incorrect`.
8. **No persistence:** preferences stay at schema v5; no storage, history, or Stats change.

## Work packages and dependencies

| ID | Work package | Prerequisites | Primary outcome |
| --- | --- | --- | --- |
| P9-01 | Baseline and contract inventory | None | Known affected consumers and a reproducible baseline |
| P9-02 | Pure mode model and transitions | P9-01 | Discriminated state, Freestyle counting, explicit Tab capture, unit coverage |
| P9-03 | Visualizer mode presentation | P9-02 | Guided counts hidden; Freestyle states, legend, counts, description, results |
| P9-04 | Panel mode selector and run lifecycle | P9-02, P9-03 | Mode switching, reset, Freestyle input branch, mode-specific copy |
| P9-05 | Browser, accessibility, and regression verification | P9-03, P9-04 | Acceptance evidence for both modes and preserved features |
| P9-06 | Documentation and sign-off | P9-05 | README, tech design, and this plan reflect the implemented state |

P9-03 and P9-04 both consume the P9-02 types; land P9-03 first so the panel can be verified against the final visualizer output. Implement tests alongside each package and keep every intermediate commit type-safe.

## Execution steps

### P9-01. Establish the baseline and affected contracts

1. Inspect the worktree and preserve unrelated changes. Read the Phase 9 detail design and the Phase 6/7 Keyboard Test sections.
2. Inventory every consumer of `KeyboardTestState`, `createKeyboardTest`, `pressTestKey`, `expectedTestKey`, `classifyTestKey`, `correctCounts`, `.key-count`, `data-count`, `data-test-state`, and Text key results strings across `src/` and `tests/`.
3. Confirm that Practice, Keyboard Details, and layout preview call `AliceKeyboardVisualizer` without `testState`, so their output must remain byte-for-byte equivalent in behavior.
4. Run the baseline commands below. Record unrelated failures separately; do not repair them as Phase 9 work.

**Exit:** affected paths and baseline results are known; no behavior has changed.

### P9-02. Add the pure mode model and transitions

1. In `src/lib/keyboard/keyboard-test.ts`, add `KeyboardTestMode`, `KEYBOARD_TEST_MODES`, and the discriminated `KeyboardTestState` union from detail design section 5.1.
2. Change `createKeyboardTest(mode = 'guided')` to return the fresh state for each mode and throw an `Error` for an unknown runtime mode.
3. Keep guided `expectedTestKey`/`pressTestKey` behavior identical. Return `undefined` from `expectedTestKey` for Freestyle. In Freestyle, `pressTestKey` increments `pressCounts[code]` and `totalPresses` only when `code` is in the sequence; otherwise it returns the same object.
4. Add `testKeyCount(state, code)` and `testedKeyCount(state, sequence)`. Guided coverage equals `expectedIndex`; Freestyle coverage counts sequence codes with a positive count.
5. Change `classifyTestKey(event, captureTab: boolean)`: replace `expectedCode !== 'Tab'` with `!captureTab`. Keep every other filter unchanged.
6. Update `src/lib/keyboard/keyboard-test.test.ts`:
   - Existing guided tests: adapt to the union (`mode: 'guided'`) and the boolean Tab argument without weakening assertions.
   - Freestyle: fresh state; any sequence order; repeated presses of one code; shared `Space` counts once per press; `totalPresses` equals the sum; non-sequence, empty, `Unidentified`, and untested codes return the identical state; coverage reaches the sequence length without a completion concept.
   - Mode isolation: Freestyle states never expose `expectedIndex`; guided `testKeyCount` stays 0/1.
   - Unknown mode throws.
   - `classifyTestKey`: Tab with `captureTab` true is `press`; false is `ignore`; Shift+Tab is `ignore` for both; Escape remains `exit`.
7. Temporarily adapt panel and visualizer call sites only enough to type-check (guided behavior unchanged) so the build stays green before P9-03/P9-04.

**Exit:** `npm run test -- src\lib\keyboard` and `npm run check` pass; guided behavior is unchanged in the browser suite.

### P9-03. Implement visualizer mode presentation

1. In `AliceKeyboardVisualizer.svelte`, derive `freestyle = testState?.mode === 'freestyle'`. Ignore `errorCode` when `freestyle`.
2. Replace direct `correctCounts` reads with `testKeyCount`. Extend `testStatus`: Freestyle returns `pressed`, `unpressed`, or `not tested`; guided is unchanged.
3. `data-feedback` in Freestyle is `correct` for a positive count, otherwise `neutral`; never `incorrect`. `data-count` keeps the exact count in both modes.
4. Render `.key-count` text only in Freestyle, displaying `999+` above 999. In guided mode, do not render the count text and center the legend (drop the `- 5` vertical offset, matching the Practice visualizer).
5. Marker: Freestyle shows `+` only on pressed keys; guided keeps `>`, `+`, `!`.
6. Legend: guided keeps Neutral, Expected key, Correct press, Mismatch. Freestyle shows Neutral and Pressed (`+`). Keep the inert-key entry rule unchanged.
7. Replace the SVG `<desc>` test-mode copy with the per-mode text in detail design section 6.5; remove the guided "shows its correct-press count" sentence.
8. Text key results: guided `{legend} ({code}): {state}`; Freestyle `{legend} ({code}): {count} press|presses`; non-sequence and inert keys read "not part of the guided test" (guided) or "not counted in this test" (Freestyle).
9. Leave the no-`testState` branches (Practice, Keyboard Details, preview) untouched.

**Exit:** type check passes; guided Keyboard Test shows no count numbers; Practice/Details visualizer specs are unchanged.

### P9-04. Add the panel mode selector and run lifecycle

1. In `KeyboardTestPanel.svelte`, add `let mode = $state<KeyboardTestMode>('guided')` and initialize `testState` from it. Do not read or write preferences for the mode.
2. Add the **Test mode** group under the heading: visible label, `role="group"` with `aria-labelledby`, native buttons from `KEYBOARD_TEST_MODES` with `aria-pressed`, and the note "Switching modes resets the test matrix." Reuse the existing selected-button and focus styles from `ModeNavigation`/`AppHeader`; add only minimal wrapping styles.
3. Replace the fixed eyebrow with the active mode label.
4. Introduce `resetRun(nextMode)` (contract 6). Route **Restart test** through it. On mode button activation: return if unchanged; otherwise set `mode`, call `resetRun`, and set a `switchMessage` for the status region. Keep focus on the button.
5. Branch `keydown` after the shared filters:
   - Compute `captureTab = mode === 'freestyle' || expected?.code === 'Tab'` and pass it to `classifyTestKey`.
   - Guided: keep the existing completed guard, Mismatch error/timer, and advancement.
   - Freestyle: no completed guard; call `pressTestKey`; on a new state, set `lastKey` to the counted key; on identity, set a neutral not-counted message. Never set `errorCode` or the error timer. Clear `switchMessage` on the first eligible press.
   - Play the test sound once per eligible press in both modes.
6. Make instructions, progress text, `<progress>` value, and status content mode-specific per detail design sections 6.2-6.4, with singular/plural forms. Use the existing neutral status styling for Freestyle; do not use error color.
7. Update the temporary-results note to mention restart and mode switching.
8. Keep `releaseFocus`, window blur/focus handling, `onDestroy` audio cleanup, and Escape focus behavior unchanged.

**Exit:** both modes work manually in Chromium on the generic and a confirmed imported layout; type check passes.

### P9-05. Verify browser behavior, accessibility, and regressions

Update `tests/keyboard-test.spec.ts`:

1. Guided regressions: replace `.key-count` text assertions with `toHaveCount(0)` and keep `data-count` assertions; change the first results item to `` ` (Backquote): expected ``; keep sequence, mismatch, expiry, completion, restart, repeat/shortcut/composition, Tab/Escape, sound, and Stats isolation tests.
2. Selector: default **One key at a time** has `aria-pressed="true"` on every mount (including after navigating away and back); both buttons are reachable by Tab and operable with Enter/Space.
3. Freestyle counting: any order; pressing `KeyA` three times shows `3` in the cell and `data-count="3"`, results `3 presses`, and the progress/total text; Space shows identical counts on both keycaps; holding a key (repeat events and duplicate keydown without keyup) counts once.
4. Freestyle feedback: no Expected key/Mismatch legend entries, no `>` or `!` markers, no `expected`/`unexpected`/`incorrect` attributes, and no "Expected"/"Unexpected" status text after counted, unknown, empty, and untested codes; the not-counted message is neutral.
5. Coverage: pressing every sequence key once announces full coverage and further presses still count.
6. Mode switching: counts, highlights, progress, and status reset in both directions; focus stays on the mode button; re-selecting the active mode keeps counts; Restart in Freestyle resets Freestyle only.
7. Tab/exit: Freestyle counts and prevents default for unmodified Tab; Shift+Tab leaves; Escape focuses **Focus keyboard test**.
8. Sound: with the audio spy, each eligible Freestyle press plays once; repeat/shortcut presses do not; switching modes stops pending playback; preferences still persist across reload.
9. Privacy: after Freestyle presses, `localStorage` preferences are unchanged apart from sound settings, history is empty, and Stats shows no new session.

Update `tests/keyboard-layout.spec.ts` with one Freestyle check on a confirmed imported layout: Escape/untested codes and inert keys stay uncounted; shared-code keycaps show the same count.

Run an accessibility-tree snapshot of both modes to confirm the group label, `aria-pressed`, region description, and single atomic status. Run a narrow-viewport visual check to confirm the selector wraps and `999+`/count text stays legible on neutral and orange keycaps.

**Exit:** targeted and full gates below pass; evidence is recorded.

### P9-06. Update documentation and sign off

1. Update the README Keyboard Test section to describe both modes, Freestyle Tab behavior, reset on switch, and hidden guided counts. Update the README phase summary.
2. Change the Phase 9 roadmap entry, section 4.5, and section 5.4 notes in `tech-design.md` from planned to implemented.
3. Set the detail design status to implemented and link this plan; record verification results, manual checks, and remaining limits in this plan.

**Exit:** implementation, automated evidence, and user-facing documentation agree.

## Verification commands

Use the existing package scripts; no lint script is configured. Do not install dependencies unless a command reports missing packages.

### Baseline and targeted iterations

```powershell
npm run test -- src\lib\keyboard\keyboard-test.test.ts
npm run check
npm run test:e2e -- 'tests[\\/](keyboard-test|keyboard-layout|visualizer)\.spec\.ts'
```

Playwright arguments are regular-expression filters; the separator class matches Windows and normalized paths. The configuration runs Chromium on a strict-port server at 4175; do not start another server on that port or claim other-browser coverage.

### Final implementation gate

```powershell
npm run test
npm run test:e2e
npm run check
npm run build
git --no-pager diff --check
```

## Acceptance evidence matrix

| Requirement | Required evidence | Owner package |
| --- | --- | --- |
| Mode selector, default, and naming | Browser selector tests; accessibility-tree snapshot | P9-04, P9-05 |
| Guided sequence unchanged | Existing unit/browser sequence, mismatch, completion, restart, filtering tests | P9-02, P9-05 |
| Guided counts hidden | No `.key-count` in guided cells; results without "correct" counts; `data-count` retained | P9-03, P9-05 |
| Freestyle any order and repeat counts | Unit transitions; browser counts in cell, attribute, results, progress | P9-02, P9-03, P9-05 |
| Expected/Mismatch hidden and disabled in Freestyle | No legend entries, markers, states, feedback, or status wording | P9-03, P9-04, P9-05 |
| Reset on mode switch | Browser reset both directions; no-op on active mode; sound stopped | P9-04, P9-05 |
| Shared visualizer and sound | Same component and fieldset in both modes; audio-spy and persistence tests | P9-03, P9-04, P9-05 |
| Layout integration | Generic and confirmed imported layout in Freestyle; inert/untested keys uncounted | P9-05 |
| No keyboard trap | Freestyle Tab counted; Shift+Tab and Escape leave | P9-02, P9-05 |
| No persistence or Stats impact | Preferences v5 unchanged except sound; empty history and Stats | P9-05 |
| No regressions | Full unit, Chromium, type check, and build gates | P9-05 |

## Completion checklist

- [x] P9-01 baseline and affected-surface inventory complete.
- [x] P9-02 discriminated state, Freestyle transitions, and Tab capture verified by unit tests.
- [x] P9-03 visualizer guided/Freestyle presentation verified; Practice and Details visualizers unchanged.
- [x] P9-04 selector, reset-on-switch, Freestyle input branch, and mode-specific copy implemented.
- [x] P9-05 browser, accessibility, layout, sound, privacy, and regression checks pass; screen-reader check remains below.
- [x] P9-06 README, tech design, detail design status, and verification results updated.
- [ ] Manual verification with an actual screen reader.

## Verification results

### Automated results (2026-10-27)

| Gate | Result |
| --- | --- |
| Baseline before changes | `npm run test` 468 passed; targeted Keyboard Test/layout/visualizer Chromium specs 37 passed |
| `npm run test` | 16 files, 473 tests passed (keyboard-test unit suite adds mode, Freestyle, coverage, and explicit Tab-capture cases) |
| `npm run check` | 0 errors, 0 warnings |
| `npm run build` | Succeeded |
| `npm run test:e2e` | 130 passed (Chromium), including six new Freestyle scenarios and a Freestyle pass on a confirmed Keychron Q8 ANSI layout |
| `git --no-pager diff --check` | Clean |

Freestyle browser coverage: keyboard-operable labelled selector and default-on-mount; any-order and repeated counts in cells, `data-count`, results, and progress; no Expected/Mismatch legend, markers, states, or wording; neutral not-counted status for unknown/unmapped codes; repeat, held-duplicate, and shortcut filtering; full-coverage announcement without completion; reset in both switch directions and no-op reselect; counted Tab with Shift+Tab/Escape exits; one sound per eligible press; preferences remain v5 without mode or counts; `999+` cell cap with exact results; empty history. Guided regressions now assert no `.key-count` text and results without "correct" counts while retaining `data-count`.

### Manual checks and remaining limits

- Visual smoke screenshots of both modes at 1280px and 360px confirmed selector wrapping, legend changes, readable counts on neutral and orange keycaps, and hidden guided counts.
- The switch announcement persists until the next eligible press or reset; in One key at a time it precedes the Expected prompt.
- Actual screen-reader verification (announcement volume during fast Freestyle input) is pending.
- Chromium is the only configured browser project; no other-browser coverage is claimed.
