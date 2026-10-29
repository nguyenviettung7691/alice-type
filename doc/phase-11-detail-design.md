# AliceType - Phase 11 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Product | AliceType |
| Phase | Phase 11: Specialized Alice Practices |
| Status | Implemented with automated verification; manual gates pending (see the implementation plan's verification results). |
| Source design | [Technical Design Document](./tech-design.md), sections 3, 4.2-4.6, 5.1 and 5.7 |
| Preceding phase | [Phase 10 Detail Design](./phase-10-detail-design.md) |
| Related contracts | [Phase 3](./phase-3-detail-design.md) visualizer, [Phase 5](./phase-5-detail-design.md) storage/Stats, [Phase 7](./phase-7-detail-design.md) layout catalog/confirmation, [Phase 8](./phase-8-detail-design.md) modes, [Phase 10](./phase-10-detail-design.md) language/input |
| Implementation plan | [Phase 11 Technical Implementation Plan](./phase-11-implementation-plan.md) |

## 2. Requirement analysis and decisions

Phase 11 starts from a product request for Alice/Arisu-specific practice: hand-separation drills, split-spacebar and
layer drills, angled visualizers with hand/finger load, Alice-oriented content, a rhythm game, a code mode, VIA/VIAL/QMK
keymap import, and Alice-versus-standard progress comparison. Each idea was checked against the current system and the
capabilities of a frontend-only browser app.

### 2.1 Browser constraints that decide eligibility

1. **Duplicate physical keys share one code.** Alice boards with two B keys send `KeyB` from both. Split spacebars
   both send `Space`. A thumb-mapped Backspace and the top-right Backspace both send `Backspace`. Phase 7's
   `resolveImportedLayout` already merges these into one `AliceKey` with several keycaps. The browser cannot tell
   which hand, thumb, or physical key produced an event.
2. **Layer keys are invisible.** `MO`, `LT` (hold), `TG`, `OSL`, and similar firmware keys emit no browser event.
   The browser sees only the code the active layer produces. Holding a layer key cannot be observed or scored.
3. **Composed input has no single physical key.** Since Phase 10, Vietnamese input-method text is committed text.
   Physical attribution exists only for direct printable keystrokes. This stays unchanged.
4. **No backend.** Content and keymaps stay bundled or local. Nothing is fetched at runtime or uploaded.

Any feature that would score, enforce, or penalize which physical duplicate key was used is therefore not
implementable honestly. Showing such a feature anyway would violate the product rule against claiming placeholder
behavior.

### 2.2 Requirement disposition

| Requested idea | Current system | Phase 11 decision |
| --- | --- | --- |
| Dual-B strict hand drill | Absent | **Partial.** A saved *B-key hand* preference (default Left) chooses which B keycap the finger guide marks and which hand receives `KeyB` load. It is a cue, never enforced or penalized. |
| Split-boundary drill (T/G/B vs Y/H/N) | Absent | **In:** Drills type `split-boundary` |
| Hand-alternation flow drill | Absent | **In:** Drills type `hand-alternation` |
| Spacebar alternation test | Absent | **Out:** both spacebars send `Space` |
| Space-as-Backspace penalty | Absent | **Out:** physical Backspace origin is unknowable |
| Layer hold and tap drills | Absent | **Out** as a scored drill. Layer *visualization* is provided by keymap import (section 9). |
| Dynamic Alice on-screen keyboard (variants, rotation) | **Implemented** (Phase 3 generic Alice; Phase 7 imported Alice-family profiles with variants and per-key rotation) | Reused. Phase 11 adds only an expected-key overlay (section 6). |
| Heatmap | Missed-key heatmap **implemented** in Stats | Retained |
| Real-time left/right workload | Absent | **In** (section 7) |
| High-strain reach-key accuracy | Absent; history stores misses but not per-key attempts | **In.** Requires history record v4 (section 7.3). |
| Cross-boundary prose (B/V/G/Y/6/7) | Absent | **In:** Drills type `cross-boundary`, generated from bundled banks. Real articles are not fetched. |
| Thumb Rhythm Arcade | Absent | **Out:** needs thumb identity and a separate game engine; candidate for a future phase only if hardware input becomes observable |
| Code and special-symbol mode | Absent | **In:** new Code mode with single-line Python, JavaScript and Rust snippets (section 8) |
| Import VIA/VIAL/QMK keymap | Absent. Phase 7 deferred *firmware protocol* reads, not file import. | **In** for VIA saved layout `.json` and Vial `.vil` (section 9). QMK Configurator `keymap.json` is deferred (it needs layout-macro order, which the catalog does not store). |
| Alice vs. standard keyboard WPM/CPM comparison | Absent | **Deferred** by product decision to a later phase |
| Difficulty levels (Expert/Master) | Deferred since Phase 8 | Unchanged; not part of Phase 11 |

### 2.3 Confirmed product decisions

1. In scope: Drills mode, finger guide, hand/finger load and per-key accuracy, Code mode, and VIA/Vial keymap import.
2. Drills and Code are available in English and Vietnamese. Vietnamese drills draw only diacritic-free tokens.
3. Code snippets are single-line. The current single-space text model is not extended to multi-line input.
4. The default B-key hand is **Left**.
5. Board comparison is deferred. The other excluded items (2.2) are recorded in the product design with their reasons.

## 3. Scope and compatibility

### 3.1 In scope

- Two new practice modes, `drills` and `code`, in Practice mode navigation after Zen.
- A pure drill generator, a pure finger map, and a bundled original code-snippet catalog.
- A Practice finger-guide toggle and a B-key hand preference.
- Live hand/finger load in Practice. Per-key attempts saved with each session. Stats sections for hand balance,
  per-key accuracy, and high-strain reach keys.
- Keymap file import onto the confirmed catalog profile, with preview, explicit Apply, clear, and a read-only layer
  viewer.
- Additive catalog data: matrix dimensions for each profile.
- Preferences schema v7 and history record v4, with migration or read compatibility for every earlier version.
- Complete English and Vietnamese UI messages for every new surface.

### 3.2 Out of scope

- Every item marked **Out** or **Deferred** in 2.2.
- Detecting or enforcing which hand, thumb, or physical duplicate key was pressed.
- Reading from or writing to keyboard firmware (VIA/Vial/ZMK protocols, WebHID reports).
- Importing macros, encoders, combos, tap dance, key overrides, or decoding VIA/Vial `layout_options`.
- Multi-line code with Enter or indentation, syntax highlighting, and executing code.
- New dependencies, a backend, or analytics.

### 3.3 Compatibility rules

- Timed, Words, Quote, Custom, and Zen keep their Phase 8/10 behavior and saved records.
- Keyboard Test behavior is unchanged except that an applied keymap import changes the resolved layout it uses, as a
  confirmed variant already does.
- With no keymap import, the generic Alice layout and confirmed catalog layouts resolve exactly as in Phase 7.
- Saved settings lock while a Practice session runs, as for existing settings.

## 4. Practice modes and configuration

`PRACTICE_MODES` becomes `['timed', 'words', 'quote', 'custom', 'zen', 'drills', 'code']`. Mode buttons are localized
(**Drills** / **Luyện tách phím**, **Code** / **Mã nguồn**; final Vietnamese wording is subject to the Phase 10
editorial gate).

```ts
type DrillType = 'split-boundary' | 'hand-alternation' | 'cross-boundary';
type CodeLanguage = 'python' | 'javascript' | 'rust';

type DrillConfiguration = {
  mode: 'drills'; language: LanguageId; drillType: DrillType;
  wordLimit: 10 | 25 | 50 | 100; bKeyHand: 'left' | 'right';
};
type CodeConfiguration = {
  mode: 'code'; language: LanguageId; codeLanguage: CodeLanguage; snippetId: string;
};
```

- Both are finite target-copying sessions using the Phase 10 committed-text engine, grapheme scoring, progress, and
  completion.
- **Drills** shows a drill-type selector and the existing word-limit selector. It hides vocabulary tier and the
  punctuation modifier. It honors the numbers modifier, except that `cross-boundary` always injects numbers
  (section 5.2).
- **Code** shows a language selector (Python, JavaScript, Rust) and a **Next snippet** action, mirroring Quote.
- `requiresFinish` rules:
  - Drills follows the session language: English completes automatically; Vietnamese requires **Finish**, as
    Phase 10 requires.
  - Code never requires Finish, because snippets are printable ASCII and need no input-method rewrite.
- Configurations are immutable for the session. Validation rejects unknown drill types, code languages, snippet IDs,
  or limits with `ExerciseGenerationError`. Errors are shown, never replaced by fallback content.

## 5. Alice Drills generator

New pure module `src/lib/typing/alice-drills.ts`. Its only inputs are configuration and an injected `RandomSource`; it
imports no DOM or storage.

### 5.1 Candidate pool

- Pool: the selected language's full 5,000-token bank, filtered to `^[a-z]+$`. For Vietnamese this keeps only
  diacritic-free tokens. Drills ignore the vocabulary tier, because the low tiers are too small for Vietnamese.
- Hand classification uses the finger map (section 6.1). `KeyB` follows the configured `bKeyHand`.
- Each drill type requires at least **20** unique candidates. Otherwise generation throws a localized
  `ExerciseGenerationError`. It never substitutes English or another drill type.
- Measured pools at design time, 5,000-token banks:

  | Language | Split-boundary | Cross-boundary | Hand-alternation |
  | --- | --- | --- | --- |
  | `en` | 2,152 | 1,932 | 727 |
  | `vi` | 325 | 320 | 72 |

  These figures are informative. Tests assert the at-least-20 rule, not the exact counts.

### 5.2 Drill types

| Type | Selection rule | Purpose |
| --- | --- | --- |
| `split-boundary` | Contains two or more letters from the boundary set `t g b v` (left) / `y h n` (right) | Practice keys on both edges of the split gap |
| `hand-alternation` | Length of at least 4 and a left/right alternation ratio of at least 0.7 between adjacent letters | Rhythm of switching across the angled divide |
| `cross-boundary` | Contains at least one of `b v g y`. After each non-final word, insert with probability 0.2 a number of 1-3 digits that contains `6` or `7`. | Letters and digits that commonly tempt cross-reaching |

- Words are drawn uniformly with replacement. Consecutive duplicates are avoided when the pool has more than one entry.
- Output uses the existing `Exercise` shape (`target`, `wordEnds`, frozen configuration), so rendering and the engine
  need no drill-specific branches.
- With the numbers modifier enabled, `split-boundary` and `hand-alternation` inject ordinary numbers as Timed/Words
  do.

### 5.3 Vietnamese input caveat

Diacritic-free Vietnamese tokens can still be rewritten by an active Telex/VNI input method. One example is a tone key
typed after a vowel. Scoring stays on committed text, so the result remains correct. Physical attribution, guide
progress, and load counts come only from direct keystrokes. The Drills panel shows a short localized note recommending
direct (non-IME) input for physical-key drills.

## 6. Finger map and finger guide

### 6.1 Finger map

New pure module `src/lib/keyboard/finger-map.ts`:

```ts
type Hand = 'left' | 'right';
type Finger = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';
interface FingerAssignment { hand: Hand | null; finger: Finger }
function fingerForCode(code: string, bKeyHand: Hand): FingerAssignment | null;
function keycapHand(cap: AliceKeycap, layoutCentreX: number): Hand;
```

- Static standard touch-typing table for the alphanumeric block, punctuation, number row, Tab, Caps Lock, Shift, Enter,
  and Backspace. Digits `1-5` and `6` are left hand, `7-0` are right hand, matching the generic Alice split in
  `ALICE_LAYOUT`.
- `KeyB` uses `bKeyHand`. `Space` is `{ hand: null, finger: 'thumb' }`. Unknown codes return `null`.
- **Imported layouts:**
  - Finger comes from the physical slot's **catalog default** code (`ImportedLayoutKey.code` before any keymap
    import). A remapped key therefore keeps the finger that physically reaches it.
  - Hand comes from the keycap's split side. Generic keycaps use `half`. Imported keycaps use rotation sign
    (`r > 0` left, `r < 0` right), and the keycap centre relative to the layout centre when `r = 0`.
