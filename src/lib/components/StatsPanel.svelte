<script lang="ts">
  import { StorageError } from '../storage/errors';
  import { MAX_SESSION_HISTORY, MINIMUM_KEY_ATTEMPTS, SessionHistory, summarizeAttribution, summarizeSessions, type SessionRecord } from '../storage/session-history';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import HandBalance from './HandBalance.svelte';
  import SessionProgressChart from './SessionProgressChart.svelte';
  import { type AliceKey, type InertKey } from '../keyboard/alice-layout';
  import { useLocalization } from '../i18n/context';
  import { compareLabels, formatAccuracy, formatDate, formatNumber } from '../i18n/format';
  import { LANGUAGES, getLanguage, type LanguageId } from '../i18n/languages';
  import { DRILL_TYPE_LABEL_KEYS } from '../i18n/alice-messages';
  import { CODE_LANGUAGE_NAMES } from '../typing/exercise-generator';
  const i18n = useLocalization();
  const { text } = i18n;
  const number = (value: number | null) => value === null ? text("practice-panel.not-available") : formatNumber(i18n.language, value);

  let { history, revision, pending, layout, layoutLabel, inertKeys = [], viewBox, layoutConfirmed, browserLegends }: {
    history: SessionHistory;
    revision: number;
    pending: boolean;
    layout: readonly AliceKey[];
    layoutLabel: string;
    inertKeys?: readonly InertKey[];
    viewBox?: string;
    layoutConfirmed: boolean;
    browserLegends: boolean;
  } = $props();
  let records = $state<SessionRecord[]>([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');
  let confirming = $state(false);
  let clearing = $state(false);
  let refresh = $state(0);
  const summary = $derived(summarizeSessions(records));
  const missedCounts = $derived(Object.fromEntries(summary.missedKeys));
  const layoutCodes = $derived(new Set(layout.map((key) => key.code)));
  const unmappedMisses = $derived(summary.missedKeys.filter(([code]) => !layoutCodes.has(code)));
  let attributionLanguage = $state<LanguageId | 'all'>('all');
  const attribution = $derived(summarizeAttribution(attributionLanguage === 'all'
    ? records : records.filter((record) => (record.language ?? 'en') === attributionLanguage)));

  type SortKey = 'completedAt' | 'mode' | 'wpm' | 'accuracy';
  let sortKey = $state<SortKey>('completedAt');
  let sortDirection = $state<'asc' | 'desc'>('desc');
  const sortedRecords = $derived.by(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const value = (record: SessionRecord): number | string | null => {
      switch (sortKey) {
        case 'completedAt': return record.completedAt;
        case 'mode': return modeLabel(record);
        case 'wpm': return record.wpm;
        case 'accuracy': return record.accuracy;
      }
    };
    return [...records].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === 'string' && typeof y === 'string' ? compareLabels(i18n.language, x, y) : Number(x) - Number(y)) * direction;
    });
  });

  function sortBy(key: SortKey) {
    if (sortKey === key) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDirection = key === 'mode' ? 'asc' : 'desc'; }
  }

  function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    return sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  function percentColor(value: number): string {
    const percent = Math.min(100, Math.max(0, value));
    return `color-mix(in srgb, var(--color-accent) ${percent}%, #fff)`;
  }

  function modeLabel(record: SessionRecord): string {
    switch (record.mode) {
      case 'timed': return text("stats-panel.timed-seconds", { p0: number(record.limit) });
      case 'words': return text("stats-panel.words-words", { p0: number(record.limit) });
      case 'quote': return text("stats-panel.quote-characters", { p0: number(record.targetCharacters) });
      case 'custom': return text("stats-panel.custom-characters", { p0: number(record.targetCharacters) });
      case 'drills': return text("stats-panel.drills-words", { p0: text(DRILL_TYPE_LABEL_KEYS[record.drillType]), p1: number(record.limit) });
      case 'code': return text("stats-panel.code-snippet", { p0: CODE_LANGUAGE_NAMES[record.codeLanguage] });
      case 'zen': return text("stats-panel.zen-manual-stop-seconds", { p0: formatNumber(i18n.language, record.elapsedMs / 1000, 1) });
    }
  }

  $effect(() => {
    revision;
    refresh;
    let active = true;
    loading = true;
    error = '';
    history.read().then((saved) => {
      if (active) records = saved;
    }).catch((failure: unknown) => {
      if (!(failure instanceof StorageError)) throw failure;
      if (active) error = failure.message;
    }).finally(() => { if (active) loading = false; });
    return () => { active = false; };
  });

  async function clear() {
    confirming = false;
    clearing = true;
    error = '';
    try {
      await history.clear();
      records = [];
      message = 'Local session history deleted.';
      refresh += 1;
    } catch (failure) {
      if (!(failure instanceof StorageError)) throw failure;
      error = failure.message;
    } finally {
      clearing = false;
    }
  }
