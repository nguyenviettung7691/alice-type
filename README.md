# AliceType

AliceType is a desktop-oriented typing practice web app for the Alice split-ergonomic keyboard layout. The planned experience uses a distraction-free dark interface, a striking orange accent, real-time typing feedback, and configurable practice modes.

## Project status

Phase 1 scaffolding and the static UI foundation are implemented. Typing behavior and interactive modes are not implemented yet. Product design documents:

- [Technical Design Document](doc/tech-design.md)
- [Phase 1 Detail Design](doc/phase-1-detail-design.md)
- [Phase 1 Implementation Plan](doc/phase-1-implementation-plan.md)

## Getting started

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Available checks and production commands:

```sh
npm run check
npm run build
npm run preview
```

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

See the [Technical Design Document](doc/tech-design.md) for the product roadmap and feature intent. Phase 1 deliberately excludes typing and persistence behavior; the displayed modes and controls are non-functional placeholders.

## License

The repository currently includes a provisional MIT license. Confirm the copyright holder and licensing choice before publishing or distributing the project.
