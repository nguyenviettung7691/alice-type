<script lang="ts">
  import { onDestroy } from 'svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import { ALICE_LAYOUT, type AliceKey } from '../keyboard/alice-layout';
  import { classifyTestKey, createKeyboardTest, expectedTestKey, pressTestKey } from '../keyboard/keyboard-test';
  import {
    KEYBOARD_TEST_EFFECTS, KeyboardTestSound, KeyboardTestSoundError, type KeyboardTestEffect
  } from '../audio/keyboard-test-sound';

  let { soundEnabled, soundEffect, onsoundchange, onaudiofailure, testLayout = ALICE_LAYOUT, testLayoutLabel = 'Generic Alice' }: {
    soundEnabled: boolean;
    soundEffect: KeyboardTestEffect;
    onsoundchange: (enabled: boolean, effect: KeyboardTestEffect) => void;
    onaudiofailure: () => void;
    testLayout?: readonly AliceKey[];
    testLayoutLabel?: string;
  } = $props();

  let testState = $state(createKeyboardTest());
  let errorCode = $state<string>();
  let errorMessage = $state('');
  let audioError = $state('');
  let focused = $state(false);
  let composing = false;
  let region: HTMLDivElement;
  let focusButton: HTMLButtonElement;
  let errorTimer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  let playbackGeneration = 0;
  const heldCodes = new Set<string>();
  const sound = new KeyboardTestSound();
  const expected = $derived(expectedTestKey(testState, testLayout));

  function clearError() {
    clearTimeout(errorTimer);
    errorTimer = undefined;
    errorCode = undefined;
    errorMessage = '';
  }

  function stopSound() {
    playbackGeneration += 1;
    sound.stop();
  }

  function play(effect = soundEffect) {
    if (!soundEnabled) return;
    const generation = playbackGeneration;
    void sound.play(effect).catch((error: unknown) => {
      if (!(error instanceof KeyboardTestSoundError)) throw error;
      if (!alive || generation !== playbackGeneration) return;
      stopSound();
      audioError = error.message;
      onaudiofailure();
    });
  }

  function releaseFocus() {
    focused = false;
    composing = false;
    heldCodes.clear();
    clearError();
    stopSound();
  }

  function keydown(event: KeyboardEvent) {
    if (event.target !== region || document.activeElement !== region || composing) return;
    const action = classifyTestKey(event, expected?.code ?? '');
    if (action === 'exit') { focusButton.focus(); return; }
    if (!expected || action === 'ignore' || heldCodes.has(event.code)) return;
    heldCodes.add(event.code);
    if (['Tab', 'Space', 'Backspace'].includes(event.code)) event.preventDefault();
    clearError();
    const next = pressTestKey(testState, event.code, testLayout);
    if (next === testState) {
      errorCode = event.code;
      errorMessage = `Unexpected key: ${event.code || 'unknown physical code'}.`;
      errorTimer = setTimeout(clearError, 600);
    } else {
      testState = next;
    }
    play();
  }

  function restart() {
    releaseFocus();
    testState = createKeyboardTest();
    region.focus();
  }

  onDestroy(() => {
    alive = false;
    clearError();
    playbackGeneration += 1;
    void sound.close().catch((error: unknown) => {
      console.error('Keyboard test audio cleanup failed.', error);
    });
  });
</script>

<svelte:window onblur={releaseFocus} onfocus={() => { focused = document.activeElement === region; }} />

