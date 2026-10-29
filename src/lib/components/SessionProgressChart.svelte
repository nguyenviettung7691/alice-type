<script lang="ts">
  import type { SessionRecord } from '../storage/session-history';
  import {
    ACCURACY_CEILING, ACCURACY_FLOOR, AXIS_INTERVALS, TIMELINE_LIMIT,
    buildSessionTimeline, clampAccuracy, wpmAxisMax, type TimelineMode, type TimelinePoint
  } from '../storage/session-timeline';
  import { useLocalization } from '../i18n/context';
  import { formatAccuracy, formatDate, formatNumber, formatShortDay, formatTime } from '../i18n/format';
  import { LANGUAGES, getLanguage, type LanguageId } from '../i18n/languages';

  const i18n = useLocalization();
  const { text } = i18n;

  let { records, modeLabel }: {
    records: readonly SessionRecord[];
    modeLabel: (record: SessionRecord) => string;
  } = $props();

  const WIDTH = 720;
  const HEIGHT = 300;
  const LEFT = 56;
  const RIGHT = 72;
  const TOP = 20;
  const BOTTOM = 62;
  const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
  const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
  const MODES: readonly TimelineMode[] = ['timed', 'words', 'quote', 'custom'];
  const MODE_LABEL_KEYS = {
    timed: 'mode-navigation.timed', words: 'mode-navigation.words',
    quote: 'mode-navigation.quote', custom: 'mode-navigation.custom'
  } as const;

  let hidden = $state<LanguageId[]>([]);
  const points = $derived(buildSessionTimeline(records));
  const languages = $derived((Object.keys(LANGUAGES) as LanguageId[]).filter((id) => points.some((point) => point.language === id)));
  const visible = $derived(points.filter((point) => !hidden.includes(point.language)));
  const visibleModes = $derived(MODES.filter((mode) => visible.some((point) => point.mode === mode)));
  // Axes and slots use the whole window so filtering does not move the remaining points.
  const wpmMax = $derived(wpmAxisMax(points));
  const wpmTicks = $derived(Array.from({ length: AXIS_INTERVALS + 1 }, (_, index) => (wpmMax / AXIS_INTERVALS) * index));
  const accuracyTicks = Array.from({ length: AXIS_INTERVALS + 1 },
    (_, index) => ACCURACY_FLOOR + ((ACCURACY_CEILING - ACCURACY_FLOOR) / AXIS_INTERVALS) * index);
  const belowFloor = $derived(visible.some((point) => point.accuracyBelowFloor));

  const x = (order: number) => LEFT + ((order - 0.5) * PLOT_WIDTH) / points.length;
  const yWpm = (wpm: number) => TOP + PLOT_HEIGHT * (1 - Math.min(wpm, wpmMax) / wpmMax);
  const yAccuracy = (accuracy: number) =>
    TOP + PLOT_HEIGHT * (1 - (clampAccuracy(accuracy) - ACCURACY_FLOOR) / (ACCURACY_CEILING - ACCURACY_FLOOR));
  const baseline = TOP + PLOT_HEIGHT;

  const wpmPath = $derived(visible.map((point) => `${x(point.order)},${yWpm(point.wpm)}`).join(' '));
  const accuracyPath = $derived(visible.map((point) => `${x(point.order)},${yAccuracy(point.accuracy)}`).join(' '));
  const accuracyArea = $derived(visible.length < 2 ? '' : [
    `${x(visible[0].order)},${baseline}`, accuracyPath, `${x(visible[visible.length - 1].order)},${baseline}`
  ].join(' '));

  function languageName(language: LanguageId): string {
    return text(getLanguage(language).labelKey);
  }

  function toggle(language: LanguageId) {
    hidden = hidden.includes(language) ? hidden.filter((id) => id !== language) : [...hidden, language];
  }

  function markerPath(mode: TimelineMode, cx: number, cy: number): string {
    switch (mode) {
      case 'timed': return `M ${cx - 6} ${cy} a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0 Z`;
      case 'words': return `M ${cx - 5.5} ${cy - 5.5} h 11 v 11 h -11 Z`;
      case 'quote': return `M ${cx} ${cy - 7.5} L ${cx + 7.5} ${cy} L ${cx} ${cy + 7.5} L ${cx - 7.5} ${cy} Z`;
      case 'custom': return `M ${cx} ${cy - 7} L ${cx + 7} ${cy + 5.5} L ${cx - 7} ${cy + 5.5} Z`;
    }
  }

  function describe(point: TimelinePoint): string {
    return text("stats-panel.chart-point", {
      p0: formatNumber(i18n.language, point.order),
      p1: formatDate(i18n.language, point.completedAt),
      p2: modeLabel(point.record),
      p3: languageName(point.language),
      p4: formatNumber(i18n.language, point.wpm),
      p5: formatAccuracy(i18n.language, point.accuracy),
      p6: point.scoring === 'committed' ? text("stats-panel.committed-text-accuracy") : text("stats-panel.historical-keystroke-accuracy")
    });
  }

  function newDay(point: TimelinePoint, index: number): boolean {
    return index === 0 || new Date(points[index - 1].completedAt).toDateString() !== new Date(point.completedAt).toDateString();
  }

  const summary = $derived(visible.length ? text("stats-panel.chart-summary", {
    p0: formatNumber(i18n.language, visible.length),
    p1: formatNumber(i18n.language, Math.min(...visible.map((point) => point.wpm))),
    p2: formatNumber(i18n.language, Math.max(...visible.map((point) => point.wpm))),
    p3: formatAccuracy(i18n.language, Math.min(...visible.map((point) => point.accuracy))),
    p4: formatAccuracy(i18n.language, Math.max(...visible.map((point) => point.accuracy)))
  }) : '');
