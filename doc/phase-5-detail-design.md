# AliceType — Phase 5 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 5: Storage & Polish |
| Status | Implemented |
| Source design | [Technical Design Document](./tech-design.md) |
| Preceding phase | [Phase 4 Detail Design](./phase-4-detail-design.md) |
| Implementation plan | [Phase 5 Implementation Plan](./phase-5-implementation-plan.md) |

## 2. Purpose

This document defines the detailed design and acceptance criteria for persisting AliceType's implemented preferences, recording completed typing sessions locally, presenting a usable statistics view, and polishing practice startup and typing feedback.

Phase 5 builds on the Timed and Words sessions and focused input path from Phase 4. It does not change exercise generation, the typing engine's metric definitions, or the physical-key feedback contract from Phase 3. All user data remains in the browser; no account, backend, or network service is introduced.

## 3. Phase 5 scope

### 3.1 In scope

- Versioned persistence of currently implemented practice configuration and Phase 5 presentation/sound preferences in `localStorage`.
- IndexedDB storage of completed Timed and Words sessions, including WPM, accuracy, mode/limit, completion date, and physical keys associated with incorrect characters.
- A Stats view that summarizes and lists locally stored sessions and key-level errors.
- Clear, recoverable handling of unavailable, blocked, malformed, or failed browser storage.
- A first-use keyboard onboarding overlay with an explicit user action and optional use of `navigator.keyboard.getLayoutMap()` when available.
- Optional, user-controlled typing click sounds and selectable caret presentation (Block, Line, Underline).
- A user preference to hide or show live WPM and accuracy while practicing.
- Focused tests for persistence, migration/validation, session recording, startup, sound controls, and regression behavior.

### 3.2 Out of scope

- Quote, Custom, and Zen modes, and Normal/Expert/Master difficulty rules. Only the existing Timed and Words modes are persisted and shown as available.
- Theme selection; the current charcoal/orange theme remains the sole supported theme.
- The Keyboard Keys Test Matrix and its independent sound-effect library, test counts, or persistence.
- Keyboard catalog/device identification or claims that browser APIs detect a keyboard's brand, model, version, RGB, or other hardware capabilities.
- A backend, account, telemetry, synchronization, import/export, or transmission of settings, typing text, or statistics.
- Persisting generated targets, raw typed text, individual keystrokes, or in-progress sessions.
- Adding a state-management, storage-wrapper, or audio dependency.

The technical design's broader settings and difficulty concepts are not treated as implemented merely because their fields are mentioned in that document. Persist only controls actually provided in this phase.

## 4. Technical decisions

| Concern | Phase 5 decision |
| --- | --- |
| Framework and language | Continue using Svelte 5 and TypeScript. |
| Preferences | Store one versioned, validated preferences record in `localStorage`; retain Phase 4 defaults when no record exists. |
| Historical sessions | Use native IndexedDB, with one record per completed session and an index on completion time. |
| Storage boundary | Keep serialization, validation, schema upgrades, and transaction handling in small browser-storage modules; keep the typing engine pure and storage-agnostic. |
| Persistence timing | Save preferences when a user changes them. Save a session once at completion, never on each keystroke. |
| Session completion | Preserve the existing mode-specific completion rules and frozen metrics. A storage failure must not turn a completed exercise into a typing failure. |
| Keyboard onboarding | Treat the overlay as an onboarding/focus step, not a claim that a permission is required. Keyboard input continues to use the focused practice input; do not add a global listener. |
| Keyboard layout map | If supported, request `navigator.keyboard.getLayoutMap()` only after the user's explicit action. Use it only for optional layout/legend assistance; if absent or denied, continue with the generic Alice/US ANSI display and normal typing. |
| Typing sound | Generate a short, quiet click with the Web Audio API after an accepted printable key action. Do not bundle unlicensed audio. Sound is off by default and only plays after explicit opt-in. |
| Errors | Report storage and optional capability failures visibly and accessibly. Do not silently claim data was saved or replace a failed operation with success-shaped state. |

