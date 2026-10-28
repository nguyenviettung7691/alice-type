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
        freestyleMessage = "That key isn't part of this layout, so it wasn't counted.";
      } else {
        testState = next;
        freestyleMessage = `${key.legend} was pressed ${plural(testKeyCount(next, key.code), 'time', 'times')}.`;
      }
    } else if (next === testState) {
      errorCode = event.code;
      errorMessage = "That wasn't the highlighted key.";
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
  <p class="eyebrow">Keyboard check</p>
  <h2 id="keyboard-test-heading" tabindex="-1">Keyboard Test</h2>
  <p class="panel-copy panel-intro">
    Check your keys one at a time or in any order. This test checks key positions and never changes your practice scores or Stats.
  </p>
  <div class="test-modes" role="group" aria-labelledby="keyboard-test-mode-label">
    <p id="keyboard-test-mode-label" class="mode-label">Choose a test style</p>
    <div class="mode-buttons">
      {#each KEYBOARD_TEST_MODES as option}
        <button type="button" aria-pressed={option.id === mode} class:selected={option.id === mode}
          onclick={() => selectMode(option.id)}>{option.label}</button>
      {/each}
    </div>
    <p class="mode-note">
      {#if freestyle}
        Press any mapped key, in any order. The diagram counts each press.
      {:else}
        Press the highlighted key to check each key in order.
      {/if}
      Changing modes clears this test.
    </p>
  </div>
  <p id="keyboard-test-instructions" class="panel-copy">
    {#if freestyle}
      Focus the test area, then press any mapped key as often as you like. Keys are matched by position, not by the character they type.
      Tab is counted; press Shift+Tab to leave. {captureEscape ? 'Escape is counted too.' : 'Escape also leaves the test.'}
      Browser shortcuts and some system keys can't be tested.
    {:else}
      Focus the test area, then press the highlighted key. The test checks key position, not the character it types.
      If Tab is highlighted, press it to test it; otherwise Tab moves focus out of the test. Shift+Tab also leaves.
      {captureEscape ? 'Escape can be tested when highlighted.' : 'Escape also leaves the test.'}
      Browser shortcuts and some system keys can't be tested.
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
    <p class="test-focus-note">{focused ? 'Ready for key presses' : 'Click here or choose “Focus keyboard test” to begin.'}</p>
    {#if freestyle}
      <p class="test-progress">{testedCount} of {testSequence.length} keys tried · {plural(totalPresses, 'key press', 'key presses')}</p>
    {:else}
      <p class="test-progress">{testedCount} of {testSequence.length} keys checked</p>
    {/if}
    <progress aria-label="Keyboard test progress" value={testedCount} max={testSequence.length}></progress>
    <p class="test-status" role="status" aria-live="polite" aria-atomic="true">
      {#if freestyle}
        {switchMessage || freestyleMessage || 'Press any mapped key to count it.'}
        {#if testedCount === testSequence.length}All mapped keys have been pressed at least once. Keep going—the count continues.{/if}
      {:else if expected}
        {switchMessage} {errorMessage} Press the highlighted key: <strong>{expected.legend}</strong>
        <span>Physical key: {expected.code}</span>
      {:else}
        Test complete. All keys checked. Choose Restart test to go again.
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
    <p>Sound is off by default. When on, it plays with each detected keypress. Changing the effect plays a short preview.
      This won't change your typing sound in Practice.</p>
  </fieldset>
  {#if audioError}
    <div class="notice" role="alert">
      <p>{audioError} Test sound has been turned off. Turn it back on to try again.</p>
      <button class="secondary-button" type="button" onclick={() => { audioError = ''; }}>Dismiss warning</button>
    </div>
  {/if}
  <button class="secondary-button" type="button" onclick={restart}>Restart test</button>
  <p class="panel-copy">Counts and highlights are temporary; restart or switch modes to clear them.</p>
</section>

<style>
  .test-input {
    margin-block: 1.5rem;
    border: 1px solid rgb(255 255 255 / 12%);
    border-radius: 0.6rem;
    padding: 1rem;
    background: rgb(0 0 0 / 12%);
    overflow-wrap: anywhere;
  }
  .test-input:focus { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  .test-focus-note { margin-top: 0; color: #b8b8b8; font-size: 0.85rem; }
  .test-progress { margin-bottom: 0.55rem; font-variant-numeric: tabular-nums; }
  .test-status { min-height: 3rem; line-height: 1.7; }
  .test-status strong { color: var(--color-accent); }
  .test-status span { font-size: 0.85rem; }
  .effect-control { display: flex; flex-wrap: wrap; align-items: center; gap: 0.7rem; }
  .effect-control label { margin: 0; }
  .panel-intro { max-width: 46rem; margin-block: -0.5rem 1.4rem; }
  .test-modes { margin-block: 1rem 1.25rem; }
  .mode-label { margin: 0 0 0.65rem; color: #b8b8b8; font-size: 0.78rem; font-weight: 600; }
  .mode-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
    max-width: 34rem;
    gap: 0.55rem;
  }
  .mode-buttons button {
    min-height: 2.8rem;
    border: 1px solid rgb(255 255 255 / 16%);
    border-radius: 0.65rem;
    padding: 0.65rem 0.85rem;
    color: var(--color-text);
    background: rgb(0 0 0 / 12%);
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
  }
  .mode-buttons button:hover:not(.selected) { border-color: rgb(255 255 255 / 35%); background: rgb(255 255 255 / 4%); }
  .mode-buttons button.selected {
    border-color: var(--color-accent);
    background: rgb(255 93 0 / 12%);
    color: var(--color-accent);
    font-weight: 650;
  }
  .mode-note { max-width: 44rem; margin: 0.7rem 0 0; color: #b8b8b8; font-size: 0.84rem; line-height: 1.6; }
  progress { display: block; width: 100%; height: 0.6rem; accent-color: var(--color-accent); }
  progress::-webkit-progress-bar { background: var(--color-background); border-radius: 0.4rem; }
  progress::-webkit-progress-value { background: var(--color-accent); border-radius: 0.4rem; }
</style>
