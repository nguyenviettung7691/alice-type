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
  <p class="eyebrow">Your pace. Your rhythm.</p>
  <h2 id="welcome-heading">Welcome to AliceType</h2>
  <p id="welcome-description">Build confidence on your Alice keyboard, one session at a time. No device connection is needed to practice.</p>

  <div class="practice-action">
    <button class="primary-button" type="button" onclick={() => finish('layout')}>Start practicing</button>
    <p>We'll try to match the diagram's key labels to your browser layout. Your session starts only when you type. Sound is off by default.</p>
  </div>

  <section class="optional-setup" aria-labelledby="optional-setup-heading">
    <h3 id="optional-setup-heading">Want to connect your keyboard? <span>Optional</span></h3>
    {#if deviceSupported}
      <p>Choose your keyboard in the browser's device picker to help find a matching layout. Some keyboards won't appear, and you'll still need to confirm any suggested layout.</p>
      <button class="secondary-button" type="button" onclick={() => finish('device')}>Connect keyboard &amp; start</button>
    {:else}
      <p>Device connection isn't available in this browser. You can still practice, test keys, and choose a layout in Keyboard Details.</p>
    {/if}
  </section>

  <details>
    <summary>Privacy &amp; keyboard access</summary>
    <p>Your settings, scores, and device details stay in this browser and are never uploaded to a server. Your browser remembers device permission; live device details are kept only for this visit.</p>
    <p>Starting practice requests browser key labels only, not device access. Labels and device information cannot detect your keyboard's physical shape. Without a confirmed layout, diagrams use a reference Alice arrangement.</p>
    <p>Connecting also tries browser key labels. Select only your keyboard in the picker. You can manage device permissions in your browser's site settings, or connect later from Keyboard connection.</p>
    <p>Typing is captured only in the focused exercise. Tab lets you leave, and browser shortcuts stay yours.</p>
  </details>

  <div class="welcome-footer">
    <p>Just looking around?</p>
    <button class="secondary-button" type="button" onclick={() => finish('skip')}>Explore first</button>
  </div>
</dialog>

<style>
  .eyebrow {
    margin: 0 0 0.6rem;
    color: var(--color-accent);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h2 { line-height: 1.2; margin-bottom: 0.8rem; }
  #welcome-description { margin: 0; }
  .practice-action { margin-top: 1.5rem; }
  .practice-action button { width: 100%; font-weight: 600; min-height: 2.75rem; }
  .practice-action p { margin: 0.65rem 0 0; font-size: 0.8rem; }
  .optional-setup {
    margin-top: 1.5rem;
    padding: 1rem;
    border: 1px solid rgb(255 255 255 / 12%);
    border-radius: 0.6rem;
    background: rgb(255 255 255 / 3%);
  }
  h3 {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
  }
  h3 span {
    padding: 0.15rem 0.45rem;
    border: 1px solid rgb(255 255 255 / 20%);
    border-radius: 999px;
    color: #b8b8b8;
    font-size: 0.7rem;
    font-weight: 400;
  }
  .optional-setup p { margin: 0.65rem 0; font-size: 0.8rem; }
  details { margin-top: 1rem; }
  summary { cursor: pointer; color: #b8b8b8; font-size: 0.8rem; }
  summary:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 4px; }
  details p { font-size: 0.8rem; }
  .welcome-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgb(255 255 255 / 12%);
  }
  .welcome-footer p { margin: 0; font-size: 0.8rem; }
</style>
