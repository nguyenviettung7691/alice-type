<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  let { items, itemKey, label, columns, header, row, resetKey }: {
    items: readonly T[];
    itemKey: (item: T) => string;
    label: string;
    columns: number;
    header: Snippet;
    row: Snippet<[T]>;
    resetKey: string;
  } = $props();

  const rowHeight = 48;
  const overscan = 4;
  let viewport = $state<HTMLDivElement>();
  let scrollTop = $state(0);
  let height = $state(400);
  const start = $derived(Math.min(
    Math.max(0, items.length - Math.ceil(height / rowHeight)),
    Math.max(0, Math.floor((scrollTop - rowHeight) / rowHeight) - overscan)
  ));
  const end = $derived(Math.min(items.length, start + Math.ceil(height / rowHeight) + overscan * 2));

  $effect(() => {
    resetKey;
    items;
    if (viewport) viewport.scrollTop = 0;
    scrollTop = 0;
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (Native keyboard scrolling is available without entering table cells.) -->
<div bind:this={viewport} bind:clientHeight={height} class="history-scroll virtual-table"
  role="region" aria-label={label} tabindex="0"
  onscroll={(event) => { scrollTop = event.currentTarget.scrollTop; }}>
  <table aria-rowcount={items.length + 1}>
    <caption class="sr-only">{label}</caption>
    <thead><tr aria-rowindex="1">{@render header()}</tr></thead>
    <tbody>
      {#if start > 0}
        <tr class="virtual-spacer" aria-hidden="true"><td colspan={columns} style:height={`${start * rowHeight}px`}></td></tr>
      {/if}
      {#each items.slice(start, end) as item, index (itemKey(item))}
        <tr class="virtual-row" aria-rowindex={start + index + 2} data-row-key={itemKey(item)}
          class:alternate={(start + index) % 2 === 1}>
          {@render row(item)}
        </tr>
      {/each}
      {#if end < items.length}
        <tr class="virtual-spacer" aria-hidden="true"><td colspan={columns} style:height={`${(items.length - end) * rowHeight}px`}></td></tr>
      {/if}
    </tbody>
  </table>
</div>
