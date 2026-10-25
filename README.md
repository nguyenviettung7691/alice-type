# AliceType

AliceType is a desktop-oriented typing practice web app for the Alice split-ergonomic keyboard layout. The planned experience uses a distraction-free dark interface, a striking orange accent, real-time typing feedback, and configurable practice modes.

## Project status

Phase 1 scaffolding, the Phase 2 core typing engine, and the Phase 3 Alice visualizer are implemented. Practice one fixed exercise with character feedback, Backspace correction, live WPM/accuracy, completion, restart, and physical-key feedback on a generic Alice keyboard diagram. Configurable modes and persistence are not implemented yet. Product design documents:

- [Technical Design Document](doc/tech-design.md)
- [Phase 1 Detail Design](doc/phase-1-detail-design.md)
- [Phase 1 Implementation Plan](doc/phase-1-implementation-plan.md)
- [Phase 2 Detail Design](doc/phase-2-detail-design.md)
- [Phase 2 Implementation Plan](doc/phase-2-implementation-plan.md)
- [Phase 3 Detail Design](doc/phase-3-detail-design.md)
- [Phase 3 Implementation Plan](doc/phase-3-implementation-plan.md)

## Practice

- Select the exercise text, tab to the practice input, or activate **Start typing**. Focusing alone does not start the session; the first printable key does.
- Type the displayed sentence, including capitalization, spaces, punctuation, and the final period. Errors are red and underlined; Backspace removes the last character.
- WPM counts currently correct characters using five characters per word. Accuracy counts all character attempts, including mistakes later corrected.
- Tab leaves the practice input without capturing typing elsewhere. Elapsed time continues while focus is away; use **Resume typing** to return.
- Reaching the end completes the exercise even with errors. **Restart** resets the same exercise and all metrics.
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

Unit tests cover typing-engine behavior and layout mapping/geometry. The browser tests cover input/focus, correction, native-edit filtering, metrics, completion/restart, visualizer timing and physical mapping, timer cleanup, keyboard scrolling, and layouts at 1440, 768, and 320 px. They require port 4175 to be available.

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

See the [Technical Design Document](doc/tech-design.md) for the product roadmap and feature intent. The header's modes, Settings, and Stats remain non-functional placeholders. No keyboard permissions, device identification, sound, progress calculation, or persistent data is introduced through Phase 3.

## License

The repository currently includes a provisional MIT license. Confirm the copyright holder and licensing choice before publishing or distributing the project.
