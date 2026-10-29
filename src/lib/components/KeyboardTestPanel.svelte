<script lang="ts">
  import { onDestroy } from 'svelte';
  import { useLocalization } from '../i18n/context';
  import { keyPressMessage, testProgressMessage, testModeMessage, testModeLabel, testEffectLabel, TOOL_MESSAGES } from '../i18n/tool-messages';
  const localization = useLocalization();
  const { text } = localization;
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
  let freestyleMessage = $state<(() => string) | null>(null);
  let switchMessage = $state<KeyboardTestMode | null>(null);
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
    switchMessage = null;
    const next = pressTestKey(testState, event.code, testSequence);
    if (freestyle) {
      const key = testSequence.find((candidate) => candidate.code === event.code);
      if (next === testState || !key) {
        freestyleMessage = () => text("keyboard-test-panel.that-key-isn-t-part-of-this");
      } else {
        testState = next;
        freestyleMessage = () => keyPressMessage(localization.language, key.legend, testKeyCount(next, key.code));
      }
    } else if (next === testState) {
      errorCode = event.code;
      errorMessage = 'unexpected';
      errorTimer = setTimeout(clearError, 600);
    } else {
      testState = next;
    }
    play();
  }

  function resetRun(nextMode: KeyboardTestMode) {
    releaseFocus();
    mode = nextMode;
    freestyleMessage = null;
    switchMessage = null;
    testState = createKeyboardTest(nextMode);
  }

  function restart() {
    resetRun(mode);
    region.focus();
  }

  function selectMode(nextMode: KeyboardTestMode) {
    if (nextMode === mode) return;
    resetRun(nextMode);
    switchMessage = nextMode;
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
  <p class="eyebrow">{text("keyboard-test-panel.keyboard-check")}</p>
  <h2 id="keyboard-test-heading" tabindex="-1">{text("keyboard-test-panel.keyboard-test")}</h2>
  <p class="panel-copy panel-intro">
    {text(TOOL_MESSAGES.testIntro)}
  </p>
  <div class="test-modes" role="group" aria-labelledby="keyboard-test-mode-label">
    <p id="keyboard-test-mode-label" class="mode-label">{text("keyboard-test-panel.choose-a-test-style")}</p>
    <div class="mode-buttons">
      {#each KEYBOARD_TEST_MODES as option}
        <button type="button" aria-pressed={option.id === mode} class:selected={option.id === mode}
          onclick={() => selectMode(option.id)}>{testModeLabel(localization.language, option.id)}</button>
      {/each}
    </div>
    <p class="mode-note">
      {#if freestyle}
        {text("keyboard-test-panel.press-any-mapped-key-in-any-order")}
      {:else}
        {text("keyboard-test-panel.press-the-highlighted-key-to-check-each")}
      {/if}
      {text("keyboard-test-panel.changing-modes-clears-this-test")}
    </p>
  </div>
  <p id="keyboard-test-instructions" class="panel-copy">
    {#if freestyle}
      {text(TOOL_MESSAGES.freestyleInstructions)}
      {text("keyboard-test-panel.tab-is-counted-press-shift-tab-to")} {captureEscape ? text("keyboard-test-panel.escape-is-counted-too") : text("keyboard-test-panel.escape-also-leaves-the-test")}
      {text("keyboard-test-panel.browser-shortcuts-and-some-system-keys-can")}
    {:else}
      {text(TOOL_MESSAGES.guidedInstructions)}
      {text(TOOL_MESSAGES.guidedTab)}
      {captureEscape ? text("keyboard-test-panel.escape-can-be-tested-when-highlighted") : text("keyboard-test-panel.escape-also-leaves-the-test")}
      {text("keyboard-test-panel.browser-shortcuts-and-some-system-keys-can")}
    {/if}
  </p>
  <button bind:this={focusButton} class="secondary-button" type="button" onclick={() => region.focus()}>
    {text("keyboard-test-panel.focus-keyboard-test")}
  </button>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (A physical-key test needs an explicitly focusable region; Shift+Tab always leaves.) -->
  <div
    bind:this={region}
    class="test-input"
    role="region"
    aria-label={text("keyboard-test-panel.keyboard-test-input")}
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
    <p class="test-focus-note">{focused ? text("keyboard-test-panel.ready-for-key-presses") : text("keyboard-test-panel.click-here-or-choose-focus-keyboard-test")}</p>
    {#if freestyle}
      <p class="test-progress">{testProgressMessage(localization.language, testedCount, testSequence.length, totalPresses)}</p>
    {:else}
      <p class="test-progress">{testProgressMessage(localization.language, testedCount, testSequence.length)}</p>
    {/if}
    <progress aria-label={text("keyboard-test-panel.keyboard-test-progress")} value={testedCount} max={testSequence.length}></progress>
    <p class="test-status" role="status" aria-live="polite" aria-atomic="true">
      {#if freestyle}
        {switchMessage ? testModeMessage(localization.language, switchMessage) : freestyleMessage?.() || text("keyboard-test-panel.press-any-mapped-key-to-count-it")}
        {#if testedCount === testSequence.length}{text("keyboard-test-panel.all-mapped-keys-have-been-pressed-at")}{/if}
      {:else if expected}
        {switchMessage ? testModeMessage(localization.language, switchMessage) : ''} {errorMessage ? text("keyboard-test-panel.that-wasn-t-the-highlighted-key") : ''} {text("keyboard-test-panel.press-the-highlighted-key")} <strong>{expected.legend}</strong>
        <span>{text("keyboard-test-panel.physical-key")} {expected.code}</span>
      {:else}
        {text("keyboard-test-panel.test-complete-all-keys-checked-choose-restart")}
      {/if}
    </p>
  </div>

  <AliceKeyboardVisualizer layout={testLayout} {testState} {errorCode} {testLayoutLabel} {browserLegends}
    {testSequence} {inertKeys} {viewBox} layoutSource={confirmed ? 'confirmed' : 'generic'} />

  <fieldset>
    <legend>{text("keyboard-test-panel.test-sound")}</legend>
    <label><input type="checkbox" checked={soundEnabled} onchange={(event) => {
      stopSound();
      audioError = '';
      onsoundchange(event.currentTarget.checked, soundEffect);
    }} /> {text("keyboard-test-panel.keyboard-test-sound")}</label>
    <div class="effect-control">
      <label for="keyboard-test-effect">{text("keyboard-test-panel.test-sound-effect")}</label>
      <select id="keyboard-test-effect" value={soundEffect} onchange={(event) => {
        const effect = KEYBOARD_TEST_EFFECTS.find((effect) => effect.id === event.currentTarget.value);
        if (!effect) throw new Error('Unsupported keyboard test sound selection.');
        stopSound();
        onsoundchange(soundEnabled, effect.id);
        play(effect.id);
      }}>
        {#each KEYBOARD_TEST_EFFECTS as effect}<option value={effect.id}>{testEffectLabel(localization.language, effect.id)}</option>{/each}
      </select>
    </div>
    <p>{text(TOOL_MESSAGES.soundHelp)}</p>
  </fieldset>
  {#if audioError}
    <div class="notice" role="alert">
      <p>{text("keyboard-test-panel.test-sound-has-been-turned-off-turn", { p0: String(audioError) })}</p>
      <button class="secondary-button" type="button" onclick={() => { audioError = ''; }}>{text("keyboard-test-panel.dismiss-warning")}</button>
    </div>
  {/if}
  <button class="secondary-button" type="button" onclick={restart}>{text("keyboard-test-panel.restart-test")}</button>
  <p class="panel-copy">{text("keyboard-test-panel.counts-and-highlights-are-temporary-restart-or")}</p>
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
