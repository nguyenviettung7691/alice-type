<script lang="ts">
  import { untrack } from 'svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import { deviceId, type KeyboardDevice } from '../keyboard/keyboard-access';
  import {
    LAYOUT_CATALOG, LayoutProfileLoadError, defaultVariant, describeVariant, findCatalogEntry, isResolvedLayoutEligible,
    isValidVariant, loadLayoutProfile, resolveImportedLayout, type ImportedLayoutProfile, type LayoutVariant
  } from '../keyboard/layout-catalog';
  import { distinguishingCodes, eliminatedVariantOptions, rankLayoutCandidates } from '../keyboard/layout-matching';
  import { type KeyboardLayoutConfirmation } from '../storage/preferences';

  let { connectedDevice = null, confirmation, layoutNotice = '', onconfirm, onclear }: {
    connectedDevice?: KeyboardDevice | null;
    confirmation: KeyboardLayoutConfirmation | null;
    /** Recoverable problem with the saved confirmation (stale, ineligible, or failed to load). */
    layoutNotice?: string;
    onconfirm: (confirmation: KeyboardLayoutConfirmation) => void;
    onclear: () => void;
  } = $props();

  const candidates = $derived(rankLayoutCandidates(connectedDevice, LAYOUT_CATALOG.profiles));
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

  // Start from the saved confirmation, else the best suggestion; later evidence never switches the review automatically.
  untrack(() => choose(confirmation?.profileId ?? rankLayoutCandidates(connectedDevice, LAYOUT_CATALOG.profiles)[0]?.entry.id ?? ''));

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
      if (!cancelled) loadError = `${error.message} The generic Alice layout stays active.`;
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
  <legend><span id="layout-match-heading" tabindex="-1">Find my layout</span></legend>
  <p>
    Suggestions come from bundled VIA and QMK data matched against the vendor/product ID your browser reports.
    AliceType cannot detect your physical layout, so nothing changes until you confirm a layout.
  </p>

  <div class="layout-status" role="status">
    {#if confirmation && confirmedEntry}
      <p>
        Active layout: <strong>{confirmedEntry.displayName}</strong> <span class="source-label">Confirmed by you</span>
        {#if confirmedEntry.groups.length > 0 && isValidVariant(confirmedEntry, confirmation.variant)}
          <span class="variant-summary">({describeVariant(confirmedEntry, confirmation.variant)})</span>
        {/if}
      </p>
    {:else}
      <p>Active layout: <strong>Generic Alice</strong>. No layout is confirmed.</p>
    {/if}
  </div>
  {#if layoutNotice}
    <p class="layout-warning" role="alert">{layoutNotice}</p>
  {/if}
  {#if deviceMismatch && confirmation?.confirmedFor}
    <p class="layout-warning" role="alert">
      The connected device ({deviceId(connectedDevice!.vendorId)}:{deviceId(connectedDevice!.productId)}) differs from the device this
      layout was confirmed for ({deviceId(confirmation.confirmedFor.vendorId)}:{deviceId(confirmation.confirmedFor.productId)}).
      The confirmed layout is kept. Review the suggestions below to choose another.
    </p>
  {/if}
  {#if confirmation}
    <div class="panel-actions">
      <button class="secondary-button" type="button" onclick={onclear}>Clear confirmation</button>
    </div>
  {/if}

  <h3>Suggestions</h3>
  {#if !connectedDevice}
    <p>No device is selected. Choose your keyboard in the connection panel to get suggestions, or browse the catalog below.</p>
  {:else if candidates.length === 0}
    <p>No catalog layout matches {deviceId(connectedDevice.vendorId)}:{deviceId(connectedDevice.productId)}. The generic Alice layout stays active. You can still browse the catalog below.</p>
  {:else}
    <ul class="candidate-list">
      {#each candidates as candidate (candidate.entry.id)}
        <li class="candidate" data-candidate={candidate.entry.id}>
          <p><strong>{candidate.entry.displayName}</strong> <span class="source-label">Suggested — not confirmed</span></p>
          <ul class="candidate-reasons">
            {#each candidate.reasons as reason}<li>{reason}</li>{/each}
          </ul>
          <button class="secondary-button" type="button" aria-label={`Review ${candidate.entry.displayName}`}
            onclick={() => choose(candidate.entry.id)}>Review this layout</button>
        </li>
      {/each}
    </ul>
  {/if}

  <label for="layout-catalog-select">Browse catalog layouts</label>
  <select id="layout-catalog-select" value={selectedId} onchange={(event) => choose(event.currentTarget.value)}>
    <option value="">Choose a layout to review</option>
    {#each sortedEntries as entry (entry.id)}
      <option value={entry.id}>{entry.displayName} ({deviceId(entry.vendorId)}:{deviceId(entry.productId)})</option>
    {/each}
  </select>

  {#if selectedEntry}
    <section class="layout-review" aria-labelledby="layout-review-heading">
      <h3 id="layout-review-heading">Review {selectedEntry.displayName}</h3>
      <p class="catalog-sources">
        Sources:
        <a href={selectedEntry.sources.via.url} target="_blank" rel="noreferrer">VIA definition</a>,
        <a href={selectedEntry.sources.qmkInfo.url} target="_blank" rel="noreferrer">QMK keyboard info</a>,
        <a href={selectedEntry.sources.keymap.url} target="_blank" rel="noreferrer">QMK default keymap</a>
        (layer {selectedEntry.sources.keymap.layer}). Legends come from the default keymap; your firmware may differ.
      </p>

      {#each selectedEntry.groups as group, groupIndex (groupIndex)}
        <fieldset class="variant-group">
          <legend>{group.label}</legend>
          {#each group.options as option, optionIndex (optionIndex)}
            {@const ruledOut = eliminated.get(groupIndex)?.has(optionIndex) ?? false}
            <label>
              <input type="radio" name={`layout-variant-${groupIndex}`} value={optionIndex}
                checked={variant[String(groupIndex)] === optionIndex}
                onchange={() => { variant = { ...variant, [String(groupIndex)]: optionIndex }; }} />
              {option}{#if ruledOut}{' '}<span class="ruled-out">— ruled out by your key presses</span>{/if}
            </label>
          {/each}
          {#if hints.get(groupIndex)}
            <p class="variant-hint">Distinguishing keys: {hints.get(groupIndex)?.join(', ')}.</p>
          {:else}
            <p class="variant-hint">Key presses cannot tell these options apart; compare the preview with your keyboard.</p>
          {/if}
        </fieldset>
      {/each}

      {#if selectedEntry.groups.length > 0}
        <label for="layout-key-check">Check with key presses (optional)</label>
        <input id="layout-key-check" type="text" readonly autocomplete="off" aria-describedby="layout-key-check-help"
          placeholder="Focus here and press the distinguishing keys" onkeydown={checkKey} />
        <p id="layout-key-check-help" class="variant-hint">
          Pressed keys only rule out options; they never confirm a layout. Nothing is saved.
          Checked: {observed.size > 0 ? [...observed].join(', ') : 'none yet'}.
        </p>
        {#if observed.size > 0}
          <button class="secondary-button" type="button" onclick={() => { observed = new Set(); }}>Clear checked keys</button>
        {/if}
      {/if}

      {#if loadError}
        <p class="layout-warning" role="alert">{loadError}</p>
      {:else if !preview}
        <p role="status">Loading layout preview…</p>
      {:else if preview.layout}
        <AliceKeyboardVisualizer layout={preview.layout.keys} inertKeys={preview.layout.inertKeys} viewBox={preview.layout.viewBox}
          layoutSource="preview" testLayoutLabel={selectedEntry.displayName} title={`${selectedEntry.displayName} preview (not yet active)`} />
        {#if !preview.eligible}
          <p class="layout-warning" role="alert">
            This variant cannot be used: missing keys {preview.layout.missingCodes.join(', ') || 'or invalid key shapes'}.
          </p>
        {/if}
      {:else}
        <p class="layout-warning" role="alert">{preview.error}</p>
      {/if}

      <div class="panel-actions">
        <button class="primary-button" type="button" disabled={!preview?.eligible || alreadyConfirmed} onclick={confirm}>
          {alreadyConfirmed ? 'Layout confirmed' : 'Confirm this layout'}
        </button>
      </div>
    </section>
  {/if}
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
  .candidate-list { margin: 0; padding: 0; list-style: none; }
  .candidate {
    margin-bottom: 0.75rem;
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 0.75rem;
    padding: 0.85rem 1rem;
    background: rgb(0 0 0 / 12%);
  }
  .candidate p { margin: 0 0 0.4rem; overflow-wrap: anywhere; }
  .candidate-reasons { margin: 0 0 0.6rem; padding-left: 1.25rem; color: #b8b8b8; font-size: 0.82rem; }
  .layout-review { margin-top: 1rem; }
  .catalog-sources { color: #b8b8b8; font-size: 0.78rem; overflow-wrap: anywhere; }
  .catalog-sources a { color: var(--color-accent); }
  .variant-group label { display: flex; align-items: center; gap: 0.5rem; }
  .variant-hint { color: #b8b8b8; font-size: 0.78rem; }
  .ruled-out { color: var(--color-error); }
  #layout-key-check {
    width: min(100%, 32rem);
    border: 1px solid var(--color-muted);
    border-radius: 0.35rem;
    padding: 0.5rem;
    background: var(--color-background);
    color: var(--color-text);
    font: inherit;
  }
  #layout-key-check:focus-visible, #layout-match-heading:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  select { width: min(100%, 32rem); }
</style>
