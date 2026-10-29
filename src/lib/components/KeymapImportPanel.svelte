<script lang="ts">
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import {
    LAYOUT_CATALOG, LayoutProfileLoadError, findCatalogEntry, isResolvedLayoutEligible, isValidVariant, loadLayoutProfile,
    resolveImportedLayout, type ImportedLayoutProfile
  } from '../keyboard/layout-catalog';
  import {
    KeymapImportError, MAX_KEYMAP_FILE_BYTES, applyKeymapLayer, keymapVariantKey, parseKeymapFile, previewKeymap,
    type KeymapImportFailure, type ParsedKeymap
  } from '../keyboard/keymap-import';
  import type { KeyboardKeymapImport, KeyboardLayoutConfirmation } from '../storage/preferences';
  import { useLocalization } from '../i18n/context';
  import { formatNumber } from '../i18n/format';
  const i18n = useLocalization();
  const { text } = i18n;

  const FILE_NAME_LENGTH = 120;

  function failureMessage(reason: KeymapImportFailure, board: string, matrix: string): string {
    switch (reason) {
      case 'too-large': return text('keymap-import.error-too-large');
      case 'malformed': return text('keymap-import.error-malformed');
      case 'unsupported': return text('keymap-import.error-unsupported');
      case 'wrong-board': return text('keymap-import.error-wrong-board', { p0: board });
      case 'wrong-size': return text('keymap-import.error-wrong-size', { p0: board, p1: matrix });
      case 'too-many-layers': return text('keymap-import.error-too-many-layers');
      case 'no-layers': return text('keymap-import.error-no-layers');
    }
  }

  let { confirmation, keymapImport, onapply, onclear, disabled = false }: {
    confirmation: KeyboardLayoutConfirmation | null;
    keymapImport: KeyboardKeymapImport | null;
    onapply: (keymap: KeyboardKeymapImport) => void;
    onclear: () => void;
    disabled?: boolean;
  } = $props();

  const entry = $derived(confirmation ? findCatalogEntry(confirmation.profileId) : undefined);
  const variant = $derived(entry && confirmation && isValidVariant(entry, confirmation.variant) ? confirmation.variant : null);
  let profile = $state.raw<ImportedLayoutProfile | null>(null);
  let loadError = $state('');
  let pending = $state.raw<{ fileName: string; parsed: ParsedKeymap } | null>(null);
  let importError = $state('');
  let status = $state('');
  let layerIndex = $state(0);
  let fileInput = $state<HTMLInputElement>();

  $effect(() => {
    const id = entry?.id;
    profile = null;
    loadError = '';
    pending = null;
    importError = '';
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

  const preview = $derived(entry && profile && variant && pending ? (() => {
    const result = previewKeymap(entry, profile, variant, pending.parsed.layers);
    return { ...result, eligible: isResolvedLayoutEligible(result.layout) };
  })() : null);
  const viewerLayers = $derived(pending?.parsed.layers ?? keymapImport?.layers ?? null);
  const viewerLayout = $derived(entry && profile && variant && viewerLayers
    ? resolveImportedLayout(entry, applyKeymapLayer(profile, entry, viewerLayers[Math.min(layerIndex, viewerLayers.length - 1)]), variant)
    : null);

  async function chooseFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    importError = '';
    status = '';
    if (!file || !entry) return;
    try {
      if (file.size > MAX_KEYMAP_FILE_BYTES) throw new KeymapImportError('too-large', 'The file is larger than 256 KB.');
      const content = await file.text();
      const parsed = parseKeymapFile(content, new TextEncoder().encode(content).length, entry);
      pending = { fileName: file.name.slice(0, FILE_NAME_LENGTH), parsed };
      layerIndex = 0;
    } catch (error) {
      if (!(error instanceof KeymapImportError)) throw error;
      importError = failureMessage(error.reason, entry.displayName, `${entry.matrix.rows} × ${entry.matrix.cols}`);
    } finally {
      input.value = '';
    }
  }

  function apply() {
    if (!pending || !entry || !variant || !preview?.eligible) return;
    onapply({
      profileId: entry.id, catalogRevision: LAYOUT_CATALOG.revision, variantKey: keymapVariantKey(variant),
      format: pending.parsed.format, fileName: pending.fileName, importedAt: Date.now(), layers: pending.parsed.layers
    });
    pending = null;
    status = text('keymap-import.applied');
  }

  function clear() {
    pending = null;
    layerIndex = 0;
    onclear();
    status = text('keymap-import.cleared');
    fileInput?.focus();
  }
</script>

<section class="keymap-import" aria-labelledby="keymap-import-heading">
  <h3 id="keymap-import-heading">{text('keymap-import.heading')}</h3>
  {#if !entry || !variant}
    <p class="settings-note">{text('keymap-import.needs-confirmed-layout')}</p>
  {:else}
    <p class="settings-note">{text('keymap-import.description', { p0: entry.displayName })}</p>
    <p class="settings-note">{text('keymap-import.file-not-firmware')}</p>
    {#if loadError}<p role="alert" class="exercise-error">{loadError}</p>{/if}
    <label class="file-label">{text('keymap-import.choose-file')}
      <input bind:this={fileInput} type="file" accept=".json,.vil,application/json" {disabled}
        aria-describedby="keymap-import-limit" onchange={(event) => { void chooseFile(event); }} />
    </label>
    <p id="keymap-import-limit" class="settings-note">{text('keymap-import.file-limit')}</p>
    {#if importError}<p role="alert" class="exercise-error">{importError}</p>{/if}

    {#if keymapImport && !pending}
      <p class="keymap-current" data-keymap-file={keymapImport.fileName}>{text('keymap-import.current', {
        p0: keymapImport.fileName, p1: keymapImport.format === 'via' ? 'VIA' : 'Vial', p2: formatNumber(i18n.language, keymapImport.layers.length)
      })}</p>
      <button class="secondary-button danger-button" type="button" {disabled} onclick={clear}>{text('keymap-import.clear')}</button>
    {/if}

    {#if pending && preview}
      <div class="keymap-preview" role="group" aria-label={text('keymap-import.preview')}>
        <p>{text('keymap-import.preview-summary', {
          p0: pending.fileName, p1: pending.parsed.format === 'via' ? 'VIA' : 'Vial',
          p2: formatNumber(i18n.language, pending.parsed.layers.length), p3: formatNumber(i18n.language, preview.differences)
        })}</p>
        {#if preview.examples.length}
          <ul class="keymap-differences">
            {#each preview.examples as difference (`${difference.row},${difference.col}`)}
              <li><code>{difference.row},{difference.col}</code>: {difference.from} → {difference.to}</li>
            {/each}
          </ul>
        {/if}
        {#if pending.parsed.identityUnconfirmed}<p class="keymap-warning">{text('keymap-import.identity-unconfirmed', { p0: entry.displayName })}</p>{/if}
        {#if pending.parsed.ignored.length}<p class="keymap-warning">{text('keymap-import.ignored', { p0: pending.parsed.ignored.join(', ') })}</p>{/if}
        {#if pending.parsed.unrecognized}<p class="keymap-warning">{text('keymap-import.unrecognized', { p0: formatNumber(i18n.language, pending.parsed.unrecognized) })}</p>{/if}
        {#if !preview.eligible}
          <p role="alert" class="exercise-error">{text('keymap-import.ineligible', { p0: preview.layout.missingCodes.join(', ') })}</p>
        {/if}
        <div class="panel-actions">
          <button class="secondary-button" type="button" disabled={disabled || !preview.eligible} onclick={apply}>{text('keymap-import.apply')}</button>
          <button class="secondary-button" type="button" onclick={() => { pending = null; }}>{text('keymap-import.discard')}</button>
        </div>
      </div>
    {/if}

    {#if viewerLayers && viewerLayout}
      <label>{text('keymap-import.layer')}
        <select value={Math.min(layerIndex, viewerLayers.length - 1)} onchange={(event) => { layerIndex = Number(event.currentTarget.value); }}>
          {#each viewerLayers as _, index}<option value={index}>{text('keymap-import.layer-option', { p0: String(index) })}</option>{/each}
        </select>
      </label>
      <p class="settings-note">{text('keymap-import.layer-viewer-note')}</p>
      <AliceKeyboardVisualizer layout={viewerLayout.keys} inertKeys={viewerLayout.inertKeys} viewBox={viewerLayout.viewBox}
        layoutSource="preview" testLayoutLabel={entry.displayName} title={text('keymap-import.layer-title', { p0: String(Math.min(layerIndex, viewerLayers.length - 1)) })} />
    {/if}
    <p class="sr-only" role="status">{status}</p>
  {/if}
</section>

<style>
  .keymap-import { border-top: 1px solid rgb(255 255 255 / 12%); padding-block: 1rem; }
  .keymap-import h3 { margin: 0 0 0.5rem; }
  .file-label { display: grid; gap: 0.35rem; margin-block: 0.5rem; }
  .keymap-preview { margin-block: 0.75rem; overflow-wrap: anywhere; }
  .keymap-differences { margin: 0.4rem 0; padding-left: 1.25rem; line-height: 1.6; }
  .keymap-warning { color: var(--color-text); }
  .keymap-warning::before { content: '⚠ '; color: var(--color-accent); }
  .keymap-current { overflow-wrap: anywhere; }
  .panel-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
