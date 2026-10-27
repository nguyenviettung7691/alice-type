<script lang="ts">
  import { StorageError } from '../storage/errors';
  import { SessionHistory, summarizeSessions, type SessionRecord } from '../storage/session-history';
  import ConfirmationDialog from './ConfirmationDialog.svelte';

  let { history, revision, pending }: {
    history: SessionHistory;
    revision: number;
    pending: boolean;
  } = $props();
  let records = $state<SessionRecord[]>([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');
  let confirming = $state(false);
  let clearing = $state(false);
  let refresh = $state(0);
  const summary = $derived(summarizeSessions(records));

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
      <dl class="stats-summary">
        <div><dt>Completed sessions</dt><dd>{summary.count}</dd></div>
        <div><dt>Target-copying sessions</dt><dd>{summary.targetCount}</dd></div>
        <div><dt>Best target-verified WPM</dt><dd>{summary.bestWpm ?? 'Not available'}</dd></div>
        <div><dt>Average target-verified WPM</dt><dd>{summary.averageWpm ?? 'Not available'}</dd></div>
        <div><dt>Average target-copying accuracy</dt><dd>{summary.averageAccuracy === null ? 'Not available' : `${summary.averageAccuracy}%`}</dd></div>
        {#if summary.zenCount}
          <div><dt>Zen sessions</dt><dd>{summary.zenCount}</dd></div>
          <div><dt>Best free-writing WPM</dt><dd>{summary.zenBestWpm}</dd></div>
          <div><dt>Average free-writing WPM</dt><dd>{summary.zenAverageWpm}</dd></div>
        {/if}
      </dl>
      <p class="panel-copy">Target-verified WPM and accuracy summarize only Timed, Words, Quote, and Custom sessions. Averages are arithmetic per-session means. Zen free-writing WPM measures retained writing, is not target-verified, and is summarized separately.</p>
      <h3>Recent sessions</h3>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (The history table needs native keyboard scrolling on narrow screens.) -->
      <div class="history-scroll" role="region" aria-label="Session history table" tabindex="0">
        <table>
          <caption class="sr-only">Completed sessions, newest first</caption>
          <thead><tr><th scope="col">Completed</th><th scope="col">Mode / limit</th><th scope="col">WPM</th><th scope="col">Accuracy</th></tr></thead>
          <tbody>
            {#each records as record (record.id)}
              <tr>
                <td><time datetime={new Date(record.completedAt).toISOString()} title={new Date(record.completedAt).toString()}>{new Date(record.completedAt).toLocaleString()}</time></td>
                <td>{modeLabel(record)}</td>
                <td>{record.mode === 'zen' ? `Free-writing WPM: ${record.wpm}` : record.wpm}</td>
                <td>{record.accuracy === null ? 'Not applicable' : `${record.accuracy.toFixed(1)}%`}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <h3>Most-missed physical keys</h3>
      <p class="panel-copy">Target-copying incorrect attempts, including mistakes later corrected. Zen is excluded. Codes identify physical positions, not detected key legends. Missing codes are excluded.</p>
      {#if summary.missedKeys.length}
        <ul class="missed-keys">
          {#each summary.missedKeys as [code, count]}<li><code>{code}</code>: {count}</li>{/each}
        </ul>
      {:else}<p>No physical-key errors recorded.</p>{/if}
    {/if}
  {/if}
  {#if pending}<p class="panel-copy">Resolve pending session saves before clearing history.</p>{/if}
  <div class="panel-actions">
    <button class="secondary-button" type="button" disabled={loading || clearing} onclick={() => { message = ''; refresh += 1; }}>Refresh history</button>
    <button class="secondary-button" type="button" disabled={pending || loading || clearing} onclick={() => { confirming = true; }}>Clear history</button>
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
