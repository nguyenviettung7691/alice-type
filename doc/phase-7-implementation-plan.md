# AliceType Phase 7 Implementation Plan

## Goal and design analysis

Implement [Phase 7 Detail Design](./phase-7-detail-design.md) on the existing Svelte 5 application. Add a local Keyboard Details view, a sourced and revisioned profile catalog, validated user-entered details, and eligibility-based reuse of verified keyboard maps in Keyboard Test. Preserve practice behavior, session history, Stats, Phase 6 test semantics, and the existing local-only privacy boundary.

`App.svelte` already owns app-view navigation and the versioned preferences record; `KeyboardTestPanel.svelte` owns transient test state. Extend these boundaries rather than adding a global store, a second storage key, or a device-detection path. The profile catalog is immutable bundled data. User edits and selected profile ID are separate local preferences. Existing generic Alice geometry and physical key codes remain the source of truth for that layout.

The initial catalog can contain only the generic Alice layout profile. Add a named physical keyboard only if every displayed identity/feature claim and any test-map claim has source-level provenance reviewed during implementation. A sparse but accurate catalog is preferred to unsupported breadth.

## Resolved implementation contracts

- Add a typed, immutable keyboard-profile catalog module with an explicit revision and review date. Give each profile a stable ID and kind (`generic-layout` or `device`). Keep catalog data independent of Svelte, browser storage, and UI.
- The generic Alice entry is a layout profile derived from `ALICE_LAYOUT`, not a keyboard product. Its brand, model, version, and hardware features remain unknown. Record internal code/layout provenance by source module; reserve external title/URL/access-date citations for claims supported by external references.
- Track provenance for each sourced identity, feature, legend, and physical mapping claim. Each external source reference must list only fields it actually supports. Do not invent citations, imply a product was tested, or infer a feature from a family name or related model.
- Ship no real device records unless the implementation can verify and cite them. The profile selector remains useful with the generic profile and the unselected state alone.
- Add preferences schema v3 at `alicetype.preferences`: `keyboardProfileId: null` and empty `keyboardUserDetails` by default. Preserve every Phase 5/6 field. Migrate v2 directly to validated v3, and chain valid v1 through the existing v1-to-v2 logic in memory before writing only the final v3 record.
- Do not write an intermediate v2 record during a v1-to-v3 migration. A failed final migration write retains validated v3 state in memory, is reported through the existing preference error/retry path, and does not discard valid settings or claim successful persistence.
- Validate profile IDs against the bundled catalog and validate persisted details as untrusted data. Trim text; limit each text field to 120 characters. Boolean feature overrides are `true`, `false`, or omitted. Omission means use the selected catalog value if available, otherwise display unknown.
- Keep catalog records immutable and keep user overrides separate. For each displayed field, user input takes precedence and is labeled **You provided this**; otherwise show a sourced catalog value as **Catalog verified** or show **Unknown**. Clearing personal details never clears profile selection; selecting no profile never clears personal details.
- Do not claim hardware detection. Standard keyboard events and optional layout-map results do not identify physical hardware or features. Phase 7 adds no permissions, device enumeration, USB/Bluetooth access, backend, telemetry, or runtime source fetching.
- Keep the details view separate from Keyboard Test. Use a profile-specific test map only when its geometry, legends, and physical-code mapping are explicitly defined and verified. Otherwise use and label **Generic Alice test layout**. A user edit is never eligible to alter the test map.
- Resolve the active test map when the Keyboard Test view starts. Do not mutate a sequence in progress when preferences change. Preserve Phase 6 focus-scoped `KeyboardEvent.code` handling, temporary counts, audio preferences, reset/completion behavior, and test/practice-statistics separation.
- Keep device details out of IndexedDB, completed-session records, typing text, missed-key summaries, and Stats. Do not make network requests for catalog sources or user information.
- Use native controls, visible focus, text source labels, responsive layout, plain-text rendering, and accessible persistence errors. Do not add dependencies.

## Execution steps

### 1. Catalog schema and profile integrity

1. Define readonly profile, feature, source-reference, provenance, and catalog-revision types in `src/lib/keyboard/keyboard-profiles.ts`.
2. Add the generic Alice layout profile using the existing layout data, with no device identity or hardware claims. Document its module provenance and its generic/test-layout classification.
3. Decide the catalog's stable field representation and test-map eligibility rule before adding UI. A profile is eligible only when it supplies a verified, renderable physical map; layout names alone are insufficient.
4. Add catalog tests for stable unique IDs, valid profile kinds, revision/date shape, field-level source coverage, nonempty citation metadata for external claims, valid internal layout references, and test-map completeness/eligibility.
5. Add only sourced device records that pass review. If no record meets the source bar, keep the catalog generic-only.

**Exit:** catalog values are typed, traceable, immutable, and do not make unsupported identity or feature claims.

### 2. Preference schema and migration

1. Extend `Preferences` and defaults in `src/lib/storage/preferences.ts` with nullable profile ID and an empty user-details object; retain the existing preference key and all Phase 5/6 values.
2. Add strict v3 validation for the full existing record, selected catalog IDs, optional trimmed text fields (maximum 120 characters each), and boolean feature overrides.
3. Refactor migration as pure, testable steps: validate v1 before applying v1-to-v2 defaults, then validate/migrate to v3 in memory; validate v2 before adding Phase 7 defaults; validate v3 directly for current records.
4. Persist only the final v3 record after successful validation. Preserve the existing no-silent-overwrite behavior for malformed/future data and the existing migration-save error/retry contract.
5. Extend `src/lib/storage/preferences.test.ts` for v1→v3 and v2→v3 preservation, exact current-schema round trips, invalid IDs/types/oversized text, unknown fields policy, malformed/future versions, and failed migration writes with in-memory retention and retry.

