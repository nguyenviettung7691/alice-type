# AliceType Phase 6 Implementation Plan

## Goal and design analysis

Implement [Phase 6 Detail Design](./phase-6-detail-design.md) on the existing Svelte 5 application. Add a standalone Keyboard Test view, guided physical-key validation over the existing Alice layout, temporary counts/highlights, and independently persisted test sound preferences. Preserve practice input, exercise state, audio, history, and statistics.

The current app owns navigation, preferences, and pending completed-session saves. Practice stays mounted while hidden; other views mount conditionally. Extend those boundaries: the test panel mounts only while selected and owns temporary test/audio state. Reuse the Alice SVG component with optional test presentation props rather than duplicate geometry.

## Resolved implementation contracts

- Only the existing generic Alice profile is available. Use `ALICE_LAYOUT` order and unique logical codes; split spacebars share one count. Each correct expected key counts once per run; repeated or out-of-order presses cannot inflate a count.
- Add a pure `keyboard-test.ts` module for state transitions and input classification, with no DOM, storage, audio, or typing-engine imports. Derive expected/tested/completed presentation from the correct counts and expected index instead of storing redundant mutable flags.
- Test only events targeted at the focused test region, never bubbling events from child controls or the independently focusable diagram scroll region. Ignore repeat, composition/IME, and shortcut combinations. Track held codes until keyup/blur to reject duplicate keydowns even when a synthetic/device event omits the repeat flag.
- An expected standalone Shift/Ctrl/Alt/Meta key is allowed with its own modifier flag. Additional held modifier flags mean a shortcut and remain untouched. A modifier's initial keydown cannot reveal whether a later shortcut key will follow; never suppress its native behavior or claim to validate the subsequent chord.
- Consume unmodified Tab only when Tab is expected. Otherwise Tab and Shift+Tab leave normally without error or sound. Escape always leaves the test region for the visible **Focus keyboard test** button. This is not a keyboard trap. Arrow keys retain native scrolling.
- Only suppress Space scrolling, Backspace navigation, or Tab focus movement inside the eligible test path. No document/window keyboard listeners and no keyboard lock/device permission.
- Element/window blur clears held-key tracking, transient errors, and playing/pending sounds but preserves current run progress. Window focus/blur listeners manage lifecycle only, never keyboard input. Reset clears progress and feedback and refocuses the region. Navigation teardown clears the run and releases audio. Completion stops consuming test events.
- Show expected/tested/error markers and counts in the existing SVG via optional test presentation. Preserve the practice DOM/data-feedback contract, title/description, and 300 ms feedback behavior. Provide a textual per-key result list for assistive technology rather than relying on an SVG image's hidden descendants.
- Add preferences schema v2 at the existing `alicetype.preferences` key: `keyboardTestSoundEnabled: false` and `keyboardTestSoundEffect: 'default'`. Validate every v1 field before migration; reject corrupt v1 records rather than defaulting missing old fields. Preserve every known practice/display/onboarding value.
- If writing a migrated record fails, keep the valid migrated values in memory, expose a save warning and retry the v2 write. Do not discard valid v1 settings or mistake a migration write failure for invalid input. Invalid/future schemas remain untouched until explicit user action.
- Persist explicit test sound changes through app preference callbacks. Practice sound remains independent. Resetting the test does not reset sound; confirmed Restore defaults resets both preference groups.
- Implement all 13 effects as original, short synthesized interpretations, not animal/sample recordings. Document provenance in the audio module. Generate bounded PCM buffers locally with deterministic tone/noise recipes; cache buffers, reuse one lazy context per mounted panel, and cap concurrent playback.
- Audio is off by default. Effect changes preview only while enabled; no preview merely from navigation, reload, or enabling the toggle. Each eligible non-repeat press (correct, wrong, or unknown) requests one effect. The final correct press may sound; later presses after completion do not.
- Cancel pending resumes/playback on sound-off, effect change, blur, reset, and teardown. Close the audio context on teardown and report failures using existing alert/logging patterns. Audio failure disables only test sound in memory and keeps physical testing usable.
- No test counts, raw events, typed text, or results enter preferences, IndexedDB, session history, or Stats. No dependencies or external runtime requests.

## Execution steps

### 1. Pure state and preference migration

1. Define typed test state, initial state, expected code, and immutable correct/wrong transitions over the existing layout.
2. Add explicit input classification for modifier exceptions, shortcuts, composition, repeat, Tab/Shift+Tab, Escape, and native-default handling.
3. Unit-test full layout coverage, physical-code-versus-character matching, wrong/unmapped input, duplicate/repeat filtering, completion, and restart.
4. Add the effect enum/type and preferences v2 fields, defaults, validation, and v1 migration.
5. Extend preference tests for all effects, exact serialized shape, old-value preservation, invalid/future records, migration write denial with in-memory recovery, and retry.