</script>

<figure class="progress-chart" aria-labelledby="progress-chart-title">
  <figcaption>
    <h4 id="progress-chart-title">{text("stats-panel.progress-chart", { p0: formatNumber(i18n.language, TIMELINE_LIMIT) })}</h4>
    <p class="panel-copy">{text("stats-panel.progress-chart-description")}</p>
  </figcaption>
  {#if !points.length}
    <p class="empty-state">{text("stats-panel.no-chart-sessions")}</p>
  {:else}
    <div class="chart-controls">
      <div class="chart-filters" role="group" aria-label={text("stats-panel.languages-shown")}>
        <span class="chart-legend-title" aria-hidden="true">{text("stats-panel.languages-shown")}</span>
        {#each languages as language (language)}
          <button class="chart-filter" type="button" aria-pressed={!hidden.includes(language)} data-language={language}
            onclick={() => toggle(language)}>
            <span class="chart-swatch" data-language={language} aria-hidden="true"></span>{languageName(language)}
          </button>
        {/each}
      </div>
      <ul class="chart-legend">
        <li><svg viewBox="0 0 28 10" aria-hidden="true"><line class="wpm-line" x1="1" y1="5" x2="27" y2="5" /></svg>{text("stats-panel.wpm-line")}</li>
        <li><svg viewBox="0 0 28 10" aria-hidden="true"><line class="accuracy-line" x1="1" y1="5" x2="27" y2="5" /></svg>{text("stats-panel.accuracy-line")}</li>
        {#if visibleModes.length}
          <li class="chart-mode-legend">
            <span class="chart-legend-title">{text("stats-panel.chart-modes")}</span>
            {#each visibleModes as mode (mode)}
              <span><svg viewBox="0 0 18 18" aria-hidden="true"><path class="legend-marker" d={markerPath(mode, 9, 9.5)} /></svg>{text(MODE_LABEL_KEYS[mode])}</span>
            {/each}
          </li>
        {/if}
        {#if belowFloor}
          <li><svg viewBox="0 0 18 18" aria-hidden="true"><path class="below-floor-marker" d="M 4 6 L 14 6 L 9 13 Z" /></svg>{text("stats-panel.below-chart-range", { p0: formatAccuracy(i18n.language, ACCURACY_FLOOR) })}</li>
        {/if}
      </ul>
    </div>
    {#if !visible.length}
      <p class="empty-state">{text("stats-panel.all-chart-languages-hidden")}</p>
    {/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The chart needs native keyboard scrolling on narrow screens.) -->
    <div class="chart-scroll" role="region" aria-labelledby="progress-chart-title" tabindex="0">
      <svg class="timeline-chart" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label={summary || text("stats-panel.all-chart-languages-hidden")}>
        <g class="chart-grid" aria-hidden="true">
          {#each wpmTicks as tick, index (index)}
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={yWpm(tick)} y2={yWpm(tick)} />
            <text class="axis-label wpm-tick" x={LEFT - 8} y={yWpm(tick)} text-anchor="end" dominant-baseline="middle">{formatNumber(i18n.language, tick)}</text>
            <text class="axis-label accuracy-tick" x={WIDTH - RIGHT + 8} y={yWpm(tick)} dominant-baseline="middle">{formatAccuracy(i18n.language, accuracyTicks[index])}</text>
          {/each}
          <text class="axis-title wpm-title" transform="translate(14 {TOP + PLOT_HEIGHT / 2}) rotate(-90)" text-anchor="middle">{text("stats-panel.wpm-axis")}</text>
          <text class="axis-title" transform="translate({WIDTH - 10} {TOP + PLOT_HEIGHT / 2}) rotate(90)" text-anchor="middle">{text("stats-panel.accuracy-axis")}</text>
          {#each points as point, index (point.id)}
            <text class="axis-label x-tick" x={x(point.order)} y={baseline + 18} text-anchor="middle">#{formatNumber(i18n.language, point.order)}</text>
            <text class="axis-label x-time" x={x(point.order)} y={baseline + 34} text-anchor="middle">{formatTime(i18n.language, point.completedAt)}</text>
            {#if newDay(point, index)}
              <text class="axis-label x-day" x={x(point.order)} y={baseline + 50} text-anchor="middle">{formatShortDay(i18n.language, point.completedAt)}</text>
            {/if}
          {/each}
        </g>
        {#if accuracyArea}<polygon class="accuracy-area" points={accuracyArea} />{/if}
        {#if visible.length > 1}
          <polyline class="accuracy-line" points={accuracyPath} />
          <polyline class="wpm-line" points={wpmPath} />
        {/if}
        {#each visible as point (point.id)}
          <g class="timeline-node" data-order={point.order} data-language={point.language} data-mode={point.mode}
            data-wpm={point.wpm} data-accuracy={point.accuracy} data-below-floor={point.accuracyBelowFloor}>
            <title>{describe(point)}</title>
            {#if point.accuracyBelowFloor}
              <path class="below-floor-marker" d="M {x(point.order) - 5} {baseline - 9} L {x(point.order) + 5} {baseline - 9} L {x(point.order)} {baseline - 2} Z" />
            {:else}
              <circle class="accuracy-node" data-language={point.language} cx={x(point.order)} cy={yAccuracy(point.accuracy)} r="3.5" />
            {/if}
            <path class="wpm-node" data-language={point.language} d={markerPath(point.mode, x(point.order), yWpm(point.wpm))} />
          </g>
        {/each}
      </svg>
    </div>
    {#if visible.length}
      <ol class="sr-only" aria-label={text("stats-panel.chart-points-list")}>
        {#each visible as point (point.id)}<li>{describe(point)}</li>{/each}
      </ol>
    {/if}
  {/if}
</figure>
