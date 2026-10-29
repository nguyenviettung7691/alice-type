# AliceType - Phase 10 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 10: Multi-language Support |
| Status | In progress; foundation milestone implemented, full localization/content/IME integration and release verification pending |
| Source design | [Technical Design Document](./tech-design.md), sections 4.2-4.4 and 5.6 |
| Preceding phase | [Phase 9 Detail Design](./phase-9-detail-design.md) |
| Practice/storage contracts | [Phase 8 Detail Design](./phase-8-detail-design.md), [Phase 5 Detail Design](./phase-5-detail-design.md) |
| Implementation plan | [Phase 10 Technical Implementation Plan](./phase-10-implementation-plan.md) |

## 2. Requirement analysis and decisions

The current app is English-only, not merely missing a language selector:

- Components contain English labels, instructions, accessible names, status messages, and interpolated sentences.
- The generator imports one English JSON bank, validates lowercase ASCII words, and builds tier prefixes of 200/1000/5000 entries.
- Quote contains 12 English literary passages. Custom rejects non-ASCII text after whitespace/typography normalization.
- Practice prevents `beforeinput`, clears the capture input after every input/composition event, and accepts only printable ASCII `keydown` actions. The engine, renderer, word boundaries, Zen chunks, and character limits rely on string lengths/slices.
- Preferences write schema v5; history writes record version 2 in IndexedDB database version 1. Saved errors/notices are often English strings obtained from `Error.message`.
- Keyboard Test is a separate physical-code tool, not a text input method.

Therefore "complete Vietnamese support" means translated app-owned UI, Vietnamese built-in content in both generated and Quote practice, and actually typing Vietnamese in all five modes. Labels-only localization would not satisfy it.

| Requirement | Phase 10 interpretation |
| --- | --- |
| Add languages in future | One typed registry, complete message catalogs, validated content descriptors, shared text/input helpers; no component per language |
| Complete Vietnamese | `vi` UI, vocabulary, Quote passages, formatting, Unicode editing and OS/browser input-method support |
| Simple far-right selector | Native labeled select after app navigation in header DOM/visual order; no flag icons or settings subpage |
| Save browser state | Existing versioned preferences in `localStorage`; persists across reload/browser restart on this origin |
| Two resource groups | UI labels/messages separate from practice content, with word banks and Quote passages in the latter |

### 2.1 Explicit scope assumptions

1. One language choice drives both the interface and built-in practice content. Separate UI/practice-language controls are deferred.
2. English (`en`) is the default, including migration. Do not auto-select from `navigator.language`, location, device, or Accept-Language.
3. Supported options display native names: **English**, **Tiếng Việt**. Formatting locales are `en-US` and `vi-VN`; document language tags are `en` and `vi`.
4. Preserve English generator defaults/tiers and the English quote catalog. Vietnamese uses the same tier sizes with clearly labeled whitespace-delimited tokens.
5. Custom and Zen accept the shared supported English/Vietnamese text repertoire under either UI language; selecting a language never translates user writing.
6. Preserve running-session settings locks. Vietnamese finite target-copying uses explicit Finish to accommodate final-syllable input-method rewrites (section 8), including Vietnamese Custom targets under English UI.

## 3. Scope and compatibility

### Current implementation boundary

The first milestone implements `i18n/languages.ts`, typed message contracts with
25 initial English/Vietnamese messages, strict translation validation, locale
formatting, and resource-driven header labels. Shared `typing/text.ts` and
`practice-input.ts` provide NFC/grapheme validation and pure committed-edit
reconciliation/scoring. The new helpers have unit coverage and header reactivity
has a dedicated browser fixture.

This is not a complete language pack: the app still selects English, has no
language selector, and retains existing ASCII capture/scoring/history. Native
composition lifecycle, full engine/renderer conversion, content packs,
preferences/history migrations, remaining UI translations and review gates are
not yet implemented. The rest of this document remains the target contract.

### 3.1 In scope

