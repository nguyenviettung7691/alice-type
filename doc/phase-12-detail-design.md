# AliceType - Phase 12 Detail Design

## 1. Document control

| Item | Value |
| --- | --- |
| Phase | 12: User keyboard management |
| Status | M1 implemented with automated verification; M2-M4 planned |
| Product contract | [Technical design](./tech-design.md), sections 4.4, 4.6 and 5.8 |
| Preceding contract | [Phase 11](./phase-11-detail-design.md) |
| Delivery plan | [Phase 12 implementation plan](./phase-12-implementation-plan.md) |

## 2. Analysis and product decisions

The useful unit is a **physical board owned by the user**, not a catalog model.
Two boards may use the same catalog geometry but different switches, tenting,
thumb roles and keymaps. Give each a stable local ID; never identify it by name,
USB IDs, or the catalog ID. Connecting hardware does not silently switch boards.

| Concept | Decision |
| --- | --- |
| Multiple hardware profiles | Implement a browser-local collection, explicit active selection, create/edit/duplicate/delete, and per-board configuration. |
| Alice/Arisu/75%/two-piece presets | Retain all four requirements. A family label is not a geometry preset. Ship actual presets only with reviewed geometry, code mappings and provenance. |
| Switch/keycap/tenting metadata | Optional self-reported values, not measured device facts. Distinguish actuation force from bottom-out weight. |
| Thumb roles | Store intent per board. Space/Backspace, Layer 1 hold/Space, Delete/Enter and Space mod-taps are supported metadata. Never enforce physical thumb identity. |
| Layer-specific practice | Score observable output (arrows, function keys), show the configured hold/reach as a cue. Never claim proof that Fn was held. |
| Mod-tap calibration | Guided experiments and self-reported outcomes; only measure observable browser events. Never infer firmware tapping-term or suggest a numeric firmware setting from unobservable events. |
| Isolated weak keys | Record board identity and setup snapshot with each new result; default Stats and future adaptive input to that board only. |
| Fatigue/session analytics | Compare elapsed-session windows and matched setups with minimum samples. Report speed/accuracy changes, not fatigue diagnosis or causal switch-weight claims. |

### 2.1 Browser boundary

Firmware-only `MO`, `LT` holds and other layer actions may emit no DOM events.
Two B keys or spacebars can emit the same code. Remapped Backspace has no
observable physical origin. Input-method composition is not a physical-key
measurement. WebHID descriptors and browser legends do not solve these limits.
No firmware reads/writes, new dependency, backend, telemetry, or runtime download.

The example "accuracy drops by 8% after 20 minutes on 67g Tactiles vs. 45g
Linears" requires actual comparable observations. Display **percentage points**
for accuracy differences, sample counts and uncertainty; never manufacture it
from metadata. Current short-session summaries cannot establish such a claim.

## 3. Delivery boundaries

- **M1 (start now):** collection lifecycle; active board selector; hardware and
  thumb-role notes; per-board catalog selection, confirmation, import, user
  details and B-hand; preferences v8; history v5 board snapshots; board-isolated
  Stats with explicit all-board and unassigned views.
- **M2:** sourced quick-select geometry presets for all four families, including
  75% and two-piece splits; per-board observable layer maps and practice runner.
- **M3:** board-specific adaptive text drills and honest mod-tap guided practice.
- **M4:** time-window recording, setup-matched longitudinal comparison and
  ergonomic/session insights.

M1's layout-family field is explicitly descriptive; it does not redraw the
keyboard. Until M2, geometry still comes only from existing confirmed catalog
layouts or the generic Alice fallback, with the existing visible notices.
Do not expose empty practice modes, pretend presets, or invented analytics.

## 4. M1 data and persistence

### 4.1 Preferences v8

Extend the existing single localStorage envelope (same key) with:

```ts
interface UserKeyboard {
  id: string;
  name: string;
  hardware: {
    family: 'unknown' | 'alice' | 'arisu' | 'alice75' | 'split';
    switchType: 'unknown' | 'linear' | 'tactile' | 'clicky';
    actuationForce: number | null; // grams, user-reported actuation force
    keycapProfile: string;
    tentingAngle: number | null; // degrees, descriptive only
  };
  thumbs: { left: ThumbRole; right: ThumbRole };
  settings: {
    keyboardProfileId: string | null;
    keyboardUserDetails: KeyboardUserDetails;
    keyboardLayoutConfirmation: KeyboardLayoutConfirmation | null;
    keyboardKeymapImport: KeyboardKeymapImport | null;
    bKeyHand: 'left' | 'right';
  };
}
```

