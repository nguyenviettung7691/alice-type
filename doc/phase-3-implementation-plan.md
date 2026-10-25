# AliceType Phase 3 Implementation Plan

## Goal and design analysis

Implement [Phase 3 Detail Design](./phase-3-detail-design.md) on the existing Svelte 5 + TypeScript practice view. Deliver an inline SVG generic Alice keyboard with transient physical-key feedback while preserving the Phase 2 exercise, input filtering, metrics, correction, completion, and restart rules.

The existing `PracticePanel.svelte` already owns focused input and the session. Extend that input path rather than introducing another listener or changing the DOM-free typing engine. `KeyboardEvent.key` determines character correctness; `KeyboardEvent.code` selects the illustrated physical position. Unknown codes must still permit accepted text input.

## Resolved implementation details

- Use a generic US ANSI Alice arrangement: staggered rows, two oppositely angled halves, a center gap, and split thumb spacebars. This is not a detected device or a manufacturer-specific profile.
- Define explicit keycap coordinates in a stable SVG coordinate system. Use physical code as the unique logical key identifier; a logical key can have more than one drawn keycap. In particular, both split spacebars belong to one `Space` entry and illuminate together because browser events do not distinguish which thumb spacebar was pressed.
- Include the US ANSI printable codes (letters, number row, and punctuation), Space, and the common editing/modifier keys needed to make the illustration recognizable. Do not invent `Fn` or hardware-specific event codes.
- Each accepted printable keydown gets a `correct` or `incorrect` state for exactly 300 ms. Different keys expire independently; another press of the same code cancels and replaces its previous timeout.
- Compute the match against the pre-action target position, then apply the existing engine action exactly once. Backspace edits the session but adds no correctness feedback.
- Preserve handled-key default prevention after completion, but do not apply an action or generate feedback. Completing the target clears all feedback immediately, including the final key; completion takes precedence over the 300 ms flash.
- Blur, restart, and teardown cancel all feedback timeouts and clear key states. These timers are separate from the existing WPM refresh interval.
- Give the SVG an instance-unique title and description. Use shape markers as well as orange/red states, with a visible legend. Do not make keycaps interactive or announce each key.
- Scale the diagram to its container with a legibility-preserving minimum width and contained horizontal scrolling. Observe its container size to add a keyboard-focusable scroll region only when it overflows; preserve the existing desktop tab order otherwise.
- Add no dependency, permission prompt, global keyboard listener, persistence, sound, mode behavior, or device detection.

## Execution steps

### 1. Add the typed static layout

Create `src/lib/keyboard/alice-layout.ts`:

- Define readonly key and keycap geometry types, half transforms, SVG bounds, and a unique-code lookup.
- Store static generic legends and positions separately from presentation and session state.
- Represent both spacebar shapes under one logical `Space` entry.
- Expose the small feedback-state type consumed by the practice component and renderer.

Add `src/lib/keyboard/alice-layout.test.ts`:

- Assert unique logical codes and non-empty legends/keycaps.
- Assert finite, positive geometry within the declared local bounds and both halves are populated.
- Verify coverage of all standard US printable physical codes, including every character in the fixed exercise.
- Verify the one-code/two-keycap Space representation and rejection of unmapped codes.

**Exit criteria:** the generic map is deterministic, testable without a browser, and does not contain inferred device facts.

### 2. Render the accessible SVG

Create `src/lib/components/AliceKeyboardVisualizer.svelte`:

- Accept readonly layout and feedback props; render neutral keycaps, legends, and correct/mismatch shape markers.
- Use the shared theme tokens, an accessible image name/description, and a visible neutral/correct/mismatch legend.
- Describe generic US ANSI legends and the single logical Space mapping without claiming automatic detection.
- Add responsive scaling, contained overflow, a visible scroll-region focus outline, and resize-observer cleanup.
- Avoid animation and per-key focus stops or live announcements.

**Exit criteria:** the split arrangement is recognizable, readable, accessible, and independent of the typing engine.

### 3. Wire focused input and transient feedback

Update `PracticePanel.svelte`:

- Preserve input filtering, native-edit containment, focused-only capture, and existing default prevention.
- Compare an accepted character against the old target position and apply the engine transition once.
- Store key feedback locally, maintain one timeout per mapped physical code, and cancel superseded timers.
- Clear feedback on completion, blur, restart, and destruction; avoid late flashes after completion.
- Render the diagram between the target label and practice controls without breaking the input/label focus styling.

**Exit criteria:** correct and mistyped characters highlight the pressed physical key, while text and metrics retain Phase 2 semantics.