- Typed, bundled English/Vietnamese resource groups and an extension checklist.
- All app-owned visible and assistive UI, including errors, confirmations, empty/loading states, title/description, and formatting.
- Far-right responsive header selector; live UI update; browser preference migration, reset, retry, and failure handling.
- Vietnamese Timed/Words banks and Vietnamese Quote catalog, with reviewed provenance and license/notice links.
- NFC text normalization, grapheme-aware state/rendering/metrics, composition and committed-edit input handling, Vietnamese Custom/Zen.
- Session language/scoring metadata, legacy history compatibility, localized Stats with transparent accuracy grouping.
- Tests and manual native input-method/accessibility verification.

### 3.2 Out of scope

- Runtime translation services/downloads, accounts, routing by locale, SEO language pages, cloud sync, telemetry, machine-translating user content.
- A built-in Telex/VNI engine, installation/configuration of an OS input method, changing keyboard OS layout, or inferring layout geometry from language.
- Third-party localization frameworks, new dependencies, difficulty rules, themes, firmware access, or new Keyboard Test behavior.
- RTL layout, arbitrary-script input guarantees, emoji editing, rich text, multiline practice targets, paste/drop answers, selection-based general document editing, undo/redo.
- Persisting Custom/Zen writing, raw events, unfinished sessions, or device-specific composition traces containing user content.

This phase supersedes the earlier printable-ASCII-only Practice/Custom/Zen contracts and IME deferrals. It does not supersede Keyboard Test's repeat/composition/shortcut filtering, physical-code identity, run resets, or privacy contracts.

## 4. Resource architecture

Keep Svelte 5, TypeScript, Vite, existing styles, Vitest, and Playwright. No new runtime package is needed.

### 4.1 Proposed organization

Paths are planned, not existing implementation:

```text
src/lib/i18n/
  languages.ts           registry, inferred LanguageId, runtime ID guard
  messages.ts            message/parameter contracts and pure translator
  context.ts             small reactive Svelte context adapter
  format.ts              locale-aware number/date/duration helpers
  ui/
    en.ts
    vi.ts
src/lib/typing/
  text.ts                normalization, supported grapheme validation, segmentation
  practice-input.ts      DOM-independent committed-edit reconciliation
  practice-content.ts    content registry and validation shared by generator/quotes
  word-banks/
    english.json         retain existing data, attribution and prefix order
    vietnamese.json
    NOTICE.txt           extend, preserving existing attribution
  quotes/
    vi.ts                Vietnamese passages with provenance
```

Keep existing English quotes in `quote-catalog.ts` unless moving the data improves its separation without duplicating validation. The two logical groups are `i18n/ui` and typing practice content; languages do not need duplicate storage of licenses or shared helpers.

### 4.2 Registry and extension boundary

The registry defines each stable language ID, native display name, formatting locale, document tag, and content ID. Infer `LanguageId` from registry keys; use a runtime guard at persistence/configuration boundaries. A content registry maps the same IDs to word-bank descriptors and quote catalogs, checked for exact registry coverage. Use type-only imports/shared types to avoid a generator/quote/content import cycle.

UI messages have stable semantic keys (`header.language`, `practice.restart`, `storage.preferencesNotSaved`, etc.). English defines the required key shape; parameter contracts are explicit and shared by both languages. Vietnamese must satisfy the exact key/parameter contract. Do not infer the schema from English literal string values such that translations must equal English text.

Prefer complete sentence templates or pure parameterized message functions over concatenated fragments. Parameter types distinguish counts, durations, field IDs, key codes, and safe external names. Use `Intl.PluralRules` only where grammatical forms require it; do not construct English singular/plural suffixes in components. Render plain text with Svelte escaping, never `{@html}`.

### 4.3 Completeness and failure policy

- Ship complete resources for both enabled languages, including optional and failure paths. Missing keys/content/placeholder mismatches fail type checks or resource tests before release.
- English is a default for a fresh/migrated profile, not a silent fallback for a broken Vietnamese catalog. Unknown requested language IDs or invalid resources raise an explicit domain/configuration error.
- Content is statically bundled. No network request, async translation race, locale-dependent chunk download, or loading placeholder is required for a switch.
- Keep practice generation deterministic with the existing injected random source. Validation happens once per bundled bank/catalog, not on every keystroke.
- Adding another language requires changing resources/registry and any genuinely new text-profile requirements, not scattering `if (language === ...)` through components.

