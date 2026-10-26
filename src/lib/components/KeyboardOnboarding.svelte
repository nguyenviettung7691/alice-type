<script lang="ts">
  import { onMount } from 'svelte';

  let { onfinish, deviceSupported = false }: {
    onfinish: (choice: 'device' | 'layout' | 'skip') => void;
    deviceSupported?: boolean;
  } = $props();
  let dialog: HTMLDialogElement;
  let finished = false;

  function finish(choice: 'device' | 'layout' | 'skip') {
    if (finished) return;
    finished = true;
    onfinish(choice);
  }

  onMount(() => { dialog.showModal(); });
</script>

<dialog bind:this={dialog} aria-labelledby="welcome-heading" aria-describedby="welcome-description" onclose={() => finish('skip')}>
  <p class="eyebrow">Welcome to AliceType</p>
  <h2 id="welcome-heading">Make room for your rhythm.</h2>
  <div id="welcome-description">
    <p>Practice starts only when you type in the focused exercise. Tab always lets you leave; browser shortcuts stay yours.</p>
    <p>Connect Keyboard &amp; Start opens the browser's device chooser. Select only your keyboard. Many keyboards are protected and will not appear; access is optional and ordinary typing needs no permission.</p>
    <p>Start practicing requests only Keyboard API layout legends, not device access. These legends cannot identify a brand, model, or physical shape. Without a verified device profile, both diagrams use a generic Alice arrangement.</p>
    <p>All app data, including connected-device information, stays in this browser and is never uploaded to a server. Device access is remembered by your browser; live device details are kept only for this visit. Sound is off until you enable it.</p>
    {#if !deviceSupported}<p>Device detection is unavailable in this browser or context. You can still try layout access or practice without it.</p>{/if}
  </div>
  <div class="panel-actions">
    {#if deviceSupported}
      <button class="primary-button" type="button" onclick={() => finish('device')}>Connect Keyboard &amp; Start</button>
    {/if}
    <button class="secondary-button" type="button" onclick={() => finish('layout')}>Start practicing</button>
    <button class="secondary-button" type="button" onclick={() => finish('skip')}>Continue without layout access</button>
  </div>
</dialog>
