<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import ModeNavigation from './ModeNavigation.svelte';
  import { ALICE_LAYOUT, ALICE_VIEW_BOX, type AliceKey, type InertKey, type KeyFeedback } from '../keyboard/alice-layout';
  import {
    applyAction,
    createSession,
    expireSession,
    extendTarget,
    getMetrics,
    getProgress,
    getTypingAction,
    createZenSession, isZenSession, stopSession, getWritingWindow,
    type PracticeSession
  } from '../typing/typing-engine';
  import {
    DEFAULT_SETTINGS, DURATIONS, WORD_LIMITS, WORD_BANK_TIERS,
    ExerciseGenerationError, generateExercise, getConfiguration,
    type PracticeSettings
  } from '../typing/exercise-generator';
  import { CARET_STYLES, type CaretStyle } from '../storage/preferences';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  import { completedRecord, type SessionRecord } from '../storage/session-history';
  import { prepareCustomText } from '../typing/custom-text';
  import { selectQuote, type Quote } from '../typing/quote-catalog';

  let {
    settings = $bindable({ ...DEFAULT_SETTINGS }), running = $bindable(false),
    caretStyle = 'block', showLiveStats = true, soundEnabled = false,
    onsettingschange, oncaretchange, onlivestatschange, onsoundchange, onreset, oncharacter, oncomplete,
    layout = ALICE_LAYOUT, layoutLabel = 'Generic Alice', browserLegends = false,
    inertKeys = [], viewBox = ALICE_VIEW_BOX, layoutConfirmed = false,
    active = true, contentReset = 0
  }: {
    settings?: PracticeSettings;
    running?: boolean;
    caretStyle?: CaretStyle;
    showLiveStats?: boolean;
    soundEnabled?: boolean;
    onsettingschange?: (settings: PracticeSettings) => void;
    oncaretchange?: (caretStyle: CaretStyle) => void;
    onlivestatschange?: (showLiveStats: boolean) => void;
    onsoundchange?: (soundEnabled: boolean) => void;
    onreset?: () => void;
    oncharacter?: () => void;
    oncomplete?: (record: SessionRecord) => void;
    layout?: readonly AliceKey[];
    layoutLabel?: string;
    browserLegends?: boolean;
    inertKeys?: readonly InertKey[];
    viewBox?: string;
    layoutConfirmed?: boolean;
    active?: boolean;
    contentReset?: number;
  } = $props();

  let sessionId = '';
  let startedWallTime = 0;
  let submitted = false;
  let missedKeys: Record<string, number> = {};
  let session = $state.raw<PracticeSession | null>(null);
  let quote = $state<Quote | null>(null);
  let draft = $state('');
  let customTarget = $state('');
  let editing = $state(true);
  let normalized = $state(false);
  let customError = $state('');
  let resultHeading = $state<HTMLHeadingElement>();
  let confirmingReset = $state(false);
  const customPreparation = $derived.by(() => {
    try { return { value: prepareCustomText(draft), error: '' }; }
    catch (error) {
      if (!(error instanceof ExerciseGenerationError)) throw error;
      return { value: null, error: error.message };
    }
  });
  let exerciseError = $state('');
  let now = $state(0);
  let inputElement = $state<HTMLInputElement>();
  let targetElement = $state<HTMLLabelElement>();
  let focused = $state(false);
  let composing = false;
  let feedback = $state<KeyFeedback>({});
  const feedbackTimers = new Map<string, number>();
  const metrics = $derived(session && (!isZenSession(session) || session.status === 'completed') ? getMetrics(session, now) : null);
  const progress = $derived(session ? getProgress(session, now) : null);
  const timed = $derived(settings.mode === 'timed');
  const zen = $derived(settings.mode === 'zen');
  const finiteSession = $derived(session && !isZenSession(session) ? session : null);
  const writing = $derived(session && isZenSession(session) ? getWritingWindow(session) : '');
  const modeLabel = $derived(({ timed: 'Timed', words: 'Word', quote: 'Quote', custom: 'Custom text', zen: 'Zen' })[settings.mode]);
  const layoutCodes = $derived(new Set(layout.map((key) => key.code)));
  const statusMessage = $derived(
    !session
      ? 'Paste your text and choose Apply text to get started.'
      : session.status === 'ready'
      ? 'Press Start typing, or just begin typing, when you are ready.'
      : session?.status === 'completed'
        ? `Session complete. ${{ timed: 'Time is up.', words: 'Word limit reached.', quote: 'Quote complete.', custom: 'Custom text complete.', zen: 'Zen stopped.' }[settings.mode]} Choose Restart to practice again.`
        : 'You are typing. Use Backspace to fix mistakes.'
  );

  $effect(() => {
    const selected = settings;
    untrack(() => {
      if (selected.mode === 'quote') quote = null;
      prepareExercise(selected);
    });
  });

  $effect(() => {
    const reset = contentReset;
    const visible = active;
    untrack(() => {
      if (!visible || reset !== previousReset) {
        previousReset = reset;
        draft = '';
        customTarget = '';
        normalized = false;
        editing = true;
        customError = '';
        focused = false;
        composing = false;
        clearFeedback();
        if (settings.mode === 'custom' || settings.mode === 'zen') session = null;
      } else if (!session && settings.mode === 'zen') prepareExercise(settings);
    });
  });
  let previousReset = 0;

  $effect(() => {
    running = active && session?.status === 'running' && !exerciseError;
  });

  $effect(() => {
    if (!running || zen) return;
    const interval = window.setInterval(() => {
      now = performance.now();
      if (session && !isZenSession(session)) session = expireSession(session, now);
      if (session?.status === 'completed') complete();
    }, 100);

    return () => window.clearInterval(interval);
  });

  $effect(() => {
    const position = finiteSession?.input.length;
    const recentWriting = writing;
    const element = targetElement;
    untrack(() => {
      if (!element) return;
      if (zen) {
        if (recentWriting) element.scrollTop = element.scrollHeight;
        return;
      }
      if (!position) {
        element.scrollTop = 0;
        return;
      }
      const active = element.querySelector<HTMLElement>('.typing-character.active');
      if (!active) return;
      const container = element.getBoundingClientRect();
      const character = active.getBoundingClientRect();
      if (character.bottom > container.bottom || character.top < container.top) {
        element.scrollTop += character.top - container.top - element.clientHeight / 3;
      }
    });
  });

  onDestroy(clearFeedback);

  function generationFailed(error: unknown) {
    if (!(error instanceof ExerciseGenerationError)) throw error;
    exerciseError = error.message;
    clearFeedback();
  }

  function prepareExercise(selected: PracticeSettings) {
    clearFeedback();
    sessionId = '';
    missedKeys = {};
    submitted = false;
    exerciseError = '';
    now = 0;
    try {
      switch (selected.mode) {
        case 'timed':
        case 'words': {
          const exercise = generateExercise(getConfiguration(selected));
          session = createSession(exercise.target, exercise.configuration, exercise.wordEnds);
          break;
        }
        case 'quote':
          quote ??= selectQuote();
          session = createSession(quote.text, { mode: 'quote', quoteId: quote.id });
          break;
        case 'custom':
          session = customTarget && !editing ? createSession(customTarget, { mode: 'custom' }) : null;
          break;
        case 'zen':
          session = createZenSession();
          break;
        default: throw new ExerciseGenerationError('Unsupported practice mode.');
      }
    } catch (error) {
      session = null;
      generationFailed(error);
    }
  }

  function changeSettings(next: PracticeSettings) {
    if (running) return;
    if (settings.mode === 'zen') session = null;
    settings = next;
    onsettingschange?.(next);
  }

  function complete() {
    clearFeedback();
    if (!submitted && session?.status === 'completed' && oncomplete) {
      submitted = true;
      oncomplete(completedRecord(session, sessionId, startedWallTime, missedKeys));
    }
  }

  function refillTarget(): boolean {
    if (!session || isZenSession(session) || session.configuration?.mode !== 'timed' || session.target.length - session.input.length >= 80) {
      return true;
    }
    try {
      session = extendTarget(session, generateExercise(session.configuration));
      return true;
    } catch (error) {
      generationFailed(error);
      return false;
    }
  }

  function clearFeedback() {
    for (const timer of feedbackTimers.values()) window.clearTimeout(timer);
    feedbackTimers.clear();
    feedback = {};
  }

  function highlightKey(code: string, correct: boolean) {
    window.clearTimeout(feedbackTimers.get(code));
    feedback = { ...feedback, [code]: correct ? 'correct' : 'incorrect' };
    feedbackTimers.set(code, window.setTimeout(() => {
      feedbackTimers.delete(code);
      const next = { ...feedback };
      delete next[code];
      feedback = next;
    }, 300));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!active || !focused || composing || (settings.mode === 'custom' && editing)) return;

    const action = getTypingAction(event);
    if (!action) return;

    event.preventDefault();
    if (!session || exerciseError || session.status === 'completed') return;

    now = performance.now();
    if (!isZenSession(session)) session = expireSession(session, now);
    if (session.status === 'completed') {
      complete();
      return;
    }
    if (action.type === 'character' && !refillTarget()) return;
    const correct = !isZenSession(session) && action.type === 'character'
      && action.character === session.target[session.input.length];
    if (action.type === 'character') {
      if (session.status === 'ready') {
        sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
        startedWallTime = Date.now();
      }
      if (!zen && !correct && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(event.code) && event.code !== 'Unidentified') {
        missedKeys[event.code] = (Object.hasOwn(missedKeys, event.code) ? missedKeys[event.code] : 0) + 1;
      }
    }
    session = applyAction(session, action, now);
    if (!zen && action.type === 'character') oncharacter?.();
    if (session.status === 'completed') {
      complete();
    } else if (!zen && action.type === 'character' && layoutCodes.has(event.code)) {
      highlightKey(event.code, correct);
    }
  }

  function restart() {
    prepareExercise(settings);
  }

  function nextQuote() {
    try {
      quote = selectQuote(quote?.id);
      prepareExercise(settings);
    } catch (error) { generationFailed(error); }
  }

  function applyCustom() {
    if (!customPreparation.value) {
      customError = customPreparation.error;
      return;
    }
    customTarget = customPreparation.value.target;
    normalized = customPreparation.value.changed;
    customError = '';
    editing = false;
    prepareExercise(settings);
  }

  async function stop() {
    if (!session || !isZenSession(session)) return;
    session = stopSession(session, performance.now());
    complete();
    await tick();
    resultHeading?.focus();
  }