**Exit:** all supported preference versions migrate without losing practice or test-sound values, and invalid data never enters UI state.

### 3. Keyboard Details view

1. Add `KeyboardDetailsPanel.svelte` to render the unselected state, profile selector, catalog revision/source references, identity values, and supported-feature values with field-level provenance labels.
2. Add a separate user-details editor for name, brand, model, version, connectivity, and boolean feature overrides. Validate and normalize at the component boundary and again in the storage validator.
3. Keep user overrides separate from catalog values. Implement display precedence, an edit/save/cancel flow, and a confirmed clear action that removes only user details.
4. Display catalog citation links only for applicable sourced claims. Render user-provided values as text, never HTML. Identify generic Alice as a layout, not a device.
5. Show unknown values explicitly and explain that selecting a profile is not hardware detection. Explain local-only storage and surface save failures using the existing app-level preference error and retry mechanism.
6. Add focused component/browser tests for unselected/generic/sourced states, source labels, precedence, source links, edit validation, clear confirmation, and accessible feedback.

**Exit:** users can inspect and edit local details without editing catalog data or seeing guessed/detected device information.

### 4. App navigation and Keyboard Test integration

1. Add the `keyboard-details` view to the app view type, header navigation, view rendering, and focus-after-navigation path. Preserve existing practice-mode navigation and the running-session restriction.
2. Pass profile selection and personal details through the existing app-owned preference change/persistence callback; the details component must not read/write browser storage directly.
3. Pass the resolved verified test map to Keyboard Test only when the selected catalog entry is eligible. Otherwise explicitly label the existing generic Alice map. Do not allow profile metadata or user-entered layout data to change physical test mapping.
4. Ensure a profile selection change cannot alter a mounted test sequence. Resolve the map on a fresh test-view mount/run and preserve Phase 6 behavior when navigating away and back.
5. Verify a no-profile state remains valid and useful, selected profiles persist across reload, and existing Settings/Stats/Practice/Keyboard Test navigation and preferences remain unchanged.

**Exit:** profile-aware test layouts are explicit, verified-only, and isolated from running test state and practice.

### 5. Browser verification, regression, and documentation

1. Add `tests/keyboard-details.spec.ts` for navigation, selected/unselected states, source labels and citations, text/feature editing, field precedence, clear confirmation, reload persistence, invalid stored data, and keyboard-only use.
2. Extend `tests/keyboard-test.spec.ts` for generic Alice fallback, verified-profile map selection when one exists, active-map labeling, and unchanged physical-code, focus, reset, and statistics behavior.
3. Test the v1-to-v3 and v2-to-v3 migration paths with representative Phase 5/6 values, migration write failure/retry, malformed/future records, invalid IDs, and storage denial. Confirm no intermediate migration write and no false success state.
4. Verify profile/user detail values never enter IndexedDB history or Stats and that no external requests are made for catalog or device information.
5. Run the focused unit and browser tests, then the configured full test suite, type check, production build, and Playwright suite. Verify Phases 2–6 regression coverage remains green.
6. Inspect desktop and narrow-screen layouts, focus handling, source labels, and clear-confirmation behavior. Update the Phase 7 detail design status and this plan with actual implementation/verification results only after completion.

**Exit:** acceptance criteria in the detail design pass, no external data flow is added, and Phase 2–6 behavior remains intact.

## Verification checklist

- [x] Catalog has a revision/date, generic Alice profile, and field-level provenance for all claims.
- [x] No unsourced device identity, feature, or layout map is represented as verified; the catalog remains generic-only.
- [x] Preference v1/v2 migration to v3 preserves all existing values and only writes a fully validated v3 record.
- [x] Invalid/future preferences and failed storage operations are explicit and recoverable.
- [x] User details validate at both form and persistence boundaries, remain separate from catalog data, and persist across reload.
- [x] Unknown, catalog-verified, and user-provided values are visibly and programmatically distinguished.
- [x] Keyboard Details works with keyboard navigation and responsive viewport sizes.
- [x] Keyboard Test uses only verified profile maps; otherwise it identifies its generic Alice fallback.
- [x] Profile data does not affect practice, session history, test counts, or Stats.
- [x] No hardware detection, device permission, backend, telemetry, or external runtime request was introduced.
- [x] Focused and regression tests, type check, production build, and browser suite pass.
- [x] `git diff --check` passes.

## Verification results

Implementation completed on 2026-10-26. The bundled catalog currently contains only the generic Alice layout: no manufacturer-specific profile was added without reviewed provenance.

| Check | Result |
| --- | --- |
| `npm test` | 214 tests passed across 8 files. |
| `npm run check` | Zero errors and zero warnings. |
| `npm run build` | Production build passed. |
| `npm run test:e2e -- --workers=4` | 92 Chromium tests passed, including Keyboard Details, v1/v2-to-v3 preference migration, and Phase 2–6 regression coverage. |
| `git diff --check` | Passed. |