## 5. UI coverage and presentation boundary

| Surface | Required localization |
| --- | --- |
| App shell/header/footer | View labels, language label/help, app description/title, attribution link labels, global notices and pending-save feedback |
| ModeNavigation/PracticePanel | Modes, settings/options, units, instructions, target status/progress, completion, editor validation/privacy, Zen and Finish controls |
| StatsPanel | Summary/table labels, sortable accessible headings, loading/empty/error/delete flows, language/scoring labels, date/number formatting |
| KeyboardOnboarding/Connection | Welcome choices, permission guidance, capability/connection status, denial/cancellation/disconnect/retry copy |
| KeyboardDetailsPanel/LayoutMatchPanel | Fields, provenance badges, unknown values, suggestions/evidence, confirmations, validation and source-link labels |
| KeyboardTestPanel/Visualizer | Guided/Freestyle labels, sounds, progress, instructions, legends, SVG title/description, Text key results, count announcements |
| ConfirmationDialog | Title, body, confirm/cancel labels, pending state, accessible description and focus flow |
| Domain/audio/storage failures | Typed error codes plus safe parameters translated at presentation, including errors still visible during a language change |

Audit exported option arrays in keyboard/audio modules as well as components: IDs remain stable; English `label` values must become message keys or be mapped at the presentation boundary. Catalog-authored explanatory strings, feature/source badges, generic profile/variant descriptions, and matching-reason templates are app-owned UI too. Preserve imported catalog identities while translating surrounding descriptions.

### 5.1 What not to translate

- AliceType, hardware brand/model/product names, USB numbers, physical `KeyboardEvent.code`, actual key legends, URLs, source revisions, IDs.
- User-provided notes, Custom drafts/targets, Zen writing, existing literary author/work titles.
- Verbatim upstream source citations, copyright notices, licenses, and original legal text. Translate link labels and app-written explanations, not authoritative legal text.
- Native browser/OS permission dialogs. Localize app guidance around them.

Do not expose browser exception messages as the primary Vietnamese user explanation. Keep original exceptions as diagnostic `cause`; show a localized operation/reason and recovery action. Use existing specific error classes with codes and typed parameters; do not catch unexpected programming errors or translate by matching English error strings. UI notice state stores message descriptors, not pretranslated strings, so open dialogs/errors re-render in the selected language. Avoid logging typed or user-authored content.

### 5.2 Formatting, accessibility, and layout

- Use `Intl.NumberFormat`/`Intl.DateTimeFormat` with the selected formatting locale. Keep raw values numeric; decimal/date formatting must not change arithmetic, sorting, persistence, or progress values.
- Percent formatting takes fractional input consistently (`accuracy / 100`); retain current metric precision. Format dates in the current local time zone as today, not an arbitrary new zone.
- Update `<html lang>` on initial preference load and every successful in-memory language change. Localize the application document title/description; brand remains AliceType.
- Set practice target/writing `lang` from its session/content context, distinct from surrounding UI. Custom/Zen use the selected session language as a pronunciation hint, not an automatic language-detection claim.
- Keep visible labels and screen-reader labels aligned. Re-render existing live-region text once per switch; do not announce translated per-character targets or flood status regions.
- Preserve charcoal/#FF5D00 styling, visible focus, contrast, keyboard order, and responsive wrapping. Test Vietnamese diacritic rendering/clipping and longer labels; do not force compact English widths.

## 6. Language selector and state transitions

`App.svelte` owns the current language through preferences and exposes a narrow reactive localization context. Components read translated messages/formatters from that context; domain modules remain pure and receive IDs/configuration rather than importing Svelte state. Reuse props for explicit language/content callbacks where appropriate; do not add a separate global persistence store.

### 6.1 Header contract

