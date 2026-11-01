<script lang="ts">
  import { tick } from 'svelte';
  import type { KeyboardSnapshot } from '../keyboard/user-keyboards';
  import { useLocalization } from '../i18n/context';

  const i18n = useLocalization();
  const { text } = i18n;
  let { keyboard, onexit }: { keyboard: KeyboardSnapshot; onexit: () => void } = $props();
  let trial = $state<'tap' | 'hold'>('tap');
  let active = $state(false);
  let focused = $state(false);
  let keyDownAt: number | null = null;
  let observed = $state('');
  let report = $state<'matched' | 'different' | 'unclear' | ''>('');
  let results = $state<string[]>([]);
  let eventRegion = $state<HTMLButtonElement>();
  const selectedThumb = $derived(keyboard.thumbs.left.includes('space-') ? keyboard.thumbs.left
    : keyboard.thumbs.right.includes('space-') ? keyboard.thumbs.right : null);

  async function begin(next: 'tap' | 'hold') {
    trial = next;
    active = true;
    focused = false;
    keyDownAt = null;
    observed = '';
    report = '';
    eventRegion?.focus();
    await tick();
    eventRegion?.focus();
  }

  function keydown(event: KeyboardEvent) {
    if (!active || !focused || event.repeat) return;
    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      event.preventDefault();
      keyDownAt = event.timeStamp;
      observed = event.key === ' ' ? 'Space' : event.key;
    }
  }

  function keyup(event: KeyboardEvent) {
    if (!active || !focused || keyDownAt === null) return;
    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      event.preventDefault();
      const duration = Math.max(0, event.timeStamp - keyDownAt);
      observed = text('boards.modtap-event-result', { key: event.key === ' ' ? 'Space' : event.key, ms: String(Math.round(duration)) });
      keyDownAt = null;
    }
  }

  function recordOutcome(value: 'matched' | 'different' | 'unclear') {
    report = value;
    results = [...results, value];
    active = false;
  }
</script>

<section class="modtap-guide" aria-labelledby="modtap-heading">
  <h3 id="modtap-heading">{text('boards.modtap-heading')}</h3>
  <p>{text('boards.modtap-help')}</p>
  <p>{selectedThumb
    ? text('boards.modtap-intent', { role: selectedThumb === 'space-shift' ? text('boards.role-space-shift') : text('boards.role-space-layer-1') })
    : text('boards.modtap-unknown-intent')}</p>
  <div class="trial-actions">
    <button class="secondary-button" type="button" disabled={active} onclick={() => begin('tap')}>{text('boards.modtap-tap')}</button>
    <button class="secondary-button" type="button" disabled={active} onclick={() => begin('hold')}>{text('boards.modtap-hold')}</button>
  </div>
  {#if active}
    <button bind:this={eventRegion} class="event-region" type="button"
      aria-label={text('boards.modtap-focus')} onfocus={() => { focused = true; }} onblur={() => { focused = false; keyDownAt = null; }}
      onkeydown={keydown} onkeyup={keyup}>
      <strong>{text(trial === 'tap' ? 'boards.modtap-tap-prompt' : 'boards.modtap-hold-prompt')}</strong>
      <span>{text('boards.modtap-press-space-or-shift')}</span>
      {#if observed}<span role="status">{observed}</span>{/if}
    </button>
    <fieldset>
      <legend>{text('boards.modtap-result')}</legend>
      <button class="secondary-button" type="button" onclick={() => recordOutcome('matched')}>{text('boards.modtap-matched')}</button>
      <button class="secondary-button" type="button" onclick={() => recordOutcome('different')}>{text('boards.modtap-different')}</button>
      <button class="secondary-button" type="button" onclick={() => recordOutcome('unclear')}>{text('boards.modtap-unclear')}</button>
    </fieldset>
  {/if}
  {#if results.length}
    <p role="status">{text('boards.modtap-summary', { completed: String(results.length) })}</p>
  {/if}
  <p class="observability-note">{text('boards.modtap-observability')}</p>
  {#if results.length >= 2}<p>{text('boards.modtap-suggestion')}</p>{/if}
  <button class="secondary-button" type="button" onclick={onexit}>{text('boards.practice-back')}</button>
</section>

<style>
  .modtap-guide { display: grid; gap: 0.65rem; }
  .modtap-guide h3, .modtap-guide p { margin: 0; }
  .trial-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .event-region { display: grid; gap: 0.5rem; min-height: 6rem; padding: 1rem; border: 2px solid var(--color-accent); border-radius: 0.75rem; background: rgb(0 0 0 / 18%); color: inherit; cursor: crosshair; font: inherit; text-align: start; }
  .event-region:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 3px; }
  .modtap-guide fieldset { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .observability-note { color: #b8b8b8; font-size: 0.9rem; }
</style>
