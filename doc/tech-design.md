# Technical Design Document: Alice Layout Practice Web App

## 1. Overview & Objectives

A lightweight, frontend-only web application designed specifically for desktop users to practice typing on an Alice (split-ergonomic) keyboard layout. The application focuses on a seamless, distraction-free UI with a striking orange accent, real-time performance tracking, and customizable practice modes.

## 2. Technology Stack

Since the app needs to be lightweight and runs entirely in the browser (no backend required), the following stack is recommended:

* **Framework:** React (via Vite) or Svelte. Svelte is highly recommended for building ultra-lightweight, fast-loading apps with minimal bundle sizes.
* **Styling:** Tailwind CSS. Allows for rapid UI development and easy enforcement of the "striking orange" theme (`text-orange-500`, `bg-orange-500`).
* **State Management:** Context API (React) or Svelte Stores.
* **Data Storage:** `localStorage` (for settings) and `IndexedDB` (using a wrapper like Dexie.js for storing historical stats/scores).
* **Icons/Assets:** Lucide Icons (lightweight SVG icons).

## 3. UI/UX Layout (Desktop-Optimized)

* **Color Palette:** Dark gray/charcoal background (e.g., `#1A1A1A`) to reduce eye strain, with high-contrast, striking orange (`#FF5D00`) as the primary accent for active elements, progress bars, and the caret.
* **Header:** Minimalist. Contains the AliceType title and navigation for Practice, Keyboard Test, Keyboard Details, and Stats; practice modes/settings live in Practice. Phase 10 adds a simple language selector at the far right.
* **Center Stage (Typing Area):** Large, highly legible text. The current word is highlighted, correct letters turn faint gray, incorrect letters turn red, and the active cursor is a blinking orange block.
* **Progress & Live Stats:** A thin, striking orange progress bar spanning the width of the typing area. Live WPM and accuracy display subtly above or below the text block.
* **Alice Keyboard Visualizer (Bottom):** An SVG-based visual representation of the Alice split layout. Keys light up in real-time as the user types, helping them build muscle memory for the unique ergonomic angles.

## 4. Core System Architecture

### 4.1. Initialization & Device Permissions

When the app first loads, an overlay modal will intercept the user.

* **Keyboard API Access:** Offer optional `navigator.keyboard.getLayoutMap()` for browser/OS key legends. It does not identify a keyboard model or physical geometry. Apply available legends to both Practice and Keyboard Test; retain reference legends for unmapped keys. Input listeners remain scoped to focused practice/test controls, not global capture.
* **UI Flow:** The welcome dialog leads with a striking orange **Start practicing** button, initially focused for keyboard use. Activation tries optional browser key labels and focuses the exercise without starting the session until the user types. A separate optional setup card offers **Connect keyboard & start**. **Explore first** or Escape dismisses without requesting access and focuses app navigation. Detailed privacy and keyboard-access guidance is available in a disclosure.
* **Optional device access:** In a secure context with WebHID, **Connect keyboard & start** invokes `navigator.hid.requestDevice()` within the user gesture. The native chooser cannot open automatically on page load. Restore previously authorized connected devices with `getDevices()`; automatically show the app dialog again when none are available. Allow skipping for the current visit. Unsupported browsers retain ordinary typing and manual profiles. Expand the connection panel after either welcome setup action so results, errors, and retries are visible.
* **Limits and privacy:** Protected keyboard collections may be excluded from WebHID. A broad chooser is necessary for vendor-defined interfaces; instruct users to select only their keyboard, without claiming automatic classification. Show the selected browser-reported product name and numeric vendor/product IDs separately from sourced catalog facts and personal notes. Never infer a brand, model, firmware, or feature from these IDs, and never present a physical layout as detected from them. The IDs may only rank catalog layout candidates for explicit user confirmation (section 4.6). Require explicit selection when several authorized devices exist. Clear stale details on disconnect, show actionable unavailable/denied/cancelled/missing-device warnings, and keep all data browser-only with no uploads. Do not open devices or read/write HID reports.

### 4.2. Typing Engine (Main Module)

A custom typing hook/class that manages keystrokes in real-time:

* **Input Handling:** Through Phase 9, Practice accepts discrete printable ASCII `keydown` input and ignores IME. Phase 10 replaces that text-entry boundary with normalized, committed Unicode input and composition handling for Vietnamese, while keeping physical-key identity separate. Tab leaves capture and browser shortcuts remain available; Keyboard Test retains its physical `keydown` behavior.
* **Calculations:**
* *WPM:* Calculated using standard formula: `(Correct Characters / 5) / (Time Elapsed in Minutes)`.
* *Accuracy:* `(Correct Keystrokes / Total Keystrokes) * 100`.


