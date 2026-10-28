# AliceType - Phase 9 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 9: Keyboard Test Modes - One key at a time and Freestyle |
| Status | Implemented and verified in automated unit/Chromium tests; manual screen-reader verification pending (see implementation plan) |
| Source design | [Technical Design Document](./tech-design.md), sections 4.5 and 5.4 |
| Preceding phase | [Phase 8 Detail Design](./phase-8-detail-design.md) |
| Existing Keyboard Test contracts | [Phase 6 Detail Design](./phase-6-detail-design.md) and [Phase 7 Detail Design](./phase-7-detail-design.md) sections 12 and 14.7 |
| Implementation plan | [Phase 9 Technical Implementation Plan](./phase-9-implementation-plan.md) |

## 2. Purpose and interpretation

Keyboard Test currently offers only one interaction: a guided sequence that expects every mapped physical key once, in a stable order. That is useful for a complete sweep but awkward for checking a single suspect switch, a chattering key, or a handful of keys in any order.

Phase 9 adds a second Keyboard Test mode and makes the mode explicit:

- **One key at a time** (mode ID `guided`) is the existing Phase 6 guided sequence. Its ordering, Expected key prompt, Mismatch feedback, progress, and completion are unchanged. The only behavior change is that each key's correct-press count number is no longer shown.
- **Freestyle** (mode ID `freestyle`) is new. The user presses any mapped key, in any order, as many times as they like. Each key shows how many times it has been pressed in the current run. There is no expected key, no wrong key, no Mismatch highlight, and no completion.

Both modes reuse the same test matrix visualizer, focused input region, input filtering, active layout resolution, and Test sound settings. Switching mode resets the test matrix.

### 2.1 Naming decision

The new mode is named **Freestyle**. It is short, is clearly the opposite of a guided sequence, and fits beside the existing **One key at a time** label without implying any scoring. Alternatives such as "Free test" (reads like "no cost"), "Free press", or "Any key" were rejected as ambiguous or awkward as a button label. The stable internal IDs are `guided` and `freestyle`; user-facing copy uses the labels **One key at a time** and **Freestyle**.

## 3. Scope

### 3.1 In scope

- A keyboard-operable Test mode selector in the Keyboard Test view with **One key at a time** and **Freestyle**.
- A pure Freestyle state transition that counts every eligible press of a countable physical code, without a limit or completion state.
- Per-key press counts displayed in Freestyle matrix cells and in the Text key results list.
- Freestyle progress showing how many countable keys were pressed at least once and the total number of counted presses.
- Hiding and disabling the Expected key prompt/marker/legend and Mismatch highlight/legend in Freestyle.
- Hiding the correct-press count number in One key at a time cells and Text key results.
- Resetting the test matrix, held keys, transient feedback, and pending test sound when the mode changes.
- Mode-aware instructions, status text, SVG description, legend, and accessible results.
- Unit and Chromium coverage for both modes, mode switching, and unchanged sound/layout behavior.

### 3.2 Out of scope

- Changing input filtering or the Phase 6 600 ms Mismatch timer in One key at a time.
- Persisting the selected test mode, counts, highlights, or any run data. No preferences schema change.
- Key-up timing, chatter or ghosting detection, rollover (NKRO) measurement, press-duration statistics, heat-map color scales, or export of test results.
- Testing dashed keys without a standard physical code or codes outside the selected layout.
- Changes to Practice, typing sound, Stats, session history, Keyboard Details, or layout matching.
- New frameworks, dependencies, global keyboard listeners, or permissions.

## 4. Technical decisions

