# AliceType Phase 2 Implementation Plan

## Goal and design analysis

Implement [Phase 2 Detail Design](./phase-2-detail-design.md) on the existing Svelte 5 + TypeScript shell. Deliver one fixed exercise with focused keyboard capture, correct/error/active character rendering, live WPM and accuracy, completion, and restart.

The engine must distinguish **currently correct characters** (WPM) from **cumulative correct attempts** (accuracy). Backspace changes the buffer but never erases attempts. Completing the target length ends the session even when it contains errors. No later-phase generator, mode, progress, permission, visualization, sound, or persistence behavior is included.

## Resolved implementation details

- Preserve the exact sample sentence as a named constant, including spaces, capitalization, commas, and final period.
- Keep the engine DOM-free and deterministic by passing monotonic timestamps into transitions and metric helpers.
- Represent session status with typed `ready`, `running`, and `completed` variants. Validate a non-empty printable ASCII target, matching the Phase 2 fixture; reject unsupported exercise text explicitly rather than creating an unfinishable session.
- Accept printable ASCII `KeyboardEvent.key` values, including shifted punctuation and uppercase letters; ignore Ctrl/Alt/Meta combinations, composing input, repeat, and unrelated keys. Backspace is the only non-printable editing key.
- Only keydown drives the buffer. Prevent handled native edits; cancel native `beforeinput` edits and clear any residual input value so paste, drop, IME, autofill, or repeated native edits cannot create a second source of truth.
- Losing focus stops capture, not elapsed time. Returning focus resumes the same session; time away remains included in WPM.
- Use a clickable text label plus an explicit Start typing/Resume typing button to focus the visually hidden input. Give input focus a visible outline on the text area. Never autofocus at initial load.
- Restart resets the existing target. Preserve input focus when already focused; activation from the Restart button keeps focus on that button, with Start typing available next.
- Render the target characters, not the mistyped replacements. Error underlines and the active block make errors and position understandable without relying only on color.
- Keep the full target available to assistive technology as one string. Announce lifecycle changes, not every character or metric update.
- Remove the decorative progress track instead of implying Phase 4 progress functionality.

## Execution steps

### 1. Establish pure session and input contracts

Add `src/lib/typing/typing-engine.ts`:

- Define typed session states, accepted character/backspace actions, and a small keyboard-event shape for input filtering.
- Add create/restart and immutable transition functions with start/end timestamps.
- Guard against empty or unsupported targets with an explicit error.
- Enforce buffer bounds, cumulative counters, terminal completion, and safe no-op Backspace.
- Derive correct buffer count, elapsed milliseconds, rounded WPM, and one-decimal accuracy; retain `null` for pre-session metric placeholders.

**Exit criteria:** deterministic state transitions and exact numeric expectations are testable without a browser.

### 2. Add focused automated tests

- Add Vitest 4 for pure-engine tests and Playwright for browser integration tests as development-only dependencies; retain the updated lockfile. Vitest 4 preserves the existing Node 20.19+/22.12+ support and supports Vite 8; do not require Vitest 5's newer Node baseline.
- Add `test` and `test:e2e` scripts without altering existing development/build commands.
- Unit cases: initialization/invalid targets, start on correct or incorrect input, immutable updates, spaces/case/punctuation, correction history, empty Backspace, completion with errors, ignored post-completion input, restart, zero elapsed time, known WPM values, one-decimal accuracy, deleted correct characters, and modifier/composition/repeat filters.
- Browser cases: no page-load autofocus, keyboard and pointer entry, visible character states, empty/native input containment, shortcuts/Tab, blur/refocus, completion lock, restart/focus, live/frozen metrics, lifecycle timer cleanup, and desktop/narrow layout.
- Browser tests use an isolated local Vite server with no dependency on a user's running server.

**Exit criteria:** reproducible `npm test` and `npm run test:e2e` commands cover both mathematical behavior and actual DOM interaction.

### 3. Wire the practice component

Update `PracticePanel.svelte`:

