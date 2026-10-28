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

  let {
    layout, feedback = {}, testState, errorCode, testLayoutLabel = 'Generic Alice', browserLegends = false,
    testSequence = layout, inertKeys = [], viewBox = ALICE_VIEW_BOX, layoutSource = 'generic', title
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
  } = $props();
  const expectedCode = $derived(testState ? expectedTestKey(testState, testSequence)?.code : undefined);
  const imported = $derived(layoutSource !== 'generic');
  const sequenceCodes = $derived(new Set(testSequence.map((key) => key.code)));
  const freestyle = $derived(testState?.mode === 'freestyle');
  const activeError = $derived(freestyle ? undefined : errorCode);

  function count(code: string): number {
    return testState ? testKeyCount(testState, code) : 0;
  }

  function testStatus(code: string): string {
    if (!sequenceCodes.has(code)) return 'not tested';
    if (freestyle) return count(code) ? 'pressed' : 'unpressed';
    if (code === activeError) return 'unexpected';
    if (code === expectedCode) return 'expected';
    return count(code) ? 'tested' : 'untested';
  }

  function marked(code: string): boolean {
    return !['untested', 'unpressed', 'not tested'].includes(testStatus(code));
  }

  function plural(value: number, word: string): string {
    return `${value} ${word}${value === 1 ? '' : 'es'}`;
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

<figure class="keyboard-visualizer" data-layout-source={layoutSource}>
  <figcaption>
    <span class="keyboard-title">{title ?? (testState ? `${testLayoutLabel} test matrix` : 'Alice visualizer')}</span>
    <span class="keyboard-legend">
      {#if layoutSource !== 'preview'}
        <span><span class="legend-mark neutral" aria-hidden="true"></span>Neutral</span>
        {#if freestyle}
          <span><span class="legend-mark correct" aria-hidden="true">+</span>Pressed</span>
        {:else}
          {#if testState}
            <span><span class="legend-mark expected" aria-hidden="true">&gt;</span>Expected key</span>
          {/if}
          <span><span class="legend-mark correct" aria-hidden="true">+</span>Correct press</span>
          <span><span class="legend-mark incorrect" aria-hidden="true">!</span>Mismatch</span>
        {/if}
      {/if}
      {#if inertKeys.length > 0}
        <span><span class="legend-mark inert" aria-hidden="true"></span>No standard key code</span>
      {/if}
    </span>
  </figcaption>
  {#if layoutSource === 'preview'}
    <p class="keyboard-note">Preview, not confirmed · Default key labels may differ from yours. Dashed keys are not testable.</p>
  {:else if imported}
    <p class="keyboard-note">
      {testLayoutLabel} layout · {layoutSource === 'confirmed' ? 'Confirmed by you' : 'Preview, not confirmed'} · VIA/QMK data, not detected hardware ·
      {browserLegends ? 'Browser layout legends (default keymap legends for missing keys)' : 'Default keymap legends'}.
      Dashed keys have no standard key code and are never highlighted or tested. Keycaps that share one physical code highlight together.
    </p>
  {:else}
    <p class="keyboard-note">
      {testLayoutLabel} layout · {browserLegends ? 'Browser layout legends (reference legends for missing keys)' : 'US ANSI legends'}, not detected hardware.
      Both spacebars represent the same Space key.
    </p>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Overflowing diagrams need focus for native keyboard scrolling.) -->
  <div
    bind:this={scrollRegion}
    class="keyboard-scroll"
    role="region"
    aria-label="Keyboard diagram scroll area"
    aria-describedby={scrollable ? `${id}-scroll-help` : undefined}
    tabindex={scrollable ? 0 : undefined}
  >
    <svg
      {viewBox}
      role="img"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <title id={`${id}-title`}>{testState
        ? `${testLayoutLabel} keyboard test matrix`
        : imported ? `${testLayoutLabel} keyboard` : 'Generic Alice keyboard'}</title>
      <desc id={`${id}-description`}>
        {#if imported}
          {layoutSource === 'confirmed' ? 'Layout confirmed by you' : 'Unconfirmed layout preview'} from imported VIA and QMK data, with {browserLegends ? 'browser layout legends where available' : 'default keymap legends'}; not a detected device.
          Keys without a standard key code are drawn dashed and never highlighted.
        {:else}
          Angled split layout with {browserLegends ? 'browser layout legends where available' : 'generic US ANSI legends'}, not a detected device.
        {/if}
        {#if freestyle}
          Each countable cell shows how many times it was pressed in this run. A plus
          marks a pressed key. There is no expected key or mismatch feedback.
          Text key results are available below the diagram.
        {:else if testState}
          An arrow marks the expected key, a plus marks a tested key, and an
          exclamation mark indicates temporary unexpected input. Text key results
          are available below the diagram.
        {:else if layoutSource !== 'preview'}
          Recent accepted printable presses briefly show an orange plus for correct
          input or a red exclamation mark for a mismatch. Unmapped physical codes
          do not highlight.
        {/if}
        {imported ? 'Keycaps that share a physical code highlight together.' : 'Both spacebar shapes share one physical Space code.'}
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
            data-code={key.code}
            data-feedback={testState
              ? (activeError === key.code ? 'incorrect' : count(key.code) ? 'correct' : 'neutral')
              : feedback[key.code] ?? 'neutral'}
            data-test-state={testState ? testStatus(key.code) : undefined}
            data-count={testState ? count(key.code) : undefined}
          >
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
                    y={cap.y + cap.height / 2 - (freestyle ? 5 : 0)}
                    dominant-baseline="central"
                    text-anchor="middle"
                  >{key.legend}</text>
                  {#if freestyle && sequenceCodes.has(key.code)}
                    <text class="key-count" x={cap.x + cap.width / 2} y={cap.y + cap.height - 6} text-anchor="middle">
                      {count(key.code) > 999 ? '999+' : count(key.code)}
                    </text>
                  {/if}
                  {#if testState ? marked(key.code) : feedback[key.code]}
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
      Scroll to see all keys. Keyboard: focus the diagram and use Left/Right arrows.
    </p>
  {/if}
  {#if testState}
    <details class="key-results">
      <summary>Text key results</summary>
      <ul>
        {#each layout as key (key.code)}
          <li>{key.legend} ({key.code}): {#if !sequenceCodes.has(key.code)}{freestyle ? 'not counted in this test' : 'not part of the guided test'}{:else if freestyle}{plural(count(key.code), 'press')}{:else}{testStatus(key.code)}{/if}</li>
        {/each}
        {#each inertKeys as key (key.id)}
          <li>{key.legend || 'Unlabeled key'} (no standard key code): {freestyle ? 'not counted in this test' : 'not part of the guided test'}</li>
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
</style>
