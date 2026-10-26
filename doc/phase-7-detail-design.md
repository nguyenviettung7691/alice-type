# AliceType — Phase 7 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 7: Keyboard Device Details |
| Status | Implemented |
| Source design | [Technical Design Document](./tech-design.md) |
| Preceding phase | [Phase 6 Detail Design](./phase-6-detail-design.md) |

## 2. Purpose

This document defines a sourced keyboard-profile catalog and a local device-details view. Users can select a catalog profile, record their own device details, and see which information is catalog-verified, user-provided, or unknown. A profile may also supply a physical key map for the Keyboard Test view, but only when that map is explicitly defined and verified.

This feature describes information the user selected or entered; it does not detect the connected keyboard. Existing practice input, session history, and Phase 6 test behavior remain independent of device details.

## 3. Phase 7 scope

### 3.1 In scope

- A Keyboard Details app view reachable independently of Practice, Keyboard Test, Settings, and Stats.
- A curated, bundled, revisioned catalog of keyboard profiles with traceable provenance for every catalog claim.
- A generic Alice layout profile based on the existing `ALICE_LAYOUT`, without a specific brand, model, version, or hardware-feature claim.
- An unknown/unselected state and a catalog profile selector.
- A device-details form for user-provided name, brand, model, version, and supported features, with edit and clear actions.
- Field-level source labels: **Catalog verified**, **You provided this**, or **Unknown**.
- Local persistence of the selected profile and user-provided details, including versioned migration of the existing preferences schema.
- Optional reuse of a catalog profile's verified physical key map in Keyboard Test, with an explicit indication of the active map.
- Unit and browser tests for catalog integrity, preference migration/validation, editing, clearing, navigation, and test-matrix eligibility.

### 3.2 Out of scope

- Automatic detection of keyboard brand, model, version, firmware, layout, connectivity, RGB/backlighting, rollover, or programmable-key support.
- Required permissions, device APIs, USB/Bluetooth scanning, keyboard probing, operating-system integration, server requests, telemetry, accounts, or cloud synchronization.
- Inferring hardware details from `KeyboardEvent`, `KeyboardEvent.code`, `KeyboardEvent.key`, browser layout maps, user-agent data, or a selected layout alone.
- Fabricating catalog entries or completing missing catalog fields with guesses.
- Allowing users to modify catalog records or mark self-reported information as catalog-verified.
- Adding an unverified or user-entered physical map to the test matrix as if it were verified.
- Changing typing metrics, practice settings, sound preferences, keyboard-test scoring, or session-history records.

## 4. Technical decisions

| Concern | Phase 7 decision |
| --- | --- |
| Framework and language | Continue using Svelte 5 and TypeScript. |
| Catalog source | Bundle a small, statically typed catalog with the application. It is curated from explicitly recorded, reviewable sources; it is not fetched at runtime. |
| Catalog revision | Give the catalog a revision identifier and revision date. Give external source references a title, URL, access date, and the fields each source supports. Record internal layout provenance by module/path rather than inventing an external citation. Update the revision when catalog claims or sources change. |
| Claim provenance | Keep provenance per catalog claim, not just per profile. A profile must not imply that a source supports fields it does not document. |
| Generic profile | Include a generic Alice layout entry derived from the existing Alice layout module. Label it as a generic layout, not as a keyboard device or verified manufacturer profile. Its brand, model, version, and hardware features are unknown. |
| Physical mapping | A catalog profile is test-matrix eligible only if its physical `KeyboardEvent.code` mapping and rendered key geometry/legends are explicitly defined and verified. Reuse the Alice layout where appropriate; do not approximate another layout from its product name. |
| Unknown data | Represent absent information as unknown. Do not substitute a generic value, browser guess, or another profile's value for a missing field. |
| User-provided data | Store user-entered details separately from immutable catalog data. Display them as user-provided, even if they happen to match catalog text. |
| Preference storage | Extend the existing `alicetype.preferences` record to schema version 3. Migrate valid v2 records by preserving all existing values and adding an unselected profile with empty user details. |
| Privacy | Store the profile selection and user details only in same-origin local storage. Do not send them to a server or include them in typing history. |
| Dependencies | Use the current Svelte, TypeScript, and browser-storage patterns. Do not add a catalog, form, or persistence dependency. |

Catalog information is only as reliable as its documented source. A catalog revision is an editorial maintenance marker, not a guarantee that every product specification remains current. The UI must identify catalog content as sourced information rather than information detected from a connected device.

## 5. Catalog and profile model

### 5.1 Catalog structure

Add a catalog module, for example `src/lib/keyboard/keyboard-profiles.ts`, with readonly types and data. Keep catalog records declarative and separate from UI and persistence. Each catalog revision contains:

| Property | Purpose |
| --- | --- |
| `revision` | Stable revision identifier for the bundled catalog. |
| `updatedAt` | Date the bundled catalog was last reviewed. |
| `profiles` | Generic layout and sourced device profiles. |

Each profile has a stable ID, display name, profile kind (`generic-layout` or `device`), and only the identity, layout, feature, and provenance fields supported by its sources. Catalog entries are immutable at runtime.

Use field-level provenance for claims such as brand, model, version, feature values, legends, and physical-code mappings. Each external source reference identifies its title, URL, access date, and the exact profile fields it supports; internal layout references identify the source module and fields. Do not include unsourced marketing text or treat a manufacturer's general product page as evidence for fields it does not state.

The initial catalog must contain the generic Alice layout profile. Additional device profiles may be included only after their identity and displayed values have traceable sources and review. If no real device profile can be sourced during implementation, ship the generic profile only; do not invent examples to make the selector appear populated.

The Phase 7 implementation ships the generic Alice profile only. No vendor-specific device entry is included because no catalog claim has been sourced and reviewed for this release.

### 5.2 Profile data and missing values

A device profile may provide:

- Identity: name, brand, model, and version.
- Layout association and displayed key legends.
- Features such as RGB/backlighting, connectivity, key rollover, and programmable keys.
- A physical key map and geometry suitable for the test matrix.
- Provenance for each supplied claim.

An omitted field means **Unknown**; it is not a negative capability claim. For a feature with a source that explicitly says the feature is absent, present that sourced value as **No** and identify it as catalog-verified. Distinguish an unknown feature from a sourced absence.

Represent values according to the field:

- Boolean capabilities use `Yes`, `No`, or `Unknown`.
- Text properties such as connectivity use their sourced or user-entered text, or `Unknown`.
- Key legends and physical key codes are layout data, not device identification.

Do not infer a value from a product-family name, similarly named revision, related model, or a visual resemblance.

### 5.3 Test-matrix eligibility

The catalog includes the existing generic Alice code map and may include other profiles only when their physical mapping is verified and complete enough to render the layout. A profile without such a map remains selectable for device details but is not offered as a test layout.

When the selected device profile is not test-matrix eligible, Keyboard Test continues to use its existing generic Alice map and labels it **Generic Alice test layout**. It must not imply that the user's selected device has that exact physical arrangement. When a verified profile map is active, identify that profile in Keyboard Test.

Keep the Phase 6 constraints: use physical `KeyboardEvent.code`, ignore unmapped codes rather than guessing from characters, maintain separate test-run state, and do not write test results to statistics or history.

## 6. Navigation and details view

### 6.1 Navigation

Add **Keyboard Details** as a distinct app view alongside Practice, Keyboard Test, Settings, and Stats. Use a stable view identifier such as `keyboard-details`. Preserve practice-mode navigation and the existing restriction on changing app views during a running practice session.

The app owns the selected profile and user-provided details as persisted preferences. The details view receives the current values and change/clear callbacks; it does not access `localStorage` directly. After navigation, focus the new view's heading using the existing app navigation pattern.

The Keyboard Details view and Keyboard Test are separate views. Changing device details must not silently start, reset, or otherwise modify a test run. If a selected profile changes the map available to a later test run, the test view starts with that map and clearly identifies it.

### 6.2 View content and source labels

The view contains:

1. A **Keyboard Details** heading and concise privacy/source explanation.
2. A profile selector with a neutral **No profile selected** option, the generic Alice layout, and sourced catalog profiles.
3. A selected-profile summary that identifies a generic layout or catalog device profile and shows the catalog revision.
4. Identity fields for name, brand, model, and version.
5. Supported-feature fields for RGB/backlighting, connectivity, key rollover, and programmable keys when applicable.
6. A clearly labeled **Your device details** editor with save, edit, and clear actions.
7. An accessible status message for save errors and successful user actions where needed.

Show a source label for each displayed value, not only once for the whole view:

- **Catalog verified** for an immutable catalog value, with access to the relevant source citation.
- **You provided this** for a user-entered value.
- **Unknown** when no catalog value or user value is available.

For profile layout and legends, identify whether the source is the generic Alice layout or a verified catalog map. Do not label a selected profile's fields as detected. Selecting a catalog profile is an explicit user choice, not evidence that the connected device matches it.

### 6.3 Editing and precedence

Catalog records remain read-only. A user can enter, edit, and clear a separate set of personal details. Do not write edits into the bundled catalog.

For each identity or feature field, display the user's non-empty value as the active value with **You provided this**. Otherwise display the selected catalog's sourced value with **Catalog verified**. If neither exists, display **Unknown**. This precedence is only a presentation rule; retain the catalog record and personal values separately so clearing personal input reveals the catalog claim again.

The editor allows text values for name, brand, model, version, and connectivity, and **Yes** or **No** overrides for boolean features. An unset/cleared override means use the catalog value when one exists, otherwise show **Unknown**. Do not store an `Unknown` override where omission already represents unknown.

