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

<nav aria-label="Practice modes" class="practice-modes">
  <p class="mode-label">Practice mode</p>
  <ul>
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
      <li><span class="unavailable-mode" aria-disabled="true" title="Coming soon">{unavailable}<span class="sr-only">, coming soon</span></span></li>
    {/each}
  </ul>
</nav>

<style>
  .practice-modes { margin-bottom: 1.5rem; }
  .mode-label {
    margin: 0 0 0.65rem;
    color: #b8b8b8;
    font-size: 0.78rem;
    font-weight: 600;
  }
  ul {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0;
    padding: 0.3rem;
    list-style: none;
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 0.75rem;
    background: rgb(0 0 0 / 15%);
  }
  li { display: flex; }
  .unavailable-mode {
    display: inline-flex;
    align-items: center;
    padding: 0.65rem 1rem;
    color: var(--color-muted);
    font-size: 0.85rem;
    cursor: not-allowed;
  }
  button {
    border: 1px solid transparent;
    border-radius: 0.5rem;
    padding: 0.65rem 1rem;
    color: var(--color-text);
    background: transparent;
    font-size: 0.85rem;
    cursor: pointer;
  }

  button.selected {
    border-color: var(--color-accent);
    color: var(--color-background);
    background: var(--color-accent);
    font-weight: 650;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
