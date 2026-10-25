# AliceType — Phase 3 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 3: The Alice Visualizer |
| Status | Implemented |
| Source design | [Technical Design Document](./tech-design.md) |
| Preceding phase | [Phase 2 Detail Design](./phase-2-detail-design.md) |
| Implementation plan | [Phase 3 Implementation Plan](./phase-3-implementation-plan.md) |

## 2. Purpose

This document defines the detailed design and acceptance criteria for adding a visual representation of a generic Alice split keyboard to the existing typing practice view. As the user types, the physical key associated with each accepted printable keystroke briefly illuminates: the accent state indicates a character that matches the current target position, and the error state indicates a mismatch.

The visualizer is feedback for the existing Phase 2 exercise, not another input or scoring system. Phase 2 remains authoritative for focus, accepted input, character comparison, timing, accuracy, completion, and restart behavior.

## 3. Phase 3 scope

### 3.1 In scope

- A responsive, inline SVG rendering of a generic Alice split-keyboard layout.
- A data-driven map from supported physical `KeyboardEvent.code` values to SVG keycaps and generic US ANSI legends.
- Transient visual feedback for accepted printable keystrokes, based on the result of the existing Phase 2 character comparison.
- Integration with the focused practice input, including cleanup of transient feedback on blur, completion, restart, and component teardown.
- Visual and assistive-technology descriptions of the visualizer and its correct/mismatch states.
- Focused tests for key mapping, feedback state, and integration with the typing input.

### 3.2 Out of scope

- Changes to the typing target, exercise generation, typing-engine metric formulas, or Phase 2 correction/completion rules.
- Additional modes, timed or word-count progress, difficulty, missed-key aggregation, or historical statistics.
- A keyboard permission overlay, global keyboard listener, browser shortcut interception, or required `navigator.keyboard.getLayoutMap()` support.
- Automatic device or operating-system keyboard-layout identification, device details, a sourced device catalog, or multiple selectable physical keyboard profiles.
- The guided Keyboard Keys Test Matrix, per-key test counts, audio, sound settings, or persisted data.
- Backend services, network requests, localStorage, IndexedDB, and external SVG/image assets.

The Phase 3 visualizer uses a generic Alice layout and does not claim to depict a particular manufacturer, model, or user's hardware.

## 4. Technical decisions

| Concern | Phase 3 decision |
| --- | --- |
| Framework and language | Continue using Svelte 5 and TypeScript. |
| Rendering | Render keycaps as inline SVG elements from a typed, static layout definition. |
| Physical key identity | Use `KeyboardEvent.code` to select a physical keycap. Use the existing `KeyboardEvent.key`-based Phase 2 result to determine whether the typed character matched the target. |
| Layout and legends | Use a generic Alice split arrangement with standard US ANSI legends. Do not claim automatic detection of hardware or the user's operating-system layout. |
| Input lifecycle | Continue to process input only on the focused practice input. No document- or window-level keyboard listeners. |
| Feedback | Correct printable input briefly highlights its physical key in the accent color; a mismatch briefly marks the physically pressed key as an error. Feedback is temporary, not a count or score. |
| State and persistence | Keep feedback component-local and ephemeral. Do not persist key presses or add an app-wide store. |
| Dependencies | Use native SVG and existing Svelte/CSS capabilities; do not add a visualization or keyboard-layout dependency. |

`KeyboardEvent.code` identifies a physical key position; it does not identify the keyboard's manufacturer or guarantee that the printed legend matches the active operating-system layout. Character correctness continues to use the character accepted by the Phase 2 typing engine. If a pressed code is not in the generic layout map, the text exercise continues normally and no keycap is highlighted.

## 5. Layout and key mapping

### 5.1 Generic Alice layout

Render a recognizable split-keyboard arrangement: left- and right-hand key groups separated by a central gap, staggered character rows, and split thumb-key groups. The SVG is an explanatory generic profile, not a dimensionally accurate rendering of a named product.

Include keycaps for the common US ANSI physical keys used by the fixed Phase 2 exercise, including letters, digits, space, punctuation, and the relevant editing/modifier keys. Keys that do not have a mapped physical code may be omitted rather than assigned an invented identity. The map must include every physical code needed by the fixed practice text; it may include additional standard keys to make the keyboard shape legible.

Use stable SVG `viewBox` coordinates and explicit keycap positions and sizes. Do not infer positions from string order or derive geometry from browser-detected device information.

