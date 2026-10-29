<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import ModeNavigation from './ModeNavigation.svelte';
  import { ALICE_LAYOUT, ALICE_VIEW_BOX, type AliceKey, type InertKey, type KeyFeedback } from '../keyboard/alice-layout';
  import {
    createSession,
    expireSession,
    extendTarget,
    getMetrics,
    getProgress,
    applyCommittedInput, getAcceptedText, requiresFinish, finishSession,
    createZenSession, isZenSession, stopSession, getWritingWindow,
    type PracticeSession
  } from '../typing/typing-engine';
  import {
    DEFAULT_SETTINGS, DURATIONS, WORD_LIMITS, WORD_BANK_TIERS, DRILL_TYPES, CODE_LANGUAGES, CODE_LANGUAGE_NAMES, B_KEY_HANDS,
    ExerciseGenerationError, generateExercise, getConfiguration,
    type PracticeSettings
  } from '../typing/exercise-generator';
  import { CARET_STYLES, type CaretStyle } from '../storage/preferences';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  import HandBalance from './HandBalance.svelte';
  import { completedRecord, type HandAttempts, type SessionRecord } from '../storage/session-history';
  import { DrillPoolError, MINIMUM_DRILL_POOL, generateDrill } from '../typing/alice-drills';
  import { selectCodeSnippet, type CodeSnippet } from '../typing/code-snippets';
  import { expectedKeycaps, fingerForCode, layoutCentreX } from '../keyboard/finger-map';
  import { keyForCharacter } from '../keyboard/key-for-character';
  import { DRILL_TYPE_HELP_KEYS, DRILL_TYPE_LABEL_KEYS, FINGER_LABEL_KEYS, HAND_LABEL_KEYS } from '../i18n/alice-messages';
  import { prepareCustomText } from '../typing/custom-text';
  import { selectQuote, type Quote } from '../typing/quote-catalog';
  import { hasGraphemeSupport, PracticeTextError, segmentGraphemes } from '../typing/text';
  import { PracticeEditError, reconcilePracticeInput } from '../typing/practice-input';
  import { useLocalization } from '../i18n/context';
  import { formatAccuracy, formatNumber } from '../i18n/format';
  const i18n = useLocalization();
  const { text } = i18n;

  let {
    settings = $bindable({ ...DEFAULT_SETTINGS }), running = $bindable(false),
    caretStyle = 'block', showLiveStats = true, soundEnabled = false,
    onsettingschange, oncaretchange, onlivestatschange, onsoundchange, onreset, oncharacter, oncomplete,
    layout = ALICE_LAYOUT, layoutLabel = 'Generic Alice', browserLegends = false,
    inertKeys = [], viewBox = ALICE_VIEW_BOX, layoutConfirmed = false,
    active = true, contentReset = 0,
    fingerGuide = false, onfingerguidechange, layoutMap = null, physicalCodes = {}
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
    fingerGuide?: boolean;
    onfingerguidechange?: (fingerGuide: boolean) => void;
    /** Raw browser layout map (code to unshifted character) when the user granted key labels. */
    layoutMap?: ReadonlyMap<string, string> | null;
    /** Remapped code to the catalog-default code of the physical slot (imported keymaps). */
    physicalCodes?: Readonly<Record<string, string>>;
  } = $props();

  let sessionId = '';
  let startedWallTime = 0;
  let submitted = false;
  let missedKeys: Record<string, number> = {};
  let keyAttempts: Record<string, number> = {};
  const EMPTY_HANDS: HandAttempts = { left: 0, right: 0, thumb: 0, unattributed: 0 };
  let handAttempts = $state<HandAttempts>({ ...EMPTY_HANDS });
  let fingerAttempts = $state<Record<string, number>>({});
  let session = $state.raw<PracticeSession | null>(null);
  let quote = $state<Quote | null>(null);
  let snippet = $state<CodeSnippet | null>(null);
  let guideAnnouncement = $state('');
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
  let writingArea = $state<HTMLDivElement>();
  let capturePosition = $state({ left: 0, top: 0, height: 24 });
  let focused = $state(false);
  let composing = $state(false);
  let inputNotice = $state<'cancelled' | 'rejected' | 'unsupported' | ''>('');
  let preedit = $state('');
  let compositionGeneration = 0;
  let activeCompositionGeneration = -1;
  let directCode: string | null = null;
  let feedback = $state<KeyFeedback>({});
  const feedbackTimers = new Map<string, number>();
  const metrics = $derived(session && (!isZenSession(session) || session.status === 'completed') ? getMetrics(session, now) : null);
  const progress = $derived(session ? getProgress(session, now) : null);
  const timed = $derived(settings.mode === 'timed');
  const zen = $derived(settings.mode === 'zen');
  const finiteSession = $derived(session && !isZenSession(session) ? session : null);
  const targetCharacters = $derived(finiteSession ? segmentGraphemes(finiteSession.target) : []);
  const inputCharacters = $derived(finiteSession ? segmentGraphemes(finiteSession.input) : []);
  const writing = $derived(session && isZenSession(session) ? getWritingWindow(session) : '');
  const compositionPreview = $derived.by(() => {
    if (!composing || !session) return { start: 0, text: '' };
    const accepted = getAcceptedText(session);
    const preview = preedit.normalize('NFC');
    let start = 0;
    while (start < accepted.length && start < preview.length && accepted[start] === preview[start]) start++;
    return { start, text: preview.slice(start) };
  });
  const modeLabel = $derived(({
    timed: text("mode-navigation.timed"), words: text("practice-panel.word"),
    quote: text("mode-navigation.quote"), custom: text("practice-panel.custom-text"), zen: 'Zen',
    drills: text("mode-navigation.drills"), code: text("mode-navigation.code")
  })[settings.mode]);
  const layoutCodes = $derived(new Set(layout.map((key) => key.code)));
  const completionReason = $derived({
    timed: text("practice-panel.time-is-up"), words: text("practice-panel.word-limit-reached"),
    quote: text("practice-panel.quote-complete"), custom: text("practice-panel.custom-text-complete"),
    zen: text("practice-panel.zen-stopped-2"), drills: text("practice-panel.word-limit-reached"),
    code: text("alice-practice.snippet-complete")
  }[settings.mode]);
  const wordProgress = $derived(settings.mode === 'words' || settings.mode === 'drills');
  const bKeyHand = $derived(settings.bKeyHand ?? 'left');
  const centreX = $derived(layoutCentreX(layout));
  const guideActive = $derived(fingerGuide && !zen && !exerciseError && finiteSession !== null
    && finiteSession.status !== 'completed' && !(settings.mode === 'custom' && editing));
  const guidePosition = $derived(inputCharacters.length);
  const nextGrapheme = $derived(guideActive ? targetCharacters[guidePosition] : undefined);
  const guideKey = $derived(nextGrapheme === undefined ? null : keyForCharacter(nextGrapheme, layoutMap));
  const assignment = (code: string) => fingerForCode(physicalCodes[code] ?? code, bKeyHand);
  const guideExpected = $derived.by(() => {
    if (!guideKey) return undefined;
    const marks: Record<string, readonly number[]> = {};
    const mark = (code: string) => {
      const key = layout.find((candidate) => candidate.code === code);
      if (key) marks[code] = expectedKeycaps(key, bKeyHand, centreX);
    };
    mark(guideKey.code);
    if (guideKey.shift) mark(assignment(guideKey.code)?.hand === 'left' ? 'ShiftRight' : 'ShiftLeft');
    return marks;
  });
  const guideCaption = $derived.by(() => {
    if (nextGrapheme === undefined) return '';
    if (!guideKey) return text('alice-practice.guide-no-key', { p0: nextGrapheme });
    const target = assignment(guideKey.code);
    const keyName = nextGrapheme === ' ' ? text('alice-practice.space-key') : nextGrapheme;
    const finger = !target ? text('alice-practice.finger-unknown')
      : target.hand === null ? text(FINGER_LABEL_KEYS.thumb)
      : text('alice-practice.hand-finger', { p0: text(HAND_LABEL_KEYS[target.hand]), p1: text(FINGER_LABEL_KEYS[target.finger]) });
    return text(guideKey.shift ? 'alice-practice.guide-next-shift' : 'alice-practice.guide-next', { p0: keyName, p1: finger });
  });
  const showHandBalance = $derived(showLiveStats && !zen && session !== null
    && handAttempts.left + handAttempts.right + handAttempts.thumb > 0);

  $effect(() => {
    const caption = guideCaption;
    const position = guidePosition;
    const characters = targetCharacters;
    untrack(() => {
      if (!caption) guideAnnouncement = '';
      else if (position === 0 || characters[position - 1] === ' ') guideAnnouncement = caption;
    });
  });
  const statusMessage = $derived(
    !session
      ? text("practice-panel.paste-your-text-and-choose-apply-text")
      : session.status === 'ready'
      ? text("practice-panel.press-start-typing-or-just-begin-typing")
      : session?.status === 'completed'
        ? text("practice-panel.session-complete-choose-restart-to-practice-again", { p0: String(completionReason) })
        : text("practice-panel.you-are-typing-use-backspace-to-fix")
  );

  $effect(() => {
    const selected = settings;
    untrack(() => {
      if (selected.mode === 'quote') quote = null;
      if (selected.mode === 'code') snippet = null;
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
    const area = writingArea;
    const preview = compositionPreview;
    let disposed = false;
    void tick().then(() => {
      if (disposed) return;
      if (!element) return;
      if (zen) {
        if (recentWriting) element.scrollTop = element.scrollHeight;
      } else if (!position) {
        element.scrollTop = 0;
      } else {
        const anchor = element.querySelector<HTMLElement>('.typing-character.active, .typing-end-anchor');
        if (anchor) {
          const container = element.getBoundingClientRect();
          const character = anchor.getBoundingClientRect();
          if (character.bottom > container.bottom || character.top < container.top) {
            element.scrollTop += character.top - container.top - element.clientHeight / 3;
          }
        }
      }
      updateCapturePosition(element, area, preview.text ? preview.start : undefined);
    });
    return () => { disposed = true; };
  });

  $effect(() => {
    const element = targetElement;
    const area = writingArea;
    if (!element || !area) return;
    const update = () => updateCapturePosition(element, area, composing && compositionPreview.text ? compositionPreview.start : undefined);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update);
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  });

  onDestroy(clearFeedback);

  function updateCapturePosition(element: HTMLLabelElement, area: HTMLDivElement | undefined, compositionStart?: number) {
    if (!area) return;
    const anchor = element.querySelector<HTMLElement>(compositionStart === undefined
      ? '.typing-character.active, .typing-end-anchor, .zen-caret'
      : `[data-position="${compositionStart}"], .typing-end-anchor, .zen-caret`);
    if (!anchor) return;
    const bounds = anchor.getBoundingClientRect();
    const container = area.getBoundingClientRect();
    capturePosition = { left: bounds.left - container.left, top: bounds.top - container.top, height: bounds.height };
  }

  function generationFailed(error: unknown) {
    if (!(error instanceof ExerciseGenerationError) && !(error instanceof PracticeTextError)) throw error;
    exerciseError = error instanceof DrillPoolError
      ? text('alice-practice.drill-pool-error', {
        p0: text(DRILL_TYPE_LABEL_KEYS[error.drillType]), p1: formatNumber(i18n.language, error.size),
        p2: formatNumber(i18n.language, MINIMUM_DRILL_POOL)
      })
      : error.message;
    clearFeedback();
  }

  function prepareExercise(selected: PracticeSettings) {
    cancelComposition(false);
    clearFeedback();
    sessionId = '';
    missedKeys = {};
    keyAttempts = {};
    handAttempts = { ...EMPTY_HANDS };
    fingerAttempts = {};
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
          quote ??= selectQuote(undefined, Math.random, selected.language ?? 'en');
          session = createSession(quote.text, { mode: 'quote', quoteId: quote.id, language: selected.language ?? 'en' });
          break;
        case 'custom':
          session = customTarget && !editing ? createSession(customTarget, { mode: 'custom', language: selected.language ?? 'en' }) : null;
          break;
        case 'zen':
          session = createZenSession(selected.language ?? 'en');
          break;
        case 'drills': {
          const exercise = generateDrill({
            mode: 'drills', language: selected.language ?? 'en', drillType: selected.drillType,
            wordLimit: selected.wordLimit, bKeyHand: selected.bKeyHand, numbers: selected.numbers
          });
          session = createSession(exercise.target, exercise.configuration, exercise.wordEnds);
          break;
        }
        case 'code':
          snippet ??= selectCodeSnippet(selected.codeLanguage, undefined);
          session = createSession(snippet.text, {
            mode: 'code', language: selected.language ?? 'en', codeLanguage: selected.codeLanguage, snippetId: snippet.id
          });
          break;
        default: throw new ExerciseGenerationError('Unsupported practice mode.');
      }
    } catch (error) {
      session = null;
      generationFailed(error);
    }
    synchronizeInput();
  }

  function changeSettings(next: PracticeSettings) {
    if (running) return;
    if (settings.mode === 'zen') session = null;
    settings = next;
    onsettingschange?.(next);
  }

  function complete() {
    cancelComposition(false);
    clearFeedback();
    if (!submitted && session?.status === 'completed' && oncomplete) {
      submitted = true;
      oncomplete(completedRecord(session, sessionId, startedWallTime, missedKeys, {
        keyAttempts: { ...keyAttempts }, handAttempts: { ...handAttempts }, bKeyHand
      }));
    }
  }

  function refillTarget(required = 0): boolean {
    if (!session || isZenSession(session) || session.configuration?.mode !== 'timed') {
      return true;
    }
    try {
      const configuration = session.configuration;
      while (session.target.length - session.input.length < Math.max(80, required)) {
        session = extendTarget(session, generateExercise(configuration));
      }
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
    directCode = null;
    if (event.key === 'Enter' && !event.isComposing && !composing && event.keyCode !== 229) {
      if (finiteSession && requiresFinish(finiteSession) && finiteSession.input.length === finiteSession.target.length) {
        event.preventDefault();
        finish();
      }
      return;
    }
    if (!active || !focused || composing || (settings.mode === 'custom' && editing)) return;
    if (event.repeat) { event.preventDefault(); return; }
    if (!event.isComposing && !event.ctrlKey && !event.altKey && !event.metaKey
      && /^[\x20-\x7e]$/.test(event.key)) directCode = event.code;
  }

    function synchronizeInput() {
      if (inputElement && !composing) {
        inputElement.value = session ? getAcceptedText(session) : '';
        inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
      }
    }

    function cancelComposition(announce = true) {
      const pending = composing;
      composing = false;
      preedit = '';
      compositionGeneration++;
      activeCompositionGeneration = -1;
      directCode = null;
      if (pending && announce) inputNotice = 'cancelled';
      synchronizeInput();
    }

    function commitNative(value: string) {
      if (!active || !focused || !session || exerciseError || session.status === 'completed') {
        synchronizeInput(); return;
      }
      try {
        now = performance.now();
        if (!isZenSession(session)) session = expireSession(session, now);
        if (session.status === 'completed') { complete(); synchronizeInput(); return; }
        const previous = getAcceptedText(session);
        const next = value.normalize('NFC');
        const result = reconcilePracticeInput(previous, next);
        if (!result.edit) { synchronizeInput(); return; }
        if (!refillTarget(Math.max(0, next.length - previous.length))) { synchronizeInput(); return; }
        const oldStatus = session.status;
        const before = session.totalAttempts;
        const direct = directCode && result.edit.deleteCount === 0 && result.edit.inserted.length === 1
          && result.edit.start === previous.length;
        const correct = !isZenSession(session) && result.edit.inserted[0] === session.target[result.edit.start];
        session = applyCommittedInput(session, next, now);
        if (oldStatus === 'ready' && session.status !== 'ready') {
          sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
          startedWallTime = Date.now();
        }
        if (!zen && direct && directCode) {
          if (!correct && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(directCode) && directCode !== 'Unidentified') {
            missedKeys[directCode] = (missedKeys[directCode] ?? 0) + 1;
          }
          if (layoutCodes.has(directCode)) highlightKey(directCode, correct);
        }
        if (!zen && session.totalAttempts > before) attribute(session.totalAttempts - before, direct ? directCode : null);
        if (!zen && session.totalAttempts > before) oncharacter?.();
        inputNotice = '';
        if (session.status === 'completed') complete();
      } catch (error) {
        if (error instanceof PracticeEditError || error instanceof PracticeTextError) inputNotice = 'rejected';
        else throw error;
      } finally { directCode = null; synchronizeInput(); }
    }

    function attribute(attempts: number, code: string | null) {
      const hands = { ...handAttempts };
      let remaining = attempts;
      if (code && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(code) && code !== 'Unidentified') {
        remaining--;
        keyAttempts[code] = (keyAttempts[code] ?? 0) + 1;
        const target = assignment(code);
        if (!target) hands.unattributed++;
        else {
          const bucket = target.hand === null || target.finger === 'thumb' ? 'thumb' : target.hand;
          hands[bucket]++;
          const finger = bucket === 'thumb' ? 'thumb' : `${target.hand}-${target.finger}`;
          fingerAttempts = { ...fingerAttempts, [finger]: (fingerAttempts[finger] ?? 0) + 1 };
        }
      }
      hands.unattributed += remaining;
      handAttempts = hands;
    }

    function beforeInput(event: InputEvent) {
      if (['insertFromPaste', 'insertFromDrop', 'insertLineBreak', 'insertParagraph', 'historyUndo', 'historyRedo'].includes(event.inputType)) {
        event.preventDefault(); inputNotice = 'unsupported'; return;
      }
      if (composing || event.isComposing) return;
    }

    function nativeInput(event: Event) {
      const element = event.currentTarget;
      if (!(element instanceof HTMLInputElement)) return;
      if (composing) { preedit = element.value; return; }
      if (event instanceof InputEvent && event.isComposing) { synchronizeInput(); return; }
      commitNative(element.value);
    }

    function finish() {
      if (!finiteSession || composing) return;
      session = finishSession(finiteSession, performance.now());
      cancelComposition(false);
      complete();
    }
  function restart() {
    prepareExercise(settings);
  }

  function nextQuote() {
    try {
      quote = selectQuote(quote?.id, Math.random, settings.language ?? 'en');
      prepareExercise(settings);
    } catch (error) { generationFailed(error); }
  }

  function nextSnippet() {
    try {
      snippet = selectCodeSnippet(settings.codeLanguage, snippet?.id);
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
    cancelComposition();
    session = stopSession(session, performance.now());
    complete();
    await tick();
    resultHeading?.focus();
  }
</script>

<section class="practice-panel" data-caret={caretStyle} aria-labelledby="practice-panel-heading" data-status={exerciseError ? 'error' : session?.status ?? 'ready'}>
  <h3 id="practice-panel-heading" class="sr-only" tabindex="-1">{text("practice-panel.typing-practice")}</h3>
  {#if !hasGraphemeSupport()}<p role="alert">{text("practice-panel.update-your-browser-to-use-unicode-practice")}</p>{/if}

  <ModeNavigation mode={settings.mode} disabled={running}
    onmodechange={(mode) => changeSettings({ ...settings, mode })} />

  {#if settings.mode === 'timed' || settings.mode === 'words'}
  <fieldset class="exercise-settings" disabled={running}>
    <legend>{text("practice-panel.practice-options")}</legend>
    {#if timed}
      <label>{text("practice-panel.duration")}
        <select aria-label={text("practice-panel.duration")} value={settings.durationSeconds} onchange={(event) => {
          const durationSeconds = DURATIONS.find((duration) => String(duration) === event.currentTarget.value);
          if (durationSeconds === undefined) throw new Error('Unsupported duration selection.');
          changeSettings({ ...settings, durationSeconds });
        }}>
          {#each DURATIONS as duration}<option value={duration}>{text("practice-panel.seconds", { p0: String(duration) })}</option>{/each}
        </select>
      </label>
    {:else}
      <label>{text("practice-panel.word-limit")}
        <select aria-label={text("practice-panel.word-limit")} value={settings.wordLimit} onchange={(event) => {
          const wordLimit = WORD_LIMITS.find((limit) => String(limit) === event.currentTarget.value);
          if (wordLimit === undefined) throw new Error('Unsupported word-limit selection.');
          changeSettings({ ...settings, wordLimit });
        }}>
          {#each WORD_LIMITS as limit}<option value={limit}>{text("practice-panel.words", { p0: String(limit) })}</option>{/each}
        </select>
      </label>
    {/if}
    <label>{text("practice-panel.vocabulary")}
      <select aria-label={text("practice-panel.vocabulary")} value={settings.wordBankTier} onchange={(event) => {
        const wordBankTier = WORD_BANK_TIERS.find((tier) => String(tier) === event.currentTarget.value);
        if (wordBankTier === undefined) throw new Error('Unsupported vocabulary selection.');
        changeSettings({ ...settings, wordBankTier });
      }}>
        {#each WORD_BANK_TIERS as tier}<option value={tier}>{text("practice-panel.words-2", { p0: String(tier) })}</option>{/each}
      </select>
    </label>
    <label class="modifier"><input type="checkbox" checked={settings.punctuation} onchange={(event) => {
      changeSettings({ ...settings, punctuation: event.currentTarget.checked });
    }} />{text("practice-panel.punctuation")}</label>
    <label class="modifier"><input type="checkbox" checked={settings.numbers} onchange={(event) => {
      changeSettings({ ...settings, numbers: event.currentTarget.checked });
    }} />{text("practice-panel.numbers")}</label>
  </fieldset>
  {#if settings.language === 'vi'}<p class="settings-note">{text('practice.vietnameseTokens')}</p>{/if}
  {/if}
  {#if settings.mode === 'drills'}
  <fieldset class="exercise-settings" disabled={running}>
    <legend>{text("practice-panel.practice-options")}</legend>
    <label>{text("alice-practice.drill-type")}
      <select aria-label={text("alice-practice.drill-type")} aria-describedby="drill-help" value={settings.drillType} onchange={(event) => {
        const drillType = DRILL_TYPES.find((type) => type === event.currentTarget.value);
        if (drillType === undefined) throw new Error('Unsupported drill selection.');
        changeSettings({ ...settings, drillType });
      }}>
        {#each DRILL_TYPES as type}<option value={type}>{text(DRILL_TYPE_LABEL_KEYS[type])}</option>{/each}
      </select>
    </label>
    <label>{text("practice-panel.word-limit")}
      <select aria-label={text("practice-panel.word-limit")} value={settings.wordLimit} onchange={(event) => {
        const wordLimit = WORD_LIMITS.find((limit) => String(limit) === event.currentTarget.value);
        if (wordLimit === undefined) throw new Error('Unsupported word-limit selection.');
        changeSettings({ ...settings, wordLimit });
      }}>
        {#each WORD_LIMITS as limit}<option value={limit}>{text("practice-panel.words", { p0: String(limit) })}</option>{/each}
      </select>
    </label>
    <label>{text("alice-practice.b-key-hand")}
      <select aria-label={text("alice-practice.b-key-hand")} value={settings.bKeyHand} onchange={(event) => {
        const hand = B_KEY_HANDS.find((candidate) => candidate === event.currentTarget.value);
        if (hand === undefined) throw new Error('Unsupported B-key hand selection.');
        changeSettings({ ...settings, bKeyHand: hand });
      }}>
        {#each B_KEY_HANDS as hand}<option value={hand}>{text(HAND_LABEL_KEYS[hand])}</option>{/each}
      </select>
    </label>
    <label class="modifier"><input type="checkbox" checked={settings.numbers || settings.drillType === 'cross-boundary'} disabled={settings.drillType === 'cross-boundary'} onchange={(event) => {
      changeSettings({ ...settings, numbers: event.currentTarget.checked });
    }} />{text("practice-panel.numbers")}</label>
  </fieldset>
  <p id="drill-help" class="settings-note">{text(DRILL_TYPE_HELP_KEYS[settings.drillType])}</p>
  <p class="settings-note">{text("alice-practice.no-enforcement")}</p>
  {#if settings.language === 'vi'}<p class="settings-note">{text("alice-practice.vi-direct-input")}</p>{/if}
  {:else if settings.mode === 'code'}
  <fieldset class="exercise-settings" disabled={running}>
    <legend>{text("practice-panel.practice-options")}</legend>
    <label>{text("alice-practice.code-language")}
      <select aria-label={text("alice-practice.code-language")} value={settings.codeLanguage} onchange={(event) => {
        const codeLanguage = CODE_LANGUAGES.find((language) => language === event.currentTarget.value);
        if (codeLanguage === undefined) throw new Error('Unsupported code-language selection.');
        changeSettings({ ...settings, codeLanguage });
      }}>
        {#each CODE_LANGUAGES as language}<option value={language}>{CODE_LANGUAGE_NAMES[language]}</option>{/each}
      </select>
    </label>
  </fieldset>
  {#if snippet}<p class="quote-attribution" data-snippet-id={snippet.id}>{text("alice-practice.snippet-source", { p0: CODE_LANGUAGE_NAMES[snippet.codeLanguage] })}</p>{/if}
  <button class="secondary-button" type="button" disabled={running} onclick={nextSnippet}>{text("alice-practice.next-snippet")}</button>
  {/if}
  {#if settings.mode === 'quote' && quote}
    <p class="quote-attribution" data-quote-id={quote.id}>{quote.author} - {quote.workTitle}</p>
    <button class="secondary-button" type="button" disabled={running} onclick={nextQuote}>{text("practice-panel.next-quote")}</button>
  {:else if settings.mode === 'custom'}
    <p id="custom-privacy">{text("practice-panel.paste-any-text-you-want-to-practice")}</p>
    <p id="custom-format">{text("practice-panel.up-to-10-000-english-or-vietnamese")}</p>
    {#if editing}
      <label class="custom-label" for="custom-draft">{text("practice-panel.custom-text")}</label>
      <textarea id="custom-draft" bind:value={draft} aria-describedby="custom-privacy custom-format custom-error"
        aria-invalid={Boolean(customError || (draft && customPreparation.error))} spellcheck={false}></textarea>
      <p id="custom-error" class="exercise-error" role={customError ? 'alert' : undefined}>{(customError || (draft ? customPreparation.error : '')) ? text("practice-panel.custom-error", { p0: String(customError || customPreparation.error) }) : ''}</p>
    {:else}
      <p role="status">{text("practice-panel.target-characters-ready-to-practice", { p0: normalized ? text('practice.normalizedReview') : '', p1: formatNumber(i18n.language, customTarget.length) })}</p>
    {/if}
    <div class="custom-actions">
      <button class="secondary-button" type="button" disabled={running || !customPreparation.value} onclick={applyCustom}>{text("practice-panel.apply-text")}</button>
      {#if editing && customTarget}
        <button class="secondary-button" type="button" onclick={() => { editing = false; customError = ''; prepareExercise(settings); }}>{text("practice-panel.cancel-editing")}</button>
      {:else if !editing}
        <button class="secondary-button" type="button" disabled={running} onclick={() => { editing = true; clearFeedback(); }}>{text("practice-panel.edit-text")}</button>
      {/if}
      <button class="secondary-button danger-button" type="button" disabled={running} onclick={() => {
        draft = ''; customTarget = ''; editing = true; customError = ''; session = null;
      }}>{text("practice-panel.clear-text")}</button>
    </div>
  {/if}
  {#if !zen}
  <p class="settings-note">{running ? text("practice-panel.options-are-locked-while-you-type-restart") : text("practice-panel.pick-a-mode-and-options-then-start")}</p>
  {:else}
    <p id="zen-instructions">{text("practice-panel.free-writing-english-and-vietnamese-are-supported")}</p>
  {/if}

  {#if exerciseError}
    <p role="alert" class="exercise-error">{text("practice-panel.we-couldn-t-prepare-this-exercise-choose", { p0: String(exerciseError) })}</p>
  {/if}
  {#if session && !(settings.mode === 'custom' && editing)}
  {#if metrics}
  <div class="practice-toolbar">
    <p class="practice-label">{text("practice-panel.practice", { p0: String(modeLabel) })}</p>

    {#if showLiveStats || session.status === 'completed'}
    <div class="metrics" role="group" aria-label={text("practice-panel.practice-metrics")}>
      <div class="metric">
        <span class="metric-label">{zen ? text("practice-panel.free-writing-wpm") : 'WPM'}</span>
        <span
          class="metric-value"
          aria-label={metrics.wpm === null ? text("practice-panel.not-available") : text("practice-panel.words-per-minute", { p0: String(metrics.wpm) })}
        >{metrics.wpm === null ? '—' : formatNumber(i18n.language, metrics.wpm)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">{text("practice-panel.accuracy")}</span>
        <span
          class="metric-value"
          aria-label={zen ? text("practice-panel.not-applicable-free-writing") : metrics.accuracy === null ? text("practice-panel.not-available") : formatAccuracy(i18n.language, metrics.accuracy)}
        >{zen ? text("practice-panel.not-applicable-free-writing") : metrics.accuracy === null ? '—' : formatAccuracy(i18n.language, metrics.accuracy)}</span>
      </div>
    </div>
    {/if}
  </div>
  {/if}
  {#if zen && session.status === 'completed' && isZenSession(session) && metrics}
    <h4 bind:this={resultHeading} tabindex="-1">{text("practice-panel.zen-stopped")}</h4>
    <p>{text("practice-panel.free-writing-wpm-is-not-target-verified", { p0: formatNumber(i18n.language, metrics.elapsedMs / 1000, 1), p1: String(session.retainedCharacters), p2: String(session.totalAttempts) })}</p>
  {/if}

  {#if !zen}
  <p id="typing-instructions" class="sr-only">
    {text("practice-panel.type-the-text-shown-backspace-fixes-the")}
  </p>
  {/if}
  <div bind:this={writingArea} class="writing-area">
  <input
    bind:this={inputElement}
    id="practice-input"
    class="typing-input"
    style:left={`${capturePosition.left}px`}
    style:top={`${capturePosition.top}px`}
    style:height={`${capturePosition.height}px`}
    type="text"
    disabled={!active || Boolean(exerciseError) || !hasGraphemeSupport()}
    aria-label={zen ? text("practice-panel.zen-writing") : text("practice-panel.typing-practice")}
    aria-describedby={zen ? 'zen-instructions' : 'typing-instructions practice-target'}
    autocomplete="off"
    autocapitalize="off"
    spellcheck={false}
    onkeydown={handleKeydown}
    onbeforeinput={beforeInput}
    oninput={nativeInput}
    onpaste={(event) => { event.preventDefault(); inputNotice = 'unsupported'; }}
    ondrop={(event) => { event.preventDefault(); inputNotice = 'unsupported'; }}
    oncompositionstart={(event) => {
      activeCompositionGeneration = compositionGeneration;
      event.currentTarget.value = session ? getAcceptedText(session) : '';
      composing = true; directCode = null;
    }}
    oncompositionend={(event) => {
      if (activeCompositionGeneration !== compositionGeneration) { synchronizeInput(); return; }
      composing = false; preedit = ''; directCode = null;
      commitNative(event.currentTarget.value);
    }}
    onfocus={() => { focused = true; synchronizeInput(); }}
    onblur={() => { focused = false; cancelComposition(); clearFeedback(); }}
  />
  <label bind:this={targetElement} class="sample-text practice-text" for="practice-input" id="practice-target" lang={session.configuration?.language ?? 'en'}>
    {#if zen}
      <span class="zen-writing">{writing}</span>{#if session.status !== 'completed'}<span class="zen-caret" aria-hidden="true">&nbsp;</span>{/if}
    {:else if finiteSession}
    <span class="sr-only">{finiteSession.target}</span>
    <span aria-hidden="true">{#each targetCharacters as character, index}<span
        class="typing-character"
        class:correct={index < inputCharacters.length && inputCharacters[index] === character}
        class:incorrect={index < inputCharacters.length && inputCharacters[index] !== character}
        class:active={!exerciseError && session.status !== 'completed' && index === inputCharacters.length}
        data-position={index}
      >{character}</span>{/each}</span>
    {#if session.status !== 'completed' && inputCharacters.length === targetCharacters.length}<span class="typing-end-anchor" aria-hidden="true">&nbsp;</span>{/if}
    {/if}
  </label>
  {#if composing && compositionPreview.text}<span class="preedit" aria-hidden="true"
    style:left={`${capturePosition.left}px`} style:top={`${capturePosition.top}px`}
    style:max-width={`calc(100% - ${capturePosition.left}px)`}>{compositionPreview.text}</span>{/if}
  </div>
  {#if inputNotice}<p role="status">{inputNotice === 'cancelled'
    ? text("practice-panel.uncommitted-input-was-cancelled")
    : text("practice-panel.this-edit-is-not-supported-or-exceeds")}</p>{/if}

  {#if progress}
  <div class="exercise-progress">
    <label for="session-progress">{timed ? text("practice-panel.elapsed-time") : wordProgress ? text("practice-panel.completed-words") : text("practice-panel.consumed-target-characters")}</label>
    <span id="progress-description">{formatNumber(i18n.language, timed ? Math.floor(progress.value) : progress.value)} / {formatNumber(i18n.language, progress.maximum)} {timed ? text("practice-panel.seconds-2") : wordProgress ? text("practice-panel.words-3") : text("practice-panel.characters")}</span>
    <progress id="session-progress" max={progress.maximum} value={progress.value} aria-describedby="progress-description"></progress>
  </div>
  {/if}
  {/if}

  {#if !zen}
  <AliceKeyboardVisualizer {layout} {feedback} testLayoutLabel={layoutLabel} {browserLegends}
    {inertKeys} {viewBox} layoutSource={layoutConfirmed ? 'confirmed' : 'generic'} expected={guideExpected} />
  {#if guideActive}
    <p class="guide-caption" data-guide-key={guideKey?.code ?? ''}>{guideCaption}{#if !layoutMap} <span class="guide-reference">{text("alice-practice.guide-reference")}</span>{/if}</p>
    <p class="sr-only" aria-live="polite">{guideAnnouncement}</p>
  {/if}
  {/if}

  <div class="practice-bottom">
    {#if !zen}<p class="session-note" role="status">{exerciseError ? text("practice-panel.practice-stopped-choose-restart-for-a-new") : statusMessage}</p>{/if}
    <div class="practice-actions">
      {#if session && !exerciseError && session.status !== 'completed' && !(settings.mode === 'custom' && editing)}
        <button
          class="start-button"
          type="button"
          onclick={() => inputElement?.focus()}
        >{zen ? text("practice-panel.focus-writing") : session.status === 'ready' ? text("practice-panel.start-typing") : focused ? text("practice-panel.typing") : text("practice-panel.resume-typing")}</button>
      {/if}
      {#if finiteSession && requiresFinish(finiteSession) && finiteSession.status !== 'completed'}
        <button class="secondary-button" type="button" disabled={composing || finiteSession.status !== 'running' || inputCharacters.length !== targetCharacters.length} onclick={finish}>{text("practice-panel.finish")}</button>
      {/if}
      {#if zen}<button class="secondary-button" type="button" disabled={session?.status !== 'running'} onclick={stop}>{text("practice-panel.stop")}</button>{/if}
      <button class="restart-button danger-button" type="button" onclick={restart}>{text("practice-panel.restart")}</button>
    </div>
  </div>

  {#if showHandBalance}
    <HandBalance hands={handAttempts} fingers={fingerAttempts} heading={text("alice-practice.hand-balance")} live />
  {/if}

  <fieldset class="preferences" disabled={running}>
    <legend>{text("practice-panel.display-and-sound")}</legend>
    <label>{text("practice-panel.caret-style")}
      <select value={caretStyle} onchange={(event) => {
        const next = CARET_STYLES.find((style) => style === event.currentTarget.value);
        if (!next) throw new Error('Unsupported caret selection.');
        oncaretchange?.(next);
      }}>
        {#each CARET_STYLES as style}<option value={style}>{{block: text("practice-panel.block"), line: text("practice-panel.line"), underline: text("practice-panel.underline")}[style]}</option>{/each}
      </select>
    </label>
    <label class="modifier"><input type="checkbox" checked={showLiveStats}
      onchange={(event) => onlivestatschange?.(event.currentTarget.checked)} />{text("practice-panel.show-live-wpm-and-accuracy")}</label>
    <label class="modifier"><input type="checkbox" checked={soundEnabled}
      onchange={(event) => onsoundchange?.(event.currentTarget.checked)} />{text("practice-panel.typing-sound")}</label>
    {#if !zen}
    <label class="modifier"><input type="checkbox" checked={fingerGuide} aria-describedby="finger-guide-note"
      onchange={(event) => onfingerguidechange?.(event.currentTarget.checked)} />{text("alice-practice.finger-guide")}</label>
    <p id="finger-guide-note" class="settings-note">{text("alice-practice.finger-guide-note")}</p>
    {/if}
    <p class="settings-note">{text("practice-panel.results-and-history-are-saved-even-when")}</p>
    <button type="button" class="secondary-button danger-button" onclick={() => { confirmingReset = true; }}>{text("practice-panel.restore-defaults")}</button>
  </fieldset>
</section>

{#if confirmingReset}
  <ConfirmationDialog
    title={text("practice-panel.restore-default-preferences")}
    message={text("practice-panel.this-resets-your-language-to-english-practice")}
    confirmText={text("practice-panel.restore-defaults")}
    oncancel={() => { confirmingReset = false; }}
    onconfirm={() => { confirmingReset = false; onreset?.(); }}
  />
{/if}

<style>
  .guide-caption { margin: 0.5rem 0 0; color: var(--color-text); font-weight: 600; }
  .guide-reference { color: var(--color-muted); font-weight: 400; font-size: 0.85em; }
  .writing-area { position: relative; margin-block: 2rem; }
  .typing-input {
    position: absolute;
    width: 1px;
    min-width: 1px;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    pointer-events: none;
  }
  .typing-input, .preedit {
    font: inherit;
    font-size: clamp(1.35rem, 3vw, 2.15rem);
    font-weight: 420;
    letter-spacing: -0.025em;
    line-height: normal;
  }
  .preedit {
    position: absolute;
    max-width: 100%;
    background: var(--color-surface);
    color: var(--color-accent);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    text-decoration: underline;
    pointer-events: none;
  }
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
  .custom-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-block: 0.75rem; }
  .zen-caret { background: var(--color-accent); }
  [data-caret="line"] .zen-caret { background: transparent; border-left: 2px solid var(--color-accent); }
  [data-caret="underline"] .zen-caret { background: transparent; border-bottom: 2px solid var(--color-accent); }
  .practice-text {
    display: block;
    cursor: text;
    border-radius: 0.25rem;
    white-space: pre-wrap;
    max-height: 15rem;
    margin: 0;
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

  .writing-area:focus-within .practice-text,
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

  .typing-character.active, .typing-end-anchor {
    color: var(--color-background);
    background: var(--color-accent);
    box-shadow: -2px 0 var(--color-accent);
  }

  [data-caret='line'] .typing-character.active, [data-caret='line'] .typing-end-anchor {
    color: var(--color-text);
    background: transparent;
    box-shadow: -2px 0 var(--color-accent);
  }

  [data-caret='underline'] .typing-character.active, [data-caret='underline'] .typing-end-anchor {
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
