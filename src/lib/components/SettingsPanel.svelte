<script lang="ts">
  import { CARET_STYLES, type Preferences } from '../storage/preferences';
  import ConfirmationDialog from './ConfirmationDialog.svelte';

  let { settings, onchange, onpractice, onreset }: {
    settings: Preferences;
    onchange: (settings: Preferences) => void;
    onpractice: () => void;
    onreset: () => void;
  } = $props();
  let confirming = $state(false);
</script>

<section class="practice-panel settings-panel" aria-labelledby="settings-heading">
  <p class="eyebrow">Make it yours</p>
  <h2 id="settings-heading" tabindex="-1">Settings</h2>
  <p class="panel-copy">Preferences stay in this browser. There is no account or sync.</p>
  <fieldset>
    <legend>Practice</legend>
    <p>Choose Timed or Words, limits, vocabulary, punctuation, and numbers in the practice view.</p>
    <button type="button" class="secondary-button" onclick={onpractice}>Edit practice settings</button>
  </fieldset>
  <fieldset>
    <legend>Display</legend>
    <label>Caret style
      <select value={settings.caretStyle} onchange={(event) => {
        const caretStyle = CARET_STYLES.find((style) => style === event.currentTarget.value);
        if (!caretStyle) throw new Error('Unsupported caret selection.');
        onchange({ ...settings, caretStyle });
      }}>
        {#each CARET_STYLES as style}<option value={style}>{style[0].toUpperCase() + style.slice(1)}</option>{/each}
      </select>
    </label>
    <label><input type="checkbox" checked={settings.showLiveStats} onchange={(event) => onchange({
      ...settings, showLiveStats: event.currentTarget.checked
    })} /> Show live WPM and accuracy</label>
    <p>Final results and history are still available when live statistics are hidden.</p>
  </fieldset>
  <fieldset>
    <legend>Sound</legend>
    <label><input type="checkbox" checked={settings.soundEnabled} onchange={(event) => onchange({
      ...settings, soundEnabled: event.currentTarget.checked
    })} /> Typing sound</label>
    <p>A quiet generated click for accepted characters. Sound is off by default.</p>
  </fieldset>
  <div class="panel-actions">
    <button type="button" class="secondary-button" onclick={() => { confirming = true; }}>Restore defaults</button>
    <button type="button" class="primary-button" onclick={onpractice}>Back to practice</button>
  </div>
</section>

{#if confirming}
  <ConfirmationDialog
    title="Restore default preferences?"
    message="This replaces your saved practice, display, and sound preferences. Session history is not deleted."
    confirmText="Restore defaults"
    oncancel={() => { confirming = false; }}
    onconfirm={() => { confirming = false; onreset(); }}
  />
{/if}