| Concern | Phase 9 contract |
| --- | --- |
| Stack | Keep Svelte 5, TypeScript, existing styles, Vitest, and Playwright. No new dependency. |
| Mode model | Add `KeyboardTestMode = 'guided' \| 'freestyle'` and a discriminated `KeyboardTestState` union keyed by `mode`, so guided-only fields cannot exist in a Freestyle state. |
| State ownership | `KeyboardTestPanel` owns the selected mode and one state value. `keyboard-test.ts` stays pure: no DOM, audio, storage, or Svelte imports. |
| Countable keys | Both modes count every physical code in the active selected layout's `testSequence`, including Escape and function keys when present. Freestyle uses the sequence as a set; ordering is irrelevant. |
| Physical identity | Unchanged: `KeyboardEvent.code` only, never `KeyboardEvent.key` or legends. |
| Visualizer reuse | Keep one `AliceKeyboardVisualizer`; it derives guided or Freestyle presentation from `testState.mode`. No second matrix component or copied geometry. |
| Sound reuse | Keep the existing Test sound fieldset, `KeyboardTestSound`, preferences, preview, and failure handling unchanged and shared by both modes. |
| Mode persistence | Not persisted. Each mount of Keyboard Test starts in One key at a time, preserving the Phase 6 entry experience and avoiding a preferences migration. |
| Reset on switch | Selecting a different mode replaces the state with a fresh state for that mode. Selecting the already active mode is a no-op. |
| Default mode | `guided`. |

## 5. State model and transitions

### 5.1 Types

```ts
export type KeyboardTestMode = 'guided' | 'freestyle';

export type KeyboardTestState =
  | {
      readonly mode: 'guided';
      readonly expectedIndex: number;
      readonly correctCounts: Readonly<Partial<Record<string, number>>>;
    }
  | {
      readonly mode: 'freestyle';
      readonly pressCounts: Readonly<Partial<Record<string, number>>>;
      readonly totalPresses: number;
    };

export const KEYBOARD_TEST_MODES: readonly { readonly id: KeyboardTestMode; readonly label: string }[] = [
  { id: 'guided', label: 'One key at a time' },
  { id: 'freestyle', label: 'Freestyle' }
];
```

Guided `correctCounts` keeps its Phase 6 meaning (each value is 0 or 1 per run). Freestyle `pressCounts` is unbounded per code within JavaScript safe integers. `totalPresses` is the sum of `pressCounts` and is stored rather than recomputed per render.

### 5.2 Pure operations

| Function | Contract |
| --- | --- |
| `createKeyboardTest(mode = 'guided')` | Returns a fresh state for the mode: `{ mode: 'guided', expectedIndex: 0, correctCounts: {} }` or `{ mode: 'freestyle', pressCounts: {}, totalPresses: 0 }`. An unknown runtime mode throws an `Error`; it never silently falls back to guided. |
| `expectedTestKey(state, sequence)` | Guided: unchanged. Freestyle: always `undefined`. |
| `pressTestKey(state, code, sequence)` | Guided: unchanged Phase 6 behavior. Freestyle: if `code` belongs to `sequence`, returns a new state with that code's count and `totalPresses` incremented by 1; otherwise returns the same state object (identity signals "not counted"). |
| `testKeyCount(state, code)` | Returns the guided correct count or Freestyle press count for `code`, defaulting to 0. Used by the visualizer and results list instead of reaching into mode-specific fields. |
| `testedKeyCount(state, sequence)` | Number of sequence codes with a count above 0. Guided equals `expectedIndex`; Freestyle is the coverage value. |
| `classifyTestKey(event, captureTab)` | Same filtering as today, but the Tab decision takes an explicit boolean instead of an expected code. Guided passes `expected?.code === 'Tab'`; Freestyle passes `true`. |

Freestyle never completes. Pressing every countable key at least once changes only the status copy (section 6.4); input continues to count.

### 5.3 Panel event handling

The existing `keydown` pipeline is preserved: focused-region check, composition guard, `classifyTestKey`, held-code duplicate rejection, default prevention for Tab/Space/Backspace, mapped Escape, and mapped function keys, then a mode-specific step. Escape is tested when present in the selected layout; Shift+Tab remains an exit path.

| Step | One key at a time | Freestyle |
| --- | --- | --- |
| Completed run | Ignore input until restart (unchanged). | Not applicable. |
| Countable code | Expected code advances and counts once; other codes set the Mismatch error (unchanged). | Increment that code's count; never set `errorCode` or an error timer. |
| Code not countable (unknown, empty, outside layout) | Mismatch message (unchanged). | Do not count; show the neutral "not counted" status (section 6.4). No Mismatch highlight. |
| Test sound | One play per eligible press (unchanged). | One play per eligible press, counted or not, matching guided behavior for unexpected keys. |

