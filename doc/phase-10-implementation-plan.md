# AliceType Phase 10 Technical Implementation Plan

> **Status:** Runtime integration and automated verification delivered. English/Vietnamese UI/content, selector/persistence, committed Unicode/composition input and history are wired. Fluent Vietnamese editorial review and actual Windows/macOS Telex/VNI/screen-reader sign-off remain release gates, not completed checks.

## Goal and governing contract

Implement [Phase 10 Detail Design](./phase-10-detail-design.md) on the existing Svelte 5/TypeScript application. Ship complete English/Vietnamese UI and practice resources, a far-right saved language selector, and Vietnamese-capable text input across all five modes. Preserve keyboard tools, local-data privacy, settings and legacy scores.

The [Technical Design Document](./tech-design.md) remains the product source of truth. The detail design resolves shared UI/practice language, English default, full vocabulary tiers, native input methods, explicit Vietnamese finite Finish, scoring/history compatibility, and the two resource groups. Do not reduce this to label translation or implement unrelated roadmap features.

## Work packages and dependency graph

| ID | Work package | Prerequisites | Exit artifact/evidence |
| --- | --- | --- | --- |
| P10-01 | Baseline and localization/input inventory | None | Known consumers, current behavior/tests, string and compatibility inventory |
| P10-02 | Registry, message contracts and formatting | P10-01 | Typed en/vi resources, translator/context, exact-coverage tests |
| P10-03 | Vietnamese content and provenance | P10-01 | Reviewed bank/Quote data, validators and notices; no provisional content |
| P10-04 | Shared grapheme model and engine edits | P10-01 | NFC/profile helpers, grapheme offsets, pure committed-edit scoring and unit tests |
| P10-05 | Language-aware generation/configuration | P10-02, P10-03, P10-04 | Validated language-specific resources and immutable session configuration |
| P10-06 | Preferences, selector and switch lifecycle | P10-02, P10-05 | Schema v6 migrations, responsive header, reset/switch/storage recovery |
| P10-07 | Full UI and structured error localization | P10-02, P10-06 | All app-owned surfaces translated, dynamic notices retranslate |
| P10-08 | Native committed-text input and rendering | P10-04, P10-05, P10-06 | IME adapter, grapheme rendering, Finish/Enter, direct-key/physical separation |
| P10-09 | History and localized Stats | P10-02, P10-05, P10-08 | v3 records, legacy view model, language/scoring presentation |
| P10-10 | Integration, Vietnamese/IME/accessibility review | P10-03, P10-07, P10-08, P10-09 | Acceptance matrix evidence, regressions fixed |
| P10-11 | Documentation and sign-off | P10-10 | Accurate README/design status, notices, verification record |

P10-02, P10-03 and P10-04 are independent after baseline. Do not wire a language into the public selector until its message and content resources validate. Keep intermediate changes type-safe; adapt related test fixtures at the same time as their types.

### Integrated implementation progress (2026-10-29)

| Work package | State | Delivered / remaining |
| --- | --- | --- |
| P10-01 | Complete | Baseline and affected-contract inventory; eight unrelated Chromium failures reproduced before integration |
| P10-02 | Implemented | Typed registry, full en/vi catalogs with exact placeholders/runtime validation, reactive context, locale formatting; no dependency added |
| P10-03 | Implemented; editorial gate pending | Exactly 5,000 pinned subtitle-derived tokens, prefix tiers, reproducible import/filtering, 12 original passages/three collections; fluent review not performed |
| P10-04, P10-05 | Implemented | Shared NFC/repertoire and committed edits, language-aware generation/configuration, Custom/Zen support |
| P10-06, P10-07 | Implemented | Responsive selector, schema-v6 migration/recovery/reset, resource-driven visible/assistive/error copy |
| P10-08 | Implemented; real IME gate pending | Retained native buffer, composition commit/deduplication/cancellation, explicit finite Finish, deadline safety and physical-code separation |
| P10-09 | Implemented | v3 language/scoring metadata, unchanged legacy scores/database schema, locale Stats and separate accuracy summaries |
| P10-10 | Automated checks complete | Types/unit/build pass; 152 Chromium cases pass with the same eight reproduced baseline failures; real OS/assistive review pending |
| P10-11 | Documentation updated; sign-off pending | README/product/detail design/notices reflect delivered behavior and remaining gates |

