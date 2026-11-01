<script lang="ts">
  import { COMMAND_OUTPUT_CODES, validateLayerBindings, type KeyboardLayerBinding } from '../keyboard/user-keyboards';
  import { StorageError } from '../storage/errors';
  import { useLocalization } from '../i18n/context';

  const i18n = useLocalization();
  const { text } = i18n;
  let { bindings, onbindingschange }: {
    bindings: readonly KeyboardLayerBinding[];
    onbindingschange: (bindings: readonly KeyboardLayerBinding[]) => void;
  } = $props();
  let layer = $state('1');
  let holdCue = $state('');
  let sourcePosition = $state('');
  let sourceCode = $state('');
  let outputCode = $state<(typeof COMMAND_OUTPUT_CODES)[number]>('ArrowLeft');
  let shift = $state(false);
  let error = $state('');

  function addBinding() {
    error = '';
    const binding = {
      id: crypto.randomUUID(),
      layer: Number(layer),
      holdCue,
      sourcePosition,
      sourceCode,
      outputCode,
      modifiers: shift ? ['shift'] : []
    };
    try {
      onbindingschange(validateLayerBindings([...bindings, binding]));
      holdCue = '';
      sourcePosition = '';
      sourceCode = '';
      shift = false;
    } catch (failure) {
      if (!(failure instanceof StorageError)) throw failure;
      error = failure.message;
    }
  }

  function removeBinding(id: string) {
    onbindingschange(bindings.filter((binding) => binding.id !== id));
  }
</script>

<fieldset class="layer-bindings">
  <legend>{text('boards.layers-legend')}</legend>
  <p>{text('boards.layers-help')}</p>
  {#if bindings.length}
    <ul>
      {#each bindings as binding (binding.id)}
        <li>
          <span><strong>{binding.holdCue}</strong> · {binding.sourcePosition} ({binding.sourceCode})
            → {binding.modifiers.includes('shift') ? 'Shift+' : ''}{binding.outputCode}</span>
          <button class="secondary-button" type="button" onclick={() => removeBinding(binding.id)}>
            {text('boards.layers-remove')}
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p>{text('boards.layers-empty')}</p>
  {/if}
  <div class="binding-fields">
    <label>{text('boards.layers-number')}
      <input type="number" min="1" max="32" bind:value={layer} />
    </label>
    <label>{text('boards.layers-hold-cue')}
      <input type="text" maxlength="80" bind:value={holdCue} />
    </label>
    <label>{text('boards.layers-source-position')}
      <input type="text" maxlength="40" bind:value={sourcePosition} placeholder="H" />
    </label>
    <label>{text('boards.layers-source-code')}
      <input type="text" maxlength="64" bind:value={sourceCode} placeholder="KeyH" />
    </label>
    <label>{text('boards.layers-output')}
      <select bind:value={outputCode}>
        {#each COMMAND_OUTPUT_CODES as code}
          <option value={code}>{code}</option>
        {/each}
      </select>
    </label>
  </div>
  <label class="modifier"><input type="checkbox" bind:checked={shift} />{text('boards.layers-shift')}</label>
  <p>{text('boards.layers-observability')}</p>
  {#if error}<p role="alert">{text('boards.layers-invalid', { detail: error })}</p>{/if}
  <button class="secondary-button" type="button" disabled={bindings.length >= 64} onclick={addBinding}>
    {text('boards.layers-add')}
  </button>
</fieldset>

<style>
  .layer-bindings, .binding-fields { display: grid; gap: 0.65rem; }
  .layer-bindings p { margin: 0; }
  .binding-fields { grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
  .layer-bindings ul { display: grid; gap: 0.4rem; margin: 0; padding-left: 1.25rem; }
  .layer-bindings li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .modifier { display: flex; align-items: center; gap: 0.5rem; }
</style>