`ThumbRole` is `unknown`, `space`, `backspace`, `delete`, `enter`,
`layer-1`, `space-shift`, or `space-layer-1`. The last two mean tap Space,
hold Shift/Layer 1. M2 can extend this to arbitrary explicit layer bindings.

Keep `keyboardBoards` and `activeKeyboardId`. Existing top-level keyboard
settings remain the active projection for existing consumers. Validation
refreshes the active board's settings from this projection; switching first
captures the outgoing projection and then loads the incoming board's settings.
All writes use the same validated envelope, so quota failures cannot partially
persist a collection and active selection in separate keys.

- IDs: safe local identifiers, 1-80 ASCII letters/digits/hyphens; create with
  `crypto.randomUUID()`. Migration uses stable `default-board`.
- Names: trimmed, nonempty, at most 80 characters; duplicate names allowed.
- Up to 20 boards to bound localStorage/keymap payload growth; explain the limit
  before the disabled Add/Duplicate actions. At least one board must remain.
- Actuation force: unknown or finite 1-200g. Tenting: unknown or finite 0-90
  degrees. Zero tenting is valid. Keycap profile: trimmed, at most 40 characters;
  suggest Cherry, KAT, MT3, SA but allow custom names.
- Reuse existing detail, confirmation, keymap and B-hand validators on **every**
  board, not just the active one. Reject invalid/duplicate IDs and orphan active
  IDs with the existing storage-warning/retry flow, without rewriting bad data.
- Migrate v1-v7 through their existing validators, preserving the previous
  active configuration in the first board. No old scores are retroactively
  attributed. Persist migration once, retaining in-memory recovery on failure.
- Language, modes, sound, caret and finger-guide visibility remain global.
- Restore defaults resets global practice preferences, not the board collection
  or its setup. Board deletion is a separate confirmed action.
- Duplicate copies setup but receives a new ID and no inherited history.
- Deleting an active board selects the first remaining board. Keep all history.
  The last board's delete action is disabled with an explanation.

### 4.2 Session record v5

Retain v4 scoring/attribution and add `keyboard`, a validated snapshot containing
the stable ID, name, hardware and thumb roles. Also snapshot the selected catalog
ID and B-hand. Do not copy the potentially large keymap or personal device notes
into each score. M4 will add a compact configuration fingerprint for exact
keymap/setup matching before it offers longitudinal comparisons.

Application sessions receive the snapshot before practice starts. Board edits,
switching and reset are blocked while running; completion and pending-save retry
use the same immutable record. Switching after completion cannot relabel it.
Unit/standalone practice callers without board context remain readable v4.
No IndexedDB schema/index upgrade is needed (database stays v1); retain the
existing 1,000-record global history bound. No raw keystroke text is persisted.

## 5. M1 interaction contract

- A labeled native **Active keyboard** select in the header (before Language)
  switches immediately while idle. `Ctrl+Shift+K` focuses that select, without
  cycling accidentally; browser/OS-reserved interception is not guaranteed.
  Ignore repeat/composition, running sessions and modal dialogs.
- Switching resets idle/completed Practice and Keyboard Test state, including
  Custom/Zen content. State and stale asynchronous layout loads must not leak
  between boards; keymap invalidation only touches the active board.
- **Your keyboards** in Keyboard Details offers Add, Duplicate, Edit and Delete.
  Forms have labels, bounded inputs, inline errors, cancel, and native validation.
  Confirm deletion explicitly; warn that saved scores are retained.
- Keep browser connection facts separate. Identical VID/PID or reconnecting a
  different device cannot establish which physical board is now active.
- Stats defaults to **Active keyboard**, following header changes. Every summary,
  recent chart/table, missed-key heatmap, hand and key accuracy calculation uses
  the same board-filtered records before existing language filtering.
- Explicit **All keyboards** and **Unassigned (older sessions)** preserve access
  to legacy records. Also list deleted boards from saved snapshot identities.
  Use IDs, never names, for filtering. Mark aggregate diagrams as the current
  layout, not historic geometry; keep outside-layout codes visible.
- Clear history remains explicitly global, regardless of the filter. Board
  deletion never clears scores. Keep pending-save protection.
- All copy and accessible names are typed en/vi messages. Preserve native
  keyboard navigation and charcoal/orange focus states; allow narrow wrapping.

## 6. Follow-up detail: geometry and layers (M2)