The public selector now exposes both languages. The Vietnamese snapshot is not
a placeholder or English fallback, but its automated filtering is **not**
equivalent to fluent content review. Do not mark the entire phase/release signed
off until the manual gates below are completed.

## P10-01. Establish baseline and affected contracts

1. Inspect worktree; preserve unrelated changes. Read product, Phase 5 storage, Phase 8 modes/input, Phase 9 physical-test contracts.
2. Inventory app-owned strings in `App.svelte`, every component, `app.css` generated content, `index.html`, keyboard/layout matching and profile/catalog helpers, audio option arrays/errors, generator/custom/quote/storage failures. Record stable IDs versus translatable copy; inspect inactive/error/assistive paths too.
3. Trace all ASCII validation, string indexing/length/slicing, `wordEnds`, refill thresholds, Custom/Quote limits, Zen chunks/windows, `getTypingAction`, missed-key attribution, and practice input/composition handlers.
4. Inventory preferences v1-v5 validators and tests; unversioned/v2 history readers/writers/fixtures; Stats aggregation and text/numeric sorting.
5. Inspect `tests/support.ts`, seeded browser preferences/records, test fixture pages and role/name selectors. Retain English default regression cases; add separate Vietnamese cases rather than replacing every expected English string.
6. Run baseline `npm run check`, `npm test`, `npm run build`; run focused existing practice/storage/history/browser tests if needed to establish an input/storage baseline. Record unrelated failures without repairing them under this phase.

**Exit:** no runtime change; known affected consumers, baseline evidence, and a complete resource/input inventory.

## P10-02. Create the localization foundation

Primary files: new `src/lib/i18n/languages.ts`, `messages.ts`, `context.ts`, `format.ts`, `ui/en.ts`, `ui/vi.ts`, and their unit tests.

1. Define en/vi registry with native names, document tags and formatting locales. Infer `LanguageId`; add runtime guard and exact registry/content coverage contracts.
2. Extract current English messages into stable semantic keys. Define message/parameter types independently of literal English values; require Vietnamese to satisfy them.
3. Translate complete sentences, dynamic units/counts and errors; avoid copied English suffix logic, unsafe HTML, runtime key guessing or English fallback.
4. Add pure translation/format helpers and a small reactive Svelte context adapter owned by App. No DOM/storage/Svelte imports in typing/keyboard domain modules.
5. Add number/date/percent/duration/collation formatting with consistent units and existing precision. Keep numeric sort and persisted values untouched.
6. Test exact key/parameter coverage, supported/unknown IDs, formatting, interpolation escaping expectations, and a test-only future-language registration example to establish the extension boundary without shipping a third language.

**Exit:** complete typed UI resources and tests; no new dependency or public selector exposing incomplete practice content.

## P10-03. Deliver Vietnamese practice data and review rights

Primary files: new `src/lib/typing/word-banks/vietnamese.json`, `quotes/vi.ts`, `practice-content.ts`; existing vocabulary/quote notices and footer license links.

1. Evaluate a redistributable Vietnamese token source. Record pinned revision, license, retrieval date, selection procedure and reviewer; do not assume English's data license applies to a different source.
2. Produce exactly 5,000 reviewed unique NFC lowercase tokens. Validate letters only, no whitespace/noise/duplicates after normalization; derive 200/1000 tiers as prefixes. Keep English bank unchanged.
3. Have a fluent Vietnamese reviewer assess spelling, accents, common usage and unsuitable/noisy entries. Explain whitespace-token/syllable semantics rather than claiming linguistic word counts.
4. Prepare at least 12 distinct Vietnamese Quote passages, 40-1000 graphemes, across at least three reviewed sources/works or original collections. Prefer explicitly licensed AliceType originals if literary translation rights are uncertain.
5. Add language/stable global IDs and full attribution/provenance/rights/review metadata. Keep legacy English quote IDs and behavior.
6. Extend notices/licenses and local footer attribution links accurately. Do not add a runtime download or source URL fetch.
7. Test exact counts/prefixes, NFC uniqueness, valid character profile, catalog lengths/IDs/provenance, invalid resource rejection and per-language coverage.

