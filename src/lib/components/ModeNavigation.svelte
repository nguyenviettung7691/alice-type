<script lang="ts">
  const modes = ['Timed', 'Words', 'Quote', 'Custom', 'Zen'];
</script>

<nav aria-label="Practice modes, coming soon">
  <ul class="m-0 flex list-none flex-wrap items-center gap-1 p-0">
    {#each modes as mode}
      <li>
        <span class="rounded-full px-3 py-2 text-xs font-medium text-muted">
          {mode}
        </span>
      </li>
    {/each}
  </ul>
</nav>