### 6.1 Presets

Provide Standard Alice (60%, no arrows), Arisu (65%, arrow cluster), Ergonomic
75% Alice (function row and macro columns), and Custom Split (two-piece,
e.g. Ergodox/Sofle). Each selectable preset must map to reviewed bundled physical
geometry with variants, matrix coordinates where available, and source notices.
Do not relabel an Arisu drawing as a 75% or guess custom split geometry.
Presets preview first; explicit Apply sets the active board's confirmation.
Existing catalog eligibility assumes Alice; extend eligibility by family with
tests rather than inserting dummy keys to satisfy it.

### 6.2 Observable layer practice

Store manual/file-derived bindings per board:
`{ layer, holdCue, sourcePosition, sourceCode, outputCode, modifiers }`.
Require an explicit confirm/preview; file-derived data reflects the file, not
the connected firmware. Only offer bindings whose output is observable.

Use a separate focused command-drill runner, not the committed-text engine.
Start with arrows and F1-F12: e.g. cue "Hold Fn1 + H" and expect `ArrowLeft`,
or a mapped top-row key producing `F1`. Count distinct non-repeat keydowns;
keyup releases visuals. Only prevent browser defaults for the expected supported
command while focused. Escape stops, Tab/Shift+Tab leave; blur releases held
state. Exclude browser/system-reserved combinations and explain missing events.
No recording while unfocused, no automated action on the OS.

Persist mode-specific output attempts/misses and layer binding snapshot only
after a separately versioned history contract and Stats presentation exist.
Label successful output as output success, never verified Fn/physical reach.

## 7. Follow-up detail: adaptation and mod-tap (M3)

- Select only the active board, matching practice language and compatible
  committed-text scoring. Ignore legacy/unassigned and Zen/command drills.
- Reuse attribution aggregation: at least 20 direct attempts per key, at least
  3 sessions before adapting. Select up to 5 keys by descending miss rate,
  tie-breaking by attempts then code. Exclude unsupported/unmapped keys and
  do not infer physical keys for composed text.
- Build a seeded, reproducible drill from the existing language bank with
  >=60% of tokens containing an eligible weak key and at least 20 distinct
  candidate tokens. Show selected keys and sample counts. An insufficient pool
  produces an explicit explanation, not a falsely labeled adaptive fallback.
- Mod-tap practice displays the board's tap/hold intent, prompts a tap or hold
  sequence and records only visible output/modifier transitions. Report elapsed
  DOM-event timing as browser timing (not switch latency/firmware tapping-term).
  For invisible layer transitions require the user to classify the outcome.
  Offer qualitative suggestions to consult firmware settings and repeat tests;
  no automatic firmware edits or claimed timing diagnosis.

## 8. Follow-up detail: longitudinal analytics (M4)

Record bounded 60-second aggregates: elapsed active time, attempts, correct
attempts and retained correct-character deltas, with no raw text. Explicitly
pause observation on hidden tabs/blur and exclude idle gaps >30 seconds.
Restart never persists an unfinished run; distinguish a practice run from a
longer desk session, grouping completed runs with gaps <=5 minutes and unchanged
board/setup. Retain only compact windows inside the history retention budget.

Within each setup, compare early minutes 0-5 with minutes 20-25 only when each
window has >=100 scored attempts and there are >=5 qualifying desk sessions
across >=3 days. Match language, mode, scoring version and content difficulty;
exclude Zen, command drills and incomplete windows. Weight accuracy by attempts,
report speed changes and accuracy differences in percentage points with sample
counts and spread. Cross-setup comparisons require both setups to meet the gate.
Explicitly label switch/tenting metadata as self-reported and comparisons as
observational/confounded. Below threshold show "not enough comparable data".
No medical diagnosis, inferred pain, fabricated percentages or causal claim.

## 9. Acceptance and verification

M1: migrations v1-v7, round-trip all boards, invalid inactive board and orphan ID,
quota/read failures, duplicate/delete isolation, metadata bounds, snapshot
immutability, all legacy history versions, per-board summary/heatmap isolation,
language filters and deleted-history access. Browser tests must cover reload,
switching same-layout boards, layout/keymap restoration, running locks, hotkey,
form validation, en/vi labels and narrow-screen overflow.

M2-M4 each require their own tested record-version changes, focused/browser
acceptance and manual real-board gates. Native VIA/Vial firmware, mod-tap timing,
OS function-key interception, Vietnamese editorial review and assistive
technology cannot be signed off by synthetic tests alone.
