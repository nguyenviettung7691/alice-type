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
      <p class="empty-state">No saved sessions yet. Complete a Timed or Words exercise to see your progress.</p>
    {:else}
      <dl class="stats-summary">
        <div><dt>Completed sessions</dt><dd>{summary.count}</dd></div>
        <div><dt>Best WPM</dt><dd>{summary.bestWpm}</dd></div>
        <div><dt>Average WPM</dt><dd>{summary.averageWpm}</dd></div>
        <div><dt>Average accuracy</dt><dd>{summary.averageAccuracy}%</dd></div>
      </dl>
      <p class="panel-copy">Averages are the arithmetic mean of each session's WPM and accuracy.</p>
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
                <td>{record.mode === 'timed' ? 'Timed' : 'Words'} / {record.limit} {record.mode === 'timed' ? 'seconds' : 'words'}</td>
                <td>{record.wpm}</td><td>{record.accuracy.toFixed(1)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <h3>Most-missed physical keys</h3>
      <p class="panel-copy">Incorrect attempts, including mistakes later corrected. Codes identify physical positions, not detected key legends. Missing codes are excluded.</p>
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