The browser's standard `keydown` events do not require a keyboard permission prompt. `navigator.keyboard.getLayoutMap()` is not universally available and does not identify keyboard hardware. The application must remain usable without it and must not describe its optional layout-map result as a physical-device identity.

## 5. Preferences

### 5.1 Persisted fields and defaults

Persist a record with a schema version and only validated values:

| Field | Allowed values | Default |
| --- | --- | --- |
| `mode` | `timed`, `words` | `timed` |
| `durationSeconds` | 15, 30, 60, 120 | 30 |
| `wordLimit` | 10, 25, 50, 100 | 25 |
| `wordBankTier` | 200, 1000, 5000 | 200 |
| `punctuation` | boolean | `false` |
| `numbers` | boolean | `false` |
| `caretStyle` | `block`, `line`, `underline` | `block` |
| `soundEnabled` | boolean | `false` |
| `showLiveStats` | boolean | `true` |
| `onboardingComplete` | boolean | `false` |

The preference type extends the Phase 4 `PracticeSettings` with the three presentation/sound fields and onboarding state. Do not persist a derived session configuration, target text, active input, elapsed time, or running flag. Keep the inactive mode's limit in preferences so switching modes retains the selected duration and word count.

Use a single namespaced key, `alicetype.preferences`, whose JSON value has the form `{ "version": 1, "settings": { ... } }`. Keep the storage key and schema version explicit in the storage module. A schema version change must include a defined migration from each supported older version.

Version 1 is the first persisted schema; there is no earlier supported version to migrate. Unsupported versions are rejected explicitly. A future version must add actual migration cases and tests rather than treating unknown data as a valid earlier record.

### 5.2 Load, validate, and save behavior

- On startup, load and validate the preference record before creating the initial exercise.
- If the key is absent, use Phase 4 defaults and do not write until the user changes a preference or completes onboarding.
- Parse the record as untrusted input. Validate the version, every enum/number/boolean, and required properties; reject malformed values rather than passing them to the generator or UI.
- For a supported older version, migrate in memory, validate the result, then write the new version. Do not discard valid known fields during migration.
- For invalid JSON, unsupported future versions, or invalid fields, use safe defaults and show a persistent, dismissible message that saved preferences could not be loaded. Do not overwrite the original record automatically; the user may explicitly restore defaults or change and save preferences.
- Dismissing onboarding after a load failure updates memory only; it must not overwrite the unreadable record.
- Catch storage access and quota/security errors at the persistence boundary. Keep the selected value active in memory, but show that it was not saved and provide a retry path. Do not announce successful persistence until `setItem` succeeds.
- Save a coherent full record after each preference change. Prevent stale asynchronous callbacks from restoring older values. Do not write while a session is running; settings are disabled during a run under the existing Phase 4 behavior.
- Restoring defaults requires an explicit user action and confirmation before replacing stored preferences.

### 5.3 Settings interface

Replace the current non-interactive Settings placeholder with a keyboard-operable view or panel. Organize controls under Practice, Display, and Sound. Provide visible labels, current values, and a clear Restore defaults action. Changes apply immediately to future ready exercises; active session settings remain frozen until Restart, consistent with Phase 4.

The Practice section links to the existing practice configuration controls instead of duplicating them. Keep practice mounted while viewing Settings/Stats, but hide it from rendering and focus. Disable view navigation during running sessions; Restart unlocks navigation. Pass presentation preferences separately from generator configuration so a sound/caret/live-stat change does not generate a different exercise. Restore defaults preserves the current onboarding-complete flag and does not delete history.

Caret selection changes only the active-character marker in the practice text. It must not alter character states or engine behavior. Hiding live statistics removes the live WPM/accuracy presentation without removing progress, target text, or final session recording. The preference applies only to the practice presentation; the Stats view remains available.

## 6. IndexedDB session history

### 6.1 Database schema

Use database `alicetype` with schema version `1` and object store `sessions`, keyed by stable `id`. Create an index named `completedAt` on the numeric completion timestamp. Do not add a separate summary store; derive summaries from stored sessions so there is only one authoritative record.

