# AliceType — Phase 6 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 6: Keyboard Keys Test Matrix |
| Status | Implemented |
| Source design | [Technical Design Document](./tech-design.md) |
| Preceding phase | [Phase 5 Detail Design](./phase-5-detail-design.md) |
| Implementation plan | [Phase 6 Implementation Plan](./phase-6-implementation-plan.md) |

## 2. Purpose

This document defines the detailed design and acceptance criteria for a separate, guided keyboard test view. It uses the generic Alice physical layout established in Phase 3 to guide a user through supported keys, show per-key correct-press feedback and counts, report unexpected keys, and optionally play a selected test sound effect.

The matrix is an independent diagnostic interaction. It does not start or modify a typing-practice session, contribute to typing accuracy or missed-key statistics, or claim to detect the user's keyboard hardware or operating-system layout.

## 3. Phase 6 scope

### 3.1 In scope

- An app-level Keyboard Test view reachable independently of Practice, Settings, and Stats.
- A guided sequence using the existing generic Alice layout and its `KeyboardEvent.code` identifiers.
- Correct-key highlighting, current expected-key guidance, per-key counts, transient unexpected-key feedback, and restart/reset behavior.
- A test-specific sound toggle and selectable effect: Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, and Plastic chicken.
- Local persistence of the test-specific sound toggle and effect selection, independent of the existing typing-sound preference.
- Keyboard and pointer operation, focus-scoped event handling, and avoidance of browser/system shortcut interception.
- Unit and browser tests for sequence behavior, input filtering, sound preference persistence, navigation, accessibility, and separation from practice statistics.

### 3.2 Out of scope

- Additional physical layout profiles. Phase 6 exposes only the generic Alice profile already implemented in `src/lib/keyboard/alice-layout.ts`; do not present unavailable profiles as selectable.
- Changing the Alice geometry, key identity mapping, typing visualizer behavior, practice input, typing-engine metrics, or practice sound.
- Persisting test progress, highlights, correct counts, or incorrect-key history. These are temporary and cleared on reset or view teardown.
- Adding test results to IndexedDB, Stats, typing-session scores, or missed-key summaries.
- Device identity, device catalog, hardware feature detection, or automatic detection of the user's actual layout.
- A required keyboard permission, global keyboard listener, browser shortcut interception, backend, telemetry, or external runtime audio requests.
- Quote, Custom, and Zen practice modes or additional difficulty rules.

## 4. Technical decisions

| Concern | Phase 6 decision |
| --- | --- |
| Framework and language | Continue using Svelte 5 and TypeScript. |
| Layout source | Reuse the typed `ALICE_LAYOUT`, `ALICE_VIEW_BOX`, and `ALICE_HALF_TRANSFORMS` from the Phase 3 keyboard module. |
| Physical key identity | Match `KeyboardEvent.code` to the active layout key's `code`. Do not use `KeyboardEvent.key` to identify a physical key. |
| Displayed legends | Use the selected profile's generic US ANSI legends. Do not imply that these necessarily match the user's printed keycaps. |
| Layout API | The matrix does not require `navigator.keyboard.getLayoutMap()`. If a future optional legend-assistance path uses it, it must be feature-detected, non-blocking, user-initiated, and clearly labeled as browser layout information, not hardware detection. |
| Input ownership | Handle key events on a focusable test interaction region rendered only for the active Keyboard Test view. Do not add document- or window-level keyboard listeners. |
| Guided order | Test each unique physical code once, in the stable order of `ALICE_LAYOUT`. A correct press advances to the next code; an unexpected press leaves the expected code unchanged. |
| State | Keep expected index, counts, highlights, and transient error feedback local to the test view. Do not persist test-run state. |
| Sound | Use a test-specific sound-effect module and preference fields. Keep the existing practice click sound and `soundEnabled` preference unchanged. |
| Audio assets | Use original/generated sounds or appropriately licensed assets, with provenance recorded in the source tree. Bundle assets locally; do not fetch them from a remote service at runtime. |
| Storage | Extend the existing versioned preferences record with a backward-compatible migration. Persist only the test sound toggle and selected effect. |
| Dependencies | Use existing Svelte, TypeScript, Web Audio, and native browser capabilities. Do not add a keyboard, sound-effects, state-management, or storage dependency. |

