<script lang="ts">
  import {
    applyAction,
    createSession,
    getMetrics,
    getTypingAction,
    PRACTICE_TEXT
  } from '../typing/typing-engine';

  let session = $state(createSession(PRACTICE_TEXT));
  let now = $state(0);
  let inputElement: HTMLInputElement;
  let focused = $state(false);
  let composing = false;
  const running = $derived(session.status === 'running');
  const metrics = $derived(getMetrics(session, now));
  const statusMessage = $derived(
    session.status === 'ready'
      ? 'Select the text or Start typing to begin.'
      : session.status === 'completed'
        ? 'Session complete. Restart to practice again.'
        : 'Session started. Use Backspace to correct mistakes.'
  );

  $effect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      now = performance.now();
    }, 100);

    return () => window.clearInterval(interval);
  });

  function handleKeydown(event: KeyboardEvent) {
    if (composing) return;

    const action = getTypingAction(event);
    if (!action) return;

    event.preventDefault();
    now = performance.now();
    session = applyAction(session, action, now);
  }

  function restart() {
    session = createSession(session.target);
    now = 0;
  }
</script>

<section class="practice-panel" aria-labelledby="practice-panel-heading" data-status={session.status}>
  <h3 id="practice-panel-heading" class="sr-only">Typing practice</h3>

  <div class="practice-toolbar">
    <p class="practice-label">A moment to focus</p>

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
    aria-label="Typing practice"
    aria-describedby="typing-instructions practice-target"
    autocomplete="off"
    autocapitalize="off"
    spellcheck={false}
    onkeydown={handleKeydown}
    onbeforeinput={(event) => event.preventDefault()}
    oninput={() => { inputElement.value = ''; }}
    oncompositionstart={() => { composing = true; }}
    oncompositionend={() => { composing = false; inputElement.value = ''; }}
    onfocus={() => { focused = true; }}
    onblur={() => { focused = false; composing = false; inputElement.value = ''; }}
  />
  <label class="sample-text practice-text" for="practice-input" id="practice-target">
    <span class="sr-only">{PRACTICE_TEXT}</span>
    <span aria-hidden="true">{#each Array.from(PRACTICE_TEXT) as character, index}<span
        class="typing-character"
        class:correct={index < session.input.length && session.input[index] === character}
        class:incorrect={index < session.input.length && session.input[index] !== character}
        class:active={session.status !== 'completed' && index === session.input.length}
      >{character}</span>{/each}</span>
  </label>

  <div class="practice-bottom">
    <p class="session-note" role="status">{statusMessage}</p>
    <div class="practice-actions">
      {#if session.status !== 'completed'}
        <button
          class="start-button"
          type="button"
          onclick={() => inputElement.focus()}
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
  }

  .typing-input:focus-visible + .practice-text {
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
