<script lang="ts">
  import AppFooter from './lib/components/AppFooter.svelte';
  import AppHeader from './lib/components/AppHeader.svelte';
  import PracticePanel from './lib/components/PracticePanel.svelte';
  import { DEFAULT_SETTINGS } from './lib/typing/exercise-generator';

  let settings = $state({ ...DEFAULT_SETTINGS });
  let running = $state(false);
</script>

<div class="app-shell">
  <AppHeader mode={settings.mode} disabled={running} onmodechange={(mode) => { settings = { ...settings, mode }; }} />

  <main class="main-content">
    <div class="intro">
      <p class="eyebrow"><span class="eyebrow-dot"></span>A quieter kind of practice</p>
      <h2>Find your rhythm.</h2>
      <p class="intro-copy">A little focus goes a long way. Settle in and let the words flow.</p>
    </div>

    <PracticePanel bind:settings bind:running />
  </main>

  <AppFooter />
</div>
