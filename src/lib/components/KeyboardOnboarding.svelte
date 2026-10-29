<script lang="ts">
  import { onMount } from 'svelte';
  import { useLocalization } from '../i18n/context';
  const localization = useLocalization();
  const { text } = localization;

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
  <p class="eyebrow">{text("keyboard-onboarding.your-pace-your-rhythm")}</p>
  <h2 id="welcome-heading">{text("keyboard-onboarding.welcome-to-alicetype")}</h2>
  <p id="welcome-description">{text("keyboard-onboarding.build-confidence-on-your-alice-keyboard-one")}</p>

  <div class="practice-action">
    <button class="primary-button" type="button" onclick={() => finish('layout')}>{text("keyboard-onboarding.start-practicing")}</button>
    <p>{text("keyboard-onboarding.we-ll-try-to-match-the-diagram")}</p>
  </div>

  <section class="optional-setup" aria-labelledby="optional-setup-heading">
    <h3 id="optional-setup-heading">{text("keyboard-onboarding.want-to-connect-your-keyboard")} <span>{text("keyboard-details-panel.optional")}</span></h3>
    {#if deviceSupported}
      <p>{text("keyboard-onboarding.choose-your-keyboard-in-the-browser-s")}</p>
      <button class="secondary-button" type="button" onclick={() => finish('device')}>{text("keyboard-onboarding.connect-keyboard-start")}</button>
    {:else}
      <p>{text("keyboard-onboarding.device-connection-isn-t-available-in-this")}</p>
    {/if}
  </section>

  <details>
    <summary>{text("keyboard-onboarding.privacy-keyboard-access")}</summary>
    <p>{text("keyboard-onboarding.your-settings-scores-and-device-details-stay")}</p>
    <p>{text("keyboard-onboarding.starting-practice-requests-browser-key-labels-only")}</p>
    <p>{text("keyboard-onboarding.connecting-also-tries-browser-key-labels-select")}</p>
    <p>{text("keyboard-onboarding.typing-is-captured-only-in-the-focused")}</p>
  </details>

  <div class="welcome-footer">
    <p>{text("keyboard-onboarding.just-looking-around")}</p>
    <button class="secondary-button" type="button" onclick={() => finish('skip')}>{text("keyboard-onboarding.explore-first")}</button>
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