</script>

<section class="practice-panel stats-panel" aria-labelledby="stats-heading">
  <p class="eyebrow">{text("stats-panel.a-little-progress-every-day")}</p>
  <h2 id="stats-heading" tabindex="-1">{text("stats-panel.stats")}</h2>
  <p class="panel-copy">{text("stats-panel.completed-practice-sessions-stored-only-in-this")}</p>
  {#if error}
    <div class="notice" role="alert">
      <p>{text("stats-panel.history-error", { p0: String(error) })}</p>
      <button class="secondary-button" type="button" onclick={() => { refresh += 1; }}>{text("stats-panel.retry-loading-history")}</button>
    </div>
  {/if}
  {#if message}<p role="status">{text("stats-panel.local-session-history-deleted")}</p>{/if}
  {#if loading}
    <p>{text("stats-panel.loading-local-history")}</p>
  {:else if !error}
    {#if !records.length}
      <p class="empty-state">{text("stats-panel.no-saved-sessions-yet-complete-a-timed")}</p>
    {:else}
      <section class="stats-section" aria-labelledby="stats-summary-heading">
        <div class="stats-section-heading">
          <h3 id="stats-summary-heading">{text("stats-panel.stats-summary")}</h3>
          <span class="stats-badge">{text("stats-panel.all-time-all-languages")}</span>
        </div>
        <dl class="stats-summary">
          <div><dt>{text("stats-panel.completed-sessions")}</dt><dd>{number(summary.count)}</dd></div>
          <div><dt>{text("stats-panel.target-copying-sessions")}</dt><dd>{number(summary.targetCount)}</dd></div>
          <div><dt>{text("stats-panel.best-target-verified-wpm")}</dt><dd>{number(summary.bestWpm)}</dd></div>
          <div><dt>{text("stats-panel.average-target-verified-wpm")}</dt><dd>{number(summary.averageWpm)}</dd></div>
          {#if summary.legacyAccuracy !== null}
            <div><dt>{text("stats-panel.historical-keystroke-accuracy")}</dt><dd><span class="percent-value" style:color={percentColor(summary.legacyAccuracy)}>{formatAccuracy(i18n.language, summary.legacyAccuracy)}</span></dd></div>
          {/if}
          <div><dt>{text("stats-panel.committed-text-accuracy")}</dt><dd>{#if summary.committedAccuracy === null}{text("practice-panel.not-available")}{:else}<span class="percent-value" style:color={percentColor(summary.committedAccuracy)}>{formatAccuracy(i18n.language, summary.committedAccuracy)}</span>{/if}</dd></div>
          {#if summary.zenCount}
            <div><dt>{text("stats-panel.zen-sessions")}</dt><dd>{number(summary.zenCount)}</dd></div>
            <div><dt>{text("stats-panel.best-free-writing-wpm")}</dt><dd>{number(summary.zenBestWpm)}</dd></div>
            <div><dt>{text("stats-panel.average-free-writing-wpm")}</dt><dd>{number(summary.zenAverageWpm)}</dd></div>
          {/if}
        </dl>
        <p class="panel-copy">{text("stats-panel.target-verified-wpm-and-accuracy-summarize-timed")}</p>
      </section>
      <section class="stats-section" aria-labelledby="recent-sessions-heading">
        <div class="stats-section-heading">
          <div>
            <h3 id="recent-sessions-heading">{text("stats-panel.recent-sessions")}</h3>
            <p class="panel-copy">{text("stats-panel.newest-first-by-default-select-a-column", { p0: number(MAX_SESSION_HISTORY) })}</p>
          </div>
          <span class="stats-badge">{text("stats-panel.saved", { p0: number(summary.count) })}</span>
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (The history table needs native keyboard scrolling on narrow screens.) -->
        <div class="history-scroll" role="region" aria-label={text("stats-panel.session-history-table")} tabindex="0">
          <table>
            <caption class="sr-only">{text("stats-panel.completed-sessions-sortable-by-column")}</caption>
            <thead><tr>
              {#each [['completedAt', 'Completed'], ['mode', 'Mode / limit'], ['wpm', 'WPM'], ['accuracy', 'Accuracy']] as const as [key, label]}
                <th scope="col" aria-sort={ariaSort(key)}>
                  <button class="sort-button" type="button" onclick={() => sortBy(key)}>
                    {{completedAt: text("stats-panel.completed"), mode: text("stats-panel.mode-limit"), wpm: 'WPM', accuracy: text("practice-panel.accuracy")}[key]}<span aria-hidden="true">{sortKey === key ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              {/each}
              <th scope="col">{text("stats-panel.language")}</th>
            </tr></thead>
            <tbody>
              {#each sortedRecords as record (record.id)}
                <tr>
                  <td><time datetime={new Date(record.completedAt).toISOString()}>{formatDate(i18n.language, record.completedAt)}</time></td>
                  <td>{modeLabel(record)}</td>
                  <td>{record.mode === 'zen' ? text("stats-panel.free-writing-wpm", { p0: number(record.wpm) }) : number(record.wpm)}</td>
                  <td>{#if record.accuracy === null}{text("stats-panel.not-applicable")}{:else}<span class="percent-value" style:color={percentColor(record.accuracy)}>{formatAccuracy(i18n.language, record.accuracy)}</span>
                    <span class="sr-only">{record.scoringVersion ? text("stats-panel.committed-text-accuracy") : text("stats-panel.historical-keystroke-accuracy")}</span>{/if}</td>
                  <td>{text(getLanguage(record.language ?? 'en').labelKey)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <SessionProgressChart {records} {modeLabel} />
      </section>
      <section class="stats-section" aria-labelledby="missed-keys-heading">
        <div class="stats-section-heading">
          <h3 id="missed-keys-heading">{text("stats-panel.most-missed-physical-keys")}</h3>
          <span class="stats-badge">{layoutLabel}</span>
        </div>
        <p class="panel-copy">{text("stats-panel.target-copying-incorrect-attempts-including-corrected-mistakes")}</p>
        <AliceKeyboardVisualizer {layout} {inertKeys} {viewBox} {browserLegends}
          testLayoutLabel={layoutLabel} layoutSource={layoutConfirmed ? 'confirmed' : 'generic'}
          title={text("stats-panel.missed-key-heatmap")} {missedCounts} />
        {#if !summary.missedKeys.length}<p class="empty-state">{text("stats-panel.no-physical-key-errors-recorded-all-mapped")}</p>{/if}
        {#if unmappedMisses.length}
          <div class="unmapped-misses">
            <h4>{text("stats-panel.keys-outside-the-selected-layout")}</h4>
            <p class="panel-copy">{text("stats-panel.these-historical-physical-codes-have-no-keycap")}</p>
            <ul>
              {#each unmappedMisses as [code, count]}<li><code>{code}</code>: {count === 1 ? text("stats-panel.1-miss") : text("stats-panel.misses", { p0: String(number(count)) })}</li>{/each}
            </ul>
          </div>
        {/if}
      </section>
      <section class="stats-section" aria-labelledby="hand-load-heading">
        <div class="stats-section-heading">
          <h3 id="hand-load-heading">{text("stats-panel.hand-load-heading")}</h3>
          <label class="stats-language">{text("stats-panel.attribution-language")}
            <select value={attributionLanguage} onchange={(event) => { attributionLanguage = event.currentTarget.value as typeof attributionLanguage; }}>
              <option value="all">{text("stats.allLanguages")}</option>
              {#each Object.keys(LANGUAGES) as LanguageId[] as language (language)}<option value={language}>{text(getLanguage(language).labelKey)}</option>{/each}
            </select>
          </label>
        </div>
        <p class="panel-copy">{text("stats-panel.hand-load-copy")}</p>
        {#if attribution.excluded}<p class="panel-copy" data-excluded={attribution.excluded}>{text("stats-panel.older-sessions-excluded", { p0: number(attribution.excluded) })}</p>{/if}
        {#if !attribution.included}
          <p class="empty-state">{text("stats-panel.no-attributed-sessions")}</p>
        {:else}
          <HandBalance hands={attribution.hands} heading={text("stats-panel.hand-balance-all")} />
          <h4>{text("stats-panel.per-key-accuracy")}</h4>
          <p class="panel-copy">{text("stats-panel.per-key-accuracy-copy", { p0: number(MINIMUM_KEY_ATTEMPTS) })}</p>
          {#if attribution.keys.length}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex (The per-key table needs native keyboard scrolling on narrow screens.) -->
            <div class="history-scroll" role="region" aria-label={text("stats-panel.per-key-accuracy")} tabindex="0">
              <table class="key-accuracy">
                <thead><tr>
                  <th scope="col">{text("stats-panel.key")}</th>
                  <th scope="col">{text("stats-panel.attempts")}</th>
                  <th scope="col">{text("stats-panel.misses-column")}</th>
                  <th scope="col">{text("practice-panel.accuracy")}</th>
                </tr></thead>
                <tbody>
                  {#each attribution.keys as key (key.code)}
                    <tr data-key-code={key.code}><th scope="row"><code>{key.code}</code></th><td>{number(key.attempts)}</td><td>{number(key.misses)}</td><td>{formatAccuracy(i18n.language, key.accuracy)}</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="empty-state">{text("stats-panel.no-keys-with-enough-attempts", { p0: number(MINIMUM_KEY_ATTEMPTS) })}</p>
          {/if}
          <h4>{text("stats-panel.reach-keys")}</h4>
          <p class="panel-copy">{text("stats-panel.reach-keys-copy")}</p>
          <dl class="reach-summary">
            <div><dt>{text("stats-panel.reach-accuracy")}</dt><dd>{attribution.reachAccuracy === null ? text("practice-panel.not-available") : formatAccuracy(i18n.language, attribution.reachAccuracy)}</dd></div>
            <div><dt>{text("stats-panel.home-row-accuracy")}</dt><dd>{attribution.homeRowAccuracy === null ? text("practice-panel.not-available") : formatAccuracy(i18n.language, attribution.homeRowAccuracy)}</dd></div>
          </dl>
          {#if attribution.reachKeys.length}
            <ul class="reach-keys">
              {#each attribution.reachKeys.slice(0, 5) as key (key.code)}<li><code>{key.code}</code>: {formatAccuracy(i18n.language, key.accuracy)}</li>{/each}
            </ul>
          {/if}
        {/if}
      </section>
    {/if}
  {/if}
  {#if pending}<p class="panel-copy">{text("stats-panel.resolve-pending-session-saves-before-clearing-history")}</p>{/if}
  <div class="panel-actions">
    <button class="secondary-button" type="button" disabled={loading || clearing} onclick={() => { message = ''; refresh += 1; }}>{text("stats-panel.refresh-history")}</button>
    <button class="secondary-button danger-button" type="button" disabled={pending || loading || clearing} onclick={() => { confirming = true; }}>{text("stats-panel.clear-history")}</button>
  </div>
</section>

{#if confirming}
  <ConfirmationDialog
    title={text("stats-panel.delete-local-session-history")}
    message={text("stats-panel.all-saved-scores-and-missed-key-statistics")}
    confirmText={text("stats-panel.delete-history")}
    oncancel={() => { confirming = false; }}
    onconfirm={clear}
  />
{/if}