The generic Alice profile is a visualization and physical-code map, not a device specification. `KeyboardEvent.code` may be unavailable or unrepresented for a particular event; such an event cannot satisfy the expected key and must not be guessed from its character.

## 5. View navigation and layout

### 5.1 Navigation

Add **Keyboard Test** to the app-level view navigation, alongside Practice, Settings, and Stats. It is a separate view, not a practice mode. Preserve the existing practice-mode navigation and mode-selection behavior.

Use a stable view identifier such as `keyboard-test` in the app and header view types. The selected navigation control exposes its state with `aria-pressed` (consistent with existing view navigation). When navigation changes views, focus the new view's heading or its labeled test interaction region after rendering. Navigating away unmounts the test view and discards its temporary run state.

Practice navigation and mode changes retain their existing behavior. Do not change the Phase 5 rule that prevents navigation while a practice session is running unless the existing app explicitly allows it.

### 5.2 Test view content

The view contains:

1. A heading and concise instructions describing the physical-key test and generic Alice/US ANSI diagram.
2. A progress indicator showing the number of correctly tested keys out of the number of unique mapped keys.
3. An expected-key prompt that identifies the physical code in accessible, human-readable text and its displayed profile legend.
4. The Alice matrix, with each key cell showing its legend, current test state, and correct-press count.
5. A polite status region for advancement, completion, and transient unexpected-key feedback.
6. An explicitly labeled test sound on/off control, effect selector, and **Restart test** action.

The diagram is built from the existing Alice layout data and half transforms rather than a second copied layout. The single logical `Space` code renders both existing spacebar keycaps and both show the same state and count. Keycap status must be conveyed by text/shape/state as well as color.

The initial expected code is the first entry in `ALICE_LAYOUT`. The user must press each mapped code in order. A correct non-repeat keydown increments that key's count, highlights the key as tested, advances the expected code, and updates progress. Each key is expected once in a run, so a key's count is either zero or one. After the final key is correctly pressed, the test enters a completed state, marks progress complete, and stops consuming test input until restart.

## 6. Input behavior and state transitions

### 6.1 Event acceptance

Process a keyboard event only when the Keyboard Test view is mounted and its designated test region has focus. The region is focusable by pointer interaction and by keyboard navigation. Provide a visible focus indicator and a concise instruction for focusing it.

For each `keydown` received by the test region:

1. Ignore the event if the test is complete.
2. Ignore `event.repeat` so holding a key cannot create extra presses or advance multiple steps.
3. Ignore composition events and modified combinations used for browser/system shortcuts (including Ctrl, Meta, and Alt combinations). A mapped modifier key may be tested as a standalone key when it is the expected code; do not treat that modifier's own keydown as a shortcut combination. Do not call `preventDefault()` for shortcut combinations.
4. If the event has a code matching the current expected code, record one correct press, update that key's count/highlight, and advance or complete the sequence.
5. If the event is an otherwise eligible physical key press but does not match the expected code, leave the expected index and all correct counts unchanged, show separate temporary error feedback, and identify the still-expected key in the status text.
6. If the code is missing or not in the active layout, do not infer a key from `event.key`; give transient unexpected-input feedback without changing progress.

Ignore auto-repeat for both expected and unexpected key presses. Do not count modifier keys used as part of a shortcut. Single supported modifier keys that are entries in `ALICE_LAYOUT` can be tested as standalone expected presses.

The implementation accepts a modifier's initial standalone keydown with its own modifier flag; it cannot predict a later chord. Additional shortcut keys remain ignored and native modifier/shortcut behavior is never suppressed. Track held codes until keyup or blur to reject duplicate keydowns even if a repeat flag is missing.

Prevent a browser default only when necessary to keep an eligible test key from triggering an in-page or browser behavior (for example, focus navigation for Tab, scrolling for Space, or a browser action for a mapped function key), and only after confirming the event belongs to the focused test region and is not a shortcut combination. Do not block modified browser/system shortcuts, navigation, or unrelated controls. Pointer activation of a matrix keycap does not count as a physical key press; pointer input is available for focus and controls, while the test itself validates physical keyboard events.

