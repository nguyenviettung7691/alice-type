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
* **Header:** Minimalist. Contains a logo/title, navigation for Modes (Timed, Words, Quote, Custom, Zen), Settings, and Stats.
* **Center Stage (Typing Area):** Large, highly legible text. The current word is highlighted, correct letters turn faint gray, incorrect letters turn red, and the active cursor is a blinking orange block.
* **Progress & Live Stats:** A thin, striking orange progress bar spanning the width of the typing area. Live WPM and accuracy display subtly above or below the text block.
* **Alice Keyboard Visualizer (Bottom):** An SVG-based visual representation of the Alice split layout. Keys light up in real-time as the user types, helping them build muscle memory for the unique ergonomic angles.

## 4. Core System Architecture

### 4.1. Initialization & Device Permissions

When the app first loads, an overlay modal will intercept the user.

* **Keyboard API Access:** Offer optional `navigator.keyboard.getLayoutMap()` for browser/OS key legends. It does not identify a keyboard model or physical geometry. Apply available legends to both Practice and Keyboard Test; retain reference legends for unmapped keys. Input listeners remain scoped to focused practice/test controls, not global capture.
* **UI Flow:** A striking orange button labeled "Connect Keyboard & Start" will require a physical click or `Enter` press to ensure the browser captures user intent and focuses the window securely before dismissing the overlay.
* **Optional device access:** In a secure context with WebHID, that button invokes `navigator.hid.requestDevice()` within the user gesture. The native chooser cannot open automatically on page load. Restore previously authorized connected devices with `getDevices()`; automatically show the app dialog again when none are available. Allow skipping for the current visit. Unsupported browsers retain ordinary typing and manual profiles.
* **Limits and privacy:** Protected keyboard collections may be excluded from WebHID. A broad chooser is necessary for vendor-defined interfaces; instruct users to select only their keyboard, without claiming automatic classification. Show the selected browser-reported product name and numeric vendor/product IDs separately from sourced catalog facts and personal notes. Never infer a physical layout, brand, model, firmware, or feature from these IDs. Require explicit selection when several authorized devices exist. Clear stale details on disconnect, show actionable unavailable/denied/cancelled/missing-device warnings, and keep all data browser-only with no uploads. Do not open devices or read/write HID reports.

### 4.2. Typing Engine (Main Module)

A custom typing hook/class that manages keystrokes in real-time:

* **Input Handling:** Listens to `keydown`. Prevents default behavior for functional keys (like `Tab` or `Space` scrolling) to keep the user locked into the exercise.
* **Calculations:**
* *WPM:* Calculated using standard formula: `(Correct Characters / 5) / (Time Elapsed in Minutes)`.
* *Accuracy:* `(Correct Keystrokes / Total Keystrokes) * 100`.


* **Session Management:** Tracks `currentWordIndex`, `currentCharIndex`, `startTime`, and `errors`. Handles session resets via an on-screen "Restart" button or a quick-key shortcut (e.g., `Tab + Enter`).

### 4.3. Exercise Generator

A utility module that dynamically generates the text block based on current settings:

* **Word Banks:** Pulls from local JSON files containing the top 200, 1000, or 5000 English words.
* **Randomization:** Randomly selects words to meet the configured limit (e.g., 50 words, or enough words to fill 60 seconds).
* **Extra Modifiers:** If `@ Punctuation` or `# Numbers` are enabled, the generator randomly injects commas, periods, quotes, or numbers into the generated array before rendering.

### 4.4. Local Storage & Stats Manager

* **Settings Save:** Automatically saves changes to modes, difficulties, and themes into `localStorage` so the user's preferences persist across sessions.
* **Stat Aggregation:** At the end of a session, the payload `{ wpm, accuracy, mode, date, missedKeys }` is written to IndexedDB. This allows the app to chart progress over time and show which specific keys on the Alice layout the user struggles with most.

### 4.5. Keyboard Keys Test Matrix

A dedicated keyboard test view presents a visual matrix for the selected keyboard layout and records key presses independently of typing-practice session statistics.

