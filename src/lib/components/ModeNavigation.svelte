<script lang="ts">
  import type { PracticeMode } from '../typing/exercise-generator';

  let { mode, disabled, onmodechange }: {
    mode: PracticeMode;
    disabled: boolean;
    onmodechange: (mode: PracticeMode) => void;
  } = $props();
  const modes = [
    { id: 'timed', label: 'Timed' }, { id: 'words', label: 'Words' }
  ] as const;
</script>

<nav aria-label="Practice modes">
  <ul class="m-0 flex list-none flex-wrap items-center gap-1 p-0">
    {#each modes as option}
      <li>
        <button
          type="button"
          aria-pressed={option.id === mode}
          class:selected={option.id === mode}
          {disabled}
          onclick={() => onmodechange(option.id)}
        >{option.label}</button>
      </li>
    {/each}
    {#each ['Quote', 'Custom', 'Zen'] as unavailable}
      <li><span class="rounded-full px-3 py-2 text-xs text-muted" aria-disabled="true">{unavailable}<span class="sr-only">, coming soon</span></span></li>
    {/each}
  </ul>
</nav>

<style>
  button {
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 0.45rem 0.75rem;
    color: var(--color-text);
    background: transparent;
    font-size: 0.75rem;
    cursor: pointer;
  }

  button.selected {
    border-color: var(--color-accent);
    color: var(--color-accent);
    font-weight: 650;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