Consume Tab only when it is expected and unmodified. Otherwise Tab leaves normally without feedback; Shift+Tab always leaves, even while Tab is expected. Escape focuses the visible **Focus keyboard test** button unless it is a key in the selected layout's test sequence; Shift+Tab remains an exit path. The independently focusable diagram scroll region retains native arrow-key scrolling and does not process test input. Element or window blur clears held codes, transient feedback, and pending/playing sound while preserving run progress. Window focus/blur listeners manage lifecycle only; they never capture keyboard input.

### 6.2 State model

The view-local state consists of:

| State | Meaning |
| --- | --- |
| `expectedIndex` | Index of the next expected entry in the stable `ALICE_LAYOUT` order. |
| `correctCounts` | Map from physical code to correct presses in the current run; initialized to zero for each mapped key. |
| Tested codes (derived) | Codes with a positive correct count; drive the completed highlight without a second mutable set. |
| `errorCode` / error message | Optional transient feedback for the most recent unexpected key; does not affect counts or progress. |
| Completion (derived) | Whether the expected index has reached the number of mapped keys. |

The count, tested-key highlight, and expected index update atomically for a correct event. A wrong event never advances or changes a count. Use one 600 ms timer for error feedback; replace or clear it when a later eligible event occurs and cancel it on blur, reset, and component teardown.

### 6.3 Restart

**Restart test** is available before and after completion. Activating it:

- Sets the expected index to the first layout entry.
- Clears every correct count and tested-key highlight.
- Clears transient error feedback and pending error timers.
- Clears the completed state and resets progress to zero.
- Returns focus to the test interaction region after the action.

Restart does not alter the saved sound toggle/effect selection and does not write any test data to storage.

## 7. Sound effects and preferences

### 7.1 Controls and playback

Provide the effects in this order: Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, Plastic chicken.

- The test sound toggle defaults to off.
- When enabled, play the selected effect once for each eligible, non-repeat physical keydown while the test view is active, including an unexpected key. Ignore shortcuts, composition, repeat events, and input received outside the focused test region.
- Changing the effect previews the newly selected effect only when the test sound toggle is enabled. Changing it while disabled must not play audio.
- Starting the test or navigating to the view does not autoplay audio.
- Keep test sound independent of the practice click sound. Enabling one must not enable or change the other.
- If audio cannot be initialized or played, keep the test usable, turn the test sound preference off for the current application state, and show an accessible, dismissible error. Do not report successful playback or preference persistence when either failed.
- Initialize/resume audio only in response to a user gesture. Reuse and release audio resources according to the existing app lifecycle; do not create a new context for every keydown.

Audio effects must be short and bounded in volume. Include asset license/provenance notices for bundled audio. Prefer original/generated effects when suitable. Do not use assets whose license or source cannot be established.

Phase 6 implements all effects as original synthesized tone/noise interpretations, not sampled recordings. Provenance is recorded in the audio module under the application license; no third-party audio assets are bundled. Each effect is at most 0.6 seconds and bounded to 0.075 peak amplitude, with at most four simultaneous sources. Buffers and one lazy context are reused per mounted panel. Sound-off, effect changes, blur, reset, and teardown cancel pending playback; teardown closes the context.

### 7.2 Preference schema and migration

The Phase 5 preferences record is schema version 1. Introduce schema version 2 with two test-only fields:

| Field | Allowed values | Default |
| --- | --- | --- |
| `keyboardTestSoundEnabled` | boolean | `false` |
| `keyboardTestSoundEffect` | `default`, `bubble`, `horn`, `cartoon`, `coin`, `dog-bark`, `glass`, `donkey`, `phone`, `punch`, `plastic-toy`, `sneeze`, `plastic-chicken` | `default` |

Keep the existing practice `soundEnabled` field and all other Phase 5 preference values unchanged. On load, migrate a valid v1 settings record to v2 in memory by copying every existing field and adding the two defaults above. Validate the complete v2 record before saving the migrated form. A v2 record must validate both new fields as well as existing fields.

Preserve the existing Phase 5 behavior for malformed data, unsupported future versions, and storage failures: report errors explicitly, do not silently overwrite the stored record, and do not claim a failed save succeeded. The current view may continue using its in-memory selection when saving fails, with the existing recoverable preference warning and retry path.

