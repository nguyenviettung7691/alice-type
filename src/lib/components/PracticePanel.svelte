<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import ModeNavigation from './ModeNavigation.svelte';
  import { ALICE_LAYOUT, type AliceKey, type KeyFeedback } from '../keyboard/alice-layout';
  import {
    applyAction,
    createSession,
    expireSession,
    extendTarget,
    getMetrics,
    getProgress,
    getTypingAction,
    type TypingSession
  } from '../typing/typing-engine';
  import {
    DEFAULT_SETTINGS, DURATIONS, WORD_LIMITS, WORD_BANK_TIERS,
    ExerciseGenerationError, generateExercise, getConfiguration,
    type PracticeSettings, type SessionConfiguration
  } from '../typing/exercise-generator';
  import { type CaretStyle } from '../storage/preferences';
  import { completedRecord, type SessionRecord } from '../storage/session-history';

  let {
    settings = $bindable({ ...DEFAULT_SETTINGS }), running = $bindable(false),
    caretStyle = 'block', showLiveStats = true, onsettingschange, oncharacter, oncomplete,
    layout = ALICE_LAYOUT, layoutLabel = 'Generic Alice', browserLegends = false
  }: {
    settings?: PracticeSettings;
    running?: boolean;
    caretStyle?: CaretStyle;
    showLiveStats?: boolean;
    onsettingschange?: (settings: PracticeSettings) => void;
    oncharacter?: () => void;
    oncomplete?: (record: SessionRecord) => void;
    layout?: readonly AliceKey[];
    layoutLabel?: string;
    browserLegends?: boolean;
  } = $props();

  let sessionId = '';
  let startedWallTime = 0;
  let submitted = false;
  let missedKeys: Record<string, number> = {};
  let session = $state<TypingSession | null>(null);
  let exerciseError = $state('');
  let now = $state(0);
  let inputElement = $state<HTMLInputElement>();
  let targetElement = $state<HTMLLabelElement>();
  let focused = $state(false);
  let composing = false;
  let feedback = $state<KeyFeedback>({});
  const feedbackTimers = new Map<string, number>();
  const metrics = $derived(session ? getMetrics(session, now) : null);
  const progress = $derived(session ? getProgress(session, now) : null);
  const timed = $derived(settings.mode === 'timed');
  const layoutCodes = $derived(new Set(layout.map((key) => key.code)));
  const statusMessage = $derived(
    session?.status === 'ready'
      ? 'Select the text or Start typing to begin.'
      : session?.status === 'completed'
        ? timed ? 'Session complete. Time is up. Restart to practice again.' : 'Session complete. Word limit reached. Restart to practice again.'
        : 'Session started. Use Backspace to correct mistakes.'
  );

  $effect(() => {
    const selected = settings;
    untrack(() => prepareExercise(selected));
  });

  $effect(() => {
    running = session?.status === 'running' && !exerciseError;
  });

  $effect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      now = performance.now();
      if (session) session = expireSession(session, now);
      if (session?.status === 'completed') complete();
    }, 100);

    return () => window.clearInterval(interval);
  });

  $effect(() => {
    const position = session?.input.length;
    const element = targetElement;
    untrack(() => {
      if (!element) return;
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

  function prepareExercise(selected: PracticeSettings, configuration?: SessionConfiguration) {
    clearFeedback();
    sessionId = '';
    missedKeys = {};
    submitted = false;
    exerciseError = '';
    now = 0;
    try {
      const exercise = generateExercise(configuration ?? getConfiguration(selected));
      session = createSession(exercise.target, exercise.configuration, exercise.wordEnds);
    } catch (error) {
      session = null;
      generationFailed(error);
    }
  }

  function changeSettings(next: PracticeSettings) {
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
    if (!session || session.configuration?.mode !== 'timed' || session.target.length - session.input.length >= 80) {
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
    if (!focused || composing) return;

    const action = getTypingAction(event);
    if (!action) return;

    event.preventDefault();
    if (!session || exerciseError || session.status === 'completed') return;

    now = performance.now();
    session = expireSession(session, now);
    if (session.status === 'completed') {
      complete();
      return;
    }
    if (action.type === 'character' && !refillTarget()) return;
    const correct = action.type === 'character'
      && action.character === session.target[session.input.length];
    if (action.type === 'character') {
      if (session.status === 'ready') {
        sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
        startedWallTime = Date.now();
      }
      if (!correct && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(event.code) && event.code !== 'Unidentified') {
        missedKeys[event.code] = (Object.hasOwn(missedKeys, event.code) ? missedKeys[event.code] : 0) + 1;
      }
    }
    session = applyAction(session, action, now);
    if (action.type === 'character') oncharacter?.();
    if (session.status === 'completed') {
      complete();
    } else if (action.type === 'character' && layoutCodes.has(event.code)) {
      highlightKey(event.code, correct);
    }
  }

  function restart() {
    prepareExercise(settings, session?.configuration);
  }
</script>

<section class="practice-panel" data-caret={caretStyle} aria-labelledby="practice-panel-heading" data-status={exerciseError ? 'error' : session?.status ?? 'ready'}>
  <h3 id="practice-panel-heading" class="sr-only" tabindex="-1">Typing practice</h3>

  <ModeNavigation mode={settings.mode} disabled={running}
    onmodechange={(mode) => changeSettings({ ...settings, mode })} />

  <fieldset class="exercise-settings" disabled={running}>
    <legend>Exercise settings</legend>
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
  <p class="settings-note">{running ? 'Restart to change mode or settings.' : 'Choose an exercise, then start typing.'}</p>

  {#if exerciseError}
    <p role="alert" class="exercise-error">Exercise unavailable: {exerciseError} Restart to try again.</p>
  {/if}
  {#if session && metrics && progress}
  <div class="practice-toolbar">
    <p class="practice-label">{timed ? 'Timed practice' : 'Word practice'}</p>

    {#if showLiveStats || session.status === 'completed'}
    <div class="metrics" role="group" aria-label="Practice metrics">
      <div class="metric">
        <span class="metric-label">WPM</span>
        <span
          class="metric-value"
          aria-label={metrics.wpm === null ? 'Not available' : `${metrics.wpm} words per minute`}
        >{metrics.wpm ?? '—'}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Accuracy</span>
        <span
          class="metric-value"
          aria-label={metrics.accuracy === null ? 'Not available' : `${metrics.accuracy.toFixed(1)} percent`}
        >{metrics.accuracy === null ? '—' : `${metrics.accuracy.toFixed(1)}%`}</span>
      </div>
    </div>
    {/if}
  </div>

  <p id="typing-instructions" class="sr-only">
    Type the target text one key at a time. Backspace corrects the last character.
    Tab leaves the practice input. Time continues when focus moves away.
    Paste and composition input are not supported in this exercise.
  </p>
  <input
    bind:this={inputElement}
    id="practice-input"
    class="typing-input sr-only"
    type="text"
    disabled={Boolean(exerciseError)}
    aria-label="Typing practice"
    aria-describedby="typing-instructions practice-target"
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
    <span class="sr-only">{session.target}</span>
    <span aria-hidden="true">{#each Array.from(session.target) as character, index}<span
        class="typing-character"
        class:correct={index < session.input.length && session.input[index] === character}
        class:incorrect={index < session.input.length && session.input[index] !== character}
        class:active={!exerciseError && session.status !== 'completed' && index === session.input.length}
      >{character}</span>{/each}</span>
  </label>

  <div class="exercise-progress">
    <label for="session-progress">{timed ? 'Elapsed time' : 'Completed words'}</label>
    <span id="progress-description">{timed ? Math.floor(progress.value) : progress.value} / {progress.maximum} {timed ? 'seconds' : 'words'}</span>
    <progress id="session-progress" max={progress.maximum} value={progress.value} aria-describedby="progress-description"></progress>
  </div>
  {/if}

  <AliceKeyboardVisualizer {layout} {feedback} testLayoutLabel={layoutLabel} {browserLegends} />

  <div class="practice-bottom">
    <p class="session-note" role="status">{exerciseError ? 'Practice stopped. Restart to generate a new exercise.' : statusMessage}</p>
    <div class="practice-actions">
      {#if session && !exerciseError && session.status !== 'completed'}
        <button
          class="start-button"
          type="button"
          onclick={() => inputElement?.focus()}
        >{session.status === 'ready' ? 'Start typing' : focused ? 'Typing…' : 'Resume typing'}</button>
      {/if}
      <button class="restart-button" type="button" onclick={restart}>Restart</button>
    </div>
  </div>
</section>

<style>
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

  .exercise-settings {
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

  .exercise-settings legend {
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .exercise-settings label {
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

  .exercise-settings:disabled {
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