- Add a native `<select>` with a visible localized **Language** label and stable ID. Options are **English** (`lang="en"`) and **Tiếng Việt** (`lang="vi"`), not flags or abbreviations alone.
- Position it after navigation at the far-right edge of the top bar on desktop. On narrow screens navigation may wrap, but the selector remains the final header control and right-aligned, without horizontal page overflow.
- Change on standard select interaction; no Apply button, page navigation, reload, or forced focus into Practice. Keep focus on the select.
- Disable while `running` is true, with associated explanatory text about restarting/stopping first. Enforce the guard in App as well as the disabled DOM state.
- Onboarding/confirmation dialogs retain their modal focus rules; do not make background header controls interactive through a modal.

### 6.2 Switching outside a running Practice session

| State/surface | Result of changing to a different language |
| --- | --- |
| UI, open warnings, Stats | Re-render immediately; keep selected view, sorting, dialogs, pending save records and delete/load state |
| Timed/Words ready/completed | Prepare a fresh ready exercise from the new bank; preserve duration/limit/tier/modifiers; clear transient result/feedback |
| Quote ready/completed | Pick from the new catalog, clear prior quote selection/result; Restart then repeats that quote, Next quote stays within language |
| Custom draft/applied ready/completed | Preserve draft, applied target, editing state; reset the run to ready when applicable, translating chrome only |
| Zen ready/completed | Preserve the existing privacy lifecycle; reset a completed run to empty ready state, never persist writing |
| Keyboard Test | Translate chrome without remounting/resetting its mode, counts, held-key cleanup, or selected sound |
| Keyboard Details/layout | Preserve profile, confirmation, notes, connection, and previews; never request a new device |

Selecting the already active language is a no-op. Build session configurations with a language snapshot; target refills and subsequent completion/history use that snapshot, not mutable UI context. If locale changes while Practice is hidden, its next activation must prepare the correct content without erasing a retained Custom draft. Avoid a top-level `{#key language}` remount.

### 6.3 Persistence and recovery

- Keep `alicetype.preferences`; add `language: LanguageId`; write schema **v6**.
- Read/migrate versions 1-5 through their historical validators and add `language: 'en'`. Keep earlier mode/layout/sound fields intact. Historical validator types must exclude new fields rather than requiring language on old data.
- v6 requires a supported ID. Missing/unknown IDs, malformed records, and unknown schema versions produce existing explicit load warnings; preserve the saved raw value, use English defaults in memory, and do not silently overwrite it.
- If migration's save fails, preserve migrated settings/language in memory using `PreferenceMigrationError` semantics and show retry.
- A user switch applies in memory immediately, then saves through the existing guarded preference path. Failed saves keep the chosen language/document tag and show a warning in that language, explaining that reload may restore the previous saved choice.
- Existing retry-load versus retry-save behavior remains distinct. Dismissing a warning does not mark data saved; retry saves the latest in-memory language along with current settings.
- Restore defaults still requires confirmation and leaves history/device grants alone. It resets language to English with the other defaults, preserves onboarding completion as today, and announces the result in the new language.
- Cross-tab live synchronization is not added. Each tab loads on startup and saves explicit local changes, consistent with existing preferences.

## 7. Practice resources

### 7.1 Word banks

Retain the existing English JSON and prefix order. Add one Vietnamese JSON array containing exactly **5,000 unique NFC lowercase tokens**, with 200/1000 tiers as prefixes. All entries must:

- Be nonempty supported Latin/Vietnamese letter graphemes, without spaces, digits, punctuation, controls, or standalone combining marks.
- Remain unique after NFC normalization and locale-appropriate lowercase validation. Accent-bearing and unaccented spellings are distinct; never strip diacritics.
- Be reviewed for Vietnamese spelling, useful everyday coverage, duplicate/noise/proper-name filtering, and inappropriate content.
- Have reproducible provenance: pinned source/revision, retrieval date, rights/license, selection/transformation procedure, and Vietnamese-language review.

