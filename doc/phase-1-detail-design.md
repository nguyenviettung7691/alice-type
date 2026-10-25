# AliceType — Phase 1 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 1: Scaffolding & UI Foundation |
| Status | Implemented |
| Source design | [Technical Design Document](./tech-design.md) |
| Implementation plan | [Phase 1 Implementation Plan](./phase-1-implementation-plan.md) |

## 2. Purpose

This document defines the detailed design and acceptance criteria for establishing the AliceType web application's frontend foundation. Phase 1 provides the project structure, shared visual language, and static desktop-oriented page shell that later phases will extend.

This document is the implementation contract for the frontend foundation, not an implementation specification for the typing engine. The Phase 1 application scaffold and static UI are implemented under `src/`; typing-session behavior remains out of scope.

## 3. Phase 1 scope

### 3.1 In scope

- Establish a Vite-based Svelte + TypeScript application foundation.
- Define the initial directory and component boundaries.
- Define reusable global styles and the charcoal/orange visual theme.
- Specify the static page shell: header, main practice area, and footer.
- Define placeholder navigation and non-functional controls for future modes, settings, and statistics.
- Define responsive behavior for desktop and narrower viewports, keyboard accessibility, and Phase 1 verification criteria.

### 3.2 Out of scope

- Typing input capture, hidden input, keyboard permission prompts, or Keyboard API access.
- Exercise generation, mode behavior, timers, WPM/accuracy calculations, and progress updates.
- Alice keyboard SVG, live key highlighting, or missed-key tracking.
- Persistence, IndexedDB, localStorage, sound, and session statistics.
- Functional settings, mode navigation, dialogs, or account/backend functionality.

These features remain assigned to later roadmap phases in the Technical Design Document. Phase 1 controls are visual placeholders and must not imply that these behaviors already work.

## 4. Technical decisions

| Concern | Phase 1 decision |
| --- | --- |
| Build tool | Vite |
| UI framework | Svelte |
| Language | TypeScript |
| Styling | Tailwind CSS, with shared theme tokens and a small global stylesheet |
| Icons | Lucide icons only where an icon improves clarity; provide accessible names |
| State | Local component state only when required for presentation; no app-wide state store in Phase 1 |
| Browser support | Current stable desktop versions of Chromium, Firefox, and Safari |
| Runtime/backend | Static client-side application; no server or network dependency is introduced |

Use the current stable compatible releases when the application scaffold is implemented, and commit the package-manager lockfile. Do not add state, persistence, or UI libraries until an in-scope requirement needs them.

## 5. Project structure

The following structure is the target for implementation of the phase and describes the resulting application foundation.

```text
alice-type/
├── .github/
│   └── copilot-instructions.md
├── doc/
│   ├── tech-design.md
│   └── phase-1-detail-design.md
├── public/
├── src/
│   ├── lib/
│   │   └── components/
│   │       ├── AppHeader.svelte
│   │       ├── ModeNavigation.svelte
│   │       ├── PracticePanel.svelte
│   │       └── AppFooter.svelte
│   ├── App.svelte
│   ├── app.css
│   └── main.ts
├── .gitignore
├── index.html
├── LICENSE
├── package.json
├── README.md
├── svelte.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

The exact Tailwind integration files may differ depending on the compatible Tailwind release selected during implementation. Keep the resulting setup aligned with the pinned dependency versions rather than copying configuration for a different major release.

### 5.1 Component responsibilities

- **`App.svelte`**: Composes the page shell and owns no typing-session behavior.
- **`AppHeader.svelte`**: Renders the AliceType wordmark and the header actions.
- **`ModeNavigation.svelte`**: Displays the Timed, Words, Quote, Custom, and Zen mode choices. Choices are visibly selectable affordances but are non-functional in Phase 1.
- **`PracticePanel.svelte`**: Renders a static sample prompt, neutral placeholder performance values, and a non-functional progress indicator. It does not listen for keystrokes.
- **`AppFooter.svelte`**: Renders restrained product/supporting information without duplicating primary navigation.
- **`app.css`**: Defines global font defaults, theme tokens, focus treatment, page background, and any base styles not handled cleanly by utility classes.
- **`main.ts`**: Mounts the Svelte application and imports global styles.

Keep components presentational and focused. Do not create empty abstractions for future modes, keyboard services, stores, or persistence.

## 6. UI and visual design

### 6.1 Page composition

The application is a single-page desktop workspace with three primary regions:

1. **Header** — AliceType wordmark on the left; mode navigation and Settings/Stats affordances on the right.
2. **Main practice area** — centered content with a restrained section label, a large sample text block, subdued WPM/accuracy placeholders, a thin progress track, and a restart affordance.
3. **Footer** — low-emphasis supporting content, such as a short practice-oriented tagline or version placeholder.

The practice area is the visual focus. Keep the header and footer compact and prevent decorative UI from competing with the sample text.

### 6.2 Theme

| Token | Value | Usage |
| --- | --- | --- |
| `--color-background` | `#1A1A1A` | Main page background |
| `--color-surface` | `#242424` | Raised panels and control surfaces |
| `--color-text` | `#E8E8E8` | Primary text |
| `--color-muted` | `#929292` | Supporting text and inactive states |
| `--color-accent` | `#FF5D00` | Primary accent, active navigation, and progress indicator |
| `--color-error` | A high-contrast red, finalized against the dark theme during implementation | Reserved for later typing error feedback |
| `--color-focus` | `#FF5D00` | Visible keyboard focus outline |