<section class="practice-panel settings-panel keyboard-test-panel" aria-labelledby="keyboard-test-heading">
  <p class="eyebrow">One key at a time</p>
  <h2 id="keyboard-test-heading" tabindex="-1">Keyboard Test</h2>
  <p id="keyboard-test-instructions" class="panel-copy">
    Focus the test area, then press and release each expected physical key. Match positions, not typed characters.
    Press Tab to leave (except when testing Tab), Shift+Tab to go back, or Escape to leave at any time.
    Browser shortcuts are not captured. Some system keys may not reach the browser.
  </p>
  <button bind:this={focusButton} class="secondary-button" type="button" onclick={() => region.focus()}>
    Focus keyboard test
  </button>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (A physical-key test needs an explicitly focusable region; Escape and Shift+Tab always leave.) -->
  <div
    bind:this={region}
    class="test-input"
    role="region"
    aria-label="Keyboard test input"
    aria-describedby="keyboard-test-instructions"
    tabindex="0"
    onkeydown={keydown}
    onkeyup={(event) => heldCodes.delete(event.code)}
    onfocus={() => { focused = true; }}
    onblur={releaseFocus}
    onpointerdown={() => region.focus()}
    oncompositionstart={() => { composing = true; heldCodes.clear(); }}
    oncompositionend={() => { composing = false; }}
  >
    <p class="test-focus-note">{focused ? 'Listening for physical keys' : 'Focus this area to test your keyboard'}</p>
    <p class="test-progress">{testState.expectedIndex} of {testLayout.length} keys tested</p>
    <progress aria-label="Keyboard test progress" value={testState.expectedIndex} max={testLayout.length}></progress>
    <p class="test-status" role="status" aria-live="polite" aria-atomic="true">
      {#if expected}
        {errorMessage} Expected: <strong>{expected.legend}</strong> <span>({expected.code})</span>
      {:else}
        Test complete. Every mapped key was correctly pressed. Restart to test again.
      {/if}
    </p>
  </div>

  <AliceKeyboardVisualizer layout={testLayout} {testState} {errorCode} {testLayoutLabel} />

  <fieldset>
    <legend>Test sound</legend>
    <label><input type="checkbox" checked={soundEnabled} onchange={(event) => {
      stopSound();
      audioError = '';
      onsoundchange(event.currentTarget.checked, soundEffect);
    }} /> Keyboard test sound</label>
    <div class="effect-control">
      <label for="keyboard-test-effect">Test sound effect</label>
      <select id="keyboard-test-effect" value={soundEffect} onchange={(event) => {
        const effect = KEYBOARD_TEST_EFFECTS.find((effect) => effect.id === event.currentTarget.value);
        if (!effect) throw new Error('Unsupported keyboard test sound selection.');
        stopSound();
        onsoundchange(soundEnabled, effect.id);
        play(effect.id);
      }}>
        {#each KEYBOARD_TEST_EFFECTS as effect}<option value={effect.id}>{effect.label}</option>{/each}
      </select>
    </div>
    <p>Original synthesized effects, off by default. Changing an effect previews it only when enabled.
      This does not change your practice typing sound.</p>
  </fieldset>
  {#if audioError}
    <div class="notice" role="alert">
      <p>{audioError} Test sound is off for this visit. Enable it again to retry.</p>
      <button class="secondary-button" type="button" onclick={() => { audioError = ''; }}>Dismiss test sound warning</button>
    </div>
  {/if}
  <button class="primary-button" type="button" onclick={restart}>Restart test</button>
  <p class="panel-copy">Counts and highlights are temporary. This test never changes practice scores or Stats.</p>
</section>

<style>
  .test-input {
    margin-block: 1.5rem;
    border: 1px solid var(--color-muted);
    border-radius: 0.6rem;
    padding: 1rem;
    overflow-wrap: anywhere;
  }
  .test-input:focus { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  .test-focus-note { margin-top: 0; color: #b8b8b8; font-size: 0.85rem; }
  .test-progress { font-variant-numeric: tabular-nums; }
  .test-status { min-height: 3rem; line-height: 1.7; }
  .test-status strong { color: var(--color-accent); }
  .test-status span { font-size: 0.85rem; }
  .effect-control { display: flex; flex-wrap: wrap; align-items: center; gap: 0.7rem; }
  .effect-control label { margin: 0; }
  progress { display: block; width: 100%; height: 0.6rem; accent-color: var(--color-accent); }
  progress::-webkit-progress-bar { background: var(--color-background); border-radius: 0.4rem; }
  progress::-webkit-progress-value { background: var(--color-accent); border-radius: 0.4rem; }
</style>
