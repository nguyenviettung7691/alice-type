<script lang="ts">
  import { tick, untrack } from 'svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import { deviceId, type KeyboardDevice } from '../keyboard/keyboard-access';
  import {
    LAYOUT_CATALOG, LayoutProfileLoadError, defaultVariant, describeVariant, findCatalogEntry, isResolvedLayoutEligible,
    isValidVariant, loadLayoutProfile, resolveImportedLayout, type ImportedLayoutProfile, type LayoutVariant
  } from '../keyboard/layout-catalog';
  import { distinguishingCodes, eliminatedVariantOptions, rankLayoutCandidates } from '../keyboard/layout-matching';
  import { type KeyboardLayoutConfirmation } from '../storage/preferences';
  import { useLocalization } from '../i18n/context';
  import { candidateReason } from '../i18n/tool-messages';
  const localization = useLocalization();
  const { text } = localization;

  let { connectedDevice = null, boardNames = [], confirmation, layoutNotice = '', onconfirm, onclear }: {
    connectedDevice?: KeyboardDevice | null;
    boardNames?: readonly string[];
    confirmation: KeyboardLayoutConfirmation | null;
    /** Recoverable problem with the saved confirmation (stale, ineligible, or failed to load). */
    layoutNotice?: string;
    onconfirm: (confirmation: KeyboardLayoutConfirmation) => void;
    onclear: () => void;
  } = $props();

  let boardName = $state('');
  const candidates = $derived(rankLayoutCandidates(connectedDevice, LAYOUT_CATALOG.profiles, boardName.trim() ? [boardName] : boardNames));
  const confirmedEntry = $derived(findCatalogEntry(confirmation?.profileId));
  const deviceMismatch = $derived(!!confirmation?.confirmedFor && !!connectedDevice
    && (confirmation.confirmedFor.vendorId !== connectedDevice.vendorId
      || confirmation.confirmedFor.productId !== connectedDevice.productId));
  const sortedEntries = [...LAYOUT_CATALOG.profiles].sort((a, b) => a.displayName.localeCompare(b.displayName));

  let selectedId = $state('');
  let variant = $state<LayoutVariant>({});
  let profile = $state.raw<ImportedLayoutProfile | null>(null);
  let loadError = $state('');
  let observed = $state.raw<ReadonlySet<string>>(new Set());
  const selectedEntry = $derived(findCatalogEntry(selectedId));

  function choose(id: string) {
    const entry = findCatalogEntry(id);
    selectedId = entry ? id : '';
    observed = new Set();
    if (!entry) { variant = {}; return; }
    variant = confirmation?.profileId === id && isValidVariant(entry, confirmation.variant)
      ? { ...confirmation.variant }
      : defaultVariant(entry);
  }

  async function review(id: string) {
    choose(id);
    await tick();
    document.getElementById('layout-review-heading')?.focus();
  }

  // Start from the saved confirmation, else the best suggestion; later evidence never switches the review automatically.
  untrack(() => choose(confirmation?.profileId ?? candidates[0]?.entry.id ?? ''));

  $effect(() => {
    const id = selectedId;
    profile = null;
    loadError = '';
    if (!id) return;
    let cancelled = false;
    loadLayoutProfile(id).then((loaded) => {
      if (!cancelled) profile = loaded;
    }, (error: unknown) => {
      if (!(error instanceof LayoutProfileLoadError)) throw error;
      if (!cancelled) loadError = error.message;
    });
    return () => { cancelled = true; };
  });

  const preview = $derived.by(() => {
    if (!selectedEntry || !profile || profile.id !== selectedEntry.id || !isValidVariant(selectedEntry, variant)) return null;
    try {
      const layout = resolveImportedLayout(selectedEntry, profile, variant);
      return { layout, eligible: isResolvedLayoutEligible(layout) };
    } catch (error) {
      if (!(error instanceof LayoutProfileLoadError)) throw error;
      return { layout: null, eligible: false, error: error.message };
    }
  });
  const eliminated = $derived(selectedEntry && profile ? eliminatedVariantOptions(selectedEntry, profile, observed) : new Map());
  const hints = $derived(selectedEntry && profile ? distinguishingCodes(selectedEntry, profile) : new Map());
  const alreadyConfirmed = $derived(!!confirmation && confirmation.profileId === selectedId
    && JSON.stringify(confirmation.variant) === JSON.stringify(variant)
    && (confirmation.confirmedFor?.vendorId ?? null) === (connectedDevice?.vendorId ?? null)
    && (confirmation.confirmedFor?.productId ?? null) === (connectedDevice?.productId ?? null));

  function checkKey(event: KeyboardEvent) {
    if (event.repeat || event.isComposing || !event.code || event.code === 'Tab' || observed.has(event.code)) return;
    observed = new Set([...observed, event.code]);
  }

  function confirm() {
    if (!selectedEntry || !preview?.eligible) return;
    onconfirm({
      profileId: selectedEntry.id,
      variant: { ...variant },
      confirmedFor: connectedDevice ? { vendorId: connectedDevice.vendorId, productId: connectedDevice.productId } : null,
      catalogRevision: LAYOUT_CATALOG.revision
    });
  }