**Exit:** usable reviewed resources and rights evidence. Missing count, unsuitable content or unverified rights blocks subsequent public exposure; never fill with placeholders/duplicates or substitute English.

## P10-04. Introduce shared grapheme text and pure committed edits

Primary files: new `src/lib/typing/text.ts`; existing `typing-engine.ts`, `custom-text.ts`, relevant tests.

1. Implement NFC validation/segmentation using `Intl.Segmenter`, explicit capability detection and the supported Latin/Vietnamese profile. Reject invalid controls/surrogates/standalone marks and unsupported scripts.
2. Replace UTF-16 character offsets with shared grapheme units in target/input state, comparison, metrics, generated boundaries, Custom/Quote validation and Zen chunk/window editing. Do not normalize preedit in place.
3. Add validated pure range-edit actions and reconciliation helpers; retain a direct-character convenience path only if it delegates to the same grapheme operation. Preserve public test APIs where appropriate rather than silently changing their meaning.
4. Implement attempt scoring for newly inserted/replacement graphemes, immutable historical totals on deletion, and current retained correctness for WPM.
5. Make generation/refill/completion accept batch edits safely. Do not silently truncate finite input; Vietnamese finite completion is an explicit action once target consumed.
6. Update Custom normalization/10,000-grapheme limits and Zen's 2,000-grapheme visible window, without adding writing persistence.
7. Test ASCII equivalence; NFC/NFD Vietnamese; different tone/case mismatch; grapheme deletion and replacement; repeated identical characters; Custom boundary lengths; Zen chunk edges; WPM/accuracy after correction; invalid edit bounds; no partial application on errors.

**Exit:** pure engine/text operations handle accented Vietnamese deterministically; existing English append/backspace scoring still passes.

## P10-05. Make built-in practice language-aware

Primary files: `exercise-generator.ts`, `quote-catalog.ts`, new `practice-content.ts`, `typing-engine.ts`, related tests.

1. Add immutable language to generated, Quote, Custom and Zen configurations. Avoid circular registry/generator/quote imports; shared types and descriptors must not depend on Svelte.
2. Resolve `getWordBank(language, tier)` through validated content; retain tier/modifier/random-source behavior and English draw/order behavior.
3. Emit grapheme `wordEnds`; test punctuation and number insertion still preserve base-token completion.
4. Scope quote selection/no-repeat to the requested language; retain English quote IDs. Reject unknown language, unsupported catalog and invalid configuration explicitly.
5. Enforce identical language/configuration on timed extension; calculate and repeat refills for multi-grapheme commits.
6. Test en/vi generation at every tier/limit, random-source errors, language isolation, quote no-repeat/Restart semantics, and snapshot-safe refills.

**Exit:** every practice mode can prepare a valid language-scoped session; missing content never silently becomes English.

## P10-06. Wire saved language and the far-right header selector

Primary files: `preferences.ts`, `App.svelte`, `AppHeader.svelte`, preference tests, `tests/support.ts`, `tests/storage.spec.ts`, new `tests/language.spec.ts`.

1. Add `Preferences.language`, default en, schema v6 writer and historical v1-v5 migration. Update old validator types to omit new fields and preserve every supported setting.
2. Preserve load/save distinction, raw invalid-record protection, migration-save failure settings, latest-state retry and localized warnings via descriptors.
3. Own localization context in App; update document lang/title/description from the in-memory selection, including first load and retry/restore-default transitions.
4. Add native select with visible label/native option names as the final header control, right-aligned at desktop/narrow widths. Preserve modal focus containment.
5. Enforce running guard in App and disabled/select help. Same-language selection must not regenerate content or save unnecessarily.
6. Implement section 6.2 switch table: new built-in content, preserved inactive settings/Custom draft/notes/layout/Keyboard Test counts, no global language-keyed remount. Invalidate stale Quote identity on language change.
7. Update Restore defaults confirmation to explain language reset; preserve history/onboarding behavior.
8. Test reload persistence, v1-v5 migrations, invalid v6 IDs/missing fields, load/save/quota failures and retry, default reset, switching by keyboard, disabled-running behavior, unchanged test counts and device selection.