- Unit tests cover every key in the generic layout and every bundled profile's default variant. Each B keycap must
  resolve to its own side.

### 6.2 Guide behavior

- A **Finger guide** switch in Practice settings, off by default and saved. It is hidden and inactive in Zen.
- While a finite session is ready or running and the guide is on, the next expected grapheme is mapped to a physical
  code:
  1. When the user granted `navigator.keyboard.getLayoutMap()` (Phase 5 legends), use the inverted map
     (character to code) for unshifted characters.
  2. Otherwise use a US-QWERTY reference table. A small caption labels it as a reference layout.
  3. Uppercase letters and shifted symbols also mark the Shift key on the opposite hand.
  4. Graphemes with no single key (Vietnamese diacritics, unknown characters) mark nothing. The caption shows
     **No single key**, not a guess.
- The visualizer gains an `expected` overlay state, visually distinct from the Phase 3 `correct` and `incorrect`
  feedback. It uses an orange outline (`#FF5D00`) plus a non-color marker, never color alone.
  - For `KeyB` only the keycap on the preferred side is marked. For `Space` all Space keycaps are marked.
- A live caption below the visualizer reads, for example, **Next: B — left index**. It announces through a polite
  live region at most once per word boundary to avoid screen-reader flooding. The visual caption updates per
  character.