### 4. Add browser coverage and update documentation

Create `tests/visualizer.spec.ts` using the existing Playwright setup:

- Assert accessible SVG, generic-layout explanation, non-interactive keycaps, and distinct non-color feedback.
- Use the browser clock to measure the 300 ms lifetime, independent expiration, replacement, and ignored repeat behavior.
- Exercise shifted characters, mismatches, physical code versus character identity, missing/unmapped codes, Backspace, shortcuts, composition, and unfocused input.
- Verify blur, restart, completion, post-completion input, and unmount cleanup; track feedback timeouts in the isolated lifecycle fixture.
- Verify no page/panel overflow at 1440, 768, and 320 px, and keyboard scrolling when the diagram overflows.
- Retain the existing practice regression suite for metrics, corrections, focus, input filtering, no persistence/network usage, and interval cleanup.

Update `package.json` so `npm test` includes both typing and keyboard unit tests. Update README usage/status/document links and footer copy. Clarify the detail design's logical-key/spacebar model and completion precedence. Mark the design implemented only after successful verification.

**Exit criteria:** the documented feature and test commands agree with the actual implementation.

### 5. Verify, commit, and push

1. Run `npm test`, `npm run check`, and `npm run build`.
2. Run `npm run test:e2e` against the isolated Chromium server; fix failures caused by this phase and rerun affected coverage.
3. Inspect the rendered desktop and narrow layout, including the two angled halves, spacebars, labels, focus, and feedback markers.
4. Review the complete scoped diff and run `git diff --check`.
5. Record actual verification outcomes in this plan and mark the detail design implemented.
6. Commit the Phase 3 design, this plan, implementation, tests, and related documentation with the required co-author trailer.
7. Push the current `main` branch to its configured `origin`. Confirm the remote branch hash equals the new local commit and the worktree is clean.

If publication is blocked by remote changes, permissions, or authentication, retain the verified local work and report the blocker. Do not overwrite remote work or claim a push succeeded without checking.

## File-level change map

| Path | Change |
| --- | --- |
| `doc/phase-3-detail-design.md` | Governing design, implementation clarifications, and verified status |
| `doc/phase-3-implementation-plan.md` | Analysis, execution sequence, and verification results |
| `src/lib/keyboard/alice-layout.ts` | Generic geometry, legends, physical mapping, feedback types |
| `src/lib/keyboard/alice-layout.test.ts` | Static mapping and geometry coverage |
| `src/lib/components/AliceKeyboardVisualizer.svelte` | Accessible responsive inline SVG |
| `src/lib/components/PracticePanel.svelte` | Focused physical-code feedback and timeout lifecycle |
| `src/lib/components/AppFooter.svelte` | Accurate feature status copy |
| `tests/visualizer.spec.ts` | Feedback, lifecycle, accessibility, and responsive browser tests |
| `package.json` | Include keyboard unit tests in the existing runner |
| `README.md` | Implemented scope, diagram behavior, and document links |

## Verification results

- `npm test`: passed, **52 tests** across the typing-engine and layout suites. Layout checks cover all 95 printable ASCII character mappings, 60 unique physical codes, both Space shapes, valid geometry, non-overlap, and transformed SVG bounds.
- `npm run check`: passed with **0 errors and 0 warnings**.
- `npm run build`: passed.
- `npm run test:e2e`: passed, **26 Chromium tests**, including all 12 existing Phase 2 regressions and 14 new visualizer tests.
- Fake-clock browser checks verify feedback remains visible at 299 ms and is removed at 300 ms, independent expiration, same-code replacement, ignored repeat, and all specified cleanup paths.
- Browser checks verify layout containment at **1440, 768, and 320 px**. The diagram fits without an extra focus stop at 1440 and 768 px; it is keyboard-scrollable at 320 px.
- Desktop and narrow-window visual inspection confirmed the angled halves, split spacebars, legible key legends, visible state legend, and contained scrolling. The interactive browser window's minimum width was 502 px; automated Chromium tests cover the required 320 px case.
- The scroll container intentionally suppresses Svelte's non-interactive-tabindex warning with a documented local directive: focus is required for native arrow-key scrolling and is enabled only while overflowing. No keycap receives focus.
- Initial validation identified a test serialization type issue and test assumptions about exact legend text and 768 px overflow; these were corrected. The final complete suites above pass.
- No dependency changes, typing-engine changes, generated exercises, device detection, permissions, sound, persistence, or global keyboard listeners were introduced.
