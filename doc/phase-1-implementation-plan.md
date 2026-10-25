# AliceType Phase 1 Implementation Plan

## Goal

Implement the Phase 1 Scaffolding & UI Foundation defined in [phase-1-detail-design.md](./phase-1-detail-design.md): a buildable Vite + Svelte + TypeScript single-page app with Tailwind CSS, shared theme tokens, a responsive and accessible static practice shell, and no typing-session behavior.

## Constraints

- Product name and browser title: **AliceType**.
- Use the charcoal/orange design tokens defined in the detail design.
- Keep navigation and actions as clearly non-interactive Phase 1 placeholders.
- Do not add key listeners, keyboard permission prompts, dynamic exercises, live WPM/accuracy, persistence, sounds, or statistics.
- Avoid unnecessary dependencies; no icon library is needed for this static shell.
- Use the supported Tailwind CSS v4 Vite plugin and CSS-first theme configuration rather than a legacy JavaScript config.

## Work plan

### 1. Create the application foundation

- Add `package.json` with Vite development, production build, preview, and type-check scripts.
- Use Svelte 5, TypeScript, Vite, `@sveltejs/vite-plugin-svelte`, Tailwind CSS 4, `@tailwindcss/vite`, and `svelte-check`.
- Add the TypeScript, Vite, and Svelte configuration files and HTML entry point.
- Generate and retain `package-lock.json` so installs are reproducible.

**Exit criteria:** `npm install` succeeds; Svelte and TypeScript checks and a production build run.

### 2. Establish the theme and global layout

- Import Tailwind from `src/app.css` and configure the design tokens with CSS `@theme`.
- Define base page colors, font stack, selection, and a high-visibility focus treatment.
- Respect reduced-motion preferences and avoid introducing animation.

**Exit criteria:** The built page uses the documented palette without requiring external assets or fonts.

### 3. Compose focused, presentational UI components

- `AppHeader.svelte`: AliceType identity and static mode/settings/stats labels.
- `ModeNavigation.svelte`: the five roadmap modes as non-interactive labels, clearly marked as coming soon.
- `PracticePanel.svelte`: fixed sample text, neutral unavailable metric values, an inactive progress track, and an explicitly unavailable restart affordance.
- `AppFooter.svelte`: quiet supporting copy and phase status.
- `App.svelte`: semantic page landmarks, one top-level AliceType heading, and composition only.
- `main.ts`: mount the app and load the shared styles.

**Exit criteria:** Components remain presentational; there are no fake links, fake button handlers, or global event listeners.

### 4. Confirm repository documentation and exclusions

- Update `README.md` to describe the scaffold as implemented and explain its intentionally static Phase 1 status.
- Keep `.gitignore` aligned with Node/Vite/Svelte output and local environment files.
- Do not create or initialize a Git repository, and do not create a commit.

**Exit criteria:** README commands agree with `package.json`; generated dependency/build output is ignored.

### 5. Validate the acceptance criteria

- Install dependencies and run the configured type-check and production build.
- Start the local development server and inspect the rendered accessibility tree.
- Verify desktop and 768 px layouts have no horizontal overflow.
- Confirm the page includes all mode labels, Settings/Stats labels, practice sample, metrics, progress track, restart placeholder, and footer.
- Confirm static placeholders do not start a session, accept typing, or claim live metrics.

## File-level change map

| Path | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json` | Dependencies and reproducible scripts/install |
| `index.html` | Document metadata and Svelte mount point |
| `vite.config.ts`, `svelte.config.js`, `tsconfig.json` | Build, component, and type-check configuration |
| `src/main.ts`, `src/App.svelte`, `src/app.css` | App entry, composition, and theme |
| `src/lib/components/*.svelte` | Header, static navigation, practice panel, and footer |
| `README.md` | Current setup, commands, and scope |
| `doc/phase-1-implementation-plan.md` | This execution plan |

