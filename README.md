# AliceType

![AliceType homepage showing the Practice view with the Alice keyboard visualizer](doc/images/homepage.png)

AliceType is a desktop-oriented typing practice web app for the Alice split-ergonomic keyboard layout. It uses a distraction-free dark interface, a striking orange accent, real-time typing feedback, and configurable practice modes.

## Project status

Phases 1–9 are implemented: the app foundation, typing engine, Alice visualizer, all five practice modes, local storage/polish, Keyboard Test matrix with guided and Freestyle modes, and local Keyboard Details view. Preferences persist locally; completed practice sessions appear in Stats with missed-key summaries for target-copying modes and separate free-writing scores for Zen. Keyboard onboarding, optional click sounds, caret styles, and live-stat visibility are available. The independent Keyboard Test offers **One key at a time** and **Freestyle** modes, temporary per-key press counts in Freestyle, and 13 optional sound effects. Keyboard Details provides a revisioned catalog with the generic Alice profile plus 23 real Alice-family layouts imported from open-source QMK/VIA data, and locally editable device notes. **Find my layout** suggests catalog layouts from your keyboard's browser-reported vendor/product ID; a layout is used in Practice and Keyboard Test only after you confirm it. Difficulty rules remain deferred. Product design documents:

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
- [Phase 8 Detail Design](doc/phase-8-detail-design.md) - Quote, Custom, and Zen implementation contract.
- [Phase 8 Technical Implementation Plan](doc/phase-8-implementation-plan.md) - ordered execution steps, dependencies, and verification gates.
- [Phase 9 Detail Design](doc/phase-9-detail-design.md) - Keyboard Test modes (One key at a time and Freestyle).
- [Phase 9 Technical Implementation Plan](doc/phase-9-implementation-plan.md) - ordered execution steps, dependencies, and verification gates.

## Practice

- The top navbar switches app views. The collapsible Keyboard connection panel sits directly below it at the top of every view. In Practice, the segmented mode selector offers **Timed**, **Words**, **Quote**, **Custom**, and **Zen**.
- Choose **Timed** (15/30/60/120 seconds) or **Words** (10/25/50/100 base words). The default is Timed, 30 seconds.
- In Timed/Words, choose a **200**, **1000**, or **5000** word vocabulary and optionally enable **Punctuation** and **Numbers**. Both modifiers default to off. Inactive choices are preserved when switching modes; they do not modify Quote/Custom text. Settings and mode selection are locked while running; Restart unlocks them.
- Select the exercise text, tab to the practice input, or activate **Start typing**. Focusing alone does not start the session; the first printable key does. Type the full displayed target, including spaces and modifiers. Errors are red and underlined; Backspace removes the last character.
- In target-copying modes, WPM counts currently correct characters using five characters per word. Accuracy counts all character attempts, including mistakes later corrected.
- Tab leaves the practice input without capturing typing elsewhere. Elapsed time continues while focus is away; use **Resume typing** to return.
- Timed mode ends at its deadline, even when focus is elsewhere. Its target extends automatically as needed; running out of the initial text does not complete the session.
- Words mode ends on the final target character even with errors. Progress counts base words, not inserted number tokens; Backspace can reduce progress without erasing attempt history.
- **Quote** selects from 12 bundled literary passages across three works, with author/work attribution. **Restart** repeats the same quote; **Next quote** selects another while idle. The passage ends at the final position, even with errors, and progress counts consumed target characters. Source and US public-domain/other-jurisdiction rights information is available from **Quote attribution** in the footer; no quote is fetched at runtime.
- **Custom** provides a native editor for pasted or entered text. **Apply text** prepares an exact target preview without starting time; review it before **Start typing**. Both the raw draft and normalized target are limited to 10,000 characters (UTF-16 code units for the draft). Line breaks, tabs, and nonbreaking spaces become spaces; repeated spaces collapse; curly quotes, en/em dashes, and ellipses become ASCII equivalents. Other unsupported characters are rejected explicitly, never silently deleted or truncated. **Edit text**, **Cancel editing**, and **Clear text** work while idle. Completion/progress use target characters, including punctuation and spaces.
- Custom draft/applied text stays only in memory across practice-mode switches. Leaving Practice, restoring defaults, or reloading clears it. A saved Custom mode reloads into an empty editor; unfinished exercises are not restored.
- **Zen** is free writing with no target, time limit, or word limit. **Focus writing** focuses capture; the first printable key starts time. Only writing and a steady caret update during a run: live metrics, progress, keyboard visualization, and practice sounds are suppressed without changing your preferences. **Stop** saves a result and shows **Free-writing WPM**, elapsed time, retained characters, and total attempts. Free-writing WPM uses retained characters (including spaces) divided by five and elapsed minutes; deleting text reduces the score. Accuracy is **Not applicable** because no target is checked.
- Zen displays only the trailing 2,000 characters but retains earlier writing in memory for Backspace and full-session scoring. There is no product-level writing cap; browser memory is finite. **Restart**, changing modes, leaving Practice, or reloading releases the writing. Restart/reload of an unfinished run does not save it.
- **Restart** generates fresh Timed/Words text, repeats the applied Quote/Custom target, or clears Zen writing, always resetting metrics and discarding an unfinished run. Preparation failures display explicit errors and stop capture until recovery. Completed numeric scores and preferences persist.
- Long exercises scroll within the text area; the active character is kept in view.
- Practice capture is limited to discrete printable ASCII key presses. Paste is supported in the Custom editor only, not during typing. Composition/IME input and held-key repeat are unsupported. Browser shortcuts are not captured by the typing engine.