If writing the migrated v2 record fails, retain the validated migrated settings in memory and report a migration-save warning. Retry writes those same settings rather than reverting valid practice/display values to defaults. The original v1 record remains untouched by the failed write.

Persist the enabled state and selected effect when changed through the existing preferences storage boundary. Do not persist test progress, counts, expected index, completion state, or error feedback. There is no separate storage key for test run data.

## 8. Accessibility, privacy, and error handling

- Use semantic headings, native buttons, and a labeled select/toggle; preserve visible focus styling and keyboard-operable navigation.
- Give the test region an accessible name and instructions. Keep focus on the region while testing, and do not require pointer interaction to start or complete the physical-key sequence.
- Expose each logical key's legend, code, state, and count in the **Text key results** list outside the SVG image; provide an accessible expected-key prompt that does not rely on color. Decorative SVG descendants remain hidden from assistive technology to avoid duplicate announcements.
- Announce expected-key changes and completion through a concise `aria-live="polite"` status. Announce incorrect input without flooding assistive technology; do not announce repeated keydown events.
- Use a distinct visual treatment and text for tested, expected, and unexpected states. Respect reduced-motion preferences; feedback must not depend on animation.
- Keep matrix behavior usable at narrow widths through the same scrollable diagram pattern and keyboard-scroll guidance used by the existing visualizer.
- Keep all run state in memory. Store only the two validated sound preferences in same-origin local storage; do not send keys, test results, device details, or audio events over the network.
- Do not state or imply that passing the test validates the keyboard's manufacturer, model, firmware, operating-system layout, or hardware capabilities.
- Surface storage/audio errors accessibly; do not hide failed operations behind defaults that appear saved or played.

## 9. Component and module responsibilities

| Path | Responsibility |
| --- | --- |
| `src/App.svelte` | Add the Keyboard Test view identifier and navigation branch; pass persisted test sound preferences and callbacks to the view; own app-level error and preference persistence behavior. |
| `src/lib/components/AppHeader.svelte` | Add Keyboard Test to app-view navigation without changing practice-mode controls. |
| `src/lib/components/KeyboardTestPanel.svelte` | Own the ephemeral expected sequence, counts, key states, focused input lifecycle, reset action, controls, and accessible status. |
| `src/lib/components/AliceKeyboardVisualizer.svelte` or a shared rendering boundary | Reuse the existing Alice layout rendering without changing practice feedback semantics. Prefer a small shared rendering boundary or a test-panel rendering path over duplicating layout geometry. |
| `src/lib/keyboard/alice-layout.ts` | Remain the source of truth for physical codes, keycap geometry, and generic legends. |
| `src/lib/keyboard/keyboard-test.ts` | Pure guided-state transitions and event classification; no DOM, audio, persistence, or typing-engine dependencies. |
| `src/lib/audio/keyboard-test-sound.ts` | Own the test effect library, playback, audio lifecycle, and typed errors independently of `TypingSound`. |
| `src/lib/audio/keyboard-test-sound.test.ts` | Cover all synthesized waveforms, duration/amplitude bounds, buffer reuse, polyphony, failures, pending-play cancellation, and resource closure. |
| `src/lib/storage/preferences.ts` | Define the test-sound effect type, v2 validation/defaults, v1-to-v2 migration, and preference load/save behavior. |
| `src/lib/storage/preferences.test.ts` | Cover v1 migration, v2 defaults/validation, invalid effect values, and persistence failures without losing existing preference fields. |
| `src/lib/keyboard/keyboard-test.test.ts` | Cover guided ordering, correct count/highlight changes, incorrect feedback, repeat/shortcut filtering, completion, and reset semantics. |
| `tests/keyboard-test.spec.ts` | Cover navigation, focus-scoped key input, keyboard/pointer controls, accessibility-relevant feedback, persistence across reload, and absence of practice-stat side effects. |
| `src/app.css` and component styles | Add only the test-view layout, matrix states, sound controls, responsive behavior, and focus/reduced-motion presentation needed by this phase. |

Keep the typing engine, practice panel input path, session-history record schema, and Stats aggregation independent of the test panel. Do not add a global keyboard service or a second practice input path.