Do not assume that a source contains 5,000 suitable entries or licenses them for redistribution. Select/verify a source during implementation before importing; a reviewed original supplement is acceptable only with recorded authorship/rights. Insufficient or unlicensed content blocks completion rather than reducing a tier or padding it.

Vietnamese spaces commonly separate syllables inside multi-syllable words. The generator's existing "word" unit remains a **base whitespace token**. Explain that convention in Vietnamese help; do not claim dictionary segmentation. Modifiers retain existing ASCII punctuation/digits and placement; number insertions do not increase the configured base-token count.

`getWordBank(language, tier)` and generation validation resolve the requested bank explicitly. `GeneratedConfiguration` gains `language`; timed refills require identical language, tier, duration, and modifiers. `wordEnds` are grapheme offsets, including existing separator/number semantics.

### 7.2 Quote

Supply at least **12 distinct Vietnamese passages**, 40-1000 graphemes each, across at least three reviewed sources/works or clearly identified original collections. Use the same selection/no-immediate-repeat/Restart/Next semantics as English. Prefer original AliceType-authored Vietnamese practice passages with explicit authorship/license if no suitable redistribution-reviewed quotations are available; identify them honestly as original practice passages, not quotations from a famous author.

Each entry includes language, stable unique ID, text, author/collection, provenance/source, rights, review date, and adaptation notes. Existing English IDs remain stable for legacy records; new IDs are globally unique (use `vi-...`). Do not translate existing literary passages without separate translation-rights review or fabricate attributions.

NFC-normalize and validate content at the catalog boundary. Extend the existing quote notice and footer attribution links to cover Vietnamese passages and any vocabulary license additions. Quote data belongs to practice resources, never the UI message catalog.

### 7.3 Custom and Zen

Keep Custom's explicit Apply/preview workflow, whitespace collapse, typographic-punctuation mappings, and 10,000-character limit, now measured in graphemes for both draft and normalized target. Add NFC normalization; preserve Vietnamese accents. Report unsupported character position/code point through localized structured validation without echoing the draft.

Reject unsupported controls, emoji/scripts outside the shipped Latin profile, and unpaired surrogates explicitly; do not silently delete them. Accept Vietnamese under English UI too. Normalization changes must be disclosed before applying. Custom editor remains paste-friendly; practice capture is not.

Zen remains unlimited transient free writing, no target/accuracy, manual Stop, no live metrics/visualizer/sound. Its trailing display window is 2,000 graphemes, chunk boundaries cannot split graphemes, and deletion/scoring uses retained graphemes. Existing content-release boundaries remain unchanged.

## 8. Text model, input methods, and scoring

### 8.1 Shared text units

Use one shared NFC/grapheme module based on built-in `Intl.Segmenter` with `granularity: 'grapheme'`. Check capability before enabling Practice. If missing, show a localized unsupported-browser/update-browser message and disable text capture; do not silently fall back to UTF-16/code-point editing. Other keyboard tools remain available.

The shipped text profile supports printable ASCII plus Vietnamese letters/diacritics in NFC, uppercase and lowercase. Combining marks are accepted only as part of a valid normalized letter grapheme. Keep the profile extensible through data/validators for later scripts; registry expansion alone does not claim support for a new script/input method.

Use grapheme arrays/indexes for comparison, accepted input length, backspace, caret classes, target completion/progress, word boundaries, limits, target refill thresholds (retain 80-character threshold), quote length validation, Zen windows/chunks, and metrics. Do not mix UTF-16 offsets with grapheme offsets. Convert DOM selection ranges at the input boundary only.

### 8.2 Committed-text adapter

Replace Practice's unconditional cancellation/clearing of native input with a focused native text capture adapter. It owns a transient buffer matching accepted session text, selection at the logical end, and a composition snapshot. Finite input remains bounded by its target; timed/Zen buffers may grow with the existing in-memory session. Only visible Zen rendering is capped, not its retained writing. Clear buffers on the same privacy/reset/destroy boundaries as session content.

