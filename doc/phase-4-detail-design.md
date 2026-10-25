# AliceType — Phase 4 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 4: Modifiers, Modes, & Logic |
| Status | Implemented |
| Source design | [Technical Design Document](./tech-design.md) |
| Preceding phase | [Phase 3 Detail Design](./phase-3-detail-design.md) |
| Implementation plan | [Phase 4 Implementation Plan](./phase-4-implementation-plan.md) |

## 2. Purpose

This document defines the detailed design and acceptance criteria for replacing the fixed Phase 2 practice text with locally generated word exercises, optional punctuation and number modifiers, and the Timed and Words practice modes. It also defines how each mode starts, ends, calculates progress, and preserves the existing typing and visualizer behavior.

The typing engine remains the source of truth for accepted characters, correction, attempts, WPM, accuracy, and the comparison used by physical-key feedback. Phase 4 supplies a target and session configuration to that engine and adds mode-specific completion and progress behavior; it does not introduce another input path.

## 3. Phase 4 scope

### 3.1 In scope

- Local word banks with the 200-, 1000-, and 5000-word tiers described in the Technical Design Document.
- Deterministic, testable generation of word exercises from the selected bank.
- Optional punctuation and number insertion, disabled by default.
- Timed mode with 15-, 30-, 60-, and 120-second durations.
- Words mode with 10-, 25-, 50-, and 100-word limits.
- Mode selection and configuration controls for these two modes.
- Mode-specific progress, live timing, session completion, restart, and final metrics.
- Focused unit and browser tests for generator, session transitions, progress, and regression behavior.

### 3.2 Out of scope

- Quote, Custom, and Zen modes. They remain unavailable placeholders; do not present them as working modes.
- Normal, Expert, or Master difficulty rules.
- Settings or session configuration persistence, IndexedDB, historical statistics, themes, or statistics pages.
- Keyboard permission prompts, global keyboard listeners, sound, or changes to the Alice visualizer's physical-key mapping.
- Keyboard Keys Test Matrix, device profiles, hardware identification, backend services, and network requests.
- External quote services, remotely fetched word banks, and dependencies for state management or exercise generation.

The roadmap names Timed and Words as the Phase 4 modes. Other modes and difficulty specifications in the Technical Design Document are not silently included in this phase.

## 4. Technical decisions

| Concern | Phase 4 decision |
| --- | --- |
| Framework and language | Continue using Svelte 5 and TypeScript. |
| Input ownership | Keep keyboard handling on the focused practice input in `PracticePanel.svelte`; do not add a global listener. |
| Exercise generation | Add a pure, typed generator that consumes bundled local word data and explicit settings. No browser, DOM, storage, or network access. |
| Randomness | Inject a random-number function into generation. Production uses `Math.random`; tests supply a seeded or fixed sequence. |
| Session engine | Keep character comparison, Backspace, attempt accounting, WPM, and accuracy in the pure typing engine. Add explicit mode-aware state transitions for timed expiry and word-limit completion. |
| Clock | Use monotonic `performance.now()` timestamps. A timer schedules UI refresh and expiry checks; elapsed time is always derived from timestamps, never accumulated timer ticks. |
| Progress | Derive progress from mode state. Clamp the displayed value to 0–100%; do not store a second mutable progress counter. |
| Settings and persistence | Configuration is component-local and resets to defaults on reload. Do not add localStorage in this phase. |
| Text format | Generated content is printable ASCII, one space between tokens, no leading/trailing spaces. This preserves Phase 2 input filtering and visualizer semantics. |

Keep the generator independent from Svelte and the typing engine. Pass its complete initial target and validated mode configuration into session creation. Timed mode may request additional generated text when its target buffer is nearly consumed; this extension must not mark the session complete.

## 5. Exercise generation

### 5.1 Word-bank data

Provide bundled local JSON data for the three selectable tiers (200, 1000, and 5000 entries). Each entry must be a unique, non-empty lowercase ASCII word and must not contain whitespace, punctuation, or digits. Keep the source and its license/provenance recorded with the data; do not add an unlicensed corpus or retrieve data at runtime.

Use the first 5000 eligible entries, preserving frequency order, from the English 2018 data in Hermit Dave's FrequencyWords (source revision and transformation recorded in the bundled notice). The smaller tiers are immutable prefixes of that list. Its subtitle-derived content is CC BY-SA 4.0, separately from the application license; include attribution and the data license in production builds and link both from the footer. Do not claim this source is a universal ranking of English frequency.

Treat the selected tier as a maximum vocabulary pool, not as the number of words in the exercise. Validate the bank before using it. Invalid settings, malformed bank entries, and an empty usable bank must fail explicitly rather than quietly producing an empty or misleading exercise.

### 5.2 Generator input and output

The generator accepts:

- A validated mode (`timed` or `words`).
- The mode's duration or word limit.
- The selected word-bank tier.
- The punctuation and numbers toggles.
- An injectable random source.

It returns printable ASCII exercise text, token metadata needed to calculate word progress, and any generator state needed to append a later timed-mode batch. It must not return an empty target.

For Words mode, generate exactly the configured number of word tokens before modifiers. For Timed mode, generate `durationSeconds * 5` base words per batch and append a further batch before accepting printable input when fewer than 80 target characters remain. A target buffer ending does not end a timed session; only its deadline does. Generation must use the same selected pool and modifier settings for appended batches.

Choose words independently with replacement; repeated words are valid, with no rejection loop. Require every random draw to be finite and in `[0, 1)`. Store base-word completion positions as exclusive input offsets in the final modified target, not offsets in an unmodified intermediate string.

Generation must remain reproducible for a given bank, settings, and deterministic random source. Do not mutate the source word bank or reuse one random selection array across sessions.

### 5.3 Modifiers

- **Punctuation:** When enabled, independently decorate each base word with 25% probability, selecting equally among a trailing comma, trailing period, or paired ASCII double quotes. Preserve valid spacing and never create a leading/trailing separator.
- **Numbers:** When enabled, independently insert a decimal number token from `0` through `999` with 20% probability after each nonfinal base word. Use digits `0`–`9` only, separated from adjacent tokens by one space. Never append numbers after the final base word.
- Both modifiers are off by default, independent, and may be enabled together.
- Apply modifiers after choosing base words. Word-limit progress counts base word tokens, not punctuation marks, number tokens, or characters.
- Punctuation and number tokens are part of the target and participate normally in correctness, attempt, accuracy, and WPM calculations.

The generator must ensure modifier output remains valid printable ASCII and must not silently strip a character after generation. Unit tests should assert format and token-count invariants rather than brittle exact randomized samples.

## 6. Modes and session behavior

### 6.1 Configuration and selection

The practice-mode navigation activates only Timed or Words. Selecting either mode updates the visible configuration controls without starting a session. Starting typing freezes the selected mode, limit, bank tier, and modifier values for that session. Configuration changes during a running session must not mutate its target, deadline, or progress denominator.

Defaults are Timed mode, 30 seconds, 25 words, the 200-word bank, and both modifiers off. The currently inactive mode's limit remains available when switching between Timed and Words. A new session uses the current configuration. Restart clears the current session and starts a new exercise with the same frozen configuration; returning to a not-yet-started state or explicitly changing configuration selects the newly configured values.

`App.svelte` owns only the shared settings and running flag, passing them to the header and practice panel. The practice panel owns the session, generated text, input, and timers. Configuration changes in `ready` or `completed` regenerate a ready exercise; running mode/settings controls are disabled.

### 6.2 Shared session lifecycle

| State | Entry condition | Behavior |
| --- | --- | --- |
| `ready` | Initial load, mode/configuration selection, or restart | Render a generated target. No session clock runs and progress is zero. |
| `running` | First supported printable character is accepted | Record the start time, accept normal typing/correction, update metrics and progress. |
| `completed` | Word target is reached or timed deadline expires | Freeze metrics and progress; ignore further character and Backspace actions until restart. |

Focusing the input does not start a session. Backspace before the first character does nothing and does not start the clock. Focus loss does not pause a running session. A browser timer firing late must not extend a Timed session: compare the current monotonic time with the deadline on every timer callback and accepted keydown before processing more input.

Restart returns to `ready`, resets typed characters, counters, progress, and timestamps, clears transient key feedback and timers, and generates fresh text from the same frozen configuration. Preserve the Phase 2 focus behavior: a Restart button keeps focus on itself; restarting from an in-session action must not unexpectedly seize focus.

### 6.3 Timed mode

- Allow durations of 15, 30, 60, and 120 seconds.
- The first accepted printable character starts the clock and establishes `deadline = startedAt + duration`.
- The deadline—not target length—completes the session. A final partial word remains visible and contributes to metrics as already defined by the typing engine.
- Calculate elapsed time from `startedAt`, capped at the configured duration. At or beyond the deadline, transition to `completed` once, freeze final metrics, and set progress to 100%.
- Before the first character, show neutral metrics and zero progress. While running, progress is elapsed time divided by duration. It reaches 100% at the deadline and is never negative or above 100%.
- Generate further target text before the current buffer is exhausted. Appending target content must not reset input, metrics, start time, deadline, or visualizer feedback. If a batch cannot be produced, surface an explicit error and stop accepting the incomplete exercise rather than treating exhaustion as successful completion.

### 6.4 Words mode

