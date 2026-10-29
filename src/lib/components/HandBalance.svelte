<script lang="ts">
  import type { HandAttempts } from '../storage/session-history';
  import { FINGERS, HANDS, type Finger, type Hand } from '../keyboard/finger-map';
  import { useLocalization } from '../i18n/context';
  import { formatAccuracy, formatNumber } from '../i18n/format';
  import { FINGER_LABEL_KEYS, HAND_LABEL_KEYS } from '../i18n/alice-messages';
  const i18n = useLocalization();
  const { text } = i18n;

  let { hands, fingers, heading, live = false }: {
    hands: HandAttempts;
    /** Direct attempts per `hand-finger` (thumbs keyed `thumb`); omitted in aggregated history. */
    fingers?: Readonly<Record<string, number>>;
    heading: string;
    live?: boolean;
  } = $props();

  const sided = $derived(hands.left + hands.right);
  const leftShare = $derived(sided ? Math.round((hands.left / sided) * 1000) / 10 : 0);
  const rightShare = $derived(sided ? Math.round((1000 - leftShare * 10)) / 10 : 0);
  const fingerRows = $derived(fingers ? [
    ...HANDS.flatMap((hand: Hand) => FINGERS.filter((finger: Finger) => finger !== 'thumb').map((finger) => ({
      label: text('alice-practice.hand-finger', { p0: text(HAND_LABEL_KEYS[hand]), p1: text(FINGER_LABEL_KEYS[finger]) }),
      count: fingers?.[`${hand}-${finger}`] ?? 0
    }))),
    { label: text('alice-practice.thumbs'), count: fingers.thumb ?? 0 }
  ] : []);
</script>

<section class="hand-balance" aria-label={heading} data-live={live ? 'true' : undefined}>
  <p class="hand-heading">{heading}</p>
  {#if sided}
    <div class="hand-bar" aria-hidden="true">
      <span class="hand-left" style:width={`${leftShare}%`}></span>
      <span class="hand-right" style:width={`${rightShare}%`}></span>
    </div>
  {/if}
  <dl class="hand-figures">
    <div><dt>{text('alice-practice.left-hand')}</dt><dd data-hand="left">{sided ? formatAccuracy(i18n.language, leftShare) : '—'} <span class="hand-count">({formatNumber(i18n.language, hands.left)})</span></dd></div>
    <div><dt>{text('alice-practice.right-hand')}</dt><dd data-hand="right">{sided ? formatAccuracy(i18n.language, rightShare) : '—'} <span class="hand-count">({formatNumber(i18n.language, hands.right)})</span></dd></div>
    <div><dt>{text('alice-practice.thumbs')}</dt><dd data-hand="thumb">{formatNumber(i18n.language, hands.thumb)}</dd></div>
    <div><dt>{text('alice-practice.unattributed')}</dt><dd data-hand="unattributed">{formatNumber(i18n.language, hands.unattributed)}</dd></div>
  </dl>
  {#if fingerRows.length}
    <details class="finger-detail">
      <summary>{text('alice-practice.finger-detail')}</summary>
      <ul>
        {#each fingerRows as row (row.label)}
          <li>{row.label}: {formatNumber(i18n.language, row.count)}</li>
        {/each}
      </ul>
    </details>
  {/if}
</section>

<style>
  .hand-balance {
    display: grid;
    gap: 0.5rem;
    margin-block: 0.75rem;
    font-size: 0.8rem;
  }
  .hand-heading { margin: 0; color: var(--color-muted); font-weight: 600; }
  .hand-bar {
    display: flex;
    height: 0.5rem;
    overflow: hidden;
    border: 1px solid var(--color-muted);
    border-radius: 999px;
  }
  .hand-left { background: var(--color-accent); }
  .hand-right {
    background: repeating-linear-gradient(135deg, var(--color-text) 0 3px, transparent 3px 6px);
  }
  .hand-figures {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    margin: 0;
  }
  .hand-figures div { display: flex; gap: 0.35rem; }
  .hand-figures dt { color: var(--color-muted); }
  .hand-figures dd { margin: 0; color: var(--color-text); font-weight: 600; }
  .hand-count { color: var(--color-muted); font-weight: 400; }
  .finger-detail summary { cursor: pointer; }
  .finger-detail summary:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  .finger-detail ul { margin: 0.4rem 0 0; padding-left: 1.25rem; line-height: 1.6; }
</style>
