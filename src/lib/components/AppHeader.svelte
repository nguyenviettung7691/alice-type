<script lang="ts">
  import { DEFAULT_LANGUAGE, isLanguageId, LANGUAGES, type LanguageId } from '../i18n/languages';
  import { translate } from '../i18n/messages';

  let { disabled, view, onviewchange, language = DEFAULT_LANGUAGE, onlanguagechange }: {
    disabled: boolean;
    view: 'practice' | 'stats' | 'keyboard-test' | 'keyboard-details';
    onviewchange: (view: 'practice' | 'stats' | 'keyboard-test' | 'keyboard-details') => void;
    language?: LanguageId;
    onlanguagechange?: (language: LanguageId) => void;
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
      {#if onlanguagechange}
        <label class="language-selector">
          <span>{translate(language, 'header.language')}</span>
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
  .language-selector { margin-left: auto; display: flex; align-items: center; gap: 0.6rem; color: var(--color-text); font-size: 0.8rem; }
  select { color: var(--color-text); background: var(--color-background); border: 1px solid var(--color-muted); border-radius: 0.4rem; padding: 0.5rem; }
  select:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
  select:disabled { opacity: 0.6; }
</style>