### 5.2 Layout definition

Represent each visual key as typed static data with:

- A physical `KeyboardEvent.code` that also serves as the unique logical key identifier.
- Its generic display legend.
- One or more keycap shapes, each with a half, SVG position, and dimensions.
- Optional presentation metadata only when required to render a keycap (for example, a wider space key).

Validate that logical physical codes in the rendered profile are unique. Both drawn spacebars belong to the same logical `Space` entry and illuminate together: browser events cannot distinguish which thumb spacebar generated that code. This is not a claim about a device's firmware mapping. A layout entry without a physical code is decorative and cannot receive live feedback. Do not use `KeyboardEvent.key` as the SVG lookup key: it varies with modifiers and keyboard layout.

The fixed Phase 2 exercise contains printable ASCII characters. Only printable actions accepted by the Phase 2 input filter produce correct/mismatch feedback. The accepted action's comparison result is determined against the target character at the current input position before applying the action. Backspace remains functional as specified in Phase 2 but does not count as a correct or missed printable character; modifier and ignored keys do not produce correctness feedback.

## 6. Input and feedback behavior

### 6.1 Event flow

1. The focused practice input receives `keydown`, as defined in the Phase 2 detail design.
2. The existing input filter rejects modified shortcuts, composition, keydown auto-repeat, and unsupported keys. If the session is completed, the practice component returns without changing typing state or producing visual feedback.
3. For an accepted printable character in a non-completed session, the practice component captures `event.code`, determines the character's match result using the pre-action session state, and applies the existing typing-engine action.
4. If `event.code` exists in the generic Alice map, add temporary feedback for that key: accent/correct for a match, error/mismatch otherwise.
5. If the code is absent or unmapped, omit the visual feedback without changing or rejecting the typing action.

Visual feedback must not cause a second comparison against a different target position, alter the input buffer, increment attempts, change WPM or accuracy, or affect session completion.

### 6.2 Feedback lifecycle

- Keep each key's feedback visible for approximately 300 ms after an accepted printable keydown, then return it to its neutral appearance.
- Multiple recently pressed keys may remain highlighted independently until their own feedback expires.
- A later accepted press of the same physical key replaces that key's previous feedback and expiration.
- Ignore auto-repeat consistently with Phase 2; repeated keydown events do not extend feedback or change typing state.
- Clear pending feedback and its timers when the input loses focus, the session completes, the user restarts, or the component is destroyed.
- Completion takes precedence over feedback: the final accepted character clears all highlights immediately rather than starting a new flash.
- Do not keep a cumulative hit count, missed-key count, or history in this phase.

## 7. UI and rendering

### 7.1 Placement and appearance

- Place the visualizer within the practice panel below the target text and before the practice controls, so it is visibly associated with the active exercise.
- Keep the visualizer subordinate to the target text and performance metrics; it must not obscure the text or change the Phase 2 panel's session flow.
- Use the existing charcoal/orange/error theme tokens. Neutral keycaps must remain distinguishable from the panel surface.
- Provide a concise legend identifying the neutral, correct-press, and mismatch states. Do not rely on color alone: use a distinct outline or small check/error marker for feedback states.
- Keep the SVG free of blinking or continuous animation. A brief color/state transition is acceptable if reduced-motion preferences are respected.

### 7.2 Responsive behavior

- Scale the SVG within its available container while preserving its aspect ratio.
- At narrow widths, keep the page free of horizontal overflow. If the keycaps cannot remain legible at the available width, allow scrolling within the visualizer region rather than forcing the full page to scroll horizontally.
- Keep the SVG at least 640 CSS pixels wide for readable legends. Make its named scroll region keyboard-focusable only while it overflows; show arrow-key scrolling instructions and disconnect its resize observer on teardown.
- Preserve clear key legends and visual separation between the two halves at supported viewport widths.

### 7.3 Accessibility

- Give the visualizer a concise accessible name and description that explain it shows the physical key associated with recent accepted typing and that feedback is temporary.
- Treat decorative SVG shapes and individual keycaps as non-interactive; do not create fake buttons or keyboard-focus stops for them.
- Do not announce every key highlight through a live region. The exercise text and Phase 2 status remain the accessible source for typing and session feedback.
- Ensure the visual difference between correct and mismatched feedback is not color-only.
- Preserve existing landmarks, heading structure, input instructions, visible focus state, and keyboard navigation.