- The guide never blocks input, changes scoring, or claims the user pressed the marked keycap.

## 7. Hand/finger load and per-key accuracy

### 7.1 Attribution rules

- Only **direct** keystrokes are attributed: the existing Practice `directCode` path, a single printable insertion at
  the caret.
- Each direct attempt increments `keyAttempts[code]`. Misses continue to increment `missedKeys[code]` as today.
- Hand buckets:
  - `left` / `right` come from `fingerForCode`.
  - `thumb` is Space.
  - `unattributed` counts committed insertions with no direct code (composition, input-method rewrites) and codes
    the finger map does not know.
- Codes failing the existing safe-code pattern are discarded, as for `missedKeys`.

### 7.2 Live presentation (Practice)

- A compact **Hand balance** row shows left and right percentages of attributed left+right attempts, as a split bar
  plus text. Thumb and unattributed counts appear as separate figures.
- An expandable **Finger detail** lists the 8 finger buckets plus thumbs.
- Shown only when live stats are on, in target-copying modes, with at least one attributed attempt. Hidden in Zen.
- Uses locale formatting (Phase 10 `format.ts`) and charcoal/orange tokens. Never color-only.

### 7.3 Persistence: history record v4

New sessions write `version: 4`:

```ts
interface RecordV4Additions {
  keyAttempts: Readonly<Record<string, number>>;   // direct attempts by physical code
  handAttempts: { left: number; right: number; thumb: number; unattributed: number };
  bKeyHand: 'left' | 'right';
}
// plus mode-specific fields:
// drills: { mode: 'drills'; drillType; limit; targetCharacters; elapsedMs }
// code:   { mode: 'code'; codeLanguage; snippetId; targetCharacters; elapsedMs }
```