The current clipped `sr-only` input is not a sufficient composition UX. Keep a real focusable native input/textarea positioned at the writing caret with usable candidate-window anchoring, and show provisional composition within the writing area without applying correctness colors or metrics. Do not clear, clip away, or replace the focused node during composition. Avoid duplicate screen-reader reading between capture and decorative text; verify the final rendering with native IMEs and assistive technology.

The adapter exposes pure normalized edit operations (`replaceRange(start, deleteCount, graphemes)`) and optional one-to-one physical-code metadata. Domain/engine modules do not inspect DOM events. Use one text mutation pipeline for English and Vietnamese; do not process the same printable action through both `keydown` and `input`.

| Event/path | Required behavior |
| --- | --- |
| Direct typing | Let ordinary native text input happen; reconcile the resulting value to accepted NFC graphemes once |
| `compositionstart/update` | Snapshot accepted state; allow preedit/candidate display; do not compare, score, sound, finish, refill, or save from provisional updates |
| Composition commit | Process the final native value when composition ends and the final input is observed, regardless of browser event ordering; value/snapshot identity suppresses duplicates, not an arbitrary timeout |
| Cancelled/empty composition | Restore accepted buffer; no attempts, start time, or completion |
| Telex/VNI rewrite without composition | Reconcile native backward replacement of the active trailing token; support delete/reinsert event sequences, not only append-only `event.data` |
| Backspace | Delete one retained grapheme; keep historical attempts as today; let the input method handle its own preedit |
| Paste/drop/line breaks/undo | Block paste/drop, non-target newline/tab and unsupported editing operations with localized feedback; do not treat them as scored answers |
| Selection/cursor movement | Keep append/backspace exercise behavior; selection replacement is permitted only for native active-token input-method rewrites, not arbitrary earlier passage editing |
| Shortcuts/repeat | Preserve browser Ctrl/Meta shortcuts and Tab exit; ignore repeat mutations; do not blanket-block input-method AltGraph or candidate-navigation keys |

Native snapshots may replace a span within the last whitespace-delimited token, not just its last code point. Diff on grapheme boundaries using a common prefix/suffix and validate the changed range. Permit deletion at the end and insertion/rewriting in that trailing token. Reject unsupported earlier edits explicitly, restoring accepted text without counting them. This is intentionally not a general-purpose editor.

`beforeinput` supplies intent when available, but `input` plus the accepted snapshot is authoritative for allowed native/IME text changes. Guard unsupported paths even if an event is not cancelable. Do not cancel valid composition merely because its `inputType` differs between supported browsers.

Keep the input method's raw value/selection intact throughout composition; compare a normalized copy at commit, then synchronize only after composition ends. Deduplicate using the accepted canonical value, including final events after `compositionend`. A later intentional repeated character must still count.

### 8.3 Clock, completion, focus, and controls

- Start the clock on the first accepted committed insertion, not focus or a provisional composition update.
- Timed deadline is unchanged. Before every committed edit, expire using the same clock. A composition committed after expiry is rejected; preedit is never saved as input. Use the session deadline, not event delivery order, to decide acceptance.
- Refill timed targets before applying a committed batch that exceeds remaining target space. Reuse the immutable language/configuration and repeat refill as necessary, not one refill per physical key.
- English finite sessions preserve automatic completion at the final target grapheme, even with remaining mistakes, except Vietnamese Custom targets as described below.
- Sessions with language `vi`, and Custom targets containing Vietnamese-specific letters under either UI language, allow final-token rewrites at target length. Derive and freeze this completion policy when preparing the target; do not guess from the last keyboard event. Show localized **Finish** when every target position is consumed; Enter outside active composition is an equivalent explicit action, not a target character. Finish is disabled for partial targets and during composition. It completes even if mistakes remain, preserving correction/scoring rules.
- Never interpret Enter used to accept an IME candidate as Finish; require a subsequent non-composing Enter/button activation. Reject overrun beyond finite target length atomically with localized feedback; do not truncate committed input silently.
- On blur, discard still-provisional preedit and restore the accepted snapshot, with a localized cancellation notice if text was pending. A commit already delivered before blur stays accepted. Ignore late composition/input events from the discarded generation.
- Restart, navigation, Stop, unmount, and completion invalidate composition generation and transient physical metadata. Stop saves accepted Zen text only and discards preedit with notice. Language changes are blocked while a run is active.

