<script lang="ts">
  import { onDestroy } from 'svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import { ALICE_LAYOUT, ALICE_VIEW_BOX, type AliceKey, type InertKey } from '../keyboard/alice-layout';
  import {
    classifyTestKey, createKeyboardTest, expectedTestKey, KEYBOARD_TEST_MODES, pressTestKey, testedKeyCount, testKeyCount,
    type KeyboardTestMode
  } from '../keyboard/keyboard-test';
  import {
    KEYBOARD_TEST_EFFECTS, KeyboardTestSound, KeyboardTestSoundError, type KeyboardTestEffect
  } from '../audio/keyboard-test-sound';

  let { soundEnabled, soundEffect, onsoundchange, onaudiofailure, testLayout = ALICE_LAYOUT, testLayoutLabel = 'Generic Alice', browserLegends = false,
    testSequence = testLayout, inertKeys = [], viewBox = ALICE_VIEW_BOX, confirmed = false }: {
    soundEnabled: boolean;
    soundEffect: KeyboardTestEffect;
    onsoundchange: (enabled: boolean, effect: KeyboardTestEffect) => void;
    onaudiofailure: () => void;
    testLayout?: readonly AliceKey[];
    testLayoutLabel?: string;
    browserLegends?: boolean;
    testSequence?: readonly AliceKey[];
    inertKeys?: readonly InertKey[];
    viewBox?: string;
    confirmed?: boolean;
  } = $props();

  let mode = $state<KeyboardTestMode>('guided');
  let testState = $state(createKeyboardTest('guided'));
  let errorCode = $state<string>();
  let errorMessage = $state('');
  let freestyleMessage = $state('');
  let switchMessage = $state('');
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
  const expected = $derived(expectedTestKey(testState, testSequence));
  const freestyle = $derived(testState.mode === 'freestyle');
  const captureEscape = $derived(testSequence.some((key) => key.code === 'Escape'));
  const modeLabel = $derived(KEYBOARD_TEST_MODES.find((option) => option.id === mode)?.label ?? '');
  const testedCount = $derived(testedKeyCount(testState, testSequence));
  const totalPresses = $derived(testState.mode === 'freestyle' ? testState.totalPresses : 0);

  function plural(value: number, singular: string, pluralWord: string) {
    return `${value} ${value === 1 ? singular : pluralWord}`;
  }

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
    const action = classifyTestKey(
      event,
      freestyle || expected?.code === 'Tab',
      captureEscape && (freestyle || expected !== undefined)
    );
    if (action === 'exit') { focusButton.focus(); return; }
    if (action === 'ignore') return;
    const mappedFunctionKey = /^F\d+$/.test(event.code)
      && testSequence.some((key) => key.code === event.code);
    if (mappedFunctionKey) event.preventDefault();
    if ((!freestyle && !expected) || heldCodes.has(event.code)) return;
    heldCodes.add(event.code);
    if (['Tab', 'Space', 'Backspace', 'Escape'].includes(event.code)) event.preventDefault();
    clearError();
    switchMessage = '';
    const next = pressTestKey(testState, event.code, testSequence);
    if (freestyle) {
      const key = testSequence.find((candidate) => candidate.code === event.code);
      if (next === testState || !key) {
        freestyleMessage = `Last key: ${event.code || 'unknown physical code'} is not counted on this layout.`;
      } else {
        testState = next;
        freestyleMessage = `Last key: ${key.legend} (${key.code}), pressed ${plural(testKeyCount(next, key.code), 'time', 'times')}.`;
      }
    } else if (next === testState) {
      errorCode = event.code;
      errorMessage = `Unexpected key: ${event.code || 'unknown physical code'}.`;
      errorTimer = setTimeout(clearError, 600);
    } else {
      testState = next;
    }
    play();
  }

  function resetRun(nextMode: KeyboardTestMode) {
    releaseFocus();
    mode = nextMode;
    freestyleMessage = '';
    switchMessage = '';
    testState = createKeyboardTest(nextMode);
  }

  function restart() {
    resetRun(mode);
    region.focus();
  }

  function selectMode(nextMode: KeyboardTestMode) {
    if (nextMode === mode) return;
    resetRun(nextMode);
    switchMessage = `Switched to ${KEYBOARD_TEST_MODES.find((option) => option.id === nextMode)?.label}. Test reset.`;
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
  <p class="eyebrow">{modeLabel}</p>
  <h2 id="keyboard-test-heading" tabindex="-1">Keyboard Test</h2>
  <div class="test-modes" role="group" aria-labelledby="keyboard-test-mode-label">
    <p id="keyboard-test-mode-label" class="mode-label">Test mode</p>
    <div class="mode-buttons">
      {#each KEYBOARD_TEST_MODES as option}
        <button type="button" aria-pressed={option.id === mode} class:selected={option.id === mode}
          onclick={() => selectMode(option.id)}>{option.label}</button>
      {/each}
    </div>
    <p class="mode-note">Switching modes resets the test matrix.</p>
  </div>
  <p id="keyboard-test-instructions" class="panel-copy">
    {#if freestyle}
      Focus the test area, then press any physical keys in any order, as often as you like. Each key shows how many
      times it was pressed. Match positions, not typed characters. Tab is counted here. {captureEscape
        ? 'Escape is counted on this layout; press Shift+Tab to leave.'
        : 'Press Escape or Shift+Tab to leave.'}
      Modified browser shortcuts are not captured. Some system keys may not reach the browser.
    {:else}
      Focus the test area, then press and release each expected physical key. Match positions, not typed characters.
      Press Tab to leave (except when testing Tab) and Shift+Tab to go back or leave.
      {captureEscape ? 'Escape is testable on this layout.' : 'Escape also leaves the test.'}
      Modified browser shortcuts are not captured. Some system keys may not reach the browser.
    {/if}
  </p>
  <button bind:this={focusButton} class="secondary-button" type="button" onclick={() => region.focus()}>
    Focus keyboard test
  </button>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (A physical-key test needs an explicitly focusable region; Shift+Tab always leaves.) -->
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
    {#if freestyle}
      <p class="test-progress">{testedCount} of {testSequence.length} keys pressed · {plural(totalPresses, 'total press', 'total presses')}</p>
    {:else}
      <p class="test-progress">{testedCount} of {testSequence.length} keys tested</p>
    {/if}
    <progress aria-label="Keyboard test progress" value={testedCount} max={testSequence.length}></progress>
    <p class="test-status" role="status" aria-live="polite" aria-atomic="true">
      {#if freestyle}
        {switchMessage || freestyleMessage || 'Press any key on the diagram.'}
        {#if testedCount === testSequence.length}Every mapped key has been pressed at least once.{/if}
      {:else if expected}
        {switchMessage} {errorMessage} Expected: <strong>{expected.legend}</strong> <span>({expected.code})</span>
      {:else}
        Test complete. Every mapped key was correctly pressed. Restart to test again.
      {/if}
    </p>
  </div>

  <AliceKeyboardVisualizer layout={testLayout} {testState} {errorCode} {testLayoutLabel} {browserLegends}
    {testSequence} {inertKeys} {viewBox} layoutSource={confirmed ? 'confirmed' : 'generic'} />

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
  <p class="panel-copy">Counts and highlights are temporary and reset when you restart or switch modes.
    This test never changes practice scores or Stats.</p>
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
  .test-modes { margin-block: 1rem; }
  .mode-label { margin: 0 0 0.65rem; color: #b8b8b8; font-size: 0.78rem; font-weight: 600; }
  .mode-buttons {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    padding: 0.3rem;
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 0.75rem;
    background: rgb(0 0 0 / 15%);
  }
  .mode-buttons button {
    border: 1px solid transparent;
    border-radius: 0.5rem;
    padding: 0.65rem 1rem;
    color: var(--color-text);
    background: transparent;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .mode-buttons button.selected {
    border-color: var(--color-accent);
    color: var(--color-background);
    background: var(--color-accent);
    font-weight: 650;
  }
  .mode-note { margin: 0.5rem 0 0; color: #b8b8b8; font-size: 0.8rem; }
  progress { display: block; width: 100%; height: 0.6rem; accent-color: var(--color-accent); }
  progress::-webkit-progress-bar { background: var(--color-background); border-radius: 0.4rem; }
  progress::-webkit-progress-value { background: var(--color-accent); border-radius: 0.4rem; }
</style>