- Validation:
  - Every `missedKeys[code]` must be at most `keyAttempts[code]`.
  - All counts are safe non-negative integers.
  - Hand totals must not exceed `totalAttempts`.
- Records v2/v3 (and unversioned legacy records) remain readable and are not rewritten. They have no per-key
  attempts and are excluded from per-key accuracy and hand balance, with a visible "N older sessions not included"
  note. Zen v4 records carry empty attempt maps.
- The IndexedDB database version is unchanged. Records are validated per item, as in Phase 10.

### 7.4 Stats presentation

- **Hand balance:** aggregate left/right/thumb/unattributed across v4 target-copying records.
- **Per-key accuracy:**
  - Formula: `1 − misses / attempts` for codes with at least **20** attempts.
  - Display: a sortable list with an optional visualizer overlay reusing the heatmap scale. The missed-key
    heatmap stays.
- **High-strain reach keys:**
  - A fixed, documented reach set: the number row `Backquote`, `Digit1-0`, `Minus`, `Equal`, plus `BracketLeft`,
    `BracketRight`, `Backslash`, `Quote`, `Slash`.
  - Compared against a home-row baseline (`KeyA S D F J K L Semicolon`), listing the lowest-accuracy reach keys.
  - Text explains that "reach" is a layout convention, not a measured strain.
- All sections respect the existing language filter and mixed-language notes.

## 8. Code mode

### 8.1 Catalog

`src/lib/typing/code-snippets.ts` with data under `src/lib/typing/code-snippets/` (`python.ts`, `javascript.ts`,
`rust.ts`).

- Original AliceType-authored snippets under the project MIT license. A notice file states authorship. Snippets are
  not copied from third-party code.
- Each entry: `{ id, codeLanguage, text }`. IDs are kebab-case and unique.
- Validation, at module load and in tests:
  - Single line of printable ASCII (`\x20-\x7e`) with no leading, trailing, or double spaces, length 30-160.
  - At least 15 entries per language.
  - Each language set collectively contains `{ } [ ] |`, a backtick, and at least one digit.
  - A Rust set without natural backticks must include them in string or comment content, so the coverage rule is
    satisfied honestly.
- Snippets contain no natural-language prose that would need translation, so they are UI-language independent.

### 8.2 Session behavior

- Random selection without immediate repeat. **Next snippet** is available when not running.
- Target, progress, scoring, finger guide, load, and completion reuse the finite copy path. Code never requires
  Finish.
