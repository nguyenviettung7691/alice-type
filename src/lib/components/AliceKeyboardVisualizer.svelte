<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ALICE_VIEW_BOX,
    keycapTransform,
    type AliceKey,
    type InertKey,
    type KeyFeedback
  } from '../keyboard/alice-layout';
  import { expectedTestKey, testKeyCount, type KeyboardTestState } from '../keyboard/keyboard-test';
  import { useLocalization } from '../i18n/context';
  import { TOOL_MESSAGES, keyResultMessage } from '../i18n/tool-messages';
  const i18n = useLocalization();
  const { text } = i18n;
  const statusLabel = (code: string) => {
    const status = testStatus(code);
    return {
      'not tested': text("alice-keyboard-visualizer.not-tested"), pressed: text("alice-keyboard-visualizer.pressed-2"), unpressed: text("alice-keyboard-visualizer.unpressed"),
      unexpected: text("alice-keyboard-visualizer.unexpected"), expected: text("alice-keyboard-visualizer.expected"), tested: text("alice-keyboard-visualizer.tested"), untested: text("alice-keyboard-visualizer.untested")
    }[status];
  };

  let {
    layout, feedback = {}, testState, errorCode, testLayoutLabel = 'Generic Alice', browserLegends = false,
    testSequence = layout, inertKeys = [], viewBox = ALICE_VIEW_BOX, layoutSource = 'generic', title,
    missedCounts
  }: {
    layout: readonly AliceKey[];
    feedback?: KeyFeedback;
    testState?: KeyboardTestState;
    errorCode?: string;
    testLayoutLabel?: string;
    browserLegends?: boolean;
    /** Ordered keys covered by the guided test; keys outside it are shown but never expected. */
    testSequence?: readonly AliceKey[];
    /** Keys without a standard physical code: drawn for orientation, never highlighted or tested. */
    inertKeys?: readonly InertKey[];
    viewBox?: string;
    /** Generic reference layout, an imported layout the user confirmed, or an unconfirmed preview. */
    layoutSource?: 'generic' | 'confirmed' | 'preview';
    title?: string;
    missedCounts?: Readonly<Record<string, number>>;
  } = $props();
  const expectedCode = $derived(testState ? expectedTestKey(testState, testSequence)?.code : undefined);
  const imported = $derived(layoutSource !== 'generic');
  const sequenceCodes = $derived(new Set(testSequence.map((key) => key.code)));
  const freestyle = $derived(testState?.mode === 'freestyle');
  const activeError = $derived(freestyle ? undefined : errorCode);
  const heatmap = $derived(missedCounts !== undefined);
  const maxMisses = $derived(Math.max(0, ...Object.values(missedCounts ?? {})));

  function misses(code: string): number {
    return missedCounts && Object.hasOwn(missedCounts, code) ? missedCounts[code] : 0;
  }

  function heat(code: string): number {
    return maxMisses ? misses(code) / maxMisses : 0;
  }

  function count(code: string): number {
    return testState ? testKeyCount(testState, code) : 0;
  }

  function testStatus(code: string): 'not tested' | 'pressed' | 'unpressed' | 'unexpected' | 'expected' | 'tested' | 'untested' {
    if (!sequenceCodes.has(code)) return 'not tested';
    if (freestyle) return count(code) ? 'pressed' : 'unpressed';
    if (code === activeError) return 'unexpected';
    if (code === expectedCode) return 'expected';
    return count(code) ? 'tested' : 'untested';
  }

  function marked(code: string): boolean {
    return !['untested', 'unpressed', 'not tested'].includes(testStatus(code));
  }

  const id = $props.id();
  let scrollRegion: HTMLDivElement;
  let scrollable = $state(false);

  onMount(() => {
    const updateOverflow = () => {
      scrollable = scrollRegion.scrollWidth > scrollRegion.clientWidth;
    };
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(scrollRegion);
    updateOverflow();
    return () => observer.disconnect();
  });
</script>

