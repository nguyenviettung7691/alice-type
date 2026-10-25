# AliceType — Phase 2 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 2: Core Typing Engine |
| Status | Implemented |
| Source design | [Technical Design Document](./tech-design.md) |
| Preceding phase | [Phase 1 Detail Design](./phase-1-detail-design.md) |
| Implementation plan | [Phase 2 Implementation Plan](./phase-2-implementation-plan.md) |

## 2. Purpose

This document defines the detailed design and acceptance criteria for adding a working, single-exercise typing session to the Phase 1 AliceType shell. It covers focused keyboard input, per-character feedback, session state, live WPM and accuracy, and restarting an exercise.

Phase 2 establishes the reusable typing-engine behavior. It does not implement the exercise generator, configurable modes, Alice keyboard visualizer, persistence, or keyboard-device features assigned to later phases.

## 3. Phase 2 scope

### 3.1 In scope

- Capture typing input through a focusable, visually hidden text input associated with the practice panel.
- Start a session on the first supported character, render typed characters as correct or incorrect, and allow backspace correction.
- Display the current target character and visual states for typed, incorrect, and remaining characters.
- Calculate and refresh WPM and accuracy during a session, then retain final values after completion.
- Complete a session when the fixed exercise text has been entered and provide a working restart control.
- Keep keyboard handling scoped to the focused practice input and clean up timers and listeners with the component lifecycle.
- Provide unit-level coverage for engine transitions, input filtering, and metric edge cases.

### 3.2 Out of scope

- Random or configurable exercise generation, word banks, punctuation/number modifiers, custom text, or quotes.
- Timed, word-count, Quote, Custom, Zen, Expert, or Master modes and their settings.
- A progress bar that represents session progress, timed sessions, or word completion.
- The Alice keyboard visualizer, physical-key identification, missed-key statistics, and keyboard test matrix.
- Keyboard permission requests, `navigator.keyboard.getLayoutMap()`, hardware identification, or device details.
- Sound, settings, localStorage, IndexedDB, historical statistics, and backend services.
- A global document-level keyboard listener, shortcuts that intercept browser/system commands, or broad suppression of default browser behavior.

The header's future modes and settings remain non-functional placeholders. The existing practice panel's static placeholder content is replaced only as needed to expose this single working exercise.

## 4. Technical decisions

| Concern | Phase 2 decision |
| --- | --- |
| Framework and language | Continue using Svelte 5 and TypeScript. |
| Input | A focusable, visually hidden text input owns keyboard focus. The practice text area can focus it; no permission prompt or global listener is used. |
| Exercise source | One fixed, local exercise string. Keep the engine independent of how later phases generate or select exercises. |
| Engine | Pure, typed functions for session transitions and metric calculations; the Svelte practice component owns presentation and the active session instance. |
| Session state | Component-local state; do not add an app-wide store for the single Phase 2 practice view. |
| Timing | Use a monotonic clock (`performance.now()`) for elapsed time. Refresh displayed metrics periodically while running and clear the refresh timer on completion, restart, or teardown. |
| Persistence | None. Session data is discarded on reload or when restarted. |
| Styling | Reuse the established charcoal/orange theme and reserved error color. Preserve visible focus and readable non-color cues. |

Do not introduce a new state-management, input, or persistence dependency for this phase.

## 5. Exercise and input behavior

### 5.1 Fixed exercise

Use the existing sample as the single target string:

> Slow down, take a breath, and let steady hands find their way across the keys.

The target includes its spaces and final period. Keep the string in one named constant so the engine and renderer use exactly the same source. Do not alter or randomize it during a session. A later exercise provider can supply another target without changing character comparison or metric rules.

### 5.2 Focus and input lifecycle

- The practice text area and a clearly named, keyboard-operable “Start typing” affordance focus the visually hidden input.
- Do not automatically seize focus on page load. Moving focus away from the input stops typing capture; returning focus allows the user to continue the same session.
- Elapsed time continues while focus is away; there is no pause/resume timing mode in this phase.
- Handle keyboard events only on the focused input. Do not attach a document/window-level key listener.
- Process a single printable character from `KeyboardEvent.key`, including space. Ignore modifier combinations (`Ctrl`, `Alt`, or `Meta`), composition events, keydown auto-repeat, and non-character keys other than Backspace.
- Do not intercept Tab, Escape, browser shortcuts, or unrelated keys. Prevent the input's default edit only for character and Backspace events that the engine handles, so the DOM input value cannot diverge from engine state.
- Backspace removes the most recently entered character while the session is running. It does nothing when the input buffer is empty. It does not decrement the cumulative attempt counters used for accuracy.
- Ignore character and Backspace input after completion until the user restarts.
- If the input is unfocused, the browser retains normal keyboard behavior.