Use the accent selectively. Maintain readable contrast for text and control states; do not use color as the only means of communicating status.

### 6.3 Typography and spacing

- Use a legible system sans-serif stack for interface text.
- Use a clear, generously sized type style for the sample prompt; avoid overly decorative fonts.
- Constrain the practice text width to a comfortable reading measure and center it in the main region.
- Use a consistent spacing scale and generous whitespace around the practice area.
- Avoid motion and blinking caret behavior in Phase 1; those belong with actual typing interaction.

### 6.4 Layout adaptation

- Optimize the primary composition for desktop viewports, with a centered content column and stable header alignment.
- At narrower widths, allow the header actions and mode choices to wrap or scroll without clipping the practice content.
- Preserve readable text size, visible focus, and usable hit targets on small viewports; do not hide essential navigation without an accessible alternative.
- Avoid a fixed minimum width that causes horizontal page scrolling.

### 6.5 Placeholder behavior

- Show one fixed sample sentence and neutral placeholder metric values.
- Render progress as an unchanging visual track; do not animate it or imply a real session is running.
- Mark non-functional controls with appropriate disabled semantics where they appear as controls. If they are merely visual labels, do not expose them as interactive elements.
- Do not register global key listeners or prevent browser defaults.

## 7. Accessibility and interaction requirements

- Use semantic `header`, `nav`, `main`, and `footer` landmarks.
- Provide a meaningful page title and a single top-level heading naming AliceType or its practice view.
- Ensure all genuinely interactive elements are reachable and operable by keyboard, with a clearly visible focus indicator.
- Use descriptive accessible names for icon-only controls; decorative icons must be hidden from assistive technology.
- Maintain sufficient text/background contrast and provide non-color cues for active, inactive, and disabled states.
- Keep placeholder controls non-functional and communicate their unavailable status instead of presenting misleading interaction.
- Respect reduced-motion preferences if any non-essential transition is introduced; no animation is required in Phase 1.

## 8. Implementation sequence

1. Initialize the Vite Svelte + TypeScript project and pin dependencies with a committed lockfile.
2. Configure Tailwind using the supported integration for the selected release and establish the theme tokens.
3. Add the global app styles, semantic page shell, and focused presentational components.
4. Populate the page with static placeholder content and ensure non-functional controls are clearly represented.
5. Validate the production build, desktop layout, narrower viewport behavior, and keyboard accessibility.

No step in this sequence implements later-phase typing, storage, permissions, or statistics features.

## 9. Verification and acceptance criteria

Phase 1 is complete when all of the following are true:

- The project starts in a local development environment and produces a successful production build.
- The browser title and visible product name are **AliceType**.
- The page contains the header, all five mode labels, Settings and Stats affordances, central practice panel, and footer.
- The charcoal background and `#FF5D00` accent are consistently applied, with readable text and visible focus states.
- The layout has no unintended horizontal overflow at a typical desktop width (1440 px) or a narrower width (768 px).
- Keyboard navigation can reach any implemented interactive controls, and focus remains visible.
- No typing session starts; no global keyboard listener, permission prompt, generated text, live metric, or persistent data is present.
- The production build and any configured lint/type checks pass.

## 10. Risks and implementation notes

- **Tailwind integration changes by major release:** Select a compatible version and follow its matching Vite/Svelte setup; keep configuration and lockfile consistent.
- **Static controls can mislead users:** Visually distinguish unavailable placeholders and avoid fake click behavior.
- **Theme contrast:** Check the final rendered combinations, especially muted text and disabled controls, rather than assuming the token values guarantee accessibility.
- **Scope creep:** The technical design places the initial keyboard permission overlay in Phase 5. Do not move it into Phase 1.