- The history record keeps the session `language` tag (the selected app language, as Phase 10 does for Custom) plus
  `codeLanguage` and `snippetId`.

## 9. VIA / Vial keymap import

### 9.1 Placement and preconditions

- Keyboard Details › Layout shows an **Import keymap** section only when a catalog layout is confirmed (Phase 7).
  The generic Alice layout has no matrix, so the section explains that import needs a confirmed board.
- A native file input accepts `.json` and `.vil`, at most **256 KB**. The file is read with `FileReader`/`text()` and
  parsed locally. It is never uploaded or written to a device.

### 9.2 Catalog prerequisite: matrix dimensions

- VIA saved layers are flattened row-major `rows × cols` arrays, so each catalog entry needs `matrix: { rows, cols }`
  from its pinned VIA definition.
- Rerun the maintainer-only `scripts/import-keyboard-layouts.ts` at the **same pinned commits**. The only snapshot
  change allowed is the added `matrix` field in `index.json`. Implementation review must confirm that profile JSON,
  `NOTICE.txt`, and the revision are otherwise unchanged.

### 9.3 Accepted formats

| Format | Shape (verified against upstream sources) | Validation |
| --- | --- | --- |
| VIA saved layout (`*.layout.json`) | `{ name, vendorProductId: number, macros?, layers: string[][], encoders? }` written by VIA's Save + Load pane | `vendorProductId` must equal `vendorId * 65536 + productId` of the confirmed entry. Every layer length must equal `rows × cols`. At least one layer. |
| Vial layout (`*.vil`) | `{ version: 1, uid, layout: (string or number)[][][], encoder_layout?, layout_options?, macro?, ... }` | `layout[layer][row][col]` dimensions must equal the matrix. `uid` is not catalog-mapped, so a dimension match is required and the preview warns that the board identity is unconfirmed. |

- Keycodes:
  - Strings are resolved with the existing `qmkKeycodeInfo`, extended for `MT`, `LT`, `*_T`, layer keys, and
    `KC_TRNS`/`KC_NO`.
  - Numbers are decoded only in the stable basic HID range (`0x04-0xE7`). `-1`/`0` mean no key. Any other numeric
    value is kept and labeled **unrecognized**.
- At most 32 layers are accepted; more are rejected.
- Macros, encoders, combos, tap dance, key overrides, and `layout_options` are ignored. The preview lists them as
  "not imported". A `layout_options` value is never used to change the confirmed variant.
- Every failure is a specific localized message: wrong board, wrong key count, unsupported version, too large,
  malformed JSON, too many layers. The previous state is left untouched.

### 9.4 Preview, apply, and effects

1. **Preview** (nothing saved yet):
   - The file name, format, and layer count.
   - The number of base-layer positions that differ from the catalog default, with up to 12 examples
     (`row,col: Caps → Ctrl/Esc`).
   - Warnings.
2. **Apply keymap**: the resolved layout is recomputed with the base layer (layer 0) at each matrix position:
   - A key with a browser code gets that code. Its legend comes from `qmkKeycodeInfo`. Tap/hold keys show
     `tap / hold` legends, for example `Space / L1` or `Esc / Ctrl`.
   - A key without a browser code becomes inert, with its legend shown.
   - The variant filter from the confirmation still applies.
   - If the result fails `isResolvedLayoutEligible`, Apply is refused and the missing codes are listed.
3. **Effects:** the applied layout is used wherever the confirmed layout is used: Practice visualizer and guide,
   Keyboard Test, and the Stats heatmap. The finger map keeps catalog-default fingers (6.1).
4. **Layer viewer:** a read-only selector (Layer 0 to N) re-renders the visualizer legends for that layer. `KC_TRNS`
   is drawn as a transparent marker. The viewer is presentation only and never affects input handling.
5. **Clear keymap** removes the import. Changing or clearing the confirmed profile, variant, or catalog revision
   clears it automatically and shows a status notice.
6. The UI states plainly that the import describes the file, not what the keyboard currently runs. AliceType cannot
   verify the firmware state.

## 10. Preferences schema v7

```ts
interface PreferencesV7Additions {
  fingerGuide: boolean;                 // default false
  bKeyHand: 'left' | 'right';           // default 'left'
  drillType: DrillType;                 // default 'split-boundary'
  codeLanguage: CodeLanguage;           // default 'python'
  keyboardKeymapImport: {
    profileId: string; catalogRevision: string; variantKey: string;
    format: 'via' | 'vial'; fileName: string; importedAt: number;
    layers: readonly (readonly (string | null)[])[];   // matrix order, row-major
  } | null;                             // default null
}
```

