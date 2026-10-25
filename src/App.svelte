<script lang="ts">
  import AppFooter from './lib/components/AppFooter.svelte';
  import AppHeader from './lib/components/AppHeader.svelte';
  import PracticePanel from './lib/components/PracticePanel.svelte';
</script>

<div class="app-shell">
  <AppHeader />

  <main class="main-content">
    <div class="intro">
      <p class="eyebrow"><span class="eyebrow-dot"></span>A quieter kind of practice</p>
      <h2>Find your rhythm.</h2>
      <p class="intro-copy">A little focus goes a long way. Settle in and let the words flow.</p>
    </div>

    <PracticePanel />
  </main>

  <AppFooter />
</div>
