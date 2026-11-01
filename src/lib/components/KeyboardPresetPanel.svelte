<script lang="ts">
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import {
    defaultVariant, isResolvedLayoutEligible, LayoutProfileLoadError, LAYOUT_CATALOG, loadLayoutProfile,
    resolveImportedLayout
  } from '../keyboard/layout-catalog';
  import { layoutPreset, LAYOUT_PRESETS, type LayoutPresetId } from '../keyboard/layout-presets';
  import type { KeyboardLayoutConfirmation } from '../storage/preferences';
  import { useLocalization } from '../i18n/context';

  const i18n = useLocalization();
  const { text } = i18n;
  let { onapply }: { onapply: (confirmation: KeyboardLayoutConfirmation) => void } = $props();
  let selectedId = $state<LayoutPresetId>(LAYOUT_PRESETS[0]?.id ?? 'standard-alice');
  let preview = $state.raw<ReturnType<typeof resolveImportedLayout> | null>(null);
  let loading = $state(false);
  let error = $state('');
  const selected = $derived(layoutPreset(selectedId));

  $effect(() => {
    const preset = selected;
    preview = null;
    error = '';
    if (!preset) return;
    let cancelled = false;
    loading = true;
    loadLayoutProfile(preset.entry.id).then((profile) => {
      if (cancelled) return;
      const layout = resolveImportedLayout(preset.entry, profile, defaultVariant(preset.entry));
      if (!isResolvedLayoutEligible(layout)) {
        error = text('boards.preset-ineligible', { codes: layout.missingCodes.join(', ') });
        return;
      }
      preview = layout;
    }).catch((failure: unknown) => {
      if (!(failure instanceof LayoutProfileLoadError)) throw failure;
      if (!cancelled) error = failure.message;
    }).finally(() => {
      if (!cancelled) loading = false;
    });
    return () => { cancelled = true; };
  });

  function apply() {
    if (!selected || !preview || loading || error) return;
    onapply({
      profileId: selected.entry.id,
      variant: defaultVariant(selected.entry),
      confirmedFor: null,
      catalogRevision: LAYOUT_CATALOG.revision
    });
  }
</script>

<fieldset class="keyboard-presets">
  <legend>{text('boards.preset-legend')}</legend>
  <p>{text('boards.preset-help')}</p>
  <label for="keyboard-preset">{text('boards.preset-select')}</label>
  <select id="keyboard-preset" bind:value={selectedId}>
    {#each LAYOUT_PRESETS as preset (preset.id)}
      <option value={preset.id}>{text(`boards.preset-${preset.id}`)}</option>
    {/each}
  </select>
  {#if selected}
    <div class="preset-preview" aria-live="polite">
      <h3>{selected.entry.displayName}</h3>
      <p>{text(`boards.preset-description-${selected.id}`)}</p>
      {#if loading}<p role="status">{text('boards.preset-loading')}</p>{/if}
      {#if error}<p role="alert">{text('boards.preset-error', { detail: error })}</p>{/if}
      {#if preview}
        <AliceKeyboardVisualizer
          layout={preview.keys}
          inertKeys={preview.inertKeys}
          viewBox={preview.viewBox}
          testLayoutLabel={preview.label}
          layoutSource="preview"
          title={text('boards.preset-preview-title', { name: preview.label })}
        />
        <ul class="preset-sources">
          <li><a href={selected.entry.sources.via.url} target="_blank" rel="noreferrer">{text('boards.preset-via-source')}</a></li>
          <li><a href={selected.entry.sources.qmkInfo.url} target="_blank" rel="noreferrer">{text('boards.preset-qmk-info-source')}</a></li>
          <li><a href={selected.entry.sources.keymap.url} target="_blank" rel="noreferrer">{text('boards.preset-qmk-keymap-source')}</a></li>
        </ul>
        <button class="primary-button" type="button" onclick={apply}>{text('boards.preset-apply')}</button>
      {/if}
    </div>
  {/if}
</fieldset>

<style>
  .keyboard-presets { display: grid; gap: 0.65rem; }
  .keyboard-presets p, .preset-preview h3 { margin: 0; }
  .preset-preview { display: grid; gap: 0.65rem; }
  .preset-preview h3 { font-size: 1rem; }
  .preset-sources { display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; margin: 0; padding-left: 1.25rem; }
  .preset-sources a { color: var(--color-accent); }
</style>