- Own a component-local session and a clock sample; derive displayed metrics rather than maintaining separate metric counters.
- Bind the hidden input, translate accepted keydown actions, and scope all keyboard handling to that input.
- Keep the native input value empty and make unsupported native edits unable to mutate engine state.
- Render correct, error, active, and remaining states with a stable accessible target string.
- Add start/resume focus control, concise lifecycle status, and enabled restart.
- Refresh the clock every 100 ms only while running. Use a Svelte effect teardown to clear the interval on status change and component destruction.

**Exit criteria:** the fixed exercise can be started, corrected, completed, and restarted with keyboard or pointer, without global capture.

### 4. Integrate presentation and documentation

- Reuse theme tokens; add active-block, error-underline, input-focus, and enabled-button styles.
- Preserve word wrapping, mobile/narrow layout, tabular metric numerals, and reduced-motion behavior.
- Update footer phase copy and README status, practice instructions, test setup, and document links.
- Mark the Phase 2 detail design implemented only after verification; record any necessary clarifications there.

**Exit criteria:** the app no longer describes working practice as an unavailable preview, while modes/Settings/Stats remain clearly unavailable.

### 5. Verify and publish

1. Run focused unit tests, `npm run check`, and `npm run build`.
2. Run browser integration tests against Chromium and inspect the rendered accessibility structure.
3. Confirm no page overflow at 1440, 768, and 320 px; confirm no runtime errors, storage writes, permission prompts, or external requests are introduced.
4. Inspect the complete diff and whitespace checks; retain only Phase 2 changes.
5. Commit the design, plan, implementation, tests, and related docs with the required co-author trailer.
6. Push `main` to the configured `origin`; verify the remote branch points to the resulting commit and the worktree is clean.

If a remote/authentication failure prevents push, retain the verified local commit and report the exact blocker rather than claiming publication.

## File-level change map

| Path | Change |
| --- | --- |
| `doc/phase-2-detail-design.md` | Include the governing design, implementation status, and clarified input/timing/focus behavior. |
| `doc/phase-2-implementation-plan.md` | This implementation plan and verification results. |
| `src/lib/typing/typing-engine.ts` | Pure session engine, keyboard filtering, and derived metrics. |
| `src/lib/typing/typing-engine.test.ts` | Deterministic engine and input unit tests. |
| `src/lib/components/PracticePanel.svelte` | Focused input, reactive renderer, metrics, lifecycle, and controls. |
| `src/lib/components/AppFooter.svelte` | Accurate Phase 2 status copy. |
| `src/app.css` | Shared practice and enabled-control presentation. |
| `package.json`, `package-lock.json` | Test commands and development-only test dependencies. |
| `playwright.config.ts`, `tests/practice.spec.ts` | Isolated browser verification configuration and scenarios. |
| `tests/fixtures/practice.html` | Mount/unmount fixture for browser verification of timer teardown. |
| `tsconfig.json` | Include browser tests and their configuration in the existing type check. |
| `README.md` | Implemented scope, usage, verification commands, and document links. |

## Verification results

Implementation and verification completed with Node.js 24.13.1 and npm 11.8.0:

| Check | Result |
| --- | --- |
| `npm test` | 48 engine/input tests passed with Vitest 4.1.12. |
| `npm run check` | Zero errors and zero warnings, including browser test TypeScript. |
| `npm run test:e2e` | 12 Chromium integration tests passed. |
| `npm run build` | Production build passed. |
| Production UI inspection | Preview responded with HTTP 200; accessibility snapshot included the full target, named input, metric group, status, and working controls. |
| Responsive inspection | No page/panel overflow at 1440, 768, and 320 px; 320 px production screenshot inspected. |
| Lifecycle/input isolation | Verified interval cleanup on restart, completion, and component unmount; no capture outside focused input. |
| Scope checks | Browser tests found no runtime errors, external requests, or persistence access during practice/restart. |

Automated browser coverage is Chromium only; Firefox and Safari were not exercised in this implementation run. Test dependencies preserve the project's existing Node support; execution on Node 20/22 was not separately repeated.