### 8.4 Metrics and physical feedback

WPM remains `(currently correct retained graphemes / 5) / elapsedMinutes` for target copying and `(retained graphemes / 5) / elapsedMinutes` for Zen. It measures text throughput, not the number of Telex/VNI physical strokes. Canonically equivalent Vietnamese encodings compare equal; different tones/case remain different.

Accuracy becomes **committed-text accuracy** for new sessions: every newly inserted/replacement grapheme in an accepted edit is an attempt, and is correct if it matches its target position. Reused common prefix/suffix graphemes are not new attempts. Deletions do not reduce historical attempts or correct-attempt totals. Final WPM correctness is recomputed from retained text, not historical correct attempts.

For example, inserting wrong `a`, then replacing it with correct `á`, records two attempts and one correct attempt; final retained correctness is one character. Committing provisional `a` -> `á` within one composition records only the final `á`. Thus accuracy reflects committed edits and can differ by input-method commit boundaries; explicitly explain this and do not claim cross-input-method keystroke comparability.

Store a scoring version to distinguish this from historical keystroke accuracy (section 9). English append/backspace behavior still yields its existing scores.

Physical feedback is independent:

- Only a direct one-grapheme insertion with an unambiguous corresponding unmodified `keydown.code` may generate per-key correct/incorrect highlights and missed-key counts.
- Composed text, multi-character commits, accent rewrites, dead-key/AltGraph combinations, and events without a reliable code must never invent a physical key or assign an entire commit to its last code.
- Committed non-Zen text may trigger at most one practice sound per accepted insertion batch; no provisional sounds or sound for deletion/cancellation. Keep audio failure/retry behavior.
- Explain in practice/Stats help that composed errors contribute to accuracy but may have no physical missed-key entry. Existing missed-key totals may remain below total wrong attempts.
- Keyboard Test continues using physical `KeyboardEvent.code`, ignoring composition/repeat/shortcuts as before. Language does not reassign keys, infer an OS keyboard, reset the matrix, or alter sound IDs.

## 9. Session history and Stats

### 9.1 Records and compatibility

Write record **version 3**, adding:

```ts
readonly language: LanguageId;
readonly scoringVersion: 'committed-grapheme-v1';
```

All session configurations, including Custom/Zen, capture language. Retain mode-specific record fields and privacy boundaries; no target text, writing, input-method name, raw event, or translation string is persisted.

Keep IndexedDB database version **1**, store/index and 1,000-record pruning unchanged; no destructive migration or rewrite is needed. Read unversioned Timed/Words records and version-2 records with their existing validators, projecting English language and `legacy-keydown-v1` scoring in the in-memory history view model. Old ASCII character counts equal grapheme counts. Do not label old records as newly rescored or change saved WPM/accuracy.

Validate v3 language/scoring IDs and grapheme-derived bounds explicitly. Separate historical wire-format types from the current write type so legacy fixtures/validators do not accidentally require new fields. New scoring consistency and missed-key constraints remain enforced. Retry-save retains the record's captured language even if UI language later changes.

### 9.2 Presentation

- Add a localized Language column/badge to rows; render names in the current UI language, leaving raw record IDs untouched.
- Keep target-copying and Zen summaries distinct. WPM can retain the existing all-language aggregate with an explicit **All languages** scope label; do not imply it is a Vietnamese-only or English-only best.
- Do not average legacy keystroke accuracy together with committed-text accuracy. Show separate labeled accuracy summaries when both exist; rows show their scoring basis through accessible text/help.
- Translate mode/limit/duration labels and sort strings using the current locale. Sort dates/numbers by raw values; mode labels use the selected locale's collator.
- No extra language filter, chart, export, storage index, or history rewrite is required in this phase.

## 10. Adding a future language

