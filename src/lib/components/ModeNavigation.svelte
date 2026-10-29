<script lang="ts">
  import type { PracticeMode } from '../typing/exercise-generator';
  import { useLocalization } from '../i18n/context';
  const i18n = useLocalization();

  let { mode, disabled, onmodechange }: {
    mode: PracticeMode;
    disabled: boolean;
    onmodechange: (mode: PracticeMode) => void;
  } = $props();
  const modes = [
    { id: 'timed', label: 'Timed' }, { id: 'words', label: 'Words' },
    { id: 'quote', label: 'Quote' }, { id: 'custom', label: 'Custom' }, { id: 'zen', label: 'Zen' }
  ] as const;
</script>

<nav aria-label={i18n.text("mode-navigation.practice-modes")} class="practice-modes">
  <p class="mode-label">{i18n.text("mode-navigation.practice-mode")}</p>
  <ul>
    {#each modes as option}
      <li>
        <button
          type="button"
          aria-pressed={option.id === mode}
          class:selected={option.id === mode}
          {disabled}
          onclick={() => onmodechange(option.id)}
        >{{timed: i18n.text("mode-navigation.timed"), words: i18n.text("mode-navigation.words"), quote: i18n.text("mode-navigation.quote"), custom: i18n.text("mode-navigation.custom"), zen: 'Zen'}[option.id]}</button>
      </li>
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
