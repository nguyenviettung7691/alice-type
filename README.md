# AliceType

AliceType is a desktop-oriented typing practice web app for the Alice split-ergonomic keyboard layout. It uses a distraction-free dark interface, a striking orange accent, real-time typing feedback, and configurable practice modes.

## Project status

Phases 1–7 are implemented: the app foundation, typing engine, Alice visualizer, generated Timed/Words exercises, local storage/polish, guided Keyboard Test matrix, and local Keyboard Details view. Preferences persist locally; completed practice sessions appear in Stats with missed-key summaries. Keyboard onboarding, optional click sounds, caret styles, and live-stat visibility are available. The independent Keyboard Test includes temporary per-key counts and 13 optional sound effects. Keyboard Details provides a revisioned generic Alice profile and locally editable device notes; vendor-specific hardware profiles remain unavailable until sourced claims can be verified. Other roadmap modes remain unavailable. Product design documents:

- [Technical Design Document](doc/tech-design.md)
- [Phase 1 Detail Design](doc/phase-1-detail-design.md)
- [Phase 1 Implementation Plan](doc/phase-1-implementation-plan.md)
- [Phase 2 Detail Design](doc/phase-2-detail-design.md)
- [Phase 2 Implementation Plan](doc/phase-2-implementation-plan.md)
- [Phase 3 Detail Design](doc/phase-3-detail-design.md)
- [Phase 3 Implementation Plan](doc/phase-3-implementation-plan.md)
- [Phase 4 Detail Design](doc/phase-4-detail-design.md)
- [Phase 4 Implementation Plan](doc/phase-4-implementation-plan.md)
- [Phase 5 Detail Design](doc/phase-5-detail-design.md)
- [Phase 5 Implementation Plan](doc/phase-5-implementation-plan.md)
- [Phase 6 Detail Design](doc/phase-6-detail-design.md)
- [Phase 6 Implementation Plan](doc/phase-6-implementation-plan.md)
- [Phase 7 Detail Design](doc/phase-7-detail-design.md)
- [Phase 7 Implementation Plan](doc/phase-7-implementation-plan.md)

## Practice

- The top navbar switches app views. The collapsible Keyboard connection panel sits directly below it at the top of every view. In Practice, a segmented mode selector sits inside the exercise panel above its settings; Timed and Words work, while Quote, Custom, and Zen remain coming soon.
- Choose **Timed** (15/30/60/120 seconds) or **Words** (10/25/50/100 base words). The default is Timed, 30 seconds.
- Choose a **200**, **1000**, or **5000** word vocabulary and optionally enable **Punctuation** and **Numbers**. Both modifiers default to off. Settings and mode selection are locked while running; Restart unlocks them.
- Select the exercise text, tab to the practice input, or activate **Start typing**. Focusing alone does not start the session; the first printable key does. Type the full displayed target, including spaces and modifiers. Errors are red and underlined; Backspace removes the last character.
- WPM counts currently correct characters using five characters per word. Accuracy counts all character attempts, including mistakes later corrected.
- Tab leaves the practice input without capturing typing elsewhere. Elapsed time continues while focus is away; use **Resume typing** to return.
- Timed mode ends at its deadline, even when focus is elsewhere. Its target extends automatically as needed; running out of the initial text does not complete the session.
- Words mode ends on the final target character even with errors. Progress counts base words, not inserted number tokens; Backspace can reduce progress without erasing attempt history.
- **Restart** generates a fresh exercise using the same session configuration and resets all metrics. A generation failure displays an explicit error and stops capture until recovery. Completed scores and preferences persist; an unfinished exercise is discarded on reload.
- Long exercises scroll within the text area; the active character is kept in view.
- Input is limited to discrete printable ASCII key presses. Paste, composition/IME input, and held-key repeat are not supported. Browser shortcuts are not captured by the typing engine.

## Settings, onboarding, and local history