Each completed-session record contains:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Unique idempotency key generated once for the session. |
| `completedAt` | number | Wall-clock Unix timestamp in milliseconds at completion. |
| `mode` | `timed` or `words` | Mode used by the frozen session configuration. |
| `limit` | number | Configured duration in seconds or base-word limit, according to `mode`. |
| `wordBankTier` | 200, 1000, or 5000 | Vocabulary tier used. |
| `punctuation` | boolean | Whether punctuation was enabled. |
| `numbers` | boolean | Whether number insertion was enabled. |
| `wpm` | finite non-negative number | Frozen final WPM from the existing metric helper. |
| `accuracy` | finite number from 0 to 100 | Frozen final accuracy from the existing metric helper. |
| `totalAttempts` | non-negative integer | Total printable attempts, including errors later corrected. |
| `correctAttempts` | non-negative integer | Correct printable attempts under the existing engine semantics. |
| `missedKeys` | object from physical code to positive integer | Counts of accepted incorrect printable attempts by `KeyboardEvent.code`. |

Do not store the target, input string, or raw events. Persist the completion date, not a monotonic `performance.now()` value. Never infer a missed key from a typed character when the event's physical `code` is unavailable; omit that event from `missedKeys` while preserving session totals.

### 6.2 Recording and idempotency

- A `ready` or restarted-but-unstarted exercise is not a session record.
- At Timed expiry or Words completion, create one immutable record from the frozen session metrics and configuration. Include the final partial Timed session and sessions with typing errors.
- Generate a random 128-bit session ID on the first accepted character. Capture wall time then and add the engine's frozen elapsed time for `completedAt`, so delayed timer callbacks do not move a Timed completion date past its deadline.
- Track mismatch counts in the active practice session using the pre-action comparison and the physical `KeyboardEvent.code`. Backspace does not subtract errors; a corrected retype is a new attempt.
- Commit the record in one IndexedDB read/write transaction. Use the session's stable `id` as key and an idempotent write so a repeated completion callback or retry cannot create duplicates.
- Do not serialize every keystroke or save interim sessions. A reload abandons an unfinished session.
- If IndexedDB is unavailable, blocked, or the transaction fails, leave the typing session completed and show a clear storage warning with Retry. Retrying the same completed session writes the same `id`; it must not alter metrics or create another record.
- Keep pending records and retry controls at app level so Restart or navigation cannot erase a failed completed result. Pending results survive only for the current page; do not claim durability until transaction completion. Disable history clearing until pending saves are resolved to avoid deletion/write races.
- On database upgrade, perform only schema creation/migration in `onupgradeneeded`. Handle blocked upgrades with a message that an older AliceType tab should be closed. Close the connection on application teardown or `versionchange`.
- Do not clear old records automatically. Provide a user-initiated clear-history action with confirmation; remove all session records in one transaction and report transaction failure.

### 6.3 Statistics view

Replace the non-interactive Stats placeholder with an accessible Stats view. Show:

- Completed-session count.
- Best WPM and average WPM, calculated from stored session WPM values.
- Average accuracy, calculated as the arithmetic mean of each session's accuracy; label the method.
- A recent-session list ordered newest first, with date/time, mode and limit, WPM, and accuracy.
- A most-missed-keys heatmap aggregated from stored `missedKeys`, using the same active Alice layout, geometry, and browser/reference legends as Practice and Keyboard Test. Each mapped key shows its exact miss count, including zero. Heat intensity is `key miss count / highest aggregated physical-key miss count`, with zero neutral and the ceiling the strongest red; it is not a per-key accuracy/error percentage. Shared-code keycaps share the count and heat. Inert keycaps remain dashed without fabricated counts. Provide expandable text results and list historical codes outside the selected layout separately; those codes still contribute to the ceiling. Do not claim detected hardware or legends.
- An explicit empty state when there are no saved sessions.

Read history from IndexedDB when the Stats view opens and after a successful save or deletion. Keep derived summaries in memory only. Use semantic headings, table/list markup with labels, and concise dates with an accessible full timestamp. Do not add animated or rapidly updating live announcements.