</script>

<fieldset class="layout-match" aria-labelledby="layout-match-heading">
  <legend><span id="layout-match-heading" tabindex="-1">{text("keyboard-connection.find-my-layout")}</span></legend>
  <p class="finder-intro">{text("layout-match-panel.nothing-changes-until-you-confirm-a-layout")}</p>

  <div class="layout-status" role="status">
    {#if confirmation && confirmedEntry}
      <p>
        {text("layout-match-panel.active-layout")} <strong>{confirmedEntry.displayName}</strong> <span class="source-label">{text("layout-match-panel.confirmed-by-you")}</span>
        {#if confirmedEntry.groups.length > 0 && isValidVariant(confirmedEntry, confirmation.variant)}
          <span class="variant-summary">({describeVariant(confirmedEntry, confirmation.variant)})</span>
        {/if}
      </p>
    {:else}
      <p>{text("layout-match-panel.active-layout")} <strong>Generic Alice</strong>{text("layout-match-panel.no-layout-is-confirmed")}</p>
    {/if}
  </div>
  {#if layoutNotice}
    <p class="layout-warning" role="alert">{text("layout-match-panel.saved-layout-unavailable", { p0: String(layoutNotice) })}</p>
  {/if}
  {#if deviceMismatch && confirmation?.confirmedFor}
    <p class="layout-warning" role="alert">
      {text("layout-match-panel.the-connected-device-differs-from-the-device", { p0: String(deviceId(connectedDevice!.vendorId)), p1: String(deviceId(connectedDevice!.productId)), p2: String(deviceId(confirmation.confirmedFor.vendorId)), p3: String(deviceId(confirmation.confirmedFor.productId)) })}
    </p>
  {/if}
  {#if confirmation}
    <div class="panel-actions">
      <button class="secondary-button danger-button" type="button" onclick={onclear}>{text("layout-match-panel.clear-confirmation")}</button>
    </div>
  {/if}

  <div class="finder-grid">
  <div class="layout-choices">
  <label for="layout-board-name">{text("layout-match-panel.board-name")}</label>
  <input id="layout-board-name" name="board-name" type="search" autocomplete="off" spellcheck="false"
    maxlength="120" bind:value={boardName} placeholder={text("layout-match-panel.e-g-keychron-q8")} aria-describedby="board-name-help" />
  <p id="board-name-help" class="variant-hint">{text("layout-match-panel.search-by-model-no-connection-needed")}</p>
  <h3>{text("layout-match-panel.suggestions")} <span class="result-count" role="status" aria-label={text("layout-match-panel.suggested-layouts", { p0: String(candidates.length) })}>({candidates.length})</span></h3>
  {#if candidates.length === 0}
    <p class="empty-suggestions">
      {#if boardName.trim()}
        {text("layout-match-panel.no-suggestions-for-try-another-model-or", { p0: String(boardName) })}
      {:else if connectedDevice}
        {text("layout-match-panel.no-match-for-this-device-try-its")}
      {:else}
        {text("layout-match-panel.enter-your-board-name-or-browse-all")}
      {/if}
    </p>
  {:else}
    <ul class="candidate-list" aria-label={text("layout-match-panel.suggested-layouts-2")}>
      {#each candidates as candidate (candidate.entry.id)}
        <li class="candidate" data-candidate={candidate.entry.id}>
          <button class="candidate-button" type="button" aria-label={text("layout-match-panel.review", { p0: String(candidate.entry.displayName) })}
            aria-pressed={selectedId === candidate.entry.id} onclick={() => review(candidate.entry.id)}>
            <strong>{candidate.entry.displayName}</strong>
            <span class="source-label">{text("layout-match-panel.suggested-not-confirmed")}</span>
            <span class="candidate-reasons">{candidate.reasons.map((reason) => candidateReason(localization.language, reason)).join(' ')}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <label for="layout-catalog-select">{text("layout-match-panel.browse-catalog-layouts")}</label>
  <select id="layout-catalog-select" value={selectedId} onchange={(event) => choose(event.currentTarget.value)}>
    <option value="">{text("layout-match-panel.choose-a-layout-to-review")}</option>
    {#each sortedEntries as entry (entry.id)}
      <option value={entry.id}>{entry.displayName}</option>
    {/each}
  </select>
  </div>

  {#if selectedEntry}
    <section class="layout-review" aria-labelledby="layout-review-heading">
      <h3 id="layout-review-heading" tabindex="-1">{text("layout-match-panel.review", { p0: String(selectedEntry.displayName) })}</h3>
      <p class="variant-hint">{text("layout-match-panel.does-this-match-your-keyboard-check-the")}</p>

      {#if loadError}
        <p class="layout-warning" role="alert">{text("layout-match-panel.the-generic-alice-layout-stays-active", { p0: String(loadError) })}</p>
      {:else if !preview}
        <p role="status">{text("layout-match-panel.loading-layout-preview")}</p>
      {:else if preview.layout}
        <AliceKeyboardVisualizer layout={preview.layout.keys} inertKeys={preview.layout.inertKeys} viewBox={preview.layout.viewBox}
          layoutSource="preview" testLayoutLabel={selectedEntry.displayName} title={text("layout-match-panel.layout-preview")} />
        {#if !preview.eligible}
          <p class="layout-warning" role="alert">
            {preview.layout.missingCodes.length > 0
              ? text("layout-match-panel.this-variant-cannot-be-used-missing-keys", { p0: String(preview.layout.missingCodes.join(', ')) })
              : text("layout-match-panel.this-variant-cannot-be-used-missing-keys-2")}
          </p>
        {/if}
      {:else}
        <p class="layout-warning" role="alert">{text("layout-match-panel.preview-error", { p0: String(preview.error ?? '') })}</p>
      {/if}

      <div class="variant-options">
      {#each selectedEntry.groups as group, groupIndex (groupIndex)}
        <fieldset class="variant-group">
          <legend>{group.label}</legend>
          {#each group.options as option, optionIndex (optionIndex)}
            {@const ruledOut = eliminated.get(groupIndex)?.has(optionIndex) ?? false}
            <label>
              <input type="radio" name={`layout-variant-${groupIndex}`} value={optionIndex}
                checked={variant[String(groupIndex)] === optionIndex}
                onchange={() => { variant = { ...variant, [String(groupIndex)]: optionIndex }; }} />
              {option}{#if ruledOut}{' '}<span class="ruled-out">{text("layout-match-panel.ruled-out-by-your-key-presses")}</span>{/if}
            </label>
          {/each}
        </fieldset>
      {/each}
      </div>
      <div class="panel-actions">
        <button class="primary-button" type="button" disabled={!preview?.eligible || alreadyConfirmed} onclick={confirm}>
          {alreadyConfirmed ? text("layout-match-panel.layout-confirmed") : text("layout-match-panel.confirm-this-layout")}
        </button>
      </div>

      <details class="layout-help">
      <summary>{selectedEntry.groups.length > 0 ? text("layout-match-panel.key-check-layout-sources") : text("layout-match-panel.layout-sources")}</summary>
      <p class="catalog-sources">
        {text("layout-match-panel.sources")}
        <a href={selectedEntry.sources.via.url} target="_blank" rel="noreferrer">{text("layout-match-panel.via-definition")}</a>,
        <a href={selectedEntry.sources.qmkInfo.url} target="_blank" rel="noreferrer">{text("layout-match-panel.qmk-keyboard-info")}</a>,
        <a href={selectedEntry.sources.keymap.url} target="_blank" rel="noreferrer">{text("layout-match-panel.qmk-default-keymap")}</a>
        {text("layout-match-panel.layer-legends-come-from-the-default-keymap", { p0: String(selectedEntry.sources.keymap.layer) })}
      </p>

      {#each selectedEntry.groups as group, groupIndex (groupIndex)}
          {#if hints.get(groupIndex)}
            <p class="variant-hint">{text("layout-match-panel.distinguishing-keys", { p0: String(group.label), p1: String(hints.get(groupIndex)?.join(', ')) })}</p>
          {:else}
            <p class="variant-hint">{text("layout-match-panel.compare-the-preview-key-presses-cannot-tell", { p0: String(group.label) })}</p>
          {/if}
      {/each}

      {#if selectedEntry.groups.length > 0}
        <label for="layout-key-check">{text("layout-match-panel.check-with-key-presses-optional")}</label>
        <input id="layout-key-check" type="text" readonly autocomplete="off" aria-describedby="layout-key-check-help"
          placeholder={text("layout-match-panel.press-a-key-to-check")} onkeydown={checkKey} />
        <p id="layout-key-check-help" class="variant-hint">
          {text("layout-match-panel.pressed-keys-only-rule-out-options-they")}
          {text("layout-match-panel.checked", { p0: observed.size > 0 ? [...observed].join(', ') : text('layout.noneChecked') })}
        </p>
        {#if observed.size > 0}
          <button class="secondary-button danger-button" type="button" onclick={() => { observed = new Set(); }}>{text("layout-match-panel.clear-checked-keys")}</button>
        {/if}
      {/if}

      </details>
    </section>
  {:else}
    <div class="review-empty"><h3>{text("layout-match-panel.preview-your-layout")}</h3><p>{text("layout-match-panel.choose-a-suggestion-or-a-catalog-layout")}</p></div>
  {/if}
  </div>
</fieldset>

<style>
  .layout-match h3 { margin: 1.25rem 0 0.5rem; font-size: 1rem; }
  .layout-status p { margin: 0.5rem 0; overflow-wrap: anywhere; }
  .variant-summary { color: #b8b8b8; font-size: 0.85rem; }
  .source-label { color: var(--color-accent); font-size: 0.82rem; }
  .layout-warning {
    border-left: 3px solid var(--color-error);
    padding-left: 0.75rem;
    overflow-wrap: anywhere;
  }
  .finder-grid { display: grid; grid-template-columns: minmax(14rem, 0.8fr) minmax(0, 1.6fr); gap: 1.5rem; align-items: start; }
  .finder-grid > * { min-width: 0; }
  .finder-intro { margin-top: 0; }
  .result-count { color: #b8b8b8; font-weight: 400; }
  .candidate-list { margin: 0 0 1rem; padding: 0.2rem; list-style: none; max-height: 14rem; overflow-y: auto; }
  .candidate {
    margin-bottom: 0.5rem;
  }
  .candidate-button {
    display: grid;
    gap: 0.3rem;
    width: 100%;
    text-align: left;
    color: var(--color-text);
    font: inherit;
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 0.75rem;
    padding: 0.85rem 1rem;
    background: rgb(0 0 0 / 12%);
  }
  .candidate-button:hover { border-color: var(--color-accent); }
  .candidate-button[aria-pressed="true"] { border-color: var(--color-accent); background: rgb(255 93 0 / 8%); }
  .candidate-button:focus-visible, summary:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  .candidate-button strong { overflow-wrap: anywhere; }
  .candidate-reasons { color: #b8b8b8; font-size: 0.78rem; overflow-wrap: anywhere; }
  .layout-review h3, .review-empty h3 { margin-top: 0; }
  .layout-help { margin-top: 1rem; }
  summary { cursor: pointer; padding: 0.5rem 0; color: #b8b8b8; }
  .variant-options { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .variant-options .variant-group { flex: 1 1 10rem; margin: 0.75rem 0 0; padding: 0.5rem 0.75rem; }
  .catalog-sources { color: #b8b8b8; font-size: 0.78rem; overflow-wrap: anywhere; }
  .catalog-sources a { color: var(--color-accent); }
  .variant-group label { display: flex; align-items: center; gap: 0.5rem; }
  .variant-hint { color: #b8b8b8; font-size: 0.78rem; }
  .ruled-out { color: var(--color-error); }
  #layout-key-check, #layout-board-name {
    width: 100%;
    border: 1px solid var(--color-muted);
    border-radius: 0.35rem;
    padding: 0.5rem;
    background: var(--color-background);
    color: var(--color-text);
    font: inherit;
  }
  #layout-key-check:focus-visible, #layout-match-heading:focus-visible, #layout-review-heading:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  select { width: min(100%, 32rem); }
  #layout-board-name:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  @media (max-width: 800px) {
    .finder-grid { grid-template-columns: minmax(0, 1fr); }
    .candidate-list { max-height: 13rem; }
  }
</style>
