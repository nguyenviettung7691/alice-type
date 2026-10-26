# AliceType — Phase 7 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 7: Keyboard Device Details |
| Status | Base scope, section 13 extension, and section 14 layout-profile extension implemented and verified in automated tests (physical-keyboard verification pending) |
| Source design | [Technical Design Document](./tech-design.md) |
| Preceding phase | [Phase 6 Detail Design](./phase-6-detail-design.md) |

## 2. Purpose

This document defines a sourced keyboard-profile catalog and a local device-details view. Users can select a catalog profile, record their own device details, and see which information is catalog-verified, user-provided, or unknown. A profile may also supply a physical key map for the Keyboard Test view, but only when that map is explicitly defined and verified.

The base feature describes information the user selected or entered. The user-requested optional browser-access extension in section 13 adds limited browser-reported device descriptors without inferring hardware specifications. The user-requested Keyboard Layout Profiles extension in section 14 adds a bundled, sourced catalog of real Alice-family keyboard layouts imported from open-source QMK and VIA definitions, suggests candidate profiles from browser-reported vendor/product IDs and other evidence, and lets the user confirm the exact profile and layout variant. A suggestion is never presented as detection; a device-specific layout becomes active only after explicit user confirmation. Existing practice input, session history, and Phase 6 test behavior remain independent of device details.

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
- Required permissions, USB/Bluetooth scanning, keyboard probing, operating-system integration, server requests, telemetry, accounts, or cloud synchronization. Optional WebHID descriptors are covered only by section 13.
- Inferring hardware details from `KeyboardEvent`, `KeyboardEvent.code`, `KeyboardEvent.key`, browser layout maps, user-agent data, or a selected layout alone.
- Fabricating catalog entries or completing missing catalog fields with guesses.
- Allowing users to modify catalog records or mark self-reported information as catalog-verified.
- Adding an unverified or user-entered physical map to the test matrix as if it were verified.
- Changing typing metrics, practice settings, sound preferences, keyboard-test scoring, or session-history records.

### 3.3 Scope changes from later extensions

Sections 13 and 14 are user-requested extensions to this base scope and take precedence where they conflict with section 3.2:

- Section 13 permits optional WebHID chooser access and browser-reported descriptors (product name, vendor ID, product ID).
- Section 14 permits using those descriptors, browser layout legends, and observed physical key codes as **ranking evidence** for catalog candidates. It also permits bundled device profiles imported from QMK/VIA sources. It does not permit presenting a candidate as detected, auto-selecting a device layout without confirmation, inferring features from IDs, opening HID devices, or fetching data at runtime.

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

The Phase 7 implementation ships the generic Alice profile only. No vendor-specific device entry is included because no catalog claim has been sourced and reviewed for this release. Section 14 defines how reviewed device profiles are imported from QMK/VIA sources; until that extension is implemented the catalog remains generic-only.

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
- Do not claim automatic hardware identification in headings, labels, empty states, error messages, or test instructions. Section 13 descriptors must be labeled browser-reported.
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
- **Limited runtime descriptors:** The base phase has no hardware discovery. The explicit extension below permits optional WebHID descriptors, not inferred device profiles or success-shaped hardware identification. Section 14 uses descriptors only to rank user-confirmed suggestions.

## 13. User-requested optional keyboard access extension

This extension supersedes the original prohibition on optional device APIs, but not the prohibition on fabricated hardware claims.