1. Add a registry ID, native name, document tag, and formatting locale.
2. Supply every UI message with matching typed parameters; review natural translation, accessible labels, long strings, errors and plural forms.
3. Supply the practice-content descriptor, reviewed 5,000-token bank/prefix tiers, and at least 12 valid passages; include provenance, redistribution terms and notices.
4. Extend the shared text profile/adapter only if the script/input method actually requires it; document unsupported scripts rather than accepting broken text.
5. Add completeness/resource, generation, input, persistence and browser smoke cases for the new language. Existing language IDs and quote IDs remain stable.
6. Verify native-input-method behavior and accessibility with a fluent reviewer; update help/README and record actual evidence.

No navigation duplication, component fork, separate preferences key, remote translation service, or new framework is part of this workflow.

## 11. Acceptance criteria

| ID | Required evidence |
| --- | --- |
| P10-A01 | Fresh profile starts English; selector is last/rightmost header control, labeled and keyboard-operable at 1280px and 360px without overflow |
| P10-A02 | Selecting Vietnamese updates all app-owned UI/assistive/error/dialog text, document language/title, and locale formatting without reload; proper names/legal text stay unchanged |
| P10-A03 | Reload restores `vi`; schemas 1-5 migrate losslessly to v6/en; invalid/blocked/quota storage paths show explicit localized warnings without overwriting invalid saved data |
| P10-A04 | Registry/UI/content key coverage and typed parameters are exact for en/vi; no missing-key/content fallback; third-language onboarding needs no copied components |
| P10-A05 | Vietnamese bank has 5,000 unique normalized reviewed tokens and exact prefix tiers; generated limits, punctuation/numbers and timed refills use the session language |
| P10-A06 | Vietnamese Quote has at least 12 reviewed passages and at least three sources/collections, correct attribution, restart/no-repeat semantics; no English fallback |
| P10-A07 | NFC/NFD Vietnamese, tone/case distinctions, grapheme deletion/caret/progress, custom limits and Zen windows work; unsupported input is reported explicitly |
| P10-A08 | Native Telex and VNI commit/cancel/replace and non-composing rewrite traces score once, including final-syllable rewrites and Vietnamese Custom under English UI; native preedit/candidates remain usable; Finish requires target consumed, Enter accepting a candidate never finishes |
| P10-A09 | Timed deadline/refill, late events, blur/restart/navigation/Stop, paste/drop/shortcuts/repeat remain safe; no provisional text, duplicate scores or content persistence |
| P10-A10 | Direct English typing/scoring remains equivalent; composed input never fabricates physical missed keys; physical test mode/count/layout/sound behavior is unchanged by language switching |
| P10-A11 | v3 history writes correct session language/scoring; legacy/unversioned and v2 records retain scores; Stats labels mixed languages and separates accuracy bases/Zen |
| P10-A12 | Fluent Vietnamese review, real OS IME checks, browser screenshots, keyboard/screen-reader smoke, unit/type/build/Chromium evidence recorded; no claim based solely on synthetic composition tests |

## 12. Risks and release gates

- **IME variability:** desktop input methods can use composition or native replacement events. Synthetic tests alone cannot establish Telex/VNI support. Verify actual Windows Vietnamese Telex/VNI and macOS Vietnamese Telex/VNI paths, record OS/browser/input-method versions, and resolve failures before declaring complete support.
- **Provisional final syllable:** premature finite completion loses accent edits; Vietnamese Finish/Enter behavior is deliberate, localized, and specifically tested.
- **Translation gaps:** English strings can originate in domain errors and data arrays, not just templates. Inventory every app-owned surface and have a fluent reviewer inspect success and failure flows.
- **Content quality/rights:** 5,000 clean tokens and 12 reviewed passages are deliverables, not placeholders. Unverified sources or untranslated quote fallback block release.
- **Historical comparability:** committed text and physical keystrokes are not equivalent accuracy measures. Keep scoring metadata and separate summaries.
- **Documentation status:** only the foundation milestone above is implemented. Full implementation sign-off requires the linked plan's evidence; initial messages and pure text helpers must not be presented as complete Vietnamese support.
