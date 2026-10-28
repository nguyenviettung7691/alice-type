<script lang="ts">
  import { StorageError } from '../storage/errors';
  import { MAX_SESSION_HISTORY, SessionHistory, summarizeSessions, type SessionRecord } from '../storage/session-history';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  import AliceKeyboardVisualizer from './AliceKeyboardVisualizer.svelte';
  import { type AliceKey, type InertKey } from '../keyboard/alice-layout';

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
      return (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y)) * direction;
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
      case 'timed': return `Timed / ${record.limit} seconds`;
      case 'words': return `Words / ${record.limit} words`;
      case 'quote': return `Quote / ${record.targetCharacters} characters`;
      case 'custom': return `Custom / ${record.targetCharacters} characters`;
      case 'zen': return `Zen / Manual stop / ${(record.elapsedMs / 1000).toFixed(1)} seconds`;
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
  <p class="eyebrow">A little progress, every day</p>
  <h2 id="stats-heading" tabindex="-1">Stats</h2>
  <p class="panel-copy">Completed practice sessions, stored only in this browser. Clearing browser data also removes this history.</p>
  {#if error}
    <div class="notice" role="alert">
      <p>{error}</p>
      <button class="secondary-button" type="button" onclick={() => { refresh += 1; }}>Retry loading history</button>
    </div>
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if loading}
    <p>Loading local history...</p>
  {:else if !error}
    {#if !records.length}
      <p class="empty-state">No saved sessions yet. Complete a Timed, Words, Quote, or Custom exercise, or stop a Zen session to see your progress.</p>
    {:else}
      <section class="stats-section" aria-labelledby="stats-summary-heading">
        <div class="stats-section-heading">
          <h3 id="stats-summary-heading">Stats summary</h3>
          <span class="stats-badge">All time</span>
        </div>
        <dl class="stats-summary">
          <div><dt>Completed sessions</dt><dd>{summary.count}</dd></div>
          <div><dt>Target-copying sessions</dt><dd>{summary.targetCount}</dd></div>
          <div><dt>Best target-verified WPM</dt><dd>{summary.bestWpm ?? 'Not available'}</dd></div>
          <div><dt>Average target-verified WPM</dt><dd>{summary.averageWpm ?? 'Not available'}</dd></div>
          <div><dt>Average target-copying accuracy</dt><dd>{#if summary.averageAccuracy === null}Not available{:else}<span class="percent-value" style:color={percentColor(Number(summary.averageAccuracy))}>{summary.averageAccuracy}%</span>{/if}</dd></div>
          {#if summary.zenCount}
            <div><dt>Zen sessions</dt><dd>{summary.zenCount}</dd></div>
            <div><dt>Best free-writing WPM</dt><dd>{summary.zenBestWpm}</dd></div>
            <div><dt>Average free-writing WPM</dt><dd>{summary.zenAverageWpm}</dd></div>
          {/if}
        </dl>
        <p class="panel-copy">Target-verified WPM and accuracy summarize only Timed, Words, Quote, and Custom sessions. Averages are arithmetic per-session means. Zen free-writing WPM measures retained writing, is not target-verified, and is summarized separately.</p>
      </section>
      <section class="stats-section" aria-labelledby="recent-sessions-heading">
        <div class="stats-section-heading">
          <div>
            <h3 id="recent-sessions-heading">Recent sessions</h3>
            <p class="panel-copy">Newest first by default; select a column heading to sort. Up to {MAX_SESSION_HISTORY} sessions are kept; the oldest are removed beyond that.</p>
          </div>
          <span class="stats-badge">{summary.count} saved</span>
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (The history table needs native keyboard scrolling on narrow screens.) -->
        <div class="history-scroll" role="region" aria-label="Session history table" tabindex="0">
          <table>
            <caption class="sr-only">Completed sessions, sortable by column</caption>
            <thead><tr>
              {#each [['completedAt', 'Completed'], ['mode', 'Mode / limit'], ['wpm', 'WPM'], ['accuracy', 'Accuracy']] as const as [key, label]}
                <th scope="col" aria-sort={ariaSort(key)}>
                  <button class="sort-button" type="button" onclick={() => sortBy(key)}>
                    {label}<span aria-hidden="true">{sortKey === key ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              {/each}
            </tr></thead>
            <tbody>
              {#each sortedRecords as record (record.id)}
                <tr>
                  <td><time datetime={new Date(record.completedAt).toISOString()} title={new Date(record.completedAt).toString()}>{new Date(record.completedAt).toLocaleString()}</time></td>
                  <td>{modeLabel(record)}</td>
                  <td>{record.mode === 'zen' ? `Free-writing WPM: ${record.wpm}` : record.wpm}</td>
                  <td>{#if record.accuracy === null}Not applicable{:else}<span class="percent-value" style:color={percentColor(record.accuracy)}>{record.accuracy.toFixed(1)}%</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
      <section class="stats-section" aria-labelledby="missed-keys-heading">
        <div class="stats-section-heading">
          <h3 id="missed-keys-heading">Most-missed physical keys</h3>
          <span class="stats-badge">{layoutLabel}</span>
        </div>
        <p class="panel-copy">Target-copying incorrect attempts, including mistakes later corrected. Zen is excluded. Codes identify physical positions, not detected key legends. Missing codes are excluded.</p>
        <AliceKeyboardVisualizer {layout} {inertKeys} {viewBox} {browserLegends}
          testLayoutLabel={layoutLabel} layoutSource={layoutConfirmed ? 'confirmed' : 'generic'}
          title="Missed-key heatmap" {missedCounts} />
        {#if !summary.missedKeys.length}<p class="empty-state">No physical-key errors recorded. All mapped keys show zero misses.</p>{/if}
        {#if unmappedMisses.length}
          <div class="unmapped-misses">
            <h4>Keys outside the selected layout</h4>
            <p class="panel-copy">These historical physical codes have no keycap in this layout. They still contribute to the heat ceiling.</p>
            <ul>
              {#each unmappedMisses as [code, count]}<li><code>{code}</code>: {count} {count === 1 ? 'miss' : 'misses'}</li>{/each}
            </ul>
          </div>
        {/if}
      </section>
    {/if}
  {/if}
  {#if pending}<p class="panel-copy">Resolve pending session saves before clearing history.</p>{/if}
  <div class="panel-actions">
    <button class="secondary-button" type="button" disabled={loading || clearing} onclick={() => { message = ''; refresh += 1; }}>Refresh history</button>
    <button class="secondary-button danger-button" type="button" disabled={pending || loading || clearing} onclick={() => { confirming = true; }}>Clear history</button>
  </div>
</section>

{#if confirming}
  <ConfirmationDialog
    title="Delete local session history?"
    message="All saved scores and missed-key statistics in this browser will be permanently deleted. Your preferences will remain."
    confirmText="Delete history"
    oncancel={() => { confirming = false; }}
    onconfirm={clear}
  />
{/if}