* **Session Management:** Tracks `currentWordIndex`, `currentCharIndex`, `startTime`, and `errors`. Handles session resets via an on-screen "Restart" button or a quick-key shortcut (e.g., `Tab + Enter`).

### 4.3. Exercise Generator

A utility module that dynamically generates the text block based on current settings:

* **Word Banks:** Through Phase 9, uses a bundled English vocabulary with 200/1000/5000-entry prefix tiers. Phase 10 selects bundled English or Vietnamese banks from an extensible language registry. Vietnamese entries are whitespace-delimited practice tokens (often syllables), not a claim of linguistic word segmentation or universal frequency ranking.
* **Randomization:** Randomly selects words to meet the configured limit (e.g., 50 words, or enough words to fill 60 seconds).
* **Extra Modifiers:** If `@ Punctuation` or `# Numbers` are enabled, the generator randomly injects commas, periods, quotes, or numbers into the generated array before rendering.

### 4.4. Local Storage & Stats Manager

* **Settings Save:** Automatically saves changes to modes, difficulties, and themes into `localStorage` so the user's preferences persist across sessions.
* **Phase 10 language:** Persist one validated language ID with existing preferences (schema v6). Default/migrate to English; no browser-language guessing. The selection drives UI and built-in practice resources, never keyboard geometry or an input-method installation.
* **Stat Aggregation:** At the end of a session, the payload `{ wpm, accuracy, mode, date, missedKeys }` is written to IndexedDB. This allows the app to chart progress over time and show which specific keys on the Alice layout the user struggles with most.
* **Progress chart (Stats addendum):** Stats → Recent sessions shows a dual-axis timeline above the history table: the latest 10 target-copying sessions (Zen excluded), oldest to newest; WPM as a bold accent line on the left axis and accuracy (50–100%) as a dashed line with a faint fill on the right axis. Point color encodes language and point shape encodes mode, with in-memory language filter toggles. See [Phase 5 Detail Design §6.3.1](./phase-5-detail-design.md#631-recent-sessions-progress-chart-stats-addendum).

### 4.5. Keyboard Keys Test Matrix

A dedicated keyboard test view presents a visual matrix for the selected keyboard layout and records key presses independently of typing-practice session statistics.

* **Layout and input mapping:** Render keys from a layout profile and associate each rendered key with its physical `KeyboardEvent.code`. The initial profile is the Alice layout map from Phase 3; only offer profiles that are actually implemented. Use `code` for physical key identity and the selected layout profile for displayed legends; use `navigator.keyboard.getLayoutMap()` only where supported. Do not assume every browser or keyboard provides a layout map.
* **Test modes (Phase 9):** **One key at a time** guides the sequence below and tracks correct presses without showing count numbers in key cells. **Freestyle** counts presses of any mapped key in any order and shows each key's press count, with no expected key, mismatch feedback, or completion. Switching modes resets the matrix. See the [Phase 9 Detail Design](./phase-9-detail-design.md).
* **Test behavior:** Guide the user through every physical key code present in the selected layout, including Escape and function keys when mapped. Highlight a key and increment its correct-press count only when the expected physical key is pressed. An unexpected key does not increment the expected key's count and receives separate, temporary red error feedback distinct from the orange accent. Since Phase 9, guided cells show tested state rather than a count number. A completed test can be restarted, which clears highlights and counts for the current test.
* **Sound effects:** Provide an independent on/off control and selectable effect: Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, or Plastic chicken. Sound is off until the user enables it; changing the selection previews the selected effect only when sound is enabled. Use appropriately licensed or original audio assets.
* **Persistence:** Save the sound enabled state and selected effect in `localStorage`. Test counts and highlights are temporary and are cleared by reset; they are not typing-session statistics.
* **Input lifecycle:** Handle keyboard events only while the test view is active and focused. Avoid capturing modified browser/system shortcuts. Prevent default browser actions for mapped test keys when needed (such as function keys that can reload or open browser UI). The view must be usable with keyboard and pointer input.

### 4.6. Keyboard Device Details

Provide a device information view that presents a realistic layout profile and clearly distinguishes detected facts from user-provided or catalog information.

* **Layout profile:** Show a visual key arrangement and legends appropriate to the selected device/layout profile, including the Alice split layout when that is the chosen profile. Support an unknown/unselected profile rather than inventing a match.
* **Device identity:** Present brand, model, version, and name only when obtained from a reliable source, such as a user-selected catalog profile or explicitly entered device details. Label the source and allow users to edit or clear self-reported details.
* **Supported features:** Show properties such as RGB/backlighting, connectivity, key rollover, or programmable keys only when verified by the selected catalog entry or explicitly provided device information. Distinguish verified, user-provided, and unavailable/unknown values.
* **Catalog quality:** Device profiles must be based on a maintained, sourced catalog. Record catalog provenance and revision information; do not fabricate a device profile or feature to fill missing data. Include a generic Alice layout profile that does not claim a specific brand or model.
* **Keyboard layout profiles:** Bundle real Alice-family layouts imported by a maintainer-only script from open-source QMK keyboard data (USB index, physical layouts, default keymaps) and VIA definitions (IDs and layout variant options), plus reviewed AliceType-curated entries. Commit the generated snapshot with attribution; never fetch sources at runtime. Map physical `KeyboardEvent.code` values only from a source default keymap, never by position or legend. License decision (2026-10-26): the imported GPL data ships with preserved upstream notices, a `NOTICE.txt` listing sources and pinned commits, the bundled GPL-3.0 text linked from the footer, a modification statement, and public corresponding source. AliceType-authored code stays MIT.
* **Layout matching:** Rank catalog candidates locally from browser-reported vendor/product IDs (weighted down when an ID is shared by several keyboards), device product names, and user-entered board names or saved name/model/brand notes. Name-only suggestions require a model token or a full catalog board name, not just a brand or generic "Alice" label, and are explicitly labeled as name-only evidence. Keep discovery compact: suggestions beside one preview on desktop, stacked on mobile, with optional device specifications, source citations, and key checks in expandable sections. Use physical codes observed during the optional key-press check only to rule out variants; legend-based ranking is deferred. Show each suggestion with its reason and a "suggested, not confirmed" label. A device-specific layout and variant (for example split Backspace or spacebar arrangement) become active in Practice and Keyboard Test only after explicit user confirmation, stored locally. Reading layouts from firmware (Vial/VIA protocol, ZMK Studio) is deferred.
* **Browser capability limits:** Standard browser keyboard events, `navigator.keyboard.getLayoutMap()`, and WebHID descriptors do not reliably reveal a physical keyboard's layout, brand, model, version, RGB capability, or other hardware features. Never display those as detected facts. Optional WebHID access follows section 4.1 and the Phase 7 addenda; it is never required for the core app. Device-specific geometry comes only from the reviewed imported catalog and is used only after the user confirms it; generic Alice remains the default.
* **Persistence:** Store user-selected layout profiles, confirmed layout matches, and manually entered details locally. Do not transmit device details to a server.

## 5. Feature Specifications

### 5.1. Alternative Modes

* **Timed:** User sets a max time (15s, 30s, 60s, 120s). The progress bar fills based on time elapsed.
* **Words:** User sets a letter/word limit (10, 25, 50, 100). The progress bar fills based on words completed.
* **Quote:** Pulls a random literary or movie quote.
* **Zen:** No limits, no visible UI updates except the text. WPM is calculated upon manual stop.
* **Custom:** User pastes their own text to practice.

### 5.2. Difficulty Levels (Based on failed keys)

* **Normal:** Standard typing. Backspace is allowed to correct mistakes.
* **Expert:** Fails the session if the user presses `Space` to submit a word that contains an uncorrected error.
* **Master:** "Sudden Death" mode. Fails and stops the session on the very first incorrect keystroke.

### 5.3. Other Settings

* **Sound:** Toggleable mechanical keyboard click sounds (satisfying "thock" sounds) triggered on `keydown`.
* **Caret Style:** Block, Line, Underline.
* **Stats Display:** Toggle real-time WPM/Accuracy on or off to reduce anxiety while typing.

### 5.4. Keyboard Keys Test Matrix

* Provide a separate test view with a visual matrix matching the selected layout profile.
* Guide the user through expected keys; highlight each correctly pressed key (Phase 9: without a count number in the key cell).
* Do not count an unexpected key as a correct press. Show distinct, transient error feedback without changing the expected key's count.
* Count discrete key presses only; ignore keydown auto-repeat. When enabled, play the selected effect on each non-repeat key press while the test is active.
* Provide a reset action that clears the current test's counts and highlights.
* Provide sound on/off and the effects Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, and Plastic chicken. Keep sound off by default, persist the toggle and selected effect locally, and preview a selection only when enabled.
* Keep matrix test counts separate from typing-session scores and missed-key statistics.
* Phase 9: offer **One key at a time** and **Freestyle** modes. Freestyle allows any order and repeated presses, shows per-key press counts, and has no expected-key or mismatch feedback. One key at a time hides count numbers. Changing mode resets the matrix.

### 5.5. Keyboard Device Details

* Show the selected keyboard layout with a realistic arrangement and key legends when a matching profile is available.
* Suggest matching catalog layout profiles from browser-available evidence and let the user confirm the profile and its variant; never auto-select or describe a suggestion as detected.
* Display the device name, version, model, brand, and supported features only when sourced from a selected catalog entry or explicit user input. Include relevant capabilities such as RGB when known.
* Identify whether each detail is catalog-verified, user-provided, or unknown. Allow a user to select a known profile or enter, edit, and clear their own device details.
* Do not claim browser-based automatic hardware identification: standard keyboard APIs do not expose reliable brand/model/version or hardware feature data. Unknown details must remain explicitly unknown.
* Keep profile and user-provided details in local storage; no backend transmission is part of this feature.

### 5.6. Multi-language support (Phase 10 - integrated; review gates pending)

* Ship complete English (`en`) and Vietnamese (`vi`) UI resources, including accessible names, instructions, errors, dialogs, status messages, and locale-aware number/date formatting. Preserve AliceType, hardware identities, physical key codes/legends, user text, and original source/license material.
* Place a labeled, keyboard-operable selector at the far right of the top bar, with native language names **English** and **Tiếng Việt**. Persist the choice in browser `localStorage`; retain the in-memory choice and show a localized warning/retry action if saving fails. Disable changes during a running practice session, as with other settings.
* Keep two resource groups per language: **UI labels/messages** and **practice content/word banks**. Quote passages belong to practice content, not UI labels. Bundle resources locally; adding a language requires a registry entry, complete resources, content/rights review, and tests, not copied components or engine branches.
* Apply the choice to Timed/Words vocabulary and Quote passages. Provide Vietnamese tiers of 200/1000/5000 unique reviewed tokens and at least 12 Vietnamese quote passages with explicit authorship/rights. Do not silently substitute English content for missing resources. Custom/Zen preserve user-authored text and support Vietnamese regardless of the UI language.
* Support Vietnamese diacritics and OS/browser Telex/VNI composition with NFC normalization and shared grapheme-aware editing, caret, progress, and scoring. Do not count composition updates as physical keystrokes or infer physical missed keys from composed text. WPM remains five accepted text characters per word, where a Phase 10 character is one grapheme, not one UTF-16 code unit.
* Vietnamese finite sessions, including Vietnamese Custom targets under English UI, require **Finish** (or Enter outside composition) after consuming the target so a final syllable can still be corrected by the input method. Other English finite sessions retain automatic completion; Timed retains its deadline and Zen its explicit Stop. The detail design specifies committed-edit accuracy semantics and event/lifecycle handling.
* Preserve legacy scores and tag new history records with session language and scoring version. Keep Stats' target-copying and Zen summaries separate; identify mixed-language summaries and distinguish historical keystroke accuracy from committed-text accuracy.
* Follow the [Phase 10 Detail Design](./phase-10-detail-design.md) and [Phase 10 Technical Implementation Plan](./phase-10-implementation-plan.md). Runtime integration now includes complete typed en/vi UI catalogs, selector/preferences v6, both content banks/catalogs, native committed Unicode/composition input, v3 history and localized Stats. Automated checks pass apart from eight reproduced pre-existing Chromium failures. Fluent editorial review, actual OS Telex/VNI and screen-reader verification remain explicit release gates; complete native compatibility is not inferred from synthetic events. Phase 10 supersedes earlier ASCII-only Practice contracts.

## 6. Implementation Roadmap

### Phase 1: Scaffolding & UI Foundation

* Set up Vite project, configure Tailwind CSS with the custom Orange accent.
* Build the desktop layout structure (Header, Main Body, Footer).

### Phase 2: Core Typing Engine

* Implement the hidden input/keydown listener logic.
* Build the math logic for WPM, Accuracy, and real-time updates.
* Create the UI text renderer (handling correct, incorrect, and active states).

### Phase 3: The Alice Visualizer

* Design the split-keyboard SVG map.
* Bind keystrokes to the SVG so keys illuminate when pressed or show red when missed.

### Phase 4: Modifiers, Modes, & Logic

* Implement the Word Generator (randomization, punctuation, numbers).
* Implement Timed vs. Word count logic and the progress bar.

### Phase 5: Storage & Polish

* Wire up `localStorage` for settings and IndexedDB for the Stats page.
* Add the Initial Keyboard Permission overlay.
* Add typing sounds and final bug testing.
* Stats addendum (implemented): a Recent-sessions dual-axis progress chart (WPM vs. accuracy, language-colored and mode-shaped points, language filter) above the history table, derived in memory from existing history. See [Phase 5 Detail Design §6.3.1](./phase-5-detail-design.md#631-recent-sessions-progress-chart-stats-addendum).

### Phase 6: Keyboard Keys Test Matrix

* Add a selectable test view using the Alice layout map established in Phase 3, with physical key positions and legends.
* Implement guided physical-key validation, correct-press highlighting and per-key counts, incorrect-key feedback, and reset behavior.
* Add the test's independent sound toggle and selectable effect library, including local persistence and audio previews.
* Verify supported key mappings, focus/input lifecycle, browser-shortcut behavior, keyboard accessibility, and separation from typing-session statistics.

### Phase 7: Keyboard Device Details

* Build a sourced, revisioned keyboard profile catalog that extends the Alice layout map used by the test matrix; do not invent missing identity or feature data.
* Add keyboard layout/device profiles and a details view for layout, name, version, model, brand, and supported features.
* Support user selection and editing of device information; visibly label catalog-verified, user-provided, and unknown data.
* Ensure unavailable hardware information is not presented as automatically detected, and provide a useful unknown/unselected state.
* Persist selected profiles and user-entered details locally; add catalog profiles to the test matrix only when their physical key mapping is defined and verified.
* Keyboard Layout Profiles extension (implemented): import reviewed Alice-family layouts from QMK/VIA open-source data into a bundled, attributed GPL-3.0 catalog; rank candidates from WebHID vendor/product IDs and narrow variants with observed key codes; require user confirmation of profile and variant before using the layout in Practice and Keyboard Test (preferences schema v4).

### Phase 8: Remaining Practice Modes

* Implement Quote using a bundled, attributed, rights-reviewed literary quote catalog with random selection and finite target completion.
* Implement Custom with a paste-friendly editor, explicit text normalization/validation, target preview, and finite practice sessions. Keep draft and target text in memory only.
* Implement Zen as unlimited free writing with no target comparison or live practice UI updates outside the text; calculate free-writing WPM on explicit manual Stop. Accuracy is not applicable.
* Extend mode-aware preferences, backward-compatible local history, and Stats without changing Timed/Words behavior or persisting user writing.
* Implemented with automated unit and Chromium verification. Follow the [Phase 8 Detail Design](./phase-8-detail-design.md) for mode semantics, ASCII input boundaries, Zen presentation overrides, migrations, and acceptance criteria; see the [implementation plan](./phase-8-implementation-plan.md#verification-results) for evidence and pending manual checks. Difficulty rules remain deferred.

### Phase 9: Keyboard Test Modes

* Add a Keyboard Test mode selector: **One key at a time** (the existing guided sequence) and **Freestyle** (any countable key, any order, unlimited presses with a per-key press count).
* Freestyle hides and disables the Expected key and Mismatch feedback; both modes share the test matrix visualizer and Test sound settings.
* Switching modes resets the test matrix. One key at a time no longer shows per-key correct-press count numbers.
* Mode and counts are not persisted; preferences stay at schema v5.
* Implemented with automated unit and Chromium verification. Follow the [Phase 9 Detail Design](./phase-9-detail-design.md) and the [Phase 9 Technical Implementation Plan](./phase-9-implementation-plan.md#verification-results).

### Phase 10: Multi-language Support

* Add an extensible, typed language registry and separate complete UI-message and practice-content resource groups; ship English and Vietnamese.
* Add the far-right top-bar language selector and preferences schema v6 migration/persistence with explicit storage-failure recovery.
* Translate every app-owned UI surface, bundle reviewed Vietnamese vocabulary/quote content, and provide Unicode/IME-safe practice across all five modes.
* Preserve physical Keyboard Test behavior, privacy, existing settings, and legacy history; add language/scoring metadata and honest Stats presentation.
* Runtime implementation and automated verification are integrated. Language/content quality and native OS/input-method/accessibility sign-off remain pending, as recorded in the [Phase 10 Detail Design](./phase-10-detail-design.md) and [Phase 10 Technical Implementation Plan](./phase-10-implementation-plan.md). The 5,000-token Vietnamese snapshot and 12 original passages have automated validation and explicit provenance, not a completed fluent editorial review.