<figure class="keyboard-visualizer" class:heatmap data-layout-source={layoutSource}>
  <figcaption>
    <span class="keyboard-title">{title ?? (testState ? text("alice-keyboard-visualizer.test-matrix", { p0: String(testLayoutLabel) }) : text("alice-keyboard-visualizer.alice-visualizer"))}</span>
    <span class="keyboard-legend">
      {#if heatmap}
        <span class="heat-scale"><span>{text("alice-keyboard-visualizer.0-misses")}</span><span class="heat-gradient" aria-hidden="true"></span><span>{text("alice-keyboard-visualizer.max", { p0: String(maxMisses) })}</span></span>
      {:else if layoutSource !== 'preview'}
        <span><span class="legend-mark neutral" aria-hidden="true"></span>{text("alice-keyboard-visualizer.neutral")}</span>
        {#if freestyle}
          <span><span class="legend-mark correct" aria-hidden="true">+</span>{text("alice-keyboard-visualizer.pressed")}</span>
        {:else}
          {#if testState}
            <span><span class="legend-mark expected" aria-hidden="true">&gt;</span>{text("alice-keyboard-visualizer.expected-key")}</span>
          {/if}
          <span><span class="legend-mark correct" aria-hidden="true">+</span>{text("alice-keyboard-visualizer.correct-press")}</span>
          <span><span class="legend-mark incorrect" aria-hidden="true">!</span>{text("alice-keyboard-visualizer.mismatch")}</span>
        {/if}
      {/if}
      {#if inertKeys.length > 0}
        <span><span class="legend-mark inert" aria-hidden="true"></span>{text("alice-keyboard-visualizer.no-standard-key-code")}</span>
      {/if}
    </span>
  </figcaption>
  {#if heatmap}
    <p class="keyboard-note">{text(TOOL_MESSAGES.heatmapHelp)}</p>
  {/if}
  {#if layoutSource === 'preview'}
    <p class="keyboard-note">{text(TOOL_MESSAGES.previewHelp)}</p>
  {:else if imported}
    <p class="keyboard-note">
      {text("alice-keyboard-visualizer.layout-via-qmk-data-not-detected-hardware", { p0: testLayoutLabel, p1: text(layoutSource === 'confirmed' ? 'visualizer.confirmed' : 'visualizer.preview'), p2: text(browserLegends ? 'visualizer.browserDefaultLegends' : 'visualizer.defaultLegends') })}
      {text(TOOL_MESSAGES.importedKeysHelp)}
    </p>
  {:else}
    <p class="keyboard-note">
      {text("alice-keyboard-visualizer.layout-not-detected-hardware-both-spacebars-represent", { p0: testLayoutLabel, p1: text(browserLegends ? 'visualizer.browserReferenceLegends' : 'visualizer.ansiLegends') })}
    </p>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Overflowing diagrams need focus for native keyboard scrolling.) -->
  <div
    bind:this={scrollRegion}
    class="keyboard-scroll"
    role="region"
    aria-label={text("alice-keyboard-visualizer.keyboard-diagram-scroll-area")}
    aria-describedby={scrollable ? `${id}-scroll-help` : undefined}
    tabindex={scrollable ? 0 : undefined}
  >
    <svg
      {viewBox}
      role="img"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <title id={`${id}-title`}>{heatmap ? text("alice-keyboard-visualizer.missed-key-heatmap", { p0: String(testLayoutLabel) }) : testState
        ? text("alice-keyboard-visualizer.keyboard-test-matrix", { p0: String(testLayoutLabel) })
        : imported ? text("alice-keyboard-visualizer.keyboard", { p0: String(testLayoutLabel) }) : text("alice-keyboard-visualizer.generic-alice-keyboard")}</title>
      <desc id={`${id}-description`}>
        {#if imported}
          {text('visualizer.importedDescription', { state: text(layoutSource === 'confirmed' ? 'visualizer.confirmed' : 'visualizer.preview'), labels: text(browserLegends ? 'visualizer.browserLegends' : 'visualizer.defaultLegends') })}
        {:else}
          {text('visualizer.referenceDescription', { labels: text(browserLegends ? 'visualizer.browserLegends' : 'visualizer.ansiLegends') })}
        {/if}
        {#if heatmap}
          {text('visualizer.heatDescription', { maximum: maxMisses })}
        {:else if freestyle}
          {text(TOOL_MESSAGES.freestyleDescription)}
        {:else if testState}
          {text(TOOL_MESSAGES.guidedDescription)}
        {:else if layoutSource !== 'preview'}
          {text(TOOL_MESSAGES.practiceDescription)}
        {/if}
        {text(imported ? 'visualizer.sharedCodes' : 'visualizer.sharedSpace')}
      </desc>
      <g aria-hidden="true">
        {#each inertKeys as key (key.id)}
          <g class="keyboard-key inert-key" data-inert={key.id}>
            {#each key.keycaps as cap}
              <g transform={keycapTransform(cap)}>
                <rect x={cap.x} y={cap.y} width={cap.width} height={cap.height} rx="6" />
                {#if !cap.secondary && key.legend}
                  <text class="key-legend" x={cap.x + cap.width / 2} y={cap.y + cap.height / 2}
                    dominant-baseline="central" text-anchor="middle">{key.legend}</text>
                {/if}
              </g>
            {/each}
          </g>
        {/each}
        {#each layout as key (key.code)}
          <g
            class="keyboard-key"
            class:heat-key={heatmap}
            data-code={key.code}
            data-feedback={heatmap ? 'neutral' : testState
              ? (activeError === key.code ? 'incorrect' : count(key.code) ? 'correct' : 'neutral')
              : feedback[key.code] ?? 'neutral'}
            data-test-state={testState ? testStatus(key.code) : undefined}
            data-count={heatmap ? misses(key.code) : testState ? count(key.code) : undefined}
            data-heat={heatmap ? heat(key.code) : undefined}
            style:--key-heat={heatmap ? `${heat(key.code) * 100}%` : undefined}
          >
            {#if heatmap}<title>{key.legend} ({key.code}): {misses(key.code)} {misses(key.code) === 1 ? 'miss' : 'misses'}</title>{/if}
            {#each key.keycaps as cap}
              <g transform={keycapTransform(cap)}>
                <rect
                  x={cap.x}
                  y={cap.y}
                  width={cap.width}
                  height={cap.height}
                  rx="6"
                />
                {#if !cap.secondary}
                  <text
                    class="key-legend"
                    x={cap.x + cap.width / 2}
                    y={cap.y + cap.height / 2 - (freestyle || heatmap ? 5 : 0)}
                    dominant-baseline="central"
                    text-anchor="middle"
                  >{key.legend}</text>
                  {#if heatmap || (freestyle && sequenceCodes.has(key.code))}
                    <text class="key-count" x={cap.x + cap.width / 2} y={cap.y + cap.height - 6} text-anchor="middle">
                      {heatmap ? misses(key.code) : count(key.code) > 999 ? '999+' : count(key.code)}
                    </text>
                  {/if}
                  {#if !heatmap && (testState ? marked(key.code) : feedback[key.code])}
                    <text
                      class="feedback-marker"
                      x={cap.x + cap.width - 7}
                      y={cap.y + 9}
                      text-anchor="middle"
                      dominant-baseline="central"
                    >{testState
                        ? (freestyle ? '+' : activeError === key.code ? '!' : expectedCode === key.code ? '>' : '+')
                        : feedback[key.code] === 'correct' ? '+' : '!'}</text>
                  {/if}
                {/if}
              </g>
            {/each}
          </g>
        {/each}
      </g>
    </svg>
  </div>
  {#if scrollable}
    <p id={`${id}-scroll-help`} class="keyboard-note scroll-help">
      {text("alice-keyboard-visualizer.scroll-to-see-all-keys-keyboard-focus")}
    </p>
  {/if}
  {#if heatmap}
    <details class="key-results">
      <summary>{text("alice-keyboard-visualizer.text-key-results")}</summary>
      <ul>
        {#each layout as key (key.code)}
          <li>{keyResultMessage(i18n.language, key.legend, key.code, misses(key.code), 'miss')}</li>
        {/each}
        {#each inertKeys as key (key.id)}
          <li>{text("alice-keyboard-visualizer.no-standard-key-code-miss-count-unavailable", { p0: key.legend || text('alice-keyboard-visualizer.unlabeled-key') })}</li>
        {/each}
      </ul>
    </details>
  {:else if testState}
    <details class="key-results">
      <summary>{text("alice-keyboard-visualizer.text-key-results")}</summary>
      <ul>
        {#each layout as key (key.code)}
          <li>{key.legend} ({key.code}): {#if !sequenceCodes.has(key.code)}{freestyle ? text("alice-keyboard-visualizer.not-counted-in-this-test") : text("alice-keyboard-visualizer.not-part-of-the-guided-test")}{:else if freestyle}{count(key.code) === 1 ? text("alice-keyboard-visualizer.1-press") : text("alice-keyboard-visualizer.presses", { p0: String(count(key.code)) })}{:else}{statusLabel(key.code)}{/if}</li>
        {/each}
        {#each inertKeys as key (key.id)}
          <li>{key.legend || text("alice-keyboard-visualizer.unlabeled-key")} ({text("alice-keyboard-visualizer.no-standard-key-code-2")}): {freestyle ? text("alice-keyboard-visualizer.not-counted-in-this-test") : text("alice-keyboard-visualizer.not-part-of-the-guided-test")}</li>
        {/each}
      </ul>
    </details>
  {/if}
</figure>

<style>
  .keyboard-visualizer {
    min-width: 0;
    margin: 0;
    border-top: 1px solid rgb(255 255 255 / 7%);
    padding-top: 1.1rem;
  }

  figcaption,
  .keyboard-legend,
  .keyboard-legend > span {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  figcaption {
    justify-content: space-between;
    gap: 0.75rem;
  }

  .keyboard-title {
    color: var(--color-text);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .keyboard-legend {
    gap: 0.85rem;
    color: var(--color-muted);
    font-size: 0.7rem;
  }

  .legend-mark {
    display: inline-flex;
    width: 1rem;
    height: 1rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-muted);
    border-radius: 0.2rem;
    font-weight: 700;
  }

  .legend-mark.correct {
    border-color: var(--color-accent);
    color: var(--color-background);
    background: var(--color-accent);
  }

  .legend-mark.expected {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .keyboard-key[data-test-state='expected'] rect {
    stroke: var(--color-accent);
    stroke-width: 3;
  }

  .keyboard-key[data-test-state='expected'] .feedback-marker {
    fill: var(--color-accent);
  }

  .key-count {
    fill: var(--color-muted);
    font-size: 11px;
    font-weight: 700;
  }

  .keyboard-key[data-feedback='correct'] .key-count,
  .keyboard-key[data-feedback='incorrect'] .key-count {
    fill: var(--color-background);
  }

  .key-results {
    margin-top: 1rem;
    color: var(--color-text);
    font-size: 0.85rem;
    line-height: 1.7;
  }

  summary { cursor: pointer; }
  summary:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  .key-results ul { padding-left: 1.5rem; }

  .legend-mark.incorrect {
    border-color: var(--color-error);
    color: var(--color-background);
    background: var(--color-error);
  }

  .keyboard-note {
    margin: 0.6rem 0 0;
    color: var(--color-muted);
    font-size: 0.7rem;
    line-height: 1.6;
  }

  .keyboard-scroll {
    overflow-x: auto;
    margin-top: 0.6rem;
    border-radius: 0.4rem;
  }

  .keyboard-scroll:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 3px;
  }

  svg {
    display: block;
    width: 100%;
    min-width: 640px;
    height: auto;
  }

  .keyboard-key rect {
    fill: var(--color-background);
    stroke: var(--color-muted);
    stroke-width: 1;
  }

  .key-legend {
    fill: var(--color-text);
    font-size: 15px;
  }

  .feedback-marker {
    fill: var(--color-background);
    font-size: 14px;
    font-weight: 800;
  }

  .keyboard-key[data-feedback='correct'] rect {
    fill: var(--color-accent);
    stroke: var(--color-accent);
  }

  .keyboard-key[data-feedback='incorrect'] rect {
    fill: var(--color-error);
    stroke: var(--color-error);
    stroke-width: 2;
    stroke-dasharray: 4 2;
  }

  .keyboard-key[data-feedback='correct'] .key-legend,
  .keyboard-key[data-feedback='incorrect'] .key-legend {
    fill: var(--color-background);
  }
  .inert-key rect {
    fill: transparent;
    stroke: var(--color-muted);
    stroke-dasharray: 4 3;
  }

  .inert-key .key-legend { fill: var(--color-muted); }

  .legend-mark.inert { border-style: dashed; }

  .heat-gradient {
    width: 6rem;
    height: 0.65rem;
    border: 1px solid var(--color-muted);
    border-radius: 1rem;
    background: linear-gradient(to right, var(--color-background), #9b282a);
  }

  .heat-key rect {
    fill: color-mix(in srgb, #9b282a var(--key-heat), var(--color-background));
    stroke: color-mix(in srgb, var(--color-error) var(--key-heat), var(--color-muted));
  }

  .heat-key .key-count { fill: var(--color-text); }
</style>