The clear action removes only personal details. It does not clear the selected catalog profile, alter the catalog, or change practice/test state. Offer an explicit confirmation before clearing saved personal details. Selecting **No profile selected** clears only the profile selection; the user's personal details remain available until explicitly cleared.

## 7. Persistence and validation

### 7.1 Preferences schema version 3

Extend the existing validated `Preferences` record with:

| Field | Shape | Default |
| --- | --- | --- |
| `keyboardProfileId` | Known catalog profile ID or `null` | `null` |
| `keyboardUserDetails` | Validated object of optional identity text fields and optional feature overrides | Empty object |

Keep the existing Phase 5/6 fields, including test sound settings, unchanged. Store these fields in the existing `settings` object under `{ "version": 3, "settings": { ... } }`; do not create a separate storage key.

### 7.2 Migration

On load:

1. Validate the stored envelope and its exact supported version.
2. For version 1, apply the existing v1-to-v2 migration in memory and then migrate the validated v2 values to v3.
3. For version 2, validate all existing values, preserve them, add `keyboardProfileId: null` and empty `keyboardUserDetails`, then validate the complete v3 settings.
4. For version 3, validate the complete record, including that any selected profile ID exists in the bundled catalog and that user-detail fields satisfy their type and length constraints.
5. Save the final v3 record only after validation; do not persist an intermediate v2 record during a chained migration. If the write fails, preserve valid migrated values in memory, report that the migration was not saved, and use the existing retry path.

Malformed JSON, unsupported future versions, invalid profile IDs, and invalid field values must be reported through the existing recoverable preference-error path. Do not silently overwrite the original record or claim a failed save succeeded. Follow Phase 5/6 behavior for invalid-load preservation and explicit user changes.

### 7.3 User-input validation

Treat local storage and form values as untrusted input. Validate:

- Profile IDs against the bundled catalog; `null` is the only unselected value.
- Text fields as strings, trimming surrounding whitespace and enforcing a 120-character maximum per field.
- Boolean feature overrides as `true`, `false`, or omitted; omission means no user override.
- Required object shape and supported schema version before loading a record into app state.

Reject invalid persisted values with a visible recoverable error. Do not coerce arbitrary values to strings, insert them as HTML, or fall back to a different device profile. Render all user text as text. Saving is performed through the existing preference storage boundary so storage failures remain visible and retryable.

Do not persist source URLs, fetched page contents, or any values discovered at runtime; citations belong to the bundled catalog.

## 8. Accessibility, privacy, and error handling

- Use semantic headings, labels, native buttons, and a native select or equivalent keyboard-operable profile picker.
- Keep keyboard focus visible and preserve focus after edit, save, cancel, and clear-confirmation actions.
- Present source state in text and not by color alone. Do not require opening a citation to understand whether a value is unknown or user-provided.
- Provide accessible names and concise descriptions for feature controls. Use appropriate status or alert semantics for persistence errors without announcing every field change.
- Keep the view usable at narrow widths and with zoom; avoid a wide table that requires two-dimensional scrolling.
- Explain that information is stored in this browser and is not sent to a server. Do not include profile details in keyboard-test results, session history, or Stats.
- Do not claim automatic detection in headings, labels, empty states, error messages, or test instructions.
- Keep unknown values visible as unknown; do not use success-shaped fallbacks after storage or validation failures.

## 9. Component and module responsibilities

| Path | Responsibility |
| --- | --- |
| `src/App.svelte` | Add the Keyboard Details view identifier/navigation branch; own preference changes and persistence; pass selected profile/details to the view and the eligible test-layout selection. |
| `src/lib/components/AppHeader.svelte` | Add Keyboard Details to the app-view navigation while preserving practice-mode controls and existing view state behavior. |
| `src/lib/components/KeyboardDetailsPanel.svelte` | Render the profile selector, sourced details, user editor, clear confirmation, and accessible status/error messages. |
| `src/lib/keyboard/keyboard-profiles.ts` | Define catalog/profile/provenance types, revision metadata, generic Alice entry, and reviewed sourced device entries. Keep it independent from UI and browser APIs. |
| `src/lib/keyboard/alice-layout.ts` | Remain the source of truth for the existing generic Alice geometry, legends, and physical codes. |
| `src/lib/components/KeyboardTestPanel.svelte` | Use the selected profile's verified test map when eligible; otherwise retain and clearly label the generic Alice test map. Keep test-run state independent of profile storage. |
| `src/lib/storage/preferences.ts` | Add v3 user-detail/profile fields, validation, v1/v2 migration, and persistence through the current storage boundary. |
| `src/lib/storage/preferences.test.ts` | Cover v2-to-v3 and chained v1-to-v3 migrations, value preservation, invalid profiles/details, and migration/save failures. |
| `src/lib/keyboard/keyboard-profiles.test.ts` | Check unique stable IDs, valid source references, field-level provenance, and test-map eligibility/coverage. |
| `tests/keyboard-details.spec.ts` | Cover navigation, unknown and selected states, source labels, edit/save/clear, reload persistence, responsive/accessibility basics, and no automatic-detection claims. |
| `tests/keyboard-test.spec.ts` | Cover generic fallback, verified-profile map selection, map labeling, and unchanged test isolation/reset behavior. |
| `src/app.css` and component styles | Add only details-view layout, source labels, editor, and responsive/focus states using existing theme tokens. |

