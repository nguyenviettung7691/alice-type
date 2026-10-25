# AliceType

AliceType is a desktop-oriented typing practice web app for the Alice split-ergonomic keyboard layout. The planned experience uses a distraction-free dark interface, a striking orange accent, real-time typing feedback, and configurable practice modes.

## Project status

Phases 1–4 are implemented: the app foundation, typing engine, Alice visualizer, and generated Timed/Words exercises. Practice with optional punctuation/numbers, configurable vocabulary, live WPM/accuracy, mode-specific progress, completion, and restart. Persistence and the other roadmap modes are not implemented. Product design documents:

- [Technical Design Document](doc/tech-design.md)
- [Phase 1 Detail Design](doc/phase-1-detail-design.md)
- [Phase 1 Implementation Plan](doc/phase-1-implementation-plan.md)
- [Phase 2 Detail Design](doc/phase-2-detail-design.md)
- [Phase 2 Implementation Plan](doc/phase-2-implementation-plan.md)
- [Phase 3 Detail Design](doc/phase-3-detail-design.md)
- [Phase 3 Implementation Plan](doc/phase-3-implementation-plan.md)
- [Phase 4 Detail Design](doc/phase-4-detail-design.md)
- [Phase 4 Implementation Plan](doc/phase-4-implementation-plan.md)

## Practice

- Choose **Timed** (15/30/60/120 seconds) or **Words** (10/25/50/100 base words). The default is Timed, 30 seconds.
- Choose a **200**, **1000**, or **5000** word vocabulary and optionally enable **Punctuation** and **Numbers**. Both modifiers default to off. Settings and mode selection are locked while running; Restart unlocks them.
- Select the exercise text, tab to the practice input, or activate **Start typing**. Focusing alone does not start the session; the first printable key does. Type the full displayed target, including spaces and modifiers. Errors are red and underlined; Backspace removes the last character.
- WPM counts currently correct characters using five characters per word. Accuracy counts all character attempts, including mistakes later corrected.
- Tab leaves the practice input without capturing typing elsewhere. Elapsed time continues while focus is away; use **Resume typing** to return.
- Timed mode ends at its deadline, even when focus is elsewhere. Its target extends automatically as needed; running out of the initial text does not complete the session.
- Words mode ends on the final target character even with errors. Progress counts base words, not inserted number tokens; Backspace can reduce progress without erasing attempt history.
- **Restart** generates a fresh exercise using the same session configuration and resets all metrics. A generation failure displays an explicit error and stops capture until recovery. Nothing is saved on reload.
- Long exercises scroll within the text area; the active character is kept in view.
- Input is limited to discrete printable ASCII key presses. Paste, composition/IME input, and held-key repeat are not supported. Browser shortcuts are not captured by the typing engine.

## Alice visualizer

- The diagram shows a generic angled Alice arrangement with US ANSI legends; it is not a detected device or a model-specific keyboard.
- Accepted printable key presses highlight their physical `KeyboardEvent.code` for 300 ms: orange with **+** for a matching character, red with **!** and a dashed outline for a mismatch. Character correctness still uses the typed character, not the illustrated legend.
- Both drawn spacebars share the logical `Space` code and illuminate together. Backspace and modifier keys do not create correctness feedback. Unmapped physical codes still allow valid text entry without highlighting a key.
- Feedback clears when focus leaves the input, the exercise completes, or it restarts. It is temporary, not a stored missed-key statistic.
- At narrow widths, scroll within the diagram to see all keys. Keyboard users can tab to its scroll area and use Left/Right arrows; the diagram adds no focus stop when it fits.

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

Unit tests cover generation/word-bank validation, modifier boundaries, mode deadlines/progress, typing-engine behavior, and layout mapping/geometry. Browser tests cover all supported mode limits, settings, refill/error recovery, exact timed metrics, input/focus, correction, native-edit filtering, completion/restart, visualizer timing/mapping, timer cleanup, keyboard scrolling, and layouts at 1440, 768, and 320 px. They require port 4175 to be available.

## Vocabulary data

The bundled English vocabulary is adapted from Hermit Dave's [FrequencyWords](https://github.com/hermitdave/FrequencyWords), derived from OpenSubtitles2018. The three tiers are prefixes of 5000 unique lowercase ASCII entries in source frequency order, not a universal English frequency ranking. No vocabulary is downloaded at runtime.

Vocabulary data is licensed separately under **CC BY-SA 4.0**. See the [attribution and transformation notice](src/lib/typing/word-banks/NOTICE.txt) and [data license](src/lib/typing/word-banks/LICENSE-CC-BY-SA-4.0.txt); both are also accessible from the app footer in production builds.

## Planned technology

- Vite
- Svelte with TypeScript
- Tailwind CSS
- Lightweight inline SVG icons where needed
- Browser-only application; no backend is planned

## Roadmap

1. Scaffolding & UI Foundation
2. Core Typing Engine
3. Alice Visualizer
4. Modifiers, Modes, & Logic
5. Storage & Polish
6. Keyboard Keys Test Matrix
7. Keyboard Device Details

See the [Technical Design Document](doc/tech-design.md) for the product roadmap and feature intent. Quote, Custom, Zen, Settings, and Stats remain unavailable placeholders. No difficulty levels, keyboard permissions, device identification, sound, or persistent data is introduced through Phase 4.

## License

The repository currently includes a provisional MIT license. Confirm the copyright holder and licensing choice before publishing or distributing the project.