- Allow limits of 10, 25, 50, and 100 base words.
- Generate the complete target with exactly the selected number of base word tokens before applying modifiers.
- A word is complete when the user has advanced past its following separator; the final word completes when its last target character is accepted. Progress is the count of completed base words divided by the configured limit.
- Progress advances on target position, including when a character is incorrect. This keeps progress about exercise completion, not accuracy. Backspace moves the current position backward and therefore may reduce progress; cumulative attempt and accuracy counters remain unchanged, as in Phase 2.
- Complete when the final target character is accepted, even if one or more characters are incorrect. Freeze the final progress at 100%.
- Modifier-added punctuation remains attached to the relevant boundary for progress purposes; inserted number tokens are not base words and do not increase the configured word denominator.

### 6.5 Shared typing and metric semantics

- Preserve the Phase 2 input filter: accept one printable ASCII character and Backspace; ignore modified shortcuts, composition, auto-repeat, unsupported keys, and unfocused input.
- Preserve Phase 2 behavior for mistyped characters and Backspace. Incorrect input remains visible, does not block progress, and can be corrected. Attempts remain cumulative after deletion.
- Continue to calculate WPM from currently correct buffered characters and elapsed time, and accuracy from cumulative correct and total printable attempts. Do not change either formula for a mode.
- In Timed mode, freeze both metrics at the deadline. In Words mode, freeze them at completion. Before the first accepted character, retain the neutral metric placeholders.
- The Phase 3 visualizer continues to use `KeyboardEvent.code` for physical position and the same pre-action target comparison for correct/mismatch feedback. Appending timed text or mode progress must not alter that comparison.
- Completion wins over transient feedback, including the last printable action. Generation/extension errors show a persistent alert, disable capture, clear feedback and refresh timers, and expose Restart; they never appear as successful completion. Only known generation errors are handled at this boundary; unexpected programming errors are not swallowed.

## 7. UI and rendering

### 7.1 Mode controls

- Replace the Timed and Words placeholder labels with keyboard-operable mode controls that expose the selected mode and associated configuration.
- Keep Quote, Custom, and Zen visibly unavailable or clearly marked as coming soon; they must not appear selectable as implemented modes.
- Show the relevant duration or word-limit options, vocabulary tier, and independent Punctuation and Numbers toggles before a session starts.
- Disable or make configuration controls read-only while a session is running. Provide a clear route to restart before applying different settings.
- Keep mode controls and configuration labels explicit; do not require color alone to identify selection or disabled state.

### 7.2 Target, metrics, and progress

- Continue rendering target characters through the existing practice-text path, preserving spaces and accessible full text.
- Bound the generated text area's height, allow internal vertical scrolling, and keep the active character in view without scrolling the page.
- Display a labeled progress indicator for the current mode: elapsed-time progress for Timed, completed-base-word progress for Words. Include text values (for example, elapsed/total seconds or completed/limit words) so progress is not conveyed only by bar color.
- Before a session starts, show zero progress and the configured limit. On completion, show final mode-specific status and frozen metrics.
- Do not imply that WPM or accuracy is a progress measure. Keep the visualizer and Restart control available under the existing Phase 3 layout.
- Respect reduced-motion preferences and avoid continuous animation. Progress updates must not trigger rapid live announcements; expose a concise completion status through the existing status region.

### 7.3 Accessibility and responsive behavior

- Use native buttons, selects, and checkbox/switch controls with visible labels and focus indicators.
- Associate each setting with its label and provide a programmatic selected/disabled state for mode controls.
- Keep keyboard entry limited to the focused practice input. Mode controls remain reachable with normal Tab navigation; do not intercept browser shortcuts.
- Keep the progress bar's accessible name, numeric value, and mode-specific description synchronized with the visible value.
- Preserve existing landmarks, heading hierarchy, narrow-screen layout, input instructions, and keyboard visualizer accessibility.

## 8. Component and module responsibilities

| Path | Responsibility |
| --- | --- |
| `src/lib/typing/exercise-generator.ts` | Pure validation, vocabulary selection, modifier application, exercise output, and timed-batch generation. No Svelte, DOM, storage, or network access. |
| `src/lib/typing/word-banks/` | Bundled 200-, 1000-, and 5000-word data with documented provenance and license. |
| `src/lib/typing/typing-engine.ts` | Extend typed session transitions and metric helpers for mode configuration, timed expiry, word progress, and timed target extension while preserving Phase 2 character semantics. |
| `src/App.svelte` and `src/lib/components/AppHeader.svelte` | Pass shared settings/running state and mode-selection callbacks between the header navigation and practice panel without a global store. |
| `src/lib/components/ModeNavigation.svelte` | Select between implemented Timed and Words modes; represent Quote, Custom, and Zen as unavailable. |
| `src/lib/components/PracticePanel.svelte` | Own selected settings, generated exercise, mode-aware session, monotonic timer/expiry, progress presentation, existing focused input, and restart lifecycle. |
| `src/lib/components/AliceKeyboardVisualizer.svelte` | Continue rendering the Phase 3 layout and supplied transient feedback; no mode or generator logic. |
| `src/lib/components/AppFooter.svelte` | Expose bundled vocabulary attribution/data-license assets and updated phase copy. |
| `src/lib/typing/exercise-generator.test.ts` | Validate bank selection, settings, deterministic generation, modifiers, ASCII output, and token metadata. |
| `src/lib/typing/typing-engine.test.ts` | Extend coverage for timed/word transitions, progress, expiry, target extension, metrics, restart, and existing Phase 2 regressions. |
| `tests/modes.spec.ts`, `tests/practice.spec.ts`, and `tests/visualizer.spec.ts` | Browser coverage for mode controls, settings, progress, timer behavior, restart, focus/input filtering, and visualizer regression. |