Auto-repeat, held duplicate keydowns, composition, and Ctrl/Alt/Meta shortcut combinations remain ignored in both modes, so holding a key adds exactly one Freestyle press. A standalone modifier key counts when pressed alone; a Shift+letter press counts the letter (and the earlier Shift keydown) as today.

Tab in Freestyle: unmodified Tab is a countable key and is consumed (`preventDefault`) while the region is focused, because there is no expected key to decide when Tab should be released. Escape is counted when present in the selected layout; Shift+Tab always leaves so the region is never a keyboard trap.

### 5.4 Reset rules

A reset replaces the state with `createKeyboardTest(mode)` and also clears held codes, transient error/status feedback, the error timer, and pending or playing test sound (the existing `releaseFocus` work).

| Trigger | Behavior |
| --- | --- |
| **Restart test** | Resets the current mode and focuses the test region (unchanged). |
| Selecting a different mode | Resets the matrix to a fresh state for the new mode. Focus stays on the activated mode button. The status region announces "Switched to Freestyle. Test reset." or the equivalent for One key at a time. |
| Selecting the active mode | No-op; counts are kept. |
| Navigating away / layout change remount | Existing behavior: the panel unmounts and all run state is discarded. The next mount starts in One key at a time. |
| Window or region blur | Existing behavior: clears held codes, error feedback, and sound; keeps counts and the selected mode. |

Mode selection is never blocked by a run in progress and asks for no confirmation; counts are temporary diagnostics, and the reset is described next to the selector.

## 6. User interface

### 6.1 Mode selector

Add a **Test mode** group directly below the heading and before the instructions:

- Render a labeled group (`role="group"`, `aria-labelledby` pointing to a visible "Test mode" label) of native `<button type="button">` elements with `aria-pressed`, matching the existing `ModeNavigation` pattern for practice modes.
- Buttons in `KEYBOARD_TEST_MODES` order: **One key at a time**, **Freestyle**.
- Below the buttons, a short note: "Switching modes resets the test matrix."
- The existing eyebrow above the heading shows the active mode label instead of the fixed "One key at a time" text.
- Buttons wrap at narrow widths and use the existing selected-button accent style (`#FF5D00`) and focus outline.

### 6.2 Instructions

