<script lang="ts">
  import { tick } from 'svelte';
  import { commandMatches, commandRecord, COMMAND_DRILL_LENGTH, isCommandOutputCode } from '../typing/command-practice';
  import type { KeyboardLayerBinding, KeyboardSnapshot } from '../keyboard/user-keyboards';
  import type { SessionRecord } from '../storage/session-history';
  import { useLocalization } from '../i18n/context';

  const i18n = useLocalization();
  const { text } = i18n;
  let { bindings, keyboard, oncomplete, onrunning, onexit }: {
    bindings: readonly KeyboardLayerBinding[];
    keyboard: KeyboardSnapshot;
    oncomplete: (record: SessionRecord) => void;
    onrunning: (running: boolean) => void;
    onexit: () => void;
  } = $props();
  let prompts = $state<KeyboardLayerBinding[]>([]);
  let index = $state(0);
  let running = $state(false);
  let focused = $state(false);
  let startedAt = 0;
  let attempts = 0;
  let correct = 0;
  let misses: Record<string, number> = {};
  let outputAttempts: Record<string, number> = {};
  let heldOutput = $state('');
  let resultMessage = $state('');
  let commandRegion = $state<HTMLButtonElement>();
  const current = $derived(prompts[index]);

  async function start() {
    if (!bindings.length || running) return;
    prompts = Array.from({ length: COMMAND_DRILL_LENGTH }, (_, position) => bindings[position % bindings.length]);
    index = 0;
    attempts = 0;
    correct = 0;
    misses = {};
    outputAttempts = {};
    resultMessage = '';
    heldOutput = '';
    startedAt = Date.now();
    running = true;
    onrunning(true);
    await tick();
    commandRegion?.focus();
  }

  function finish(save: boolean) {
    if (!running) return;
    const completedAt = Date.now();
    running = false;
    focused = false;
    heldOutput = '';
    onrunning(false);
    if (save && attempts > 0) {
      oncomplete(commandRecord(keyboard, prompts, { attempts, correct, misses, outputAttempts }, i18n.language, startedAt, completedAt));
      resultMessage = text('boards.command-complete', { correct: String(correct), attempts: String(attempts) });
    } else {
      resultMessage = text('boards.command-stopped');
    }
  }

  function keydown(event: KeyboardEvent) {
    if (!running || !focused) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      finish(false);
      onexit();
      return;
    }
    if (event.repeat || !isCommandOutputCode(event.code)) return;
    const expected = current;
    if (!expected) return;
    const matches = commandMatches(expected, event);
    if (matches) event.preventDefault();
    attempts += 1;
    outputAttempts[event.code] = (outputAttempts[event.code] ?? 0) + 1;
    if (matches) correct += 1;
    else misses[event.code] = (misses[event.code] ?? 0) + 1;
    heldOutput = event.code;
    if (index + 1 >= prompts.length) finish(true);
    else index += 1;
  }

  function keyup(event: KeyboardEvent) {
    if (event.code === heldOutput) heldOutput = '';
  }
</script>

<section class="command-practice" aria-labelledby="command-practice-heading">
  <h3 id="command-practice-heading">{text('boards.command-heading')}</h3>
  <p>{text('boards.command-help')}</p>
  {#if !bindings.length}
    <p class="empty-state">{text('boards.command-no-bindings')}</p>
  {:else}
    <button class="primary-button" type="button" disabled={running} onclick={start}>{text('boards.command-start')}</button>
  {/if}
  {#if running && current}
    <button
      bind:this={commandRegion}
      class="command-capture"
      type="button"
      aria-label={text('boards.command-focus')}
      onfocus={() => { focused = true; }}
      onblur={() => { focused = false; heldOutput = ''; }}
      onkeydown={keydown}
      onkeyup={keyup}
    >
      <span>{text('boards.command-progress', { current: String(index + 1), total: String(prompts.length) })}</span>
      <strong>{current.holdCue}</strong>
      <span>{text('boards.command-expect', { code: current.outputCode })}</span>
      {#if heldOutput}<span class="held-key">{heldOutput}</span>{/if}
      <span>{text(focused ? 'boards.command-focused' : 'boards.command-unfocused')}</span>
    </button>
    <button class="secondary-button" type="button" onclick={() => { finish(false); onexit(); }}>{text('boards.command-stop')}</button>
  {/if}
  {#if resultMessage}<p role="status">{resultMessage}</p>{/if}
  <p class="observability-note">{text('boards.command-observability')}</p>
</section>

<style>
  .command-practice { display: grid; gap: 0.65rem; }
  .command-practice h3, .command-practice p { margin: 0; }
  .command-capture {
    display: grid; gap: 0.65rem; min-height: 8rem; padding: 1rem;
    border: 2px solid var(--color-accent); border-radius: 0.75rem;
    background: rgb(0 0 0 / 18%); color: inherit; cursor: crosshair; font: inherit; text-align: start;
  }
  .command-capture:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 3px; }
  .command-capture strong { font-size: 1.3rem; }
  .held-key { width: fit-content; padding: 0.25rem 0.5rem; border-radius: 0.35rem; background: var(--color-accent); color: var(--color-background); }
  .observability-note { color: #b8b8b8; font-size: 0.9rem; }
</style>