Stats uses three distinct bordered sections: **Stats summary**, **Recent sessions**, and **Most-missed physical keys**. Summary metrics use responsive individual cards with aligned numeric baselines and tabular digits, preserving the separate target-copying and Zen definitions. History scrolls horizontally and vertically inside a maximum 25rem viewport with sticky column headers, alternating rows, and right-aligned numeric columns. The keyboard diagram retains its keyboard-scrollable narrow-screen presentation.

Destructive actions throughout the app use the shared red/error button treatment, including clear history/text/details/layout confirmation/checked keys, restore defaults, and practice/test restarts. Confirmation dialogs retain a neutral Cancel action and a filled red confirmation action. Existing confirmation, persistence, and reset behavior is unchanged.

Validate every stored record on read, including records missing an indexed timestamp; fail explicitly rather than silently skipping malformed history. Sort validated records newest-first (with stable ID tie-breaking). The v1 time index is created for future indexed retrieval; current reads inspect the entire store for validation.

## 7. Keyboard onboarding and optional layout access

### 7.1 First-use flow

- On the first visit without `onboardingComplete`, show a dismissible welcome overlay with a concise explanation of focused typing, the generic Alice visualizer, and optional keyboard-layout support.
- Center the welcome dialog horizontally and vertically in the viewport, keeping at least 1rem of edge spacing and allowing its contents to scroll on short screens. Shared dialog styles explicitly restore automatic margins after the Tailwind reset.
- Provide a clearly labeled primary action such as **Start practicing** and a secondary **Continue without layout access** action. Both actions dismiss the overlay and mark onboarding complete locally.
- The primary action is a real button activated by pointer, Enter, or Space. It focuses the practice input only after the explicit activation; do not capture keys on the overlay or attach a global keyboard handler.
- If a layout map is supported, call `navigator.keyboard.getLayoutMap()` from that user-activated action. Use a successful result only for optional key-label assistance where the UI can represent it without claiming physical device identity.
- Focus immediately after explicit Start activation, independently of the optional API promise. Show a labeled sample of browser layout legends in a dismissible note; do not change the generic SVG geometry/legends or wait for permission before enabling practice.
- If the API is missing, the call rejects, or access is denied, continue with generic US ANSI legends and show a concise non-blocking explanation only when relevant. Do not repeatedly prompt or block typing.
- Never claim that pressing the button has identified or connected a specific keyboard. The browser reports layout mappings, not trustworthy make/model or feature data.
- If saving the onboarding-complete flag fails, dismiss the overlay for the current page and show the preference-storage warning. The next page load may show onboarding again.

### 7.2 Focus and lifecycle

Continue to process typing only through the focused practice input. Do not register document/window-level `keydown` or `keyup` listeners, intercept browser/system shortcuts, or require `navigator.keyboard.getLayoutMap()` for the core exercise. Dispose any optional API result and pending UI work when the owning view is destroyed.

## 8. Typing sound and caret presentation

### 8.1 Sound

- Sound is disabled by default. Add a visible, labeled toggle on the Settings view.
- Play a brief, low-volume click only for a printable character accepted by the existing Phase 4 input filter. Do not play for Backspace, ignored keys, shortcuts, composition, auto-repeat, unfocused input, or after completion.
- Create or resume the audio context only from a user gesture. If audio is unsupported or unavailable, keep typing functional, turn the sound preference off in memory, and show a concise accessible error. Do not repeatedly create audio contexts.
- Keep the sound short, bounded in volume, and independent from correctness, key feedback, or the separate future Keyboard Keys Test sound library.
- Stop/release audio resources when the application or relevant component is destroyed. Do not persist audio buffers or record sound events.

### 8.2 Caret

Provide Block, Line, and Underline options using the current theme's accent color and visible state contrast. The style applies only to the active target character, remains visible at narrow widths, and respects reduced-motion preferences. It must not change the target's accessible text or cause session announcements.

## 9. UI, accessibility, and privacy