The `keyboard-test-instructions` paragraph (referenced by the region's `aria-describedby`) is mode-specific.

- **One key at a time:** "Focus the test area, then press and release each expected physical key. Match positions, not typed characters. Press Tab to leave (except when testing Tab) and Shift+Tab to go back or leave. Escape is testable on this layout when present; otherwise Escape leaves the test. Modified browser shortcuts are not captured. Some system keys may not reach the browser."
- **Freestyle:** "Focus the test area, then press any physical keys in any order, as often as you like. Each key shows how many times it was pressed. Match positions, not typed characters. Tab is counted here. Escape is counted when it is part of this layout; press Shift+Tab to leave. Modified browser shortcuts are not captured. Some system keys may not reach the browser."

### 6.3 Progress

| Element | One key at a time | Freestyle |
| --- | --- | --- |
| Text | "{n} of {total} keys tested" (unchanged) | "{n} of {total} keys pressed · {presses} total presses" with correct singular forms |
| `<progress>` | `value = expectedIndex`, `max = total` (unchanged) | `value = testedKeyCount`, `max = total` |
| Accessible name | "Keyboard test progress" | "Keyboard test progress" |

### 6.4 Status region

The polite, atomic status region stays in place for both modes.

- **One key at a time:** unchanged: optional Mismatch message, then "Expected: legend (code)", or the completion message.
- **Freestyle:** never shows "Expected" or "Unexpected" wording.
  - Before any key: "Press any key on the diagram."
  - After a counted press: "Last key: {legend} ({code}), pressed {count} {time|times}."
  - After an eligible press that is not countable: "Last key: {code or 'unknown physical code'} is not counted on this layout." The message persists until the next eligible press or a reset; it uses neutral text styling, not the error color.
  - When every countable key has a count of at least 1, append "Every mapped key has been pressed at least once." Input keeps counting.
  - After a mode switch: the switch announcement from section 5.4 until the next press.

### 6.5 Visualizer presentation

`AliceKeyboardVisualizer` receives the same props as today. The current `errorCode` prop stays optional; the panel never passes one in Freestyle, and the visualizer also ignores it when `testState.mode === 'freestyle'`.

| Aspect | One key at a time | Freestyle |
| --- | --- | --- |
| Caption title | "{label} test matrix" (unchanged) | "{label} test matrix" |
| Legend entries | Neutral, Expected key, Correct press, Mismatch (unchanged) | Neutral, Pressed (`+`). No Expected key or Mismatch entry. |
| `data-test-state` | `expected`, `unexpected`, `tested`, `untested`, `not tested` (unchanged) | `pressed`, `unpressed`, `not tested`. Never `expected` or `unexpected`. |
| `data-feedback` | Unchanged | `correct` when count > 0 (reuses the orange filled style), otherwise `neutral`. Never `incorrect`. |
| Marker | `>`, `+`, `!` (unchanged) | `+` on pressed keys only |
| Count text in cell (`.key-count`) | **Not rendered.** The key legend is vertically centered as in the Practice visualizer. | Rendered under the legend. Values above 999 display "999+"; the results list shows the exact count. |
| `data-count` attribute | Kept as a non-visual test hook with the correct count (0 or 1). | Exact press count. |
| SVG `<desc>` | Remove "Each cell shows its correct-press count." Keep the arrow/plus/exclamation description. | "Each countable cell shows how many times it was pressed in this run. A plus marks a pressed key. There is no expected key or mismatch feedback." |

Both spacebar keycaps and any keycaps sharing one physical code continue to show the same state and count. Inert (dashed) keys and codes outside `testSequence` remain neutral, unhighlighted, and uncounted in both modes.

### 6.6 Text key results

The `<details>` **Text key results** list remains below the diagram in both modes and lists the same keys in layout order.

- **One key at a time:** "{legend} ({code}): {state}" where state is `expected`, `tested`, `untested`, or `unexpected`. The "N correct" count is removed. Non-sequence and inert keys keep "not part of the guided test".
- **Freestyle:** "{legend} ({code}): {count} {press|presses}" for countable keys. Non-sequence keys and inert keys read "not counted in this test".

### 6.7 Unchanged shared controls

The **Test sound** fieldset, effect selector, preview rule, audio-failure alert, **Restart test** button, and the temporary-results note are shared by both modes and must behave exactly as in Phase 6. The temporary-results note becomes: "Counts and highlights are temporary and reset when you restart or switch modes. This test never changes practice scores or Stats."

## 7. Accessibility

- The mode selector is reachable by Tab, operable with Enter/Space, exposes the active mode through `aria-pressed`, and has a visible label; state is not conveyed by color alone.
- Mode switching keeps focus on the activated button so keyboard users are not moved unexpectedly; the status region announces the reset.
- Freestyle Tab capture is documented in the region's description, and Shift+Tab always leaves (WCAG 2.1.2 No Keyboard Trap). Escape is testable when present in the selected layout.
- Freestyle announcements are a single, atomic "Last key" sentence per press, replacing rather than queuing earlier text. Repeat and held-key events never announce.
- Count text in Freestyle cells keeps sufficient contrast on both neutral and orange-filled keycaps using the existing `.key-count` color rules.
- The responsive scrollable diagram, its keyboard scroll help, and reduced-motion behavior are unchanged.

## 8. Privacy, persistence, and errors

- No preferences schema change. Preferences remain schema v5; `keyboardTestSoundEnabled` and `keyboardTestSoundEffect` are the only persisted Keyboard Test values.
- Mode, counts, last key, and status text are memory-only and never written to `localStorage`, IndexedDB, Stats, URLs, logs, or the network.
- An unknown mode value reaching `createKeyboardTest` is a programming error and throws; the UI only offers the two defined IDs.
- Audio failures keep the existing typed error, accessible alert, and "sound off for this visit" behavior in both modes.

## 9. Component and module responsibilities

| Path | Change |
| --- | --- |
| `src/lib/keyboard/keyboard-test.ts` | Add `KeyboardTestMode`, `KEYBOARD_TEST_MODES`, the discriminated state union, Freestyle transitions, `testKeyCount`, `testedKeyCount`, and the explicit `captureTab` argument for `classifyTestKey`. |
| `src/lib/keyboard/keyboard-test.test.ts` | Cover Freestyle creation, repeated counting, non-sequence codes, total presses, coverage, mode isolation, unknown mode errors, and unchanged guided behavior. |
| `src/lib/components/KeyboardTestPanel.svelte` | Add the Test mode selector, mode state, reset-on-switch, mode-specific instructions/progress/status, Freestyle keydown branch, and Tab capture rule. Keep sound and focus lifecycle shared. |
| `src/lib/components/AliceKeyboardVisualizer.svelte` | Derive guided/Freestyle cell states, markers, legend, counts, description, and results from `testState.mode`. Hide guided count text. Practice (no `testState`) is unchanged. |
| `tests/keyboard-test.spec.ts` | Update guided assertions that expect visible counts or "N correct" results; add Freestyle and mode-switch scenarios. |
| `tests/keyboard-layout.spec.ts` | Confirm a confirmed imported layout works in Freestyle and every selected key code is countable. |
| `src/App.svelte`, preferences, audio, Practice, Stats | No change expected. |
| `README.md`, `doc/tech-design.md` | Describe the two modes once implemented. |

## 10. Implementation sequence

1. Extend the pure keyboard-test module and its unit tests; update existing callers to the discriminated state without behavior change.
2. Update the visualizer to branch on `testState.mode`, hide guided counts, and add Freestyle presentation and results text.
3. Add the panel mode selector, reset-on-switch, Freestyle event branch, and mode-specific copy.
4. Update and extend Chromium tests for both modes, switching, Tab/Escape behavior, sound, imported layouts, and Stats isolation.
5. Run `npm run check`, unit tests, the production build, and the Playwright suite; update README and the tech design status.

## 11. Verification and acceptance criteria

Phase 9 is complete when all of the following are true:

- Keyboard Test shows a labeled **Test mode** selector with **One key at a time** (selected by default on every mount) and **Freestyle**, operable by keyboard and pointer with correct `aria-pressed` state.
- **One key at a time** keeps the Phase 6/7 sequence, Expected key prompt and marker, Mismatch highlight and 600 ms expiry, progress, completion, and restart behavior, but no matrix cell renders a count number and Text key results contain no "correct" count.
- In **Freestyle**, any countable key can be pressed in any order; each eligible non-repeat press of the same key increments that key's displayed count, `data-count`, results entry, and the total press count.
- Freestyle never renders the Expected key prompt, `>` marker, Expected key or Mismatch legend entries, `expected`/`unexpected` test states, `incorrect` feedback, or error-colored status. Non-countable eligible presses are reported neutrally and are not counted.
- Freestyle has no completion state; covering every countable key is announced but counting continues.
- Switching to the other mode resets counts, highlights, progress, status, held keys, and pending sound; re-selecting the active mode keeps counts. **Restart test** resets only the active mode.
- Auto-repeat, held duplicates, composition, and modified shortcuts never count in either mode. Shift+Tab always leaves; Escape is testable when present in the selected layout; Freestyle counts and consumes unmodified Tab.
- Test sound, effect preview, persistence, and audio-failure handling behave identically in both modes and remain independent of practice sound.
- Generic Alice and confirmed imported layouts both work in both modes; shared-code keycaps show identical states and counts; inert and untested keys are never counted or highlighted.
- No test data or mode appears in preferences, IndexedDB, Stats, or network traffic. Preferences remain schema v5.
- Type checks, unit tests, production build, and Chromium tests pass with no Practice, Stats, Keyboard Details, or layout-matching regression.

## 12. Risks and implementation notes

- **Type migration:** Existing code reads `testState.correctCounts` directly. Route all reads through `testKeyCount` so Freestyle states cannot be misread as guided states.
- **Tab trap perception:** Consuming Tab in Freestyle is intentional so Tab can be tested. Keep the instruction copy and Shift+Tab exit covered by browser tests.
- **Announcement volume:** Fast Freestyle typing changes the status on every press. Keep the region atomic and short; do not add extra live regions or per-key announcements.
- **Large counts:** Cell text space is small. Cap only the visual text at "999+"; never cap the stored count or results text.
- **Regression in guided tests:** Existing Playwright assertions on `.key-count` text and "0 correct, expected" must change deliberately to the new guided contract, not be deleted.
- **Scope creep:** Chatter detection, timing, and persistence of mode are explicitly excluded; record them as future candidates rather than partial implementations.
