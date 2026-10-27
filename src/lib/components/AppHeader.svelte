<script lang="ts">
  let { disabled, view, onviewchange }: {
    disabled: boolean;
    view: 'practice' | 'settings' | 'stats' | 'keyboard-test' | 'keyboard-details';
    onviewchange: (view: 'practice' | 'settings' | 'stats' | 'keyboard-test' | 'keyboard-details') => void;
  } = $props();
  const views = [
    { id: 'practice', label: 'Practice' }, { id: 'keyboard-test', label: 'Keyboard Test' },
    { id: 'keyboard-details', label: 'Keyboard Details' },
    { id: 'settings', label: 'Settings' }, { id: 'stats', label: 'Stats' }
  ] as const;
</script>

<header class="w-full border-b border-white/[0.06]">
  <div class="mx-auto flex w-[min(100%-3rem,76rem)] flex-wrap items-center justify-between gap-x-8 gap-y-4 py-5 max-[520px]:w-[calc(100%-2rem)] max-[520px]:py-4">
    <div class="flex items-center gap-3">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="36" height="36" class="size-9 rounded-xl shadow-[0_0_1.5rem_rgb(255_93_0/22%)]" aria-hidden="true" />
      <h1 class="m-0 text-[1.08rem] font-semibold tracking-[-0.035em] text-text">AliceType</h1>
    </div>

    <div class="flex flex-wrap items-center gap-x-7 gap-y-3 max-[760px]:w-full max-[760px]:justify-between max-[520px]:items-start max-[520px]:flex-col">
      <nav class="view-navigation" aria-label="App views">
        {#each views as destination}
          <button type="button" {disabled} aria-pressed={view === destination.id}
            onclick={() => onviewchange(destination.id)}>{destination.label}</button>
        {/each}
      </nav>
    </div>
  </div>
</header>