Keep profile data and user-entered details separate. Do not put catalog logic in `App.svelte`, duplicate the Alice geometry, or add device details to the session-history schema.

## 10. Implementation sequence

1. Define catalog types, revision/provenance shape, and the generic Alice layout entry. Establish source-recording and review requirements before adding any real device records.
2. Add catalog validation tests for stable IDs, provenance references, allowed field shapes, and complete verified test maps. Add only entries supported by recorded sources.
3. Extend preferences to schema v3 with profile selection and user details; implement explicit chained migration and invalid-data/error cases before wiring the UI.
4. Build the Keyboard Details view with unselected/unknown states, profile selection, field-level labels/citations, validated editing, and confirmed clear behavior.
5. Add app/header navigation and persist changes through the existing preference callbacks and retry/error flow.
6. Connect only test-eligible verified catalog maps to Keyboard Test. Preserve the generic Alice fallback and identify the actual active test map.
7. Add unit and browser coverage for migrations, reload persistence, editing, source precedence, invalid data, profile eligibility, and unchanged practice/statistics behavior.
8. Run focused unit/browser tests, the configured type checks, and production build. Verify no network access is added and Phases 2–6 behavior remains unchanged.

## 11. Verification and acceptance criteria

Phase 7 is complete when all of the following are true:

- Keyboard Details is a separate, keyboard-operable app view, and existing Practice, Keyboard Test, Settings, and Stats navigation still works.
- The view supports a true unselected state and the generic Alice layout profile without implying a device identity.
- Every catalog identity, feature, legend, and physical-map claim has traceable provenance at the field level. The catalog has an explicit revision and review date.
- No unsourced or fabricated hardware profile/feature is present. Missing information remains explicitly unknown.
- Every displayed value is clearly labeled **Catalog verified**, **You provided this**, or **Unknown** as appropriate. Selecting a profile is never described as hardware detection.
- Users can select a catalog profile and edit, save, and clear their own details. User input is kept separate from immutable catalog records; clearing an override reveals a sourced catalog value where available.
- Profile selection and user details persist locally and survive reload. No device details are sent over a network, included in session history, or exposed in Stats; the details are limited to the intended fields in the local v3 preference record.
- Valid v2 preferences migrate to v3 without losing any Phase 5/6 settings. Valid v1 settings migrate through the supported chain. Failed migration writes preserve validated values in memory and are visible/retryable.
- Malformed, unsupported, or invalid preference data is not silently overwritten, misrepresented, or converted into a different profile.
- Catalog device profiles are available in Keyboard Test only when a complete, verified physical key map and renderable layout are supplied. Otherwise Keyboard Test uses and labels the existing generic Alice map.
- Test-map selection does not change Phase 6's `KeyboardEvent.code` matching, focus-scoped input, counts, reset semantics, audio settings, or separation from practice statistics.
- The details view is responsive and accessible: labels and source states are programmatic and visible, controls work with keyboard, focus is apparent, and status/errors are announced appropriately.
- Focused unit/browser tests, configured type checks, and production build pass with no Phase 2–6 regression.

## 12. Risks and implementation notes

- **Catalog coverage:** A small, correctly sourced catalog is preferable to a broad catalog with uncertain claims. It is valid for the first release to contain only the generic Alice layout profile.
- **Source drift:** Product pages may change or disappear. Retain source title, URL, access date, and catalog revision, and review claims when the catalog is updated.
- **Identity versus layout:** A layout can be useful without identifying the physical device. Keep the generic Alice profile distinct from any named product, and never infer a device from its layout.
- **Preference migrations:** The existing preference record is version 2. Chain the v1-to-v2 and v2-to-v3 migrations without dropping test-sound or practice fields; test failed writes as well as successful migration.
- **Profile changes and test input:** Resolve the active test map when entering Keyboard Test. Do not mutate a running sequence in place; a profile/map change must take effect on a fresh test run.
- **User text:** Render user-entered values as plain text and apply limits/validation at both form and storage boundaries.
- **No runtime discovery:** Browser keyboard APIs remain optional layout-assistance capabilities only. Phase 7 must not add device enumeration, permission prompts, or a success-shaped “detected” state.
