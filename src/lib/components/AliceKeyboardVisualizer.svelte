<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ALICE_HALF_TRANSFORMS,
    ALICE_VIEW_BOX,
    type AliceKey,
    type KeyFeedback
  } from '../keyboard/alice-layout';

  let { layout, feedback }: {
    layout: readonly AliceKey[];
    feedback: KeyFeedback;
  } = $props();

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

<figure class="keyboard-visualizer">
  <figcaption>
    <span class="keyboard-title">Alice visualizer</span>
    <span class="keyboard-legend">
      <span><span class="legend-mark neutral" aria-hidden="true"></span>Neutral</span>
      <span><span class="legend-mark correct" aria-hidden="true">+</span>Correct press</span>
      <span><span class="legend-mark incorrect" aria-hidden="true">!</span>Mismatch</span>
    </span>
  </figcaption>
  <p class="keyboard-note">
    Generic Alice layout · US ANSI legends, not detected hardware.
    Both spacebars represent the same Space key.
  </p>

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
      viewBox={ALICE_VIEW_BOX}
      role="img"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <title id={`${id}-title`}>Generic Alice keyboard</title>
      <desc id={`${id}-description`}>
        Angled split layout with generic US ANSI legends, not a detected device.
        Recent accepted printable presses briefly show an orange plus for correct
        input or a red exclamation mark for a mismatch. Unmapped physical codes
        do not highlight. Both spacebar shapes share one physical Space code.
      </desc>
      <g aria-hidden="true">
        {#each layout as key (key.code)}
          <g class="keyboard-key" data-code={key.code} data-feedback={feedback[key.code] ?? 'neutral'}>
            {#each key.keycaps as cap}
              <g transform={ALICE_HALF_TRANSFORMS[cap.half]}>
                <rect
                  x={cap.x}
                  y={cap.y}
                  width={cap.width}
                  height={cap.height}
                  rx="6"
                />
                <text
                  class="key-legend"
                  x={cap.x + cap.width / 2}
                  y={cap.y + cap.height / 2}
                  dominant-baseline="central"
                  text-anchor="middle"
                >{key.legend}</text>
                {#if feedback[key.code]}
                  <text
                    class="feedback-marker"
                    x={cap.x + cap.width - 7}
                    y={cap.y + 9}
                    text-anchor="middle"
                    dominant-baseline="central"
                  >{feedback[key.code] === 'correct' ? '+' : '!'}</text>
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
</style>