**Exit:** selector persists correctly and changes the right state only; no lost writing/notes or silently overwritten saved data.

## P10-07. Localize all UI and recoverable errors

Primary files: `App.svelte`, `src/lib/components/*.svelte`, keyboard/profile/matching copy, audio/storage error classes, `index.html`.

1. Apply the inventory to every component and app-owned data label, including optional states, SVG descriptions, Text key results, sound option labels and keyboard provenance/matching reasons.
2. Replace presentation of raw `error.message` with translated code/parameter descriptors. Preserve original exceptions as causes and existing specific catch/rethrow behavior.
3. Store notices/completion/dialog messages as descriptors so switching translates current messages; do not remount controls or re-run domain operations to obtain fresh strings.
4. Format displayed numbers/dates/percentages/units and mode sorting with current locale. Preserve raw metrics and `aria-valuenow`/progress semantics.
5. Preserve proper names, user notes, physical legends/codes and original legal/source content. Add localized labels/help around them.
6. Audit header/navigation, all five modes, Stats empty/populated/error/delete, onboarding, connection failures, layout selection/details, both test modes and sound failures in both languages.
7. Add targeted browser assertions for representative normal/error/assistive surfaces. A string scan aids review but cannot prove translation correctness or completeness by itself.

**Exit:** no untranslated app-owned surface; documented exceptions are identities/source/legal text, not forgotten features.

## P10-08. Integrate native Vietnamese input and composition lifecycle

Primary files: new `practice-input.ts`/tests; `PracticePanel.svelte`; focused browser input tests.

1. Implement accepted-buffer/snapshot/generation state and grapheme diff validation from detail design section 8. Replace unconditional `beforeinput` cancellation and per-event input clearing.
2. Keep printable text through one native input pipeline. `keydown` only manages control policies, repeat/shortcut filtering, candidate-safe Enter and optional unambiguous direct-key metadata.
3. Support native composition commit/cancel and active-token native rewrites, including non-composing Telex/VNI sequences. Restore rejected native edits with localized feedback and no scored side effects.
4. Deduplicate both common final-input/composition-end orders by canonical value and generation, not timing heuristics; stale events after blur/reset/completion cannot mutate new state.
5. Make input-method/AltGraph candidate controls usable; prevent paste/drop/newline/unsupported earlier editing without breaking Tab exit/browser shortcuts.
6. Render target/caret/errors/progress with shared graphemes. Replace clipped capture with usable native composition/candidate anchoring and provisional writing-area rendering. Add finite Finish plus non-composing Enter for vi sessions and Vietnamese Custom targets under English UI; freeze policy at preparation and do not finish on the candidate-accept Enter. Keep other English auto-completion, Timed deadline, Zen Stop and passive-focus behavior.
7. Refill before batch application, expire before commit, and discard provisional text on blur/Stop/restart/navigation. Keep all buffers transient.
8. Generate physical-key feedback/misses only for direct one-to-one insertions; at most one practice sound per committed batch, none for preedit/deletion/Zen. Test no phantom physical errors from accents.
9. Test event-order permutations, commit/cancel, dead keys, native trailing-token replace/delete/reinsert, backspace, final accent changes, candidate Enter, duplicate events versus intentional repeated letters, overrun rejection, late commit after deadline, long batch refills, blur and stale generations.

**Exit:** deterministic automated input coverage; real native input-method verification remains a separate release gate, not inferred from synthetic events.

## P10-09. Preserve history and update Stats honestly

Primary files: `session-history.ts`, `StatsPanel.svelte`, history tests, `tests/stats.spec.ts`, seeded browser record fixtures.