## 8. Component and module responsibilities

| Path | Responsibility |
| --- | --- |
| `src/lib/keyboard/alice-layout.ts` | Typed, static key definitions and generic Alice SVG geometry for the supported physical codes. |
| `src/lib/components/AliceKeyboardVisualizer.svelte` | Render the supplied layout and temporary per-key feedback as an accessible, responsive inline SVG. No keyboard listener, typing-engine logic, or persistence. |
| `src/lib/components/PracticePanel.svelte` | Capture `event.code` alongside the existing accepted input action, determine correctness from Phase 2 state, supply transient feedback to the visualizer, and clean up its feedback timers. |
| `src/lib/typing/typing-engine.ts` | Retain Phase 2 session and metric behavior; do not add layout, SVG, or visualizer state to the pure engine. |
| `src/app.css` and/or component styles | Add only the visualizer layout, keycap states, legend, and responsive styling needed beyond existing theme tokens. |
| `src/lib/keyboard/alice-layout.test.ts` and existing practice tests | Verify unique/complete mappings and user-visible visualizer behavior using repository test conventions. |

Keep the layout data separate from SVG presentation and keep the typing engine DOM-free. Do not introduce a generic keyboard service or application-wide event bus for this single practice view.

## 9. Implementation sequence

1. Define the generic Alice layout data and confirm every character in the fixed Phase 2 exercise can be associated with a physical code.
2. Add the typed inline SVG visualizer with neutral keycaps, generic legends, accessible description, and responsive sizing.
3. Extend the existing focused input path to pass physical key codes and Phase 2 comparison outcomes to the visualizer without changing engine semantics.
4. Implement independent transient key states and timer cleanup for expiry, blur, completion, restart, and teardown.
5. Add focused unit and browser coverage for mapped and unmapped keys, correct/mismatched input, ignored input, and lifecycle cleanup.
6. Run the existing type checks, tests, and production build; inspect desktop and narrow viewport behavior and keyboard accessibility.

Do not implement Phase 4 exercise generation or modes, Phase 5 persistence or permissions, Phase 6 keyboard testing, or Phase 7 device details as part of this sequence.

## 10. Verification and acceptance criteria

Phase 3 is complete when all of the following are true:

- A generic Alice split-keyboard SVG is present in the practice panel and remains legible and responsive without causing page-level horizontal overflow.
- Every physical code required by the fixed exercise maps to exactly one logical entry; only `Space` has two drawn keycaps. Displayed legends are identified as generic US ANSI rather than detected hardware information.
- A correctly typed printable character briefly highlights its physical key in the correct state; a mismatch briefly marks the physical key pressed in the error state.
- Correctness is determined by the same target comparison and input position as Phase 2; the visualizer never changes typed characters, attempts, accuracy, WPM, completion, or restart behavior.
- Unmapped codes do not prevent valid typing and do not create a misleading key highlight.
- Modifier combinations, composition, auto-repeat, ignored keys, and browser shortcuts do not create incorrect feedback or interfere with existing Phase 2 input behavior.
- Backspace behavior and all Phase 2 focus, correction, completion, and restart rules remain unchanged.
- Feedback expires, can coexist for different keys, and is cleared with all timers on blur, completion, restart, and component teardown.
- The visualizer is named and described to assistive technology, does not add per-key focus stops or rapid live announcements, and does not rely on color alone.
- No permission prompt, global listener, automatic hardware identification, sound, persistent key counts, new mode, or backend request is introduced.
- Configured Svelte/TypeScript checks, focused tests, and the production build pass.

## 11. Risks and implementation notes

- **Physical position versus typed character:** Use `KeyboardEvent.code` only for visual position and the Phase 2 `KeyboardEvent.key` comparison for correctness. Do not substitute one for the other.
- **Layout variation:** Alice keyboards differ in key count and thumb clusters. The generic map is explicitly illustrative; a specific device profile belongs to the later device-details phase.
- **Non-US legends:** The generic US ANSI legends may not match a user's active operating-system layout. Do not claim the browser detected the user's legends; correct text entry must still work even when its physical code has no visual mapping.
- **Feedback timers:** Replace per-key timers safely and clear every outstanding timer on all lifecycle exits so stale callbacks cannot restore feedback after restart or teardown.
- **Scope boundary:** Temporary per-press feedback is not missed-key analytics. Aggregation and persistence remain later-phase work.