The initial implementation targets printable ASCII desktop keyboard text entry, including uppercase letters and shifted punctuation. Empty or unsupported target text is rejected explicitly by the engine. Composition/IME input, paste, drop, and other native edits do not change the session buffer; the hidden input's native value remains empty. Unsupported keys and repeat do not count as attempts.

### 5.3 Character comparison and correction

Maintain an input buffer with at most one entered character per target position. For each supported character:

1. Compare it with the target character at the current buffer length.
2. Add the input character to the buffer whether or not it matches, allowing the user to continue and see the error in context.
3. Increment total attempts. Increment correct attempts only for a match.
4. Mark the new position correct or incorrect and advance the active position by one.

Backspace removes the last buffer entry, including its visible correct/error state, and moves the active position back. Attempts and correctness history are cumulative: deleting a typo does not erase the original incorrect attempt. A subsequent corrected character is a new attempt.

The session completes when the buffer length reaches the target length. A session may therefore finish with visible incorrect characters; the engine does not silently require a perfect result or skip characters. Restart clears the buffer and all session counters.

## 6. Session and metric model

### 6.1 Session states

| State | Entry condition | Behavior |
| --- | --- | --- |
| `ready` | Initial load or after restart | Render the target and active first position. Show neutral metric placeholders. No timer is running. |
| `running` | First supported character is accepted | Record start time, process input and corrections, and refresh live metrics. |
| `completed` | Input buffer reaches target length | Record end time, freeze the final metrics, and ignore further typing until restart. |

The first supported character starts the clock, including an incorrect character. Merely focusing the input does not start the clock. Restart returns to `ready`, restores the same target text, resets all counts and metrics, and leaves the input focused if it was focused before the action. Activating the Restart button leaves focus on that button; Start typing is available to re-enter the input.

### 6.2 Data model

The engine's session model should contain only data needed for deterministic behavior and display:

| Field | Meaning |
| --- | --- |
| `target` | Immutable exercise text for this session. |
| `input` | Entered characters, including any current errors. |
| `status` | `ready`, `running`, or `completed`. |
| `startedAt` | Monotonic timestamp for the first accepted character; unset in `ready`. |
| `endedAt` | Monotonic completion timestamp; unset until completion. |
| `totalAttempts` | Number of accepted printable character attempts, including attempts later deleted with Backspace. |
| `correctAttempts` | Number of accepted character attempts that matched their target position, including correct attempts later deleted. |

Do not store derived values such as elapsed time, WPM, or accuracy as independent mutable state. Derive them from the timestamps and counters to avoid inconsistent values.

### 6.3 WPM

Follow the Technical Design Document formula:

`WPM = (correct characters / 5) / elapsed time in minutes`

For this phase, “correct characters” means the number of currently buffered characters that match their target positions. Replacing a character through Backspace removes it from this WPM numerator; a character that is still wrong contributes zero. This keeps displayed speed tied to the currently correct text rather than counting repeated correction attempts as completed text.

Use elapsed time from the first accepted character to the current time while running, and to `endedAt` when completed. Display zero WPM when elapsed time is zero; never divide by zero. Show a rounded, non-negative whole-number WPM value. Before the first accepted character, show a neutral placeholder rather than a calculated score.

### 6.4 Accuracy

Follow the Technical Design Document formula:

`Accuracy = (correct attempts / total attempts) * 100`

Only printable character attempts contribute. Backspace and ignored keys do not contribute. Deleted mistakes remain in the denominator, and deleted correct attempts remain in both counters, because accuracy measures the user's accepted typing attempts over the session. If there have been no attempts, show a neutral placeholder. Otherwise show a percentage rounded to one decimal place and bounded to 0–100%.

### 6.5 Live refresh

Recalculate elapsed time and WPM approximately every 100 ms while the session is running. Accuracy changes immediately when a printable character is accepted. Input and Backspace also update character-state rendering immediately. Use the monotonic timestamps rather than counting timer ticks, so timer throttling does not distort elapsed time. Stop and clear the refresh timer on completion, restart, and component teardown.

## 7. UI and rendering

### 7.1 Practice text

- Render the exercise as individual character spans or an equivalent accessible structure.
- Display target characters rather than replacing them with mistyped characters, so the intended exercise remains readable.
- Render entered matching characters with a correct state, entered mismatches with an error state, the next target position with an active state, and remaining positions with the neutral state.
- Make spaces visible enough to understand typing position without changing their accessible text. Do not use color as the sole distinction: combine error color with an underline or another non-color cue, and provide a visible caret/active marker.
- Keep the full exercise available as normal text to assistive technology; do not announce every character update as a live region.
- Indicate completion in a concise status message outside the character-by-character text.

### 7.2 Metrics and controls

- Replace the WPM and Accuracy placeholders with live values during a session and final values after completion.
- Keep values visually stable with tabular numerals. Expose metric names and units in accessible text.
- Enable the Restart button and give it a descriptive accessible name. It resets the current fixed exercise; it does not select a new exercise.
- Show concise guidance when ready (for example, “Select the text or Start typing to begin”) and a completion status when done.
- Do not present the static progress track as live progress in this phase. Retain it only as an inactive decorative track or remove it if it would imply an implemented progress calculation.