## Settings, onboarding, and local history

- On first use, a welcome dialog explains optional keyboard access and browser-only privacy. Where WebHID is supported, **Connect Keyboard & Start** opens the browser chooser on your click (or Enter). Select only your keyboard; protected keyboard interfaces often cannot appear. Returning visits restore authorized connected devices; if none are available, the app shows the dialog again. Skip / Escape dismisses it for this visit without blocking typing.
- **Start practicing** requests only Keyboard API legends; **Continue without layout access** skips both APIs. `navigator.keyboard.getLayoutMap()` supplies OS/browser key legends, not a brand, model, or physical arrangement. Available legends update both Practice and Keyboard Test; missing legends retain reference values. **Refresh key labels** retries access, and supported layout-change events refresh legends.
- The keyboard connection panel starts collapsed, showing a color-coded text status and the selected device name. Click its summary or focus it and press Enter/Space to expand controls, privacy information, and unsupported, denied/cancelled, missing-device, or detection-failure guidance. Yellow indicates attention/selection needed, green a selected device, blue pending permission, and neutral unavailable access. WebHID exposes only the selected product name and numeric vendor/product IDs; these are labeled browser-reported, separate from catalog facts and personal notes. Multiple authorized devices require explicit selection. Disconnects clear stale device details and layout legends. No HID device is opened and no reports are read or written.
- All app data, including device information, stays in the browser; nothing is uploaded. Runtime device details are held only in memory, browser-managed device grants may survive reload, and selected reference profiles/personal notes remain in local preferences. You can revoke device access in browser site settings.
- Open **Settings** to choose Block, Line, or Underline caret, hide live WPM/accuracy, or enable a quiet generated typing click. Sound is off by default; only accepted printable keys trigger it. Final metrics remain visible when live stats are hidden.
- Practice preferences (including each mode's inactive limit), display settings, sound selection, and onboarding completion use versioned `localStorage`. **Restore defaults** requires confirmation and does not delete history.
- **Stats** lists all completed exercises newest first. Target-copying best/average WPM, average per-session accuracy, and missed physical `KeyboardEvent.code` summaries exclude Zen; Zen has a separate session count and best/average Free-writing WPM. Averages are arithmetic per-session means. Correcting a target error does not erase that attempt; missing physical codes are excluded from key totals, not accuracy. Zen has no accuracy or missed-key score.
- Preferences use schema v5 with migration from v1-v4. New history records use format v2 while existing unversioned Timed/Words records remain readable; the IndexedDB database/store/index stay unchanged. No target text, custom drafts, Zen writing, raw event sequence, account, telemetry, or remote synchronization is stored or transmitted. Data belongs to this origin/browser and may be removed by browser storage cleanup.
- Navigation and settings stay locked during a run. Use **Restart** to abandon a run, or **Stop** to save Zen, before switching views or changing preferences. Moving focus away does not pause elapsed time.
- Storage failures show explicit warnings and retry controls without blocking practice. Failed session saves remain retryable through restart/navigation for the current page; reload discards unsaved pending results. **Clear history** requires confirmation and is disabled while saves are pending.

## Alice visualizer

- Both diagrams use the same selected verified reference arrangement, with optional browser layout legends (US ANSI reference legends otherwise). The current catalog contains only generic Alice geometry; it is not a detected device or a model-specific keyboard. A HID product name or ID does not establish a physical-layout match.
- Accepted printable key presses highlight their physical `KeyboardEvent.code` for 300 ms: orange with **+** for a matching character, red with **!** and a dashed outline for a mismatch. Character correctness still uses the typed character, not the illustrated legend.
- Both drawn spacebars share the logical `Space` code and illuminate together. Backspace and modifier keys do not create correctness feedback. Unmapped physical codes still allow valid text entry without highlighting a key.
- Feedback clears when focus leaves the input, the exercise completes, or it restarts. The highlight is temporary; incorrect printable attempts are separately aggregated into completed-session history.
- At narrow widths, scroll within the diagram to see all keys. Keyboard users can tab to its scroll area and use Left/Right arrows; the diagram adds no focus stop when it fits.

## Keyboard Test

- Open **Keyboard Test**, choose a **Test mode**, then activate **Focus keyboard test** or tab to the test input region. This is a physical `KeyboardEvent.code` test, independent of the character typed or printed on your keycaps. Switching modes resets the test matrix; each visit starts in **One key at a time**.
- **One key at a time:** press and release each expected physical key in the diagram's stable order. The arrow marks the expected key; correctly tested keys show **+**. A wrong key briefly shows **!** without advancing. Key cells show no count numbers in this mode.
- **Freestyle:** press any mapped keys in any order, as often as you like. Each key cell shows how many times it was pressed (shown as 999+ above 999), and progress shows keys pressed and total presses. There is no expected key, mismatch highlight, or completion. Keys the layout does not test (such as Escape or dashed keys) are reported but not counted.
- Both spacebars share the same logical Space key. **Text key results** provides a readable list of key states (One key at a time) or exact press counts (Freestyle).
- Held-key repeat, composition, and browser/system shortcut combinations are ignored. Standalone modifiers can be tested; their native behavior is not suppressed. Some system keys may be withheld by the browser/OS, so this is not a hardware certification or device-identification tool.
- In One key at a time, Tab leaves the input except when Tab itself is expected. In Freestyle, Tab is counted. **Shift+Tab** and **Escape** always provide a way out. Focus the separate diagram scroll area for native Left/Right scrolling at narrow widths.
- **Restart test** clears the current mode's counts, progress, and feedback without changing sound preferences. Blur pauses input while retaining progress; leaving the view or reloading discards the run and the mode choice. Matrix runs never contribute to practice scores, missed-key summaries, or Stats.
- **Keyboard test sound** defaults off and is independent of practice sound. Select Default, Bubble, Horn, Cartoon, Coin, Dog bark, Glass, Donkey, Phone, Punch, Plastic Toy, Sneeze, or Plastic chicken. These are original short synthesized interpretations, not downloaded recordings. Selection changes preview only when enabled; eligible correct and unexpected presses sound once each.
- The toggle/effect persist in preferences schema v3. Existing v1/v2 preferences migrate while retaining practice/display/onboarding values. A failed migration write preserves valid selections in memory and offers retry without overwriting the original record. No run counts or raw test events are saved.

## Keyboard Details

- Open **Keyboard Details** to select a reference profile (generic Alice or a catalog keyboard) or leave the profile unselected. The selection describes a reference profile; AliceType does not detect the connected keyboard.
- The bundled catalog is revisioned and records provenance. Device profiles show only the name (from VIA) and brand (from the QMK manufacturer field), each cited with the pinned upstream source. Model, version, RGB, connectivity, rollover, and programmable-key details stay **Unknown**.
- Name, brand, model, version, connectivity, and feature overrides can be entered as user-provided details. Each displayed value is labeled **Catalog verified**, **You provided this**, or **Unknown**. Personal details can be edited and cleared separately from profile selection.
- Profile, personal details, and the confirmed layout are saved in this browser using preferences schema v4. Existing v1/v2/v3 preferences migrate while preserving practice and Keyboard Test settings. Device details are not included in session history or Stats and are never sent to a server.
- **Find my layout** (in Keyboard Details, or from the keyboard connection panel once a device is selected):
  - Ranks catalog layouts by the browser-reported vendor/product ID. It explains each suggestion, warns when an ID is shared by several keyboards, and labels every suggestion **Suggested — not confirmed**. Without a match, you can browse the catalog.
  - Lets you choose layout variants (for example split Backspace or a long right Shift). Pressing the listed distinguishing keys in the optional key-press check rules out variants that cannot produce them.
  - Shows a preview. The layout and variants become active in Practice and Keyboard Test only after **Confirm this layout**. Rotated keys, ISO Enter shapes, and keys without a standard code (drawn dashed, never highlighted or tested) follow the source data.
  - Can clear the confirmation at any time. Choosing a different reference profile also clears it. A notice appears when the connected device's ID differs from the confirmed one or when a catalog update invalidates the stored variant.
- Suggestions are never presented as detection. Nothing is fetched at runtime, and no HID device is opened or read. Keyboard Test uses the generic Alice map unless a layout is confirmed. User-provided notes never change the test layout.

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

Unit tests cover generation/word-bank validation, quote catalog integrity, Custom normalization, Zen chunked writing/manual-stop metrics, modifier boundaries, mode deadlines/progress, typing-engine behavior, layout mapping/geometry, guided keyboard-test transitions, synthesized effect bounds, audio lifecycle, preference migration/validation, and history record/summary contracts. Browser tests additionally exercise all five practice modes, content cleanup/privacy, real IndexedDB upgrades/transactions, blocked access, failed commits/retries/deletion, reload persistence, onboarding, sound filtering/cleanup, native Web Audio effects, pending-play cancellation, full physical-key matrix runs, and caret/live-stat preferences at desktop and narrow widths. They require port 4175 to be available.

## Vocabulary data

The bundled English vocabulary is adapted from Hermit Dave's [FrequencyWords](https://github.com/hermitdave/FrequencyWords), derived from OpenSubtitles2018. The three tiers are prefixes of 5000 unique lowercase ASCII entries in source frequency order, not a universal English frequency ranking. No vocabulary is downloaded at runtime.

Vocabulary data is licensed separately under **CC BY-SA 4.0**. See the [attribution and transformation notice](src/lib/typing/word-banks/NOTICE.txt) and [data license](src/lib/typing/word-banks/LICENSE-CC-BY-SA-4.0.txt); both are also accessible from the app footer in production builds.

## Quote data

The bundled catalog contains 12 original-English passages across three literary works. See the [quote attribution and rights notice](src/lib/typing/QUOTE-NOTICE.txt) for exact sources, editions, adaptations, and US public-domain status. Redistribution outside the United States requires checking local copyright law. The notice is available from the app footer; no external quote service or runtime download is used.

## Keyboard layout data

Layout profiles under `src/lib/keyboard/layout-data/` are generated from [VIA keyboard definitions](https://github.com/the-via/keyboards) (GPL-3.0) and [QMK firmware](https://github.com/qmk/qmk_firmware) keyboard data (GPL-2.0-or-later, used under GPL-3.0). Geometry and variants come from VIA, physical key codes from each board's QMK default keymap, and USB IDs and the brand from QMK. The data is converted and filtered, and it is licensed under **GPL-3.0**. See the [attribution notice](src/lib/keyboard/layout-data/NOTICE.txt), which lists sources, pinned commits, and upstream copyright lines, and the [GPL-3.0 text](src/lib/keyboard/layout-data/LICENSE-GPL-3.0.txt). Both are linked from the app footer.

Maintainers regenerate the snapshot with `npm run import:layouts` (Node 22.18+, network access required). The importer reads only the reviewed allowlist in `scripts/keyboard-layout-sources.json`, pins upstream commits, and rejects layouts without an angled split. The app never fetches layout data at runtime.

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
8. Remaining Practice Modes: Quote, Custom, Zen

See the [Technical Design Document](doc/tech-design.md) for the product roadmap and feature intent and the [Phase 9 Implementation Plan](doc/phase-9-implementation-plan.md) for the latest implementation and verification record. Difficulty levels, alternate themes, and automatic device identification are not implemented. Reading layouts from firmware (Vial/VIA protocol, ZMK Studio) is deferred.

## License

The repository currently includes a provisional MIT license for AliceType-authored source. Confirm the copyright holder and licensing choice before publishing or distributing the project. Bundled vocabulary data is CC BY-SA 4.0, and bundled keyboard layout data is GPL-3.0 (see above). Because MIT is GPL-compatible, a distributed build that includes the layout data is conveyed under GPL-3.0 as a whole, and this repository provides the corresponding source.