Keep the engine pure and explicit. Do not introduce a global store, generic event bus, generator service, persistence abstraction, or second keyboard listener for the two mode consumers.

## 9. Implementation sequence

1. Add and validate local word-bank data, recording the data source and license.
2. Implement the pure generator with injectable randomness, validated settings, modifier behavior, word-token metadata, and timed batch output.
3. Extend the typing engine with explicit mode configuration, word progress, timed deadline/completion, safe target extension, and frozen final metrics. Preserve all existing Phase 2 behavior with regression tests.
4. Wire Timed and Words selection and their controls into the existing header/practice flow. Keep the other modes unavailable.
5. Update `PracticePanel.svelte` to create sessions from generated exercises, enforce frozen running settings, refresh metrics/progress, complete timed sessions at their deadline, and restart cleanly.
6. Add accessible progress presentation and mode-specific completion/status text without changing Phase 3 keyboard feedback behavior.
7. Add focused unit and browser coverage for generation, modifiers, mode transitions, expiry, word-boundary progress, settings, restart, accessibility, and regressions.
8. Run configured type checks, unit tests, browser tests, and production build; inspect desktop and narrow-screen behavior.

Do not implement Quote, Custom, Zen, difficulty levels, persistence, permissions, sound, historical stats, the keyboard test matrix, or device details as part of this sequence.

## 10. Verification and acceptance criteria

Phase 4 is complete when all of the following are true:

- Local 200-, 1000-, and 5000-word tiers are available, valid, documented, and used without network requests.
- Generator validation rejects invalid/empty input explicitly. Given fixed input settings and random source, output is reproducible, non-empty, printable ASCII, and has the required base-word count.
- Punctuation and number toggles are independent and off by default; their output obeys the ASCII and spacing rules and does not corrupt base-word progress metadata.
- Only Timed and Words are selectable working modes. Timed exposes exactly 15/30/60/120 seconds; Words exposes exactly 10/25/50/100 words.
- Selecting a mode or configuration does not start the session. The first accepted printable character starts the clock; focusing or Backspace alone does not.
- Timed progress reflects monotonic elapsed time, the session ends at its deadline even if timer callbacks are delayed, and target-buffer extension cannot complete or reset the session.
- Words progress reflects completed base words, including modifier cases; corrections can move progress backward, while attempt counters retain Phase 2 semantics.
- Both modes preserve correct/mistyped rendering, Backspace correction, WPM/accuracy definitions, browser-shortcut behavior, and Phase 3 physical-key feedback.
- Completion freezes metrics/progress, ignores further typing until restart, and restart clears all timers, feedback, and session state while applying the intended frozen configuration.
- Progress has accessible labels and textual values; settings work with keyboard and pointer; the page has no new horizontal overflow.
- Quote, Custom, Zen, difficulty modes, settings persistence, storage, global listeners, permissions, audio, stats, and backend/network behavior remain unimplemented.
- Configured Svelte/TypeScript checks, focused unit tests, browser tests, and production build pass.

## 11. Risks and implementation notes

- **Word-bank provenance:** A packaged list can carry licensing obligations. Record provenance and permitted use before including data; do not copy an unverified corpus.
- **Timer throttling:** Background tabs delay callbacks. Compare `performance.now()` to the fixed deadline on callbacks and input, and cap elapsed time for final metrics.
- **Timed target exhaustion:** A timed session must not end because a generated buffer ran out. Extend it before exhaustion and test extension at a boundary; surface generation errors explicitly.
- **Progress versus correctness:** Mode progress measures target advancement, not correct characters. Keep it separate from accuracy and WPM; Backspace changes target position but not cumulative attempts.
- **Modifier metadata:** Punctuation and number tokens affect what is typed but must not inflate the configured base-word denominator.
- **Configuration changes:** Running sessions use a frozen configuration. Avoid a reactive settings change silently replacing text or the timer underneath the user's input.
- **Scope boundary:** Quote/Custom/Zen, difficulty rules, storage, and statistics are explicitly deferred; do not imply they are available through labels or controls.