Use the current background, surface, text, muted, accent, error, and focus tokens. Avoid adding animation that distracts from text or typing feedback.

## 8. Component and module responsibilities

| Path | Responsibility |
| --- | --- |
| `src/lib/typing/typing-engine.ts` | Typed session state, pure character/backspace/restart transitions, and metric calculations. No DOM access, timer, or Svelte dependency. |
| `src/lib/components/PracticePanel.svelte` | Fixed target presentation, hidden input/focus behavior, scoped keyboard handling, periodic metric refresh, status, and restart control. Own and dispose its timer. |
| `src/app.css` | Any global focus or character-state styling required beyond existing theme utilities. Prefer component-scoped styling where practical. |
| `src/lib/typing/typing-engine.test.ts` (or repository-standard test location) | Unit tests for engine behavior and metric boundaries if a test runner is present or added as part of implementation. |
| `tests/practice.spec.ts`, `tests/fixtures/practice.html`, `playwright.config.ts` | Chromium integration tests, isolated lifecycle fixture, and local test-server configuration. |

Keep the pure engine API small. Use explicit types for the session state and transition results; do not add generic event-bus, store, or service abstractions for a single consumer.

## 9. Accessibility and browser behavior

- Maintain semantic page landmarks and heading structure from Phase 1.
- Make the typing input discoverable with a descriptive accessible name and instructions. The input may be visually hidden but must remain focusable and usable with assistive technology.
- Provide a visible keyboard-focus indicator on the practice text/start affordance and Restart button.
- Ensure mouse users can focus the typing input by selecting the practice area; ensure keyboard users can reach and activate the start affordance.
- Announce session start and completion through a concise status region, not a rapidly changing character-level live region.
- Keep the browser's normal navigation and shortcuts intact. Do not globally capture keys or prevent defaults for keys not processed by the engine.
- Preserve the Phase 1 contrast, responsive layout, and reduced-motion behavior.

## 10. Implementation sequence

1. Add the typed pure engine model and deterministic transitions for character input, Backspace, completion, and restart.
2. Implement metric helpers and unit tests for elapsed-time boundaries, empty input, correction, and completed sessions.
3. Replace the static practice sample with the fixed target renderer and character states.
4. Add focusable input handling scoped to the practice component; verify ignored keys and default browser behavior.
5. Wire live metrics, completion status, and restart; ensure timer cleanup on every exit path.
6. Validate type checks, production build, keyboard-only use, and responsive presentation.

Do not implement later-phase modes, generator, permissions, visualizer, storage, or stats while carrying out this sequence.

## 11. Verification and acceptance criteria

Phase 2 is complete when all of the following are true:

- The production app loads one fixed target exercise and accepts typing only while its practice input is focused.
- A matching character is visibly correct; a mismatching character is visibly erroneous and does not prevent continued typing.
- Backspace removes the most recent visible character, preserves cumulative attempt counters, and does nothing on an empty buffer.
- The session starts on the first accepted character, completes at target length, and ignores input after completion until restart.
- WPM uses the documented formula and currently correct buffered characters; accuracy uses cumulative correct and total printable attempts.
- Empty metrics do not divide by zero; WPM and accuracy remain finite and within their defined display bounds.
- Live timing uses a monotonic clock, and the refresh timer is cleaned up on completion, restart, and component teardown.
- Restart restores the same target and clears session state, attempts, metrics, and completion status.
- Modifier shortcuts, composition input, auto-repeat, Tab, Escape, and unrelated keys do not corrupt the text buffer or interfere with browser navigation.
- No global keyboard listener, permission prompt, generated exercise, mode behavior, persistent data, sound, keyboard visualizer, or historical statistics are introduced.
- The input, start affordance, and restart control are keyboard accessible, and feedback is not conveyed by color alone.
- The configured Svelte/TypeScript checks and production build pass; focused engine tests cover correct input, incorrect input, correction, completion, restart, and metric edge cases.

## 12. Risks and implementation notes

- **Input focus and browser shortcuts:** Keep capture on the focused input and prevent defaults only for handled input; avoid locking the user into the session.
- **Correction semantics:** Accuracy is cumulative attempts while WPM uses currently correct buffered characters. Keep the two definitions explicit in both code and tests.
- **Timer drift:** Timer callbacks can be delayed in background tabs. Calculate from timestamps rather than incrementing elapsed time by the interval.
- **Hidden input accessibility:** A visually hidden input must remain focusable, named, and discoverable; do not use `display: none`, `visibility: hidden`, or `aria-hidden` on the active input.
- **Future exercise sources:** Keep the engine independent of the current fixed string so later generation can replace its source without coupling text selection to keystroke processing.