- `KeyboardConnection.svelte` owns optional access and its lifecycle; `keyboard-access.ts` defines minimal browser interfaces and a pure legend-overlay helper. No new dependency is required.
- On first use, show the native app welcome dialog automatically. With WebHID support, query previously granted connected devices on mount. If none are available (or detection fails), also show the dialog on returning visits. Skipping or Escape dismisses it for the visit. Do not use `onboardingComplete` as evidence of a browser permission grant.
- **Connect Keyboard & Start** invokes `requestDevice({ filters: [] })` synchronously within the user's activation, before awaiting anything. Browsers prohibit automatically opening their native chooser on load. Explain that users must choose their keyboard and that protected keyboard interfaces may not appear. Vendor-defined interfaces prevent a reliable keyboard-only chooser filter; do not classify arbitrary HID devices as keyboards.
- Restore one authorized device automatically. If several are connected, require an explicit selection and explain that standard key events cannot be associated with one HID device. Handle connect/disconnect events, remove listeners on teardown, and invalidate stale asynchronous updates.
- Present product name, vendor ID, and product ID in a separate **Browser-reported device** section. These are descriptors, not verified brand, model, firmware, feature, or geometry claims. Do not merge them into catalog facts or personal notes.
- Also display **VID:PID (VPID)** as the existing vendor/product IDs combined in four-digit hexadecimal form (`VVVV:PPPP`). This is formatting, not an additional detected fact. Skip VIA/KC support and firmware-version fields: generic WebHID descriptors do not establish them, and vendor-defined HID collections alone do not prove a protocol. Do not probe device reports or guess from a product name. Section 14 may use these descriptors to rank catalog candidates for user confirmation, never as proof of a match.
- `navigator.keyboard.getLayoutMap()` is possible only where exposed and allowed by the browser. **Start practicing** requests just these legends; the connection action also attempts them. Use the same reference map with the same available legends in both Practice and Keyboard Test. Preserve physical codes, geometry, counts, and typing semantics. Missing or blank legends retain reference values. Handle supported layout-change events and provide **Refresh key labels**.
- Keep the connection panel collapsed by default using native `details`/`summary` with keyboard activation and visible focus. The summary always shows **Keyboard connection**, a text status badge, and the selected device name (or an explicit unselected state). Use yellow for selection/attention needed, green for a selected device, blue for pending permission, and neutral for unavailable access; never convey status through color alone. Keep controls, full guidance, and browser-only privacy inside the expanded panel, with actions and summary content wrapping on narrow screens. Present browser-reported details in a responsive definition-list card with a single source label, separate from the reference-layout limitation and editable notes.
- Keep the connection panel first in the main content, directly below the app navbar on every view, without vertical centering or a hero/intro gap. It remains in normal document flow. The navbar contains only app-view navigation. Practice mode selection lives in the Practice panel above exercise settings as a wrapping segmented control; future modes stay unavailable, and mode changes remain disabled during a run. Remove the Practice intro block.
- The catalog still contains only generic Alice. State explicitly that no verified device-specific profile is available and the reference diagram is not detected hardware. A real keyboard-specific arrangement requires a sourced, reviewed catalog entry; descriptor names and IDs are not enough. Section 14 supplies such entries and requires user confirmation before a device-specific arrangement becomes active.
- Show visible, politely announced warnings for unsupported access, denied access, cancelled/empty selection, no accessible device, and API errors. Include error details and retry controls; all ordinary typing and manual profile editing remain available without permission. Clear stale selected-device descriptors and browser legends when that device disconnects.
- Display browser-only privacy in onboarding and across views: no app or connected-device data is uploaded. Retain live descriptors and layout maps only in page memory; the browser owns persistent device grants. Existing profile/personal-detail preference storage is unchanged. Do not open HID devices, read input reports, send output/feature reports, add telemetry, or associate descriptors with session history. Users can revoke device grants through browser site settings.
- Verify first-load prompting and returning visits without grants, user activation, restored grants, multiple devices, denied/empty/unsupported/error cases, disconnect/reconnect, shared legend updates, unchanged typing/matrix behavior, and narrow layouts with mocked browser APIs. Physical-device compatibility still requires manual testing on the user's keyboard and browser.

Browser API references:

- [MDN: HID.requestDevice()](https://developer.mozilla.org/en-US/docs/Web/API/HID/requestDevice)
- [MDN: HID.getDevices()](https://developer.mozilla.org/en-US/docs/Web/API/HID/getDevices)
- [MDN: Keyboard.getLayoutMap()](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap)

## 14. User-requested Keyboard Layout Profiles extension

Status: implemented on 2026-10-26 with a 23-profile catalog (revision `via-9e3e9f4.qmk-180f394`); see the [implementation plan](./phase-7-implementation-plan.md#extension-verification-results) for verification results. This extension supersedes the generic-only catalog limitation in sections 5.1, 12, and 13. It does not relax the rules against fabricated claims, presenting suggestions as detection, or reading HID reports.

### 14.1 Goal and constraints

Present an exact, realistic layout for the user's Alice-family keyboard whenever a reviewed source describes it. Browsers cannot read a physical layout from a standard keyboard, so AliceType combines:

1. A **bundled catalog** of real Alice-family layouts imported from open-source keyboard definitions.
2. **Candidate ranking** from browser-available evidence.
3. **Explicit user confirmation** of the profile and its layout variant.

Known limits that the design must handle, not hide:

- **Shared USB IDs.** Many inexpensive boards use a controller vendor's generic VID:PID, so one ID pair can map to several unrelated keyboards. A unique ID match is still only a strong suggestion.
- **Layout variants.** One product can ship with split or full Backspace, one or two spacebars of different widths, optional macro columns, and different right-Shift/arrow clusters. Descriptors do not reveal the variant.
- **Logical codes.** `KeyboardEvent.code` cannot distinguish two spacebar halves (both `Space`) or duplicate B keys, and firmware remapping can change emitted codes. Observed codes can eliminate variants but cannot prove one.
- **WebHID limits.** Browsers exclude protected keyboard collections; only the descriptors from section 13 are available, and AliceType does not open devices.

### 14.2 Sources and evidence ranking

| Rank | Source | Use in this extension | Notes |
| --- | --- | --- | --- |
| 1 | [VIA keyboard definitions](https://github.com/the-via/keyboards) (`v3/<vendor>/<keyboard>.json`) | Geometry (KLE layout with real per-key rotation `r`/`rx`/`ry`), matrix `row,col` per key, `vendorId`/`productId`, display name, and `layouts.labels` variant groups | QMK `info.json` layouts flatten Alice rotation, so VIA geometry is the realistic source. GPL-3.0. |
| 2 | [QMK keyboard API](https://keyboards.qmk.fm/v1/usb.json) and [`qmk/qmk_firmware`](https://github.com/qmk/qmk_firmware) | Manufacturer (brand), the `LAYOUT_*` matrix order from merged `info.json`, the default keymap's base layer (physical keycodes by matrix position), and the full `usb.json` VID/PID index for shared-ID counts | QMK layouts contain matrix positions, not keycodes. GPL-2.0-or-later. |
| 3 | AliceType-curated entries | Boards absent from QMK/VIA, authored from a manufacturer-published KLE/layout file or a reviewed physical measurement | Same provenance and review bar as other entries. None ship in the first import. |
| — | Product-name similarity | Ranking signal only | Never sufficient to suggest a match on its own. |

**Deferred (out of scope for this extension):** reading a Vial-encoded layout definition from firmware over raw HID, VIA protocol queries, ZMK Studio, runtime fetching of any source, user-imported KLE files, and automatic selection without confirmation. These may be proposed in a later phase. Device queries would require opening HID devices, which section 13 still prohibits.

### 14.3 Catalog import pipeline (maintainer-only)

- Add the maintainer script `scripts/import-keyboard-layouts.ts`. Maintainers run it with `npm run import:layouts` on Node 22.18+ (native TypeScript type stripping). It is not part of `npm run build` and the application never runs it. It reads the reviewed allowlist `scripts/keyboard-layout-sources.json`. Each entry gives the VIA definition path, the QMK keyboard folder, the default keymap path and base layer, and a reviewer note confirming the board is Alice-family. The script pins every download to the current commit SHA of `the-via/keyboards` and `qmk/qmk_firmware`, and records the QMK API `last_updated` timestamp.
- The script never auto-discovers boards. Allowlist additions require manual review of the source layout (two rotated clusters). The importer also rejects any layout that lacks an angled split, meaning it has no keys rotated in both directions. For that reason, straight-row boards such as AliceH66 Pianoforte are excluded.
- The script writes a committed, generated snapshot under `src/lib/keyboard/layout-data/`:
  - `index.json`: catalog revision and generation date, plus each profile's identity, USB IDs, source references, variant groups, and `sharedIdCount` per VID:PID from the full QMK `usb.json` index (including non-Alice boards).
  - `profiles/<id>.json`: physical keys (geometry, rotation, matrix, base keycode, `KeyboardEvent.code` or `null`, legend, variant membership) for lazy loading.
  - `NOTICE.txt` (attribution, upstream copyright lines, source paths and commits, modification statement) and `LICENSE-GPL-3.0.txt`.
- **License decision (recorded 2026-10-26 by the project owner):** imported QMK (GPL-2.0-or-later) and VIA (GPL-3.0) data may ship in AliceType, provided every license requirement is met:
  - Imported data keeps its upstream license. Generated files state that they are derived from the listed upstream files, were converted and filtered by the importer, and are licensed under GPL-3.0 (QMK's "or later" option permits GPL-3.0).
  - `NOTICE.txt` preserves upstream copyright and license notices, including the copyright lines from each keymap header and attribution to the VIA and QMK contributors, and lists each source repository, path, and pinned commit.
  - The full GPL-3.0 text ships beside the data and is linked from the app footer, like the vocabulary notices, so every built distribution carries the notice and license.
  - The preferred form for modification (importer, allowlist, and generated data) stays public in this repository. Anyone distributing a build that includes the data must also offer this corresponding source.
  - AliceType-authored source stays MIT-licensed. MIT is GPL-compatible, so a distributed build that includes the imported data is conveyed under GPL-3.0 as a whole. The README license section states this.
  - The importer adds no warranty or further restriction and keeps the license text unmodified.
- No dependency is added to `package.json` for the importer. It uses only Node built-ins, `fetch`, and the app's pure TypeScript parsing modules.
- The importer validates its output and fails loudly. It never fills a gap with a guessed value.

### 14.4 Profile, geometry, and physical-code model

Extend `keyboard-profiles.ts` and `alice-layout.ts` types without changing generic Alice behavior:

- `KeyboardProfile` device entries carry `usbIds`, variant groups, and external source references (repository, path, pinned commit, access date). Identity `name` comes from the VIA definition name and `brand` from the QMK manufacturer field, each cited to its source. `model` and `version` stay **Unknown**. Hardware features (RGB, connectivity, rollover, programmable keys) stay **Unknown** because these sources don't state them as product specifications; QMK/VIA firmware support is not a feature claim.
- `AliceKeycap.half` becomes optional, and keycaps gain optional `rotation`, `originX`, `originY` (SVG units) and `secondary` (the second rectangle of ISO-style keys, drawn without a legend). The renderer uses `ALICE_HALF_TRANSFORMS` for halves and per-key `rotate()` otherwise, so generic Alice output is unchanged.
- KLE parsing follows the VIA reader's semantics: cursor and rotation carry-over, label alignment, decals skipped, and alternative options aligned to option 0 by top-left pivot. Rotated bounds normalize the origin. The key pitch is 48 SVG units with a 6-unit gap, matching generic Alice, and the `viewBox` comes from rotated bounds.
- **Physical codes.** Each VIA key's matrix `row,col` is matched to the keycode at that matrix position in the default keymap's base layer. Positions come from the merged QMK `info.json` `LAYOUT_*` order, resolving `layout_aliases`. Keycodes then go through a fixed, unit-tested QMK keycode → `KeyboardEvent.code` table (for example `KC_A` → `KeyA`, `KC_BSPC` → `Backspace`, `KC_SPC` → `Space`). These keys get `code: null` and are drawn but excluded from Practice highlighting and the test sequence:
  - layer keys, mod-tap, shifted, and macro keycodes;
  - RGB, media, and system-control keycodes;
  - `KC_TRNS`/`KC_NO` and vendor-custom keycodes;
  - matrix positions missing from the keymap.

  Never assign a code by position or legend. Legends come from the mapped code (for example `A`, `Backspace`) or a short keycode name for uncoded keys.
- Several keys with the same code (split spacebars, duplicate `KeyB`) merge into one logical key with several keycaps, so they share one count, as the generic Space does.
- **Variants.** Each VIA `layouts.labels` entry becomes a group: a string label is a two-option toggle (*No*/*Yes*), and an array is `[name, ...options]`. A resolved variant selects one option per group (default option 0). Keys outside groups always appear.
- **Test sequence.** Coded keys sorted by matrix `(row, col)`. Escape and F1–F24 are drawn and highlighted, but are left out of the guided sequence: Escape always exits the test (Phase 6), and function keys commonly trigger browser actions.
- **Test-matrix eligibility** (extends section 5.3). A resolved variant is eligible when geometry is complete and finite, every printable alphanumeric key of the generic Alice layout (`KeyA`–`KeyZ`, `Digit0`–`Digit9`, `Space`) has a code, and the source references are complete. Eligibility is a property of catalog data. Whether the profile matches the user's keyboard is decided only by user confirmation.

### 14.5 Candidate ranking

Add a pure module, for example `src/lib/keyboard/layout-matching.ts`, with no browser or UI access. Inputs:

| Evidence | Effect |
| --- | --- |
| Browser-reported VID:PID (section 13) | Exact index match produces candidates. Lower the weight as `sharedIdCount` rises; when the ID is shared, state that it is shared by several keyboards. |
| Browser-reported product name | Tie-breaker only; never creates a candidate. |
| Observed physical codes (only from the focused **Check with key presses** input in this page) | Eliminate variant options when an observed code appears in the profile only under other options of the same group. Never confirm a variant by itself. |

Layout-map legends are not ranking evidence: they reflect the OS input language, not the physical board, and the catalog keeps ANSI and ISO boards as separate profiles with distinct product IDs.

Output: an ordered candidate list with a human-readable reason for each (for example *"Vendor/product ID 0x3434:0x0381 matches; this ID is used by 1 catalog keyboard"*), and the variant groups that remain unresolved. No candidate means the generic Alice layout stays active and the view says no catalog match was found. Do not offer the closest-looking board as a guess.

Ranking runs locally on bundled data. Observed codes are kept in memory only and are not written to history or preferences.

### 14.6 Confirmation flow and UI

- Keyboard Details gains a **Find my layout** section, also reachable from the keyboard-connection panel when a device is selected. It lists ranked candidates as small accessible previews with name, source, reason, and a **Suggested — not confirmed** text label. Status is not conveyed by color alone.
- The user picks a candidate, then resolves the profile's variant groups with native radio groups. A single preview shows the currently selected variant. Groups that physical codes cannot distinguish, such as spacebar splits, are always resolved visually.
- Optional **Check with key presses**: ask the user to press specific distinguishing keys, such as the key left of Backspace, in a focused input. Use the result only to eliminate variants and say what was checked. Keep Phase 6 focus-scoped input rules, ignore repeats, and suppress no browser shortcuts.
- **Confirm this layout** saves the match. The UI then labels the arrangement **Confirmed by you**, alongside the per-field labels from section 6.2. A suggestion is never labeled detected or verified as matching.
- Users can also browse and pick any catalog profile without a connected device, and can clear a confirmation, which returns to the generic Alice layout.
- If a different VID:PID is later selected in section 13, keep the saved confirmation but show a non-blocking notice that the connected device differs from the confirmed one, with options to keep it or find another layout. Never switch automatically.

### 14.7 Practice, Keyboard Test, and visualizer integration

- The confirmed, eligible profile and variant replace the generic Alice layout in both the Practice visualizer and Keyboard Test, resolved when each view mounts. A running practice session or test run is never changed in place, following section 12.
- Browser layout-map legends still overlay reference legends by physical code. Keys without a standard code show their source legend and receive no highlight.
- The test sequence covers the resolved variant's coded keys in matrix `(row, col)` order, excluding Escape and F1–F24 (section 14.4). Shared codes keep the existing shared-count behavior. Phase 6 counts, reset, sound, and statistics isolation are unchanged. The text key results list marks the excluded keys as not part of the guided test.
- Stats and session history keep storing missed keys by physical code only. Profile data is not added to history.
- When the confirmed profile is not eligible, use and label the generic Alice layout as before and explain why.

### 14.8 Persistence (preferences schema v4)

- Add `keyboardLayoutConfirmation`: `null` or `{ profileId, variant: Record<groupIndex, optionIndex>, confirmedFor: { vendorId, productId } | null, catalogRevision }`. Saving a confirmation also sets `keyboardProfileId` to the same profile. Selecting a different profile clears the confirmation. Validation requires a matching `profileId`, non-negative integer group/option indexes, 16-bit integer IDs, and a non-empty revision of at most 40 characters.
- Migrate v3 → v4 by adding `keyboardLayoutConfirmation: null` and chain v1/v2 through the existing steps. Write only the final v4 record. Keep the section 7.2 validation, error, and retry contract.
- If a later catalog revision removes the profile, the existing unknown-profile validation error applies: the stored record is preserved and a recoverable error is shown. If the profile exists but the stored variant no longer matches its groups or options, keep the stored record unchanged. Show a recoverable notice that the confirmed layout is no longer available, use the generic Alice layout, and offer re-confirmation. Do not silently map the record to another profile.
- Do not persist observed key codes, ranking scores, layout-map legends, or product names beyond the confirmed VID:PID pair.

### 14.9 Privacy, network, and performance

- No runtime network requests. Source URLs appear only as citations.
- No HID device is opened and no report is read or written. All evidence stays in page memory, and only the confirmation fields above are stored locally.
- Load profile layout modules lazily with dynamic import, keyed by profile ID, so the initial bundle grows only by the small ID index. A failed chunk load shows an explicit error and keeps the generic Alice layout.

### 14.10 Module responsibilities (additions)

| Path | Responsibility |
| --- | --- |
| `scripts/import-keyboard-layouts.ts`, `scripts/keyboard-layout-sources.json` | Maintainer-only import, normalization, validation, and attribution generation from the reviewed allowlist (`npm run import:layouts`). |
| `src/lib/keyboard/layout-data/` | Generated, committed catalog snapshot (`index.json`, `profiles/*.json`, `NOTICE.txt`, `LICENSE-GPL-3.0.txt`). Never hand-edited. |
| `src/lib/keyboard/kle-layout.ts` | Pure VIA/KLE layout parser (rotation, label alignment, variant groups, option alignment, bounds). |
| `src/lib/keyboard/qmk-keycodes.ts` | Pure QMK keymap layer parser and keycode → `KeyboardEvent.code`/legend table. |
| `src/lib/keyboard/layout-catalog.ts` | Imported profile index, lazy profile loading, variant validation/resolution, conversion to renderable layouts, test sequence, and eligibility. |
| `src/lib/keyboard/layout-matching.ts` | Pure candidate ranking and variant elimination with reasons. |
| `src/lib/keyboard/keyboard-profiles.ts`, `alice-layout.ts` | Device profiles from the imported index with cited identity; optional keycap rotation. |
| `src/lib/components/LayoutMatchPanel.svelte` (inside Keyboard Details) | Candidate list, browse, variant resolution, key-press check, confirm/clear, mismatch and stale notices. |
| `src/lib/components/AliceKeyboardVisualizer.svelte`, `KeyboardTestPanel.svelte`, `PracticePanel.svelte` | Render confirmed layouts with per-key rotation, computed `viewBox`, and uncoded keys; generic Alice output unchanged. |
| `src/lib/components/KeyboardConnection.svelte`, `AppFooter.svelte` | **Find my layout** entry point; GPL-3.0 layout-data notice and license links. |
| `src/lib/storage/preferences.ts` | Schema v4, validation, and v1/v2/v3 → v4 migration. |

### 14.11 Acceptance criteria (additions)

- Imported profiles have complete source references (repository, path, pinned commit, accessed date). The NOTICE, GPL-3.0 text, and footer links meet the section 14.3 license decision.
- Geometry conversion, rotation, keycode mapping, and variant resolution are unit-tested against fixtures, and generic Alice rendering output is unchanged.
- Candidate ranking is deterministic, explains every suggestion, discloses shared IDs, never suggests from product name alone, and returns no candidate when the evidence does not match the catalog.
- No device-specific layout becomes active without explicit confirmation. The UI never uses "detected" or "verified match" wording for suggestions.
- Confirmed layouts drive the Practice visualizer and Keyboard Test with unchanged Phase 2–6 semantics. Non-coded keys are visible but never highlighted or tested.
- Preferences migrate v1/v2/v3 → v4 with no data loss. Stale confirmations surface a recoverable notice.
- No runtime network request, HID open, or report access is introduced, and the initial bundle excludes per-profile layout data.
- Focused unit and browser tests, type check, production build, and Phase 2–7 regression suites pass. Manual verification on at least one physical Alice-family keyboard present in the catalog is recorded.

Source references for this extension (accessed 2026-10-26):

- [QMK keyboard API USB index](https://keyboards.qmk.fm/v1/usb.json) and per-keyboard `info.json`, for example [Keychron Q8 ANSI encoder](https://keyboards.qmk.fm/v1/keyboards/keychron/q8/ansi_encoder/info.json)
- [the-via/keyboards](https://github.com/the-via/keyboards) and the [VIA definition specification](https://www.caniusevia.com/docs/specification)
- [qmk/qmk_firmware](https://github.com/qmk/qmk_firmware)