- `mode` additionally accepts `drills` and `code`.
- v1-v6 records migrate by adding the defaults. Invalid v7 content follows the existing reset/recovery path.
- An import whose `profileId`, `variantKey`, or `catalogRevision` no longer matches the saved confirmation is dropped
  on load, with a status notice.
- `fileName` is truncated to 120 characters. `layers` are validated against the matrix again on load.
- Save failures keep the in-memory state and show the existing localized warning and retry.

## 11. Localization, accessibility, and theme

- All new labels, captions, errors, notes, and live-region text get stable keys in the typed `en` and `vi`
  catalogs.
- Exempt from translation, as in Phase 10: AliceType, key codes, QMK keycodes, file names, code snippets, and
  hardware names.
- Native controls: radio group or select for drill type and code language, switch for the finger guide, file input
  for import. Labels are visible, focus is visible, and everything is keyboard-operable.
- The visualizer's expected state, the hand-balance bar, and the accuracy lists all carry text equivalents. The
  existing assistive key list in the visualizer gains "expected" status text.
- Layout is responsive. The hand-balance row wraps on narrow widths. Charcoal backgrounds and `#FF5D00` accents follow
  the existing CSS tokens.

## 12. Acceptance criteria

1. Practice offers Drills and Code. Existing five modes and their records behave as before.
2. Each drill type, for `en` and `vi`, deterministically produces targets that satisfy its selection rule with a
   seeded random source. A pool below 20 raises a visible error.
3. Cross-boundary targets contain only qualifying words and inject only numbers containing 6 or 7.
4. With the finger guide on:
   - The next key is marked with a non-color marker plus a caption.
   - `B` marks only the keycap on the preferred side, for both generic and imported two-B profiles.
   - Shifted characters also mark opposite-hand Shift. Vietnamese diacritic graphemes show **No single key**.
5. Live hand balance updates from direct keystrokes only. Thumb and unattributed counts are separate. It is hidden
   when live stats are off and in Zen.
6. New records are v4 with consistent `keyAttempts`, `handAttempts`, and `bKeyHand`. v2/v3/legacy records load
   unchanged and are excluded from per-key accuracy with a visible count.
7. Stats shows hand balance, per-key accuracy (at least 20 attempts), and reach-key versus home-row comparison,
   honoring the language filter.
8. Code mode loads validated snippets for all three languages, avoids immediate repeats, and completes without Finish
   under either UI language.
9. A VIA file for the confirmed board previews, applies, persists, and changes visualizer legends and codes. A file
   for another board or with a wrong key count is rejected with a specific message.
10. A Vial file with matching dimensions previews with an identity warning and applies. A malformed file, more than
    32 layers, or more than 256 KB is rejected. The layer viewer shows non-base layers read-only.
11. Changing or clearing the confirmed profile or variant clears the import with a notice.
12. Preferences v1-v6 migrate to v7 with the documented defaults.
13. All new UI exists in both catalogs with exact key and parameter coverage. Automated accessibility checks show no
    new violations.
14. No new runtime dependency, network request, or upload is introduced.
15. Documentation never presents enforcement of hand, thumb, or layer use, or board comparison, as implemented.

## 13. Risks and release gates

| Risk | Mitigation / gate |
| --- | --- |
| Users read the guide as enforcement | Persistent "cue only" wording; no penalties; acceptance criterion 15 |
| Finger map is wrong for unusual imported boards | Per-profile unit tests on default variants; unknown codes are reported as unattributed rather than guessed |
| VIA/Vial formats evolve | Strict validation with specific errors; formats documented with upstream source references in the implementation plan; numeric Vial codes beyond the basic range are labeled unrecognized |
| Re-running the import script changes more than `matrix` | Same pins plus review of the snapshot diff; reject the change if any other field differs |
| Vietnamese drill tokens are rewritten by Telex/VNI | Committed-text scoring, physical-only attribution, visible recommendation; manual IME gate inherited from Phase 10 |
| Code snippets infringe or contain errors | Original authorship notice; validation tests; manual readability review |
| Code language parity (Rust backticks) | Coverage rule tested per language; content authored to satisfy it honestly |
| Inherited Phase 10 gates still open | Fluent Vietnamese review, real OS IME, and screen-reader sign-off continue to apply to new copy |