- Keep the existing landmarks and heading hierarchy. Settings and Stats navigation must be native, keyboard-operable controls with a programmatic selected state.
- Implement the onboarding overlay as a labeled dialog with focus contained while open, a visible close/continue route, and focus returned to the invoking control when dismissed without starting practice.
- Preserve the Phase 4 visible practice instructions, progress text, and practice input behavior. Do not make onboarding a permanent focus trap.
- Announce storage failures and successful history deletion through a concise status/alert region. Do not announce every history read or keypress.
- Ensure sound and display controls are operable without color-only cues. Respect `prefers-reduced-motion`.
- Store preferences and statistics only in the browser's same-origin storage. No network requests, analytics, external audio fetches, or transmission of target/typed text are allowed.
- Make history deletion explicit and irreversible only after confirmation. Keep a clear indication that history is local to this browser.

## 10. Component and module responsibilities

| Path | Responsibility |
| --- | --- |
| `src/lib/storage/preferences.ts` | Preference schema/version, default values, validation, migrations, `localStorage` load/save, and explicit storage errors. |
| `src/lib/storage/session-history.ts` | IndexedDB open/upgrade/close lifecycle, typed session records, idempotent writes, ordered reads, key aggregation inputs, and confirmed clear operation. |
| `src/lib/storage/errors.ts` | Shared storage error and unknown-record guard at browser persistence boundaries. |
| `src/lib/audio/typing-sound.ts` | Lazy Web Audio context, quiet generated click, explicit audio errors, and resource cleanup. |
| `src/lib/typing/typing-engine.ts` | Preserve pure session/metric behavior; expose or retain the final data needed by the UI but do not import browser storage or audio. |
| `src/App.svelte` | Load preferences before child initialization, own navigation, pending-save retries, optional layout-map/audio lifecycle, and pass validated settings and callbacks to views. |
| `src/lib/components/AppHeader.svelte` | Provide accessible navigation among implemented practice modes and the Settings/Stats views. |
| `src/lib/components/PracticePanel.svelte` | Apply persisted practice/display preferences, count mismatched physical codes, trigger accepted-key sound, and submit one completed-session record. |
| `src/lib/components/SettingsPanel.svelte` | Present and update practice, caret, sound, and live-stat preferences; expose restore-defaults and persistence status. |
| `src/lib/components/StatsPanel.svelte` | Load and display local history, aggregate summaries, empty/error states, retry, and confirmed history deletion. |
| `src/lib/components/KeyboardOnboarding.svelte` | Render first-use dialog and report explicit start/skip activation to the app's optional layout-map/focus path. |
| `src/lib/components/ConfirmationDialog.svelte` | Reusable native modal confirmation and focus restoration for reset/delete actions. |
| `src/app.css` and component styles | Add caret variants, dialog and settings/history layout, and responsive/accessibility states using existing theme tokens. |
| `src/lib/storage/preferences.test.ts` | Cover defaults, storage read/write errors, schema validation, supported migrations, corrupt/future data, and no silent overwrite. |
| `src/lib/storage/session-history.test.ts` | Cover completed-record validation, frozen metric/timestamp conversion, privacy shape, and summary arithmetic. |
| `tests/storage.spec.ts` and `tests/fixtures/app.html` | Real-browser IndexedDB transactions/upgrades/retries/deletion, preferences, onboarding, audio, display settings, responsive views, and app teardown. |
| `tests/practice.spec.ts`, `tests/modes.spec.ts`, `tests/visualizer.spec.ts` | Cover preference restoration, sound/caret/stats display behavior, session-save boundaries, onboarding, navigation, and Phase 2–4 regressions. |

Keep storage and audio code out of the typing engine. Do not introduce a global keyboard service, generic persistence framework, or a second keyboard-input path.

## 11. Implementation sequence