1. Write v3 records with captured language and `committed-grapheme-v1`. Keep mode-specific validation, content privacy, safe counts and missed-key constraints.
2. Keep historical validators for unversioned/v2 wire records and project en/`legacy-keydown-v1` in the view model without rewriting IndexedDB. Leave database version/store/index/pruning unchanged.
3. Verify completion idempotence and pending-save retry use original language/scoring even after a later UI switch.
4. Localize rows, add language badge/column, keep raw sorting, and identify all-language WPM aggregation.
5. Separate accuracy summaries by scoring basis while preserving target-copying/Zen separation. Document absence of inferred physical misses for composed text.
6. Test mixed legacy/en/vi records, unchanged historical values, separate accuracy means, invalid v3 metadata, retries/deletion/pruning, and no content fields in serialized records.

**Exit:** old scores remain readable and unchanged; new scores are not misrepresented as equivalent physical-keystroke measurements.

## P10-10. Verify the exact acceptance contract

Run the smallest relevant checks during implementation, then the integrated suite. Use existing scripts; install dependencies only after a manifest change or missing-dependency failure. On Windows, use Windows-style paths for file arguments.

### Automated commands

```powershell
npm run check
npx vitest run src\lib\i18n src\lib\typing src\lib\storage
npx playwright test language.spec.ts practice.spec.ts remaining-modes.spec.ts storage.spec.ts stats.spec.ts
```

After focused results pass, run the regression/build sign-off:

```powershell
npm test
npm run build
npm run test:e2e
```

`tests/language.spec.ts` is planned, not currently available; the first milestone
adds `tests/localization-foundation.spec.ts` instead. Playwright arguments above
are filename regex filters, not Windows filesystem paths (backslashes in path
arguments are interpreted as regex escapes). Reuse existing Chromium
configuration/server port 4175. New pure helper tests belong under `src/lib` so
`npm test` discovers them. Use `npx vitest run` for focused selectors because
`npm test` already includes `src/lib`, making additional filters additive rather
than narrowing. No new lint script/tool is required.

### Focused verification matrix

| Area | Required cases | Acceptance |
| --- | --- | --- |
| Resource contract | Exact UI keys/params, registry/content coverage, no fallback, en/vi data validity/counts/rights | A02, A04-A06 |
| Selector/state | Desktop/narrow far-right placement, native keyboard operation, same-language no-op, running lock, no remount/reset of test/details | A01-A03, A10 |
| Persistence | Fresh/default, v1-v5 migrations, v6 invalid/missing/unknown values, migration save failure, quota/denied access, retry/dismiss/reset | A03 |
| Text engine | NFC/NFD accents, case/tone, counts/caret, 10,000/10,001 Custom graphemes, 2,000 Zen window, scoring after rewrites | A07 |
| Native adapter | Composition order/cancel/dedup, non-composing active-token replacement, final accent/Finish/Enter, time expiry/refill/blur/reset/stale event | A08-A09 |
| Privacy/physical keys | No saved text/events, no invented key codes for composition, direct ASCII feedback equivalent, Test unchanged | A09-A11 |
| History/Stats | Legacy and v3 together, original values, separate accuracy basis, language labels, formatted displays/raw sorting, retry/delete | A11 |
| Regression | Five modes, onboarding/device/layout/visualizer/test sound, shortcuts, failure recovery | A10, A12 |

### Manual native-input and review gates

1. On actual Windows and macOS, use OS Vietnamese **Telex** and **VNI** with current Chrome and the platform's other primary browser (Edge on Windows, Safari on macOS). Record OS/browser/input-method versions and whether events compose or replace without composition.
2. Exercise a diacritic coverage sample spanning Vietnamese vowel shapes and all tone marks, uppercase/lowercase, native corrections/backspace, a final syllable requiring a late tone rewrite, candidate acceptance and cancellation. Check Timed, Words, Quote, Custom and Zen; type, do not paste into capture.
3. Cover commit before/after time expiry, blur with candidate open, restart, Zen Stop and language-switch lock. Check no missing/duplicated characters, provisional attempts, accidental finite finish or phantom physical misses.
4. Inspect en/vi screenshots at 1280px and 360px, including header, dialogs, long notices, stats table, vowel diacritics and focus rings. No page overflow or clipped marks.
5. Keyboard-only and actual screen-reader smoke: selector name/options, document language, status/alerts/dialogs, target versus UI language, Tab leaving capture and candidate Enter. Record assistive technology/version.
6. Obtain fluent Vietnamese review of all UI and content, not just a successful build or spot translation. Correct unnatural/missing labels and token quality issues.