- On first use, a welcome dialog explains optional keyboard access and browser-only privacy. Where WebHID is supported, **Connect Keyboard & Start** opens the browser chooser on your click (or Enter). Select only your keyboard; protected keyboard interfaces often cannot appear. Returning visits restore authorized connected devices; if none are available, the app shows the dialog again. Skip / Escape dismisses it for this visit without blocking typing.
- **Start practicing** requests only Keyboard API legends; **Continue without layout access** skips both APIs. `navigator.keyboard.getLayoutMap()` supplies OS/browser key legends, not a brand, model, or physical arrangement. Available legends update both Practice and Keyboard Test; missing legends retain reference values. **Refresh key labels** retries access, and supported layout-change events refresh legends.
- The keyboard connection panel starts collapsed, showing a color-coded text status and the selected device name. Click its summary or focus it and press Enter/Space to expand controls, privacy information, and unsupported, denied/cancelled, missing-device, or detection-failure guidance. Yellow indicates attention/selection needed, green a selected device, blue pending permission, and neutral unavailable access. WebHID exposes only the selected product name and numeric vendor/product IDs; these are labeled browser-reported, separate from catalog facts and personal notes. Multiple authorized devices require explicit selection. Disconnects clear stale device details and layout legends. No HID device is opened and no reports are read or written.
- All app data, including device information, stays in the browser; nothing is uploaded. Runtime device details are held only in memory, browser-managed device grants may survive reload, and selected reference profiles/personal notes remain in local preferences. You can revoke device access in browser site settings.
- Open **Settings** to choose Block, Line, or Underline caret, hide live WPM/accuracy, or enable a quiet generated typing click. Sound is off by default; only accepted printable keys trigger it. Final metrics remain visible when live stats are hidden.
- Practice preferences (including each mode's inactive limit), display settings, sound selection, and onboarding completion use versioned `localStorage`. **Restore defaults** requires confirmation and does not delete history.
- **Stats** lists completed exercises newest first, with best/average WPM, average per-session accuracy, and incorrect attempts grouped by physical `KeyboardEvent.code`. Correcting an error does not erase that attempt. Missing physical codes are excluded from key totals, not from accuracy.
- Session history uses IndexedDB. No target text, typed text, raw event sequence, account, telemetry, or remote synchronization is stored or transmitted. Data belongs to this origin/browser and may be removed by browser storage cleanup.
- Navigation and settings stay locked during a run. Use **Restart** before switching views or changing preferences; moving focus away still does not pause elapsed time.
- Storage failures show explicit warnings and retry controls without blocking practice. Failed session saves remain retryable through restart/navigation for the current page; reload discards unsaved pending results. **Clear history** requires confirmation and is disabled while saves are pending.

## Alice visualizer

- Both diagrams use the same selected verified reference arrangement, with optional browser layout legends (US ANSI reference legends otherwise). The current catalog contains only generic Alice geometry; it is not a detected device or a model-specific keyboard. A HID product name or ID does not establish a physical-layout match.
- Accepted printable key presses highlight their physical `KeyboardEvent.code` for 300 ms: orange with **+** for a matching character, red with **!** and a dashed outline for a mismatch. Character correctness still uses the typed character, not the illustrated legend.
- Both drawn spacebars share the logical `Space` code and illuminate together. Backspace and modifier keys do not create correctness feedback. Unmapped physical codes still allow valid text entry without highlighting a key.
- Feedback clears when focus leaves the input, the exercise completes, or it restarts. The highlight is temporary; incorrect printable attempts are separately aggregated into completed-session history.
- At narrow widths, scroll within the diagram to see all keys. Keyboard users can tab to its scroll area and use Left/Right arrows; the diagram adds no focus stop when it fits.

## Keyboard Test

- Open **Keyboard Test**, then activate **Focus keyboard test** or tab to the test input region. Press and release each expected physical key in the generic Alice diagram's stable order. This is a physical `KeyboardEvent.code` test, independent of the character typed or printed on your keycaps.
- The arrow marks the expected key; correctly tested keys show **+** and a count of one. A wrong key briefly shows **!** without advancing or changing any count. Both spacebars share the same logical Space count. **Text key results** provides a readable list of key states and counts.
- Held-key repeat, composition, and browser/system shortcut combinations are ignored. Standalone modifiers can be tested; their native behavior is not suppressed. Some system keys may be withheld by the browser/OS, so this is not a hardware certification or device-identification tool.
- Tab leaves the input except when Tab itself is expected. **Shift+Tab** and **Escape** always provide a way out. Focus the separate diagram scroll area for native Left/Right scrolling at narrow widths.
- **Restart test** clears all run counts, progress, and feedback without changing sound preferences. Blur pauses input while retaining progress; leaving the view or reloading discards the run. Matrix runs never contribute to practice scores, missed-key summaries, or Stats.
- **Keyboard test sound** defaults off and is independent of practice sound. Select Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, or Plastic chicken. These are original short synthesized interpretations, not downloaded recordings. Selection changes preview only when enabled; eligible correct and unexpected presses sound once each.
- The toggle/effect persist in preferences schema v3. Existing v1/v2 preferences migrate while retaining practice/display/onboarding values. A failed migration write preserves valid selections in memory and offers retry without overwriting the original record. No run counts or raw test events are saved.

## Keyboard Details

- Open **Keyboard Details** to select the generic Alice layout reference or leave the profile unselected. The selection describes a reference profile; AliceType does not detect the connected keyboard.
- The bundled catalog is revisioned and records internal layout provenance. It currently contains the generic Alice layout only; no brand, model, version, RGB, connectivity, rollover, or programmable-key claims are made for a device.
- Name, brand, model, version, connectivity, and feature overrides can be entered as user-provided details. Each displayed value is labeled **Catalog verified**, **You provided this**, or **Unknown**. Personal details can be edited and cleared separately from profile selection.
- Profile and personal details are saved in this browser using preferences schema v3. Existing v1/v2 preferences migrate while preserving practice and Keyboard Test settings. Device details are not included in session history or Stats and are never sent to a server.
- Keyboard Test uses a catalog map only when it is explicitly verified; otherwise it labels and uses the generic Alice map. User-provided notes never change the test layout.

## Getting started

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Available checks and production commands:

```sh
npm run check
npm test
npm run build
npm run preview
```

Browser integration tests run in Chromium with an isolated local development server:

```sh
npx playwright install chromium
npm run test:e2e
```

Unit tests cover generation/word-bank validation, modifier boundaries, mode deadlines/progress, typing-engine behavior, layout mapping/geometry, guided keyboard-test transitions, synthesized effect bounds, audio lifecycle, preference migration/validation, and history record/summary contracts. Browser tests additionally exercise real IndexedDB upgrades/transactions, blocked access, failed commits/retries/deletion, reload persistence, onboarding, sound filtering/cleanup, native Web Audio effects, pending-play cancellation, full physical-key matrix runs, caret/live-stat preferences, and Phase 2–5 regressions at desktop and narrow widths. They require port 4175 to be available.

## Vocabulary data

The bundled English vocabulary is adapted from Hermit Dave's [FrequencyWords](https://github.com/hermitdave/FrequencyWords), derived from OpenSubtitles2018. The three tiers are prefixes of 5000 unique lowercase ASCII entries in source frequency order, not a universal English frequency ranking. No vocabulary is downloaded at runtime.

Vocabulary data is licensed separately under **CC BY-SA 4.0**. See the [attribution and transformation notice](src/lib/typing/word-banks/NOTICE.txt) and [data license](src/lib/typing/word-banks/LICENSE-CC-BY-SA-4.0.txt); both are also accessible from the app footer in production builds.

## Technology

- Vite
- Svelte with TypeScript
- Tailwind CSS
- Lightweight inline SVG icons where needed
- Browser-only application; no backend is planned
- Native localStorage, IndexedDB, and Web Audio; no storage or audio dependency

## Roadmap

1. Scaffolding & UI Foundation
2. Core Typing Engine
3. Alice Visualizer
4. Modifiers, Modes, & Logic
5. Storage & Polish
6. Keyboard Keys Test Matrix
7. Keyboard Device Details

See the [Technical Design Document](doc/tech-design.md) for the product roadmap and feature intent and the [Phase 7 Implementation Plan](doc/phase-7-implementation-plan.md) for the latest implementation and verification record. Quote, Custom, and Zen remain unavailable placeholders. Difficulty levels, alternate themes, and automatic device identification are not implemented.

## License

The repository currently includes a provisional MIT license. Confirm the copyright holder and licensing choice before publishing or distributing the project.