1. Define typed preference and session-history schemas, validators, storage error types, and unit tests before wiring UI.
2. Implement versioned `localStorage` loading/saving and deterministic fallback/error presentation; initialize the app from validated preferences.
3. Implement IndexedDB schema creation, idempotent session writes, ordered reads, and explicit history deletion with focused database tests.
4. Extend the existing practice completion path to record frozen metrics/configuration exactly once and aggregate incorrect `KeyboardEvent.code` counts without changing engine formulas.
5. Add Settings and Stats views, accessible navigation, persistence status, empty/error states, and preference application to new ready exercises.
6. Add the first-use onboarding dialog with optional layout-map access and keyboard-safe focus handling.
7. Add sound and caret controls; verify accepted-key-only sound, audio resource cleanup, live-stat visibility, and reduced-motion behavior.
8. Run unit, type, build, and browser tests. Verify storage persistence across reload, blocked/unavailable storage behavior, keyboard-only navigation, responsive layouts, no runtime network requests, and no Phase 2–4 regressions.

Do not implement other practice modes, difficulty levels, theme selection, test-matrix audio/counts, device catalog or hardware identification, synchronization, or backend functionality in this sequence.

## 12. Verification and acceptance criteria

Phase 5 is complete when all of the following are true:

- Implemented preferences load before the initial exercise and survive reload with valid values; absent data uses Phase 4 defaults.
- Invalid, unsupported, or inaccessible preference data produces a visible, recoverable warning, is not silently overwritten, and cannot inject invalid configuration into the generator.
- Supported migrations preserve valid known values and write the new schema only after successful validation.
- Mode limits, vocabulary, and modifier selections persist, including the inactive mode's limit; active session settings stay frozen until restart.
- Caret style, sound opt-in, and live-stat visibility persist and have the specified effect without changing input, progress, WPM, accuracy, or session completion semantics.
- Sound is off by default and plays only on accepted printable input after user activation; unsupported audio does not prevent typing and is reported.
- The first-use overlay is accessible, can be dismissed without optional layout access, and never blocks core typing on an unsupported or denied layout-map API.
- No document/window keyboard listener is added. Core typing remains attached to the focused practice input, and browser shortcuts/navigation remain usable.
- Each completed Timed or Words session produces exactly one local record with frozen metrics, frozen configuration, timestamp, and available physical-code error counts. Ready, restarted-unstarted, and abandoned sessions are not recorded.
- Session records contain no target text, typed text, or raw keystroke sequence. No app data is sent over the network.
- IndexedDB handles upgrades, blocked opens, and transaction failures explicitly. A failed save does not present false success or change the completed typing result; retry is idempotent.
- Stats shows an empty state or correct summaries/list, orders sessions newest-first, identifies missed keys by physical code, and allows confirmed local history deletion.
- Settings, Stats, onboarding, storage error/retry, and deletion flows work with keyboard and assistive technology and remain usable at narrow viewport widths.
- Configured type checks, focused unit tests, browser tests, and production build pass. No unrelated dependencies or external runtime requests are introduced.

## 13. Risks and implementation notes

- **Browser storage availability:** Private browsing modes, policy, quota, and embedded contexts may disable storage. Keep errors visible and keep the current practice session usable.
- **IndexedDB lifecycle:** Multiple tabs can hold older connections open during an upgrade. Handle `blocked` and `versionchange`; do not leave transactions open across UI work.
- **Duplicate completion writes:** Timed expiry can be observed by both a timer callback and a key event. Use one completion id and idempotent storage writes rather than relying only on callback ordering.
- **Metric fidelity:** Persist the engine's frozen result and configuration at completion. Do not recompute historical metrics using later formulas or current preferences.
- **Physical-key counts:** `KeyboardEvent.code` may be absent or unmapped. Keep total accuracy/session counts correct and omit unknown physical identities rather than guessing from a character.
- **Audio policies:** Browsers may suspend audio until a user gesture. Initialize on explicit opt-in/accepted action, avoid autoplay, and preserve normal typing when audio is unavailable.
- **Permission wording:** The overlay is onboarding, not a required keyboard-device permission. Do not imply hardware detection or block use behind an API that may not exist.
- **Privacy:** Local history is sensitive user data even without a backend. Avoid storing text, provide clear/delete controls, and state plainly that data is stored in this browser.
- **Scope boundary:** Quote/Custom/Zen, difficulty, alternate themes, Keyboard Keys Test Matrix behavior, and device details remain outside Phase 5.
