<script lang="ts">
  import { onMount } from 'svelte';

  let { onfinish }: { onfinish: (useLayout: boolean) => void } = $props();
  let dialog: HTMLDialogElement;
  let finished = false;

  function finish(useLayout: boolean) {
    if (finished) return;
    finished = true;
    onfinish(useLayout);
  }

  onMount(() => { dialog.showModal(); });
</script>

<dialog bind:this={dialog} aria-labelledby="welcome-heading" aria-describedby="welcome-description" onclose={() => finish(false)}>
  <p class="eyebrow">Welcome to AliceType</p>
  <h2 id="welcome-heading">Make room for your rhythm.</h2>
  <div id="welcome-description">
    <p>Practice starts only when you type in the focused exercise. Tab always lets you leave; browser shortcuts stay yours.</p>
    <p>The visualizer is a generic Alice keyboard. Starting can optionally ask the browser for layout legends, not your keyboard's brand or model. No permission is needed for ordinary typing.</p>
    <p>Your preferences and completed scores stay in this browser. Sound is off until you enable it.</p>
  </div>
  <div class="panel-actions">
    <button class="primary-button" type="button" onclick={() => finish(true)}>Start practicing</button>
    <button class="secondary-button" type="button" onclick={() => finish(false)}>Continue without layout access</button>
  </div>
</dialog>