* **Layout and input mapping:** Render keys from a layout profile and associate each rendered key with its physical `KeyboardEvent.code`. The initial profile is the Alice layout map from Phase 3; only offer profiles that are actually implemented. Use `code` for physical key identity and the selected layout profile for displayed legends; use `navigator.keyboard.getLayoutMap()` only where supported. Do not assume every browser or keyboard provides a layout map.
* **Test behavior:** Guide the user through keys to test. Highlight a key and increment its correct-press count only when the expected physical key is pressed. An unexpected key does not increment the expected key's count and receives separate, temporary error feedback. Show each key's correct-press count in its matrix cell. A completed test can be restarted, which clears highlights and counts for the current test.
* **Sound effects:** Provide an independent on/off control and selectable effect: Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, or Plastic chicken. Sound is off until the user enables it; changing the selection previews the selected effect only when sound is enabled. Use appropriately licensed or original audio assets.
* **Persistence:** Save the sound enabled state and selected effect in `localStorage`. Test counts and highlights are temporary and are cleared by reset; they are not typing-session statistics.
* **Input lifecycle:** Handle keyboard events only while the test view is active and focused. Avoid capturing browser/system shortcuts or suppressing normal browser behavior unnecessarily. The view must be usable with keyboard and pointer input.

### 4.6. Keyboard Device Details

Provide a device information view that presents a realistic layout profile and clearly distinguishes detected facts from user-provided or catalog information.

* **Layout profile:** Show a visual key arrangement and legends appropriate to the selected device/layout profile, including the Alice split layout when that is the chosen profile. Support an unknown/unselected profile rather than inventing a match.
* **Device identity:** Present brand, model, version, and name only when obtained from a reliable source, such as a user-selected catalog profile or explicitly entered device details. Label the source and allow users to edit or clear self-reported details.
* **Supported features:** Show properties such as RGB/backlighting, connectivity, key rollover, or programmable keys only when verified by the selected catalog entry or explicitly provided device information. Distinguish verified, user-provided, and unavailable/unknown values.
* **Catalog quality:** Device profiles must be based on a maintained, sourced catalog. Record catalog provenance and revision information; do not fabricate a device profile or feature to fill missing data. Include a generic Alice layout profile that does not claim a specific brand or model.
* **Browser capability limits:** Standard browser keyboard events and `navigator.keyboard.getLayoutMap()` do not reliably reveal a physical keyboard's brand, model, version, RGB capability, or other hardware features. Never infer or display those as detected facts. Optional WebHID access follows section 4.1 and the Phase 7 addendum; it is never required for the core app. The bundled catalog currently contains only generic Alice, so device-specific realistic geometry remains unavailable rather than guessed.
* **Persistence:** Store user-selected layout profiles and manually entered details locally. Do not transmit device details to a server.

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
* Guide the user through expected keys; highlight each correctly pressed key and show its correct-press count in the key cell.
* Do not count an unexpected key as a correct press. Show distinct, transient error feedback without changing the expected key's count.
* Count discrete key presses only; ignore keydown auto-repeat. When enabled, play the selected effect on each non-repeat key press while the test is active.
* Provide a reset action that clears the current test's counts and highlights.
* Provide sound on/off and the effects Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, and Plastic chicken. Keep sound off by default, persist the toggle and selected effect locally, and preview a selection only when enabled.
* Keep matrix test counts separate from typing-session scores and missed-key statistics.

### 5.5. Keyboard Device Details

* Show the selected keyboard layout with a realistic arrangement and key legends when a matching profile is available.
* Display the device name, version, model, brand, and supported features only when sourced from a selected catalog entry or explicit user input. Include relevant capabilities such as RGB when known.
* Identify whether each detail is catalog-verified, user-provided, or unknown. Allow a user to select a known profile or enter, edit, and clear their own device details.
* Do not claim browser-based automatic hardware identification: standard keyboard APIs do not expose reliable brand/model/version or hardware feature data. Unknown details must remain explicitly unknown.
* Keep profile and user-provided details in local storage; no backend transmission is part of this feature.

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