**Exit:** only matching physical codes change progress; valid existing preferences survive migration and failed migration writes.

### 2. Original sound library

1. Define the full labeled effect list and deterministic synthesis recipes for Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, and Plastic chicken.
2. Generate short finite, bounded buffers with distinct waveforms; document original provenance.
3. Add lazy Web Audio initialization/resume, buffer reuse, bounded polyphony, pending-play cancellation, active-node cleanup, and typed playback errors.
4. Unit-test every effect's duration, finite samples, amplitude, non-silence, and distinctness, plus playback/failure/cancellation/resource cleanup using controlled audio doubles.

**Exit:** every effect is functional without licensed third-party assets, network access, or audio dependencies.

### 3. Matrix UI and application wiring

1. Extend the existing Alice visualizer with optional expected/count/error presentation, legend markers, accessible description, and textual results without changing practice behavior.
2. Build `KeyboardTestPanel.svelte` with heading, instructions, Focus button, focused region, progress/expected prompt, sound controls, transient errors, reset, and completion.
3. Wire held-key tracking, keyup/blur cleanup, expected Tab interception, Shift+Tab/Escape exit, and focus-safe pointer handling.
4. Add Keyboard Test app/header navigation and update every view type/focus target. Keep running-practice navigation disabled and preserve mounted practice state.
5. Wire preference changes, migration-save warnings/retry, independent test audio failures, and confirmed defaults behavior.
6. Keep narrow-screen overflow inside the existing diagram scroll area and preserve keyboard scrolling outside the capture region.

**Exit:** an accessible standalone test works end-to-end without affecting practice or historical statistics.

### 4. Browser verification and documentation

1. Add browser coverage for full real-keyboard sequence, correct/wrong/unmapped feedback, split Space counts, repeated/held input, reset, completion, blur/resume, teardown, and navigation.
2. Verify only the focused test region consumes input; controls, Tab/Shift+Tab/Escape, browser shortcut combinations, and scroll regions remain usable.
3. Verify sound off/on, every effect and preview, cancellation, failures, resource closure, preference reload, v1 migration/write failure recovery, and practice sound independence.
4. Verify exact storage shape and unchanged IndexedDB history after a completed test; preserve completed/ready practice across navigation.
5. Update existing test fixtures to schema v2; retain explicit v1 migration cases and change future-version fixtures to an actually unsupported version.
6. Run focused unit/browser tests and type checks first, then all existing unit/browser tests and the production build. Fix failures caused by Phase 6.
7. Inspect rendered desktop and 320 px views using a browser screenshot and accessibility snapshot. Update README, detail design status/contracts, and this plan with actual results.

**Exit:** all configured checks pass, visible UI is usable, and no Phase 2–5 regression remains.

### 5. Commit and push

1. Review Phase 6 changes and run `git diff --check`; include the previously created Phase 6 design.
2. Commit the design, plan, implementation, tests, and directly related documentation on the existing branch with the required Copilot co-author trailer.
3. Push to configured `origin` without force. Verify remote branch SHA matches the local commit and the working tree is clean.

## Verification results

Implemented on 2026-10-25.

| Check | Result |
| --- | --- |
| `npm test` | 198 tests passed across 7 files. |
| `npm run check` | Zero errors and zero warnings. |
| `npm run build` | Production build passed; no added dependency or downloaded sound asset. |
| `npm run test:e2e -- --workers=4` | 88 Chromium tests passed, including all Phase 2–5 regressions and 16 Phase 6 tests. |
| Native audio | All 13 effects played through native Web Audio with finite, audible, bounded buffers; context closed on navigation; no runtime errors or external requests. |
| Keyboard lifecycle | Full 60-code sequence, shared Space counts, repeat/held filtering, shortcuts, composition, Tab/Shift+Tab/Escape, window blur, reset, completion, and teardown verified. |
| Audio lifecycle | Buffer/context reuse, four-source polyphony, errors, and pending resume cancellation on blur/reset/sound-off/app teardown verified. |
| Persistence | v1-to-v2 preservation, failed migration writes with in-memory retention/retry, all effect values, sound independence, reload, and exact test-free serialized settings verified. |
| UI inspection | Desktop 1440 px and narrow 320 px screenshots inspected; matrix states/counts, labeled sound controls, native diagram scrolling, and no page-width overflow verified. |
| `git diff --check` | Passed. |

Implementation clarifications are reflected in the detail design: tested/completed state is derived rather than duplicated, keyboard exit remains available during/after testing, text key results sit outside the SVG's hidden visual descendants, window blur clears stale held keys, and every sound is an original synthesized interpretation under the application license.
