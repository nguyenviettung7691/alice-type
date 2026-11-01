<script lang="ts">
  import { DEFAULT_LANGUAGE, isLanguageId, LANGUAGES, type LanguageId } from '../i18n/languages';
  import { translate } from '../i18n/messages';

  let { disabled, view, onviewchange, language = DEFAULT_LANGUAGE, onlanguagechange,
    boards = [], activeKeyboardId, onkeyboardchange }: {
    disabled: boolean;
    view: 'practice' | 'stats' | 'keyboard-test' | 'keyboard-details';
    onviewchange: (view: 'practice' | 'stats' | 'keyboard-test' | 'keyboard-details') => void;
    language?: LanguageId;
    onlanguagechange?: (language: LanguageId) => void;
    boards?: readonly { id: string; name: string }[];
    activeKeyboardId?: string;
    onkeyboardchange?: (id: string) => void;
  } = $props();
  const views = [
    { id: 'practice', label: 'view.practice' }, { id: 'keyboard-test', label: 'view.keyboardTest' },
    { id: 'keyboard-details', label: 'view.keyboardDetails' }, { id: 'stats', label: 'view.stats' }
  ] as const;
</script>

<header class="w-full border-b border-white/[0.06]">
  <div class="mx-auto flex w-[min(100%-3rem,76rem)] flex-wrap items-center justify-between gap-x-8 gap-y-4 py-5 max-[520px]:w-[calc(100%-2rem)] max-[520px]:py-4">
    <div class="flex items-center gap-3">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="36" height="36" class="size-9 rounded-xl shadow-[0_0_1.5rem_rgb(255_93_0/22%)]" aria-hidden="true" />
      <h1 class="m-0 text-[1.08rem] font-semibold tracking-[-0.035em] text-text">AliceType</h1>
    </div>

    <div class="flex flex-wrap items-center gap-x-7 gap-y-3 max-[760px]:w-full max-[760px]:justify-between max-[520px]:items-start max-[520px]:flex-col">
      <nav class="view-navigation" aria-label={translate(language, 'header.views')}>
        {#each views as destination}
          <button type="button" {disabled} aria-pressed={view === destination.id}
            onclick={() => onviewchange(destination.id)}>{translate(language, destination.label)}</button>
        {/each}
      </nav>
      {#if onkeyboardchange}
        <label class="board-selector">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M5 9h2m2 0h2m2 0h2m2 0h2M5 12h2m2 0h2m2 0h2m2 0h2M7 15h10" />
          </svg>
          <span class="sr-only">{translate(language, 'boards.active')}</span>
          <select id="active-keyboard" value={activeKeyboardId} {disabled} aria-keyshortcuts="Control+Shift+K"
            aria-label={translate(language, 'boards.active')}
            aria-describedby={disabled ? 'board-locked' : undefined}
            onchange={(event) => onkeyboardchange?.(event.currentTarget.value)}>
            {#each boards as board (board.id)}<option value={board.id}>{board.name}</option>{/each}
          </select>
        </label>
        {#if disabled}<span id="board-locked" class="sr-only">{translate(language, 'boards.locked')}</span>{/if}
      {/if}
      {#if onlanguagechange}
        <label class="language-selector">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" />
          </svg>
          <span class="sr-only">{translate(language, 'header.language')}</span>
          <select id="app-language" value={language} {disabled} aria-label={translate(language, 'header.language')} aria-describedby={disabled ? 'language-locked' : undefined}
            onchange={(event) => {
              const next = event.currentTarget.value;
              if (!isLanguageId(next)) throw new Error('Unsupported language selection.');
              onlanguagechange?.(next);
            }}>
            {#each Object.entries(LANGUAGES) as [id, entry]}
              <option value={id} lang={entry.documentLanguage}>{entry.nativeName}</option>
            {/each}
          </select>
        </label>
        {#if disabled}<span id="language-locked" class="sr-only">{translate(language, 'header.languageLocked')}</span>{/if}
      {/if}
    </div>
  </div>
</header>

<style>
  .language-selector { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; color: #b8b8b8; font-size: 0.85rem; }
  .board-selector { display: flex; align-items: center; gap: 0.5rem; max-width: 100%; color: #b8b8b8; font-size: 0.85rem; }
  .board-selector select { width: 12rem; max-width: 100%; }
</style>