## 10. Implementation sequence

1. Define and test the keyboard-test state transitions using the existing layout data, including stable sequence order, correct/wrong input, repeat filtering, completion, and reset.
2. Add the preferences v2 schema, explicit v1 migration, effect-value validation, and migration/storage tests while preserving all existing Phase 5 fields.
3. Add a test-specific audio module with the complete effect set, local/licensed assets or original sounds, typed failures, and cleanup.
4. Implement the accessible test panel and focused physical-key event path; verify browser shortcuts and controls are not captured.
5. Add app/header navigation and wire sound preference updates, preview, and accessible error handling.
6. Add focused browser tests for reload persistence, view focus lifecycle, responsive diagram use, and separation from practice session history/statistics.
7. Run unit tests, type checks, the production build, and browser tests. Verify Phase 2–5 practice, preferences, stats, and visualizer behavior remain unchanged.

## 11. Verification and acceptance criteria

Phase 6 is complete when all of the following are true:

- Keyboard Test is a distinct app view. Existing Practice, Settings, Stats, and practice-mode navigation still work as before.
- The test matrix renders the existing generic Alice geometry and legends, with one logical `Space` key represented by both spacebar shapes.
- Every unique code in the active profile is included once in the stable guided sequence, and the user can identify the next expected physical key.
- Only a matching, eligible, non-repeat `KeyboardEvent.code` advances the sequence or increments its key count. Key labels/characters are never used as a fallback identity.
- An unexpected or unmapped physical key receives separate temporary feedback, leaves progress and all correct counts unchanged, and does not alter the expected key.
- Auto-repeat, composition, and modified browser/system shortcuts cannot advance the test. No document/window keyboard listener is added; test input is ignored outside the active focused region.
- The last expected key completes the run. Restart from any state clears counts, highlights, progress, error feedback, and completion and returns focus to the test region.
- Test counts/highlights are temporary and never appear in IndexedDB history, typing-session scores, missed-key summaries, or practice accuracy.
- The sound toggle defaults off; every effect is selectable; sound plays only when enabled and only in response to an eligible test press; selection preview occurs only when enabled.
- Test sound preferences persist across reload and remain independent of practice typing sound. A valid v1 preference record migrates to v2 without losing any Phase 5 values; malformed or unsupported records and storage failures remain visible and recoverable.
- Audio assets are original or appropriately licensed with provenance recorded; runtime playback makes no external network request. Audio failure does not block testing and is reported accessibly.
- Navigation, test controls, expected-key progress, completion, and errors are usable with keyboard and assistive technology. State is not conveyed by color alone, and responsive diagram overflow can be scrolled with keyboard input.
- No device identity, hardware capability, or automatic layout-detection claim is made. The generic Alice/US ANSI profile is clearly labeled.
- Focused unit/browser tests, configured type checks, and production build pass with no Phase 2–5 regression.

## 12. Risks and implementation notes

- **Preference migration:** Phase 5 currently reads and writes schema version 1. Adding fields without an explicit migration would cause existing preferences to be rejected. Test migration with representative valid records and ensure write failures do not discard the in-memory state or falsely announce persistence.
- **Input focus:** A test region that loses focus must stop receiving test input. Avoid global listeners; make focus acquisition and restoration explicit and test navigation away and back.
- **Shortcut safety:** Space and modifier keys have browser behavior. Filter modified shortcuts before any default prevention, and suppress a default only for an eligible key when required to keep the test view usable.
- **Code support:** `KeyboardEvent.code` values are standardized but not guaranteed for every platform/device. Unknown codes must remain unknown rather than being guessed from character values.
- **Test-state ambiguity:** Keep expected ordering deterministic and counts scoped to one run. Do not persist counts or make a completed run silently restart.
- **Audio licensing and availability:** Do not use an effect whose provenance is unclear. Browsers can reject or suspend audio; preserve test behavior and report the failure.
- **Regression boundaries:** Practice and test sound have different semantics and settings. Keep their preference fields, playback paths, and failure handling independent.
- **Accessibility volume:** Announcing every key event can overwhelm assistive technology. Announce only meaningful expected-key transitions, concise errors, and completion.