</script>

<section class="practice-panel" data-caret={caretStyle} aria-labelledby="practice-panel-heading" data-status={exerciseError ? 'error' : session?.status ?? 'ready'}>
  <h3 id="practice-panel-heading" class="sr-only" tabindex="-1">Typing practice</h3>

  <ModeNavigation mode={settings.mode} disabled={running}
    onmodechange={(mode) => changeSettings({ ...settings, mode })} />

  {#if settings.mode === 'timed' || settings.mode === 'words'}
  <fieldset class="exercise-settings" disabled={running}>
    <legend>Practice options</legend>
    {#if timed}
      <label>Duration
        <select aria-label="Duration" value={settings.durationSeconds} onchange={(event) => {
          const durationSeconds = DURATIONS.find((duration) => String(duration) === event.currentTarget.value);
          if (durationSeconds === undefined) throw new Error('Unsupported duration selection.');
          changeSettings({ ...settings, durationSeconds });
        }}>
          {#each DURATIONS as duration}<option value={duration}>{duration} seconds</option>{/each}
        </select>
      </label>
    {:else}
      <label>Word limit
        <select aria-label="Word limit" value={settings.wordLimit} onchange={(event) => {
          const wordLimit = WORD_LIMITS.find((limit) => String(limit) === event.currentTarget.value);
          if (wordLimit === undefined) throw new Error('Unsupported word-limit selection.');
          changeSettings({ ...settings, wordLimit });
        }}>
          {#each WORD_LIMITS as limit}<option value={limit}>{limit} words</option>{/each}
        </select>
      </label>
    {/if}
    <label>Vocabulary
      <select aria-label="Vocabulary" value={settings.wordBankTier} onchange={(event) => {
        const wordBankTier = WORD_BANK_TIERS.find((tier) => String(tier) === event.currentTarget.value);
        if (wordBankTier === undefined) throw new Error('Unsupported vocabulary selection.');
        changeSettings({ ...settings, wordBankTier });
      }}>
        {#each WORD_BANK_TIERS as tier}<option value={tier}>{tier} words</option>{/each}
      </select>
    </label>
    <label class="modifier"><input type="checkbox" checked={settings.punctuation} onchange={(event) => {
      changeSettings({ ...settings, punctuation: event.currentTarget.checked });
    }} />Punctuation</label>
    <label class="modifier"><input type="checkbox" checked={settings.numbers} onchange={(event) => {
      changeSettings({ ...settings, numbers: event.currentTarget.checked });
    }} />Numbers</label>
  </fieldset>
  {/if}
  {#if settings.mode === 'quote' && quote}
    <p class="quote-attribution" data-quote-id={quote.id}>{quote.author} - {quote.workTitle}</p>
    <button class="secondary-button" type="button" disabled={running} onclick={nextQuote}>Next quote</button>
  {:else if settings.mode === 'custom'}
    <p id="custom-privacy">Paste any text you want to practice. It stays in this tab and is never saved.
      It clears when you leave Practice or restore defaults, but survives switching modes.</p>
    <p id="custom-format">Up to 10,000 printable ASCII characters. Line breaks become spaces, and curly quotes, dashes, and ellipses are converted to plain versions. Check the result before you start typing.</p>
    {#if editing}
      <label class="custom-label" for="custom-draft">Custom text</label>
      <textarea id="custom-draft" bind:value={draft} aria-describedby="custom-privacy custom-format custom-error"
        aria-invalid={Boolean(customError || (draft && customPreparation.error))} spellcheck={false}></textarea>
      <p id="custom-error" class="exercise-error" role={customError ? 'alert' : undefined}>{customError || (draft ? customPreparation.error : '')}</p>
    {:else}
      <p role="status">{normalized ? 'Whitespace/typography normalized; review the target before typing. ' : ''}{customTarget.length} target characters. Ready to practice.</p>
    {/if}
    <div class="custom-actions">
      <button class="secondary-button" type="button" disabled={running || !customPreparation.value} onclick={applyCustom}>Apply text</button>
      {#if editing && customTarget}
        <button class="secondary-button" type="button" onclick={() => { editing = false; customError = ''; prepareExercise(settings); }}>Cancel editing</button>
      {:else if !editing}
        <button class="secondary-button" type="button" disabled={running} onclick={() => { editing = true; clearFeedback(); }}>Edit text</button>
      {/if}
      <button class="secondary-button danger-button" type="button" disabled={running} onclick={() => {
        draft = ''; customTarget = ''; editing = true; customError = ''; session = null;
      }}>Clear text</button>
    </div>
  {/if}
  {#if !zen}
  <p class="settings-note">{running ? 'Options are locked while you type. Restart to change them.' : 'Pick a mode and options, then start typing.'}</p>
  {:else}
    <p id="zen-instructions">Free writing: type whatever you like. Only your latest 2,000 characters are shown, but Backspace can still edit earlier text.
      Use printable ASCII keys; paste and IME input are not supported. Tab leaves the writing area, and the clock keeps running while you are away.
      Stop saves your result; Restart discards an unfinished run. Sound and live stats are always off in Zen.</p>
  {/if}

  {#if exerciseError}
    <p role="alert" class="exercise-error">We couldn't prepare this exercise: {exerciseError} Choose Restart to try again.</p>
  {/if}
  {#if session && !(settings.mode === 'custom' && editing)}
  {#if metrics}
  <div class="practice-toolbar">
    <p class="practice-label">{modeLabel} practice</p>

    {#if showLiveStats || session.status === 'completed'}
    <div class="metrics" role="group" aria-label="Practice metrics">
      <div class="metric">
        <span class="metric-label">{zen ? 'Free-writing WPM' : 'WPM'}</span>
        <span
          class="metric-value"
          aria-label={metrics.wpm === null ? 'Not available' : `${metrics.wpm} words per minute`}
        >{metrics.wpm ?? '—'}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Accuracy</span>
        <span
          class="metric-value"
          aria-label={zen ? 'Not applicable - free writing' : metrics.accuracy === null ? 'Not available' : `${metrics.accuracy.toFixed(1)} percent`}
        >{zen ? 'Not applicable - free writing' : metrics.accuracy === null ? '—' : `${metrics.accuracy.toFixed(1)}%`}</span>
      </div>
    </div>
    {/if}
  </div>
  {/if}
  {#if zen && session.status === 'completed' && isZenSession(session) && metrics}
    <h4 bind:this={resultHeading} tabindex="-1">Zen stopped</h4>
    <p>Free-writing WPM is not target-verified. Elapsed: {(metrics.elapsedMs / 1000).toFixed(1)} seconds.
      Retained characters: {session.retainedCharacters}. Total attempts: {session.totalAttempts}.</p>
  {/if}

  {#if !zen}
  <p id="typing-instructions" class="sr-only">
    Type the text shown, one key at a time. Backspace fixes the last character.
    Tab leaves the typing area. The clock keeps running if focus moves away.
    Paste and IME input are not supported.
  </p>
  {/if}
  <input
    bind:this={inputElement}
    id="practice-input"
    class="typing-input sr-only"
    type="text"
    disabled={!active || Boolean(exerciseError)}
    aria-label={zen ? 'Zen writing' : 'Typing practice'}
    aria-describedby={zen ? 'zen-instructions' : 'typing-instructions practice-target'}
    autocomplete="off"
    autocapitalize="off"
    spellcheck={false}
    onkeydown={handleKeydown}
    onbeforeinput={(event) => event.preventDefault()}
    oninput={(event) => { event.currentTarget.value = ''; }}
    oncompositionstart={() => { composing = true; }}
    oncompositionend={(event) => { composing = false; event.currentTarget.value = ''; }}
    onfocus={() => { focused = true; }}
    onblur={(event) => { focused = false; composing = false; event.currentTarget.value = ''; clearFeedback(); }}
  />
  <label bind:this={targetElement} class="sample-text practice-text" for="practice-input" id="practice-target">
    {#if zen}
      <span class="zen-writing">{writing}</span>{#if session.status !== 'completed'}<span class="zen-caret" aria-hidden="true">&nbsp;</span>{/if}
    {:else if finiteSession}
    <span class="sr-only">{finiteSession.target}</span>
    <span aria-hidden="true">{#each Array.from(finiteSession.target) as character, index}<span
        class="typing-character"
        class:correct={index < finiteSession.input.length && finiteSession.input[index] === character}
        class:incorrect={index < finiteSession.input.length && finiteSession.input[index] !== character}
        class:active={!exerciseError && session.status !== 'completed' && index === finiteSession.input.length}
      >{character}</span>{/each}</span>
    {/if}
  </label>

  {#if progress}
  <div class="exercise-progress">
    <label for="session-progress">{timed ? 'Elapsed time' : settings.mode === 'words' ? 'Completed words' : 'Consumed target characters'}</label>
    <span id="progress-description">{timed ? Math.floor(progress.value) : progress.value} / {progress.maximum} {timed ? 'seconds' : settings.mode === 'words' ? 'words' : 'characters'}</span>
    <progress id="session-progress" max={progress.maximum} value={progress.value} aria-describedby="progress-description"></progress>
  </div>
  {/if}
  {/if}

  {#if !zen}
  <AliceKeyboardVisualizer {layout} {feedback} testLayoutLabel={layoutLabel} {browserLegends}
    {inertKeys} {viewBox} layoutSource={layoutConfirmed ? 'confirmed' : 'generic'} />
  {/if}

  <div class="practice-bottom">
    {#if !zen}<p class="session-note" role="status">{exerciseError ? 'Practice stopped. Choose Restart for a new exercise.' : statusMessage}</p>{/if}
    <div class="practice-actions">
      {#if session && !exerciseError && session.status !== 'completed' && !(settings.mode === 'custom' && editing)}
        <button
          class="start-button"
          type="button"
          onclick={() => inputElement?.focus()}
        >{zen ? 'Focus writing' : session.status === 'ready' ? 'Start typing' : focused ? 'Typing…' : 'Resume typing'}</button>
      {/if}
      {#if zen}<button class="secondary-button" type="button" disabled={session?.status !== 'running'} onclick={stop}>Stop</button>{/if}
      <button class="restart-button danger-button" type="button" onclick={restart}>Restart</button>
    </div>
  </div>

  <fieldset class="preferences" disabled={running}>
    <legend>Display and sound</legend>
    <label>Caret style
      <select value={caretStyle} onchange={(event) => {
        const next = CARET_STYLES.find((style) => style === event.currentTarget.value);
        if (!next) throw new Error('Unsupported caret selection.');
        oncaretchange?.(next);
      }}>
        {#each CARET_STYLES as style}<option value={style}>{style[0].toUpperCase() + style.slice(1)}</option>{/each}
      </select>
    </label>
    <label class="modifier"><input type="checkbox" checked={showLiveStats}
      onchange={(event) => onlivestatschange?.(event.currentTarget.checked)} />Show live WPM and accuracy</label>
    <label class="modifier"><input type="checkbox" checked={soundEnabled}
      onchange={(event) => onsoundchange?.(event.currentTarget.checked)} />Typing sound</label>
    <p class="settings-note">Results and history are saved even when live stats are hidden. Typing sound is a soft click for each accepted key and is off by default. Preferences stay in this browser.</p>
    <button type="button" class="secondary-button danger-button" onclick={() => { confirmingReset = true; }}>Restore defaults</button>
  </fieldset>
</section>

{#if confirmingReset}
  <ConfirmationDialog
    title="Restore default preferences?"
    message="This resets your practice options, caret, live stats, and sound to their defaults. Your session history is kept."
    confirmText="Restore defaults"
    oncancel={() => { confirmingReset = false; }}
    onconfirm={() => { confirmingReset = false; onreset?.(); }}
  />
{/if}

<style>
  textarea {
    display: block;
    width: 100%;
    min-height: 9rem;
    padding: 0.75rem;
    border: 1px solid var(--color-muted);
    border-radius: 0.4rem;
    color: var(--color-text);
    background: var(--color-background);
    font: inherit;
    resize: vertical;
  }
  .custom-label { display: block; margin-block: 0.75rem; }
  .custom-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .zen-caret { background: var(--color-accent); }
  [data-caret="line"] .zen-caret { background: transparent; border-left: 2px solid var(--color-accent); }
  [data-caret="underline"] .zen-caret { background: transparent; border-bottom: 2px solid var(--color-accent); }
  .practice-text {
    display: block;
    cursor: text;
    border-radius: 0.25rem;
    white-space: pre-wrap;
    max-height: 15rem;
    margin-block: 2rem;
    overflow-y: auto;
    overflow-wrap: anywhere;
    scrollbar-color: var(--color-accent) var(--color-surface);
  }

  .exercise-settings, .preferences {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    min-width: 0;
    margin: 0;
    border: 0;
    border-bottom: 1px solid rgb(255 255 255 / 10%);
    padding: 0 0 1rem;
    font-size: 0.8rem;
  }

  .preferences {
    margin-top: 2rem;
    border-top: 1px solid rgb(255 255 255 / 10%);
    border-bottom: 0;
    padding: 1rem 0 0;
  }

  .preferences .settings-note { flex-basis: 100%; margin: 0; }

  .exercise-settings legend, .preferences legend {
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .exercise-settings label, .preferences label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  select {
    max-width: 100%;
    border: 1px solid var(--color-muted);
    border-radius: 0.35rem;
    padding: 0.4rem;
    color: var(--color-text);
    background: var(--color-background);
    font: inherit;
  }

  select:focus-visible, input[type="checkbox"]:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 3px;
  }

  input[type="checkbox"], progress {
    accent-color: var(--color-accent);
  }

  .exercise-settings:disabled, .preferences:disabled {
    opacity: 0.6;
  }

  .settings-note {
    margin: 0.65rem 0 1.5rem;
    color: var(--color-muted);
    font-size: 0.75rem;
  }

  .exercise-error {
    color: var(--color-error);
  }

  .exercise-progress {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    color: var(--color-muted);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  progress {
    grid-column: 1 / -1;
    width: 100%;
    height: 0.5rem;
    border: 0;
    border-radius: 1rem;
    overflow: hidden;
    background: var(--color-background);
  }

  progress::-webkit-progress-bar {
    background: var(--color-background);
  }

  progress::-webkit-progress-value {
    background: var(--color-accent);
  }

  progress::-moz-progress-bar {
    background: var(--color-accent);
  }

  .typing-input:focus-visible + .practice-text,
  .practice-text:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 8px;
  }

  .typing-character.correct {
    color: var(--color-muted);
  }

  .typing-character.incorrect {
    color: var(--color-error);
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.2em;
  }

  .typing-character.active {
    color: var(--color-background);
    background: var(--color-accent);
    box-shadow: -2px 0 var(--color-accent);
  }

  [data-caret='line'] .typing-character.active {
    color: var(--color-text);
    background: transparent;
    box-shadow: -2px 0 var(--color-accent);
  }

  [data-caret='underline'] .typing-character.active {
    color: var(--color-text);
    background: transparent;
    box-shadow: 0 2px var(--color-accent);
  }

  .practice-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.6rem;
  }

  .start-button {
    border: 1px solid var(--color-accent);
    border-radius: 0.55rem;
    padding: 0.55rem 0.8rem;
    color: var(--color-background);
    background: var(--color-accent);
    font-size: 0.78rem;
    cursor: pointer;
  }
</style>