Synthetic browser events do not prove OS IME integration. If a required native environment or fluent review is unavailable, record **pending/blocked** and do not call Vietnamese support complete. Keep user text out of committed logs/screenshots/traces; use only reviewed public test samples.

**Exit:** all A01-A12 evidence collected, regression failures resolved, manual gates passed or explicitly blocking release.

## P10-11. Update documentation and sign off

1. Update README from English-only/ASCII current behavior to the delivered language/input/Finish/scoring behavior. Document local language persistence/default reset and the process for adding a language.
2. Update product design and this plan's status only after verification. Preserve historical phase docs; refer to Phase 10 as the explicit superseding contract for text/input.
3. Verify all notices/license links and corresponding bundled data attribution. Do not imply Vietnamese data inherits another resource's license.
4. Record commands/results, acceptance IDs, screenshots/review evidence, native-input matrix and any remaining blockers in the verification section below.
5. Confirm diff contains no accidental user-writing fixtures, generated test results, dependency churn, unrelated fixes or unverified completion claims.

## Verification results

| Evidence | Status |
| --- | --- |
| Requirement analysis and Phase 10 documentation | Defined by this documentation change |
| Foundation implementation | Registry, initial 25-message en/vi catalogs, strict translator, locale formatters, resource-driven header, pure Unicode text/edit helpers |
| Complete en/vi resources, native capture, selector/migrations/history | Integrated and covered by automated checks |
| Baseline | `npm run check`: 0 errors/warnings; `npm test`: 476 passed; `npm run build`: passed |
| Focused foundation unit/type checks | `npm run check`: 0 errors/warnings; `npx vitest run src\lib\i18n src\lib\typing\text.test.ts src\lib\typing\practice-input.test.ts`: 91 tests passed |
| Focused Chromium checks | `npx playwright test localization-foundation.spec.ts modes.spec.ts`: 31 passed (new header fixture plus existing Modes and Remaining Modes) |
| Full milestone regression/build | Type check and production build pass; 567 unit tests pass; full Chromium run: 144 passed, 8 pre-existing failures (see below) |
| Integrated type/unit/build verification | `npm run check`: 0 errors/warnings; `npm test`: 587 passed; `npm run build`: passed |
| Integrated Chromium verification | `npx playwright test`: 152 passed, the same 8 pre-existing failures; includes 8 app-level language/composition cases plus foundation header fixtures |
| Vietnamese provenance/automated content checks | Pinned FrequencyWords revision, CC BY-SA notice/filter script; exact NFC tiers and 12 original passages validated |
| Fluent Vietnamese resource/content review | Pending; subtitle filtering is not a dictionary/quality sign-off |
| Actual Windows/macOS Telex/VNI checks | Pending |
| Desktop/narrow visual and screen-reader checks | Pending |
| Release/sign-off | Runtime integration delivered; full Vietnamese/native-IME/accessibility sign-off remains pending |

### Existing Chromium failures reproduced against baseline

The full suite's eight failures were rerun with the original header restored
byte-for-byte against `HEAD` (`git diff --exit-code` passed). None of the new
foundation modules were imported by the baseline app. All eight failures
reproduced; the resource-driven header was then restored and its focused tests
rerun. These unrelated assertions remain unchanged by the integration (line numbers
below refer to the first-milestone baseline):

- `keyboard-details.spec.ts:73`: generic Keyboard Test expects 60 keys, current map has 73.
- `keyboard-layout.spec.ts:49`: an existing text parser passes `Physical key: Escape` to `keyboard.press`.
- `stats.spec.ts:149`: Restart test expects a danger-button class absent from the existing component.
- `storage.spec.ts:400`, `:419`, and both `:434` cases: old onboarding/status-copy expectations differ from current browser-label feedback.
- `visualizer.spec.ts:53`: an existing mismatch-color assertion expects `rgb(255, 100, 100)` instead of current `rgb(255, 77, 79)`.

These are baseline failures, not evidence of full Phase 10 release verification.
