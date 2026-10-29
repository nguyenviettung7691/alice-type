<script lang="ts">
  import { onMount } from 'svelte';
  import KeyboardOnboarding from './KeyboardOnboarding.svelte';
  import { browserKeyboardAccess, type KeyboardDevice } from '../keyboard/keyboard-access';
  import { useLocalization } from '../i18n/context';
  const localization = useLocalization();
  const { text } = localization;

  let { onboarding, disabled, onfinish, ondevicechange, onlayoutchange, onfindlayout, confirmedLayoutLabel = null }: {
    onboarding: boolean;
    disabled: boolean;
    onfinish: (focusPractice: boolean) => void;
    ondevicechange: (device: KeyboardDevice | null) => void;
    onlayoutchange: (legends: ReadonlyMap<string, string> | null) => void;
    onfindlayout: () => void;
    confirmedLayoutLabel?: string | null;
  } = $props();

  const { hid, keyboard } = browserKeyboardAccess();
  let prompt = $state(false);
  let expanded = $state(false);
  let busy = $state(false);
  let warning = $state<(() => string) | null>(null);
  let layoutMessage = $state<(() => string) | null>(null);
  let devices = $state.raw<KeyboardDevice[]>([]);
  let selected = $state.raw<KeyboardDevice | null>(null);
  let alive = true;
  let dismissed = false;
  let deviceRevision = 0;
  let layoutRevision = 0;

  function selectDevice(device: KeyboardDevice | null) {
    selected = device;
    ondevicechange(device);
  }

  function updateDevices(next: KeyboardDevice[]) {
    devices = next;
    const current = next.find((device) => device === selected);
    selectDevice(current ?? (next.length === 1 ? next[0] : null));
    warning = next.length === 0
      ? () => text("keyboard-connection.no-device-is-available-right-now-it")
      : next.length > 1 && !selected
        ? () => text("keyboard-connection.several-devices-are-available-choose-the-one")
        : null;
  }

  async function restoreDevices(initial = false) {
    if (!hid) {
      warning = () => text("keyboard-connection.device-access-is-not-available-in-this");
      return;
    }
    const revision = ++deviceRevision;
    try {
      const next = await hid.getDevices();
      if (!alive || revision !== deviceRevision) return;
      updateDevices(next);
      if (initial && next.length === 0 && !dismissed) prompt = true;
      if (selected) void requestLayout();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (alive && revision === deviceRevision) {
        selectDevice(null);
        devices = [];
        warning = () => text("keyboard-connection.keyboard-detection-failed-try-connecting-again-or", { p0: String(error.message) });
        if (initial && !dismissed) prompt = true;
      }
    }
  }

  async function requestLayout() {
    const revision = ++layoutRevision;
    try {
      if (!keyboard?.getLayoutMap) {
        layoutMessage = () => text("keyboard-connection.browser-key-labels-are-not-available-here");
        onlayoutchange(null);
        return;
      }
      const map = await keyboard.getLayoutMap();
      if (!alive || revision !== layoutRevision) return;
      onlayoutchange(map.size > 0 ? new Map(map) : null);
      layoutMessage = () => text("keyboard-connection.key-labels-are-updated-from-your-browser");
      if (map.size === 0) layoutMessage = () => text("keyboard-connection.your-browser-did-not-provide-any-key");
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (alive && revision === layoutRevision) {
        onlayoutchange(null);
        layoutMessage = () => text("keyboard-connection.could-not-refresh-key-labels-the-diagrams", { p0: String(error.message) });
      }
    }
  }

  async function connect() {
    if (!hid || busy) return;
    busy = true;
    const revision = ++deviceRevision;
    try {
      // Invoke the chooser before any await to preserve the click's user activation.
      const next = await hid.requestDevice({ filters: [] });
      if (!alive || revision !== deviceRevision) return;
      if (next.length > 0) {
        updateDevices(next);
      } else {
        warning = () => text("keyboard-connection.no-device-was-selected-try-again-or");
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (alive && revision === deviceRevision) {
        warning = () => text("keyboard-connection.the-browser-could-not-connect-to-a", { p0: String(error.message) });
      }
    } finally {
      if (alive) busy = false;
    }
  }

  function finish(choice: 'device' | 'layout' | 'skip') {
    dismissed = true;
    prompt = false;
    if (choice !== 'skip') expanded = true;
    if (choice === 'device') {
      void connect();
      void requestLayout();
    } else if (choice === 'layout') {
      void requestLayout();
    } else {
      warning = () => text("keyboard-connection.no-problem-you-can-practice-and-test");
    }
    onfinish(choice !== 'skip');
  }

  onMount(() => {
    void restoreDevices(true);
    const refresh = () => { void restoreDevices(); };
    const disconnect = (event: Event) => {
      if ('device' in event && event.device === selected) {
        selectDevice(null);
        onlayoutchange(null);
        layoutRevision += 1;
      }
      refresh();
    };
    const layoutChanged = () => { void requestLayout(); };
    hid?.addEventListener('connect', refresh);
    hid?.addEventListener('disconnect', disconnect);
    keyboard?.addEventListener?.('layoutchange', layoutChanged);
    return () => {
      alive = false;
      hid?.removeEventListener('connect', refresh);
      hid?.removeEventListener('disconnect', disconnect);
      keyboard?.removeEventListener?.('layoutchange', layoutChanged);
    };
  });
</script>

<section class="notice keyboard-connection" aria-label={text("keyboard-connection.keyboard-connection")}>
  <details bind:open={expanded}>
    <summary>
      <span class="connection-title">{text("keyboard-connection.keyboard-connection")}</span>
      <span class="connection-badge" data-tone={busy ? 'pending' : !hid ? 'neutral' : selected ? (warning ? 'warning' : 'success') : 'warning'}>
        {busy ? text("keyboard-connection.connecting") : !hid ? text("keyboard-connection.unavailable") : selected ? (warning ? text("keyboard-connection.attention-needed") : text("keyboard-connection.device-selected")) : devices.length > 1 ? text("keyboard-connection.choose-a-device") : text("keyboard-connection.no-device-selected")}
      </span>
      <span class="summary-device" aria-live="polite">{selected?.productName || (selected ? text("keyboard-connection.unnamed-device") : text("keyboard-connection.no-device-selected"))}</span>
      <svg class="disclosure-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </summary>
    <div class="connection-content">
      <div class="connection-overview">
        <div class="connection-copy">
          <p class="connection-intro"><strong>{text("keyboard-connection.device-access-is-optional")}</strong> {text("keyboard-connection.you-can-practice-and-test-keys-without")}</p>
          <p class="connection-description">{text("keyboard-connection.connect-a-device-to-see-the-details")}</p>
          {#if selected}
            <p class="selected-device" role="status">{text("keyboard-connection.selected-device")} <strong>{selected.productName || text("keyboard-connection.unnamed-device")}</strong></p>
            {#if confirmedLayoutLabel}
              <p class="connection-description">{text("keyboard-connection.both-diagrams-use-the-layout-you-confirmed", { p0: String(confirmedLayoutLabel) })}</p>
            {:else}
              <p class="connection-description">{text("keyboard-connection.no-layout-is-confirmed-yet-the-diagrams")}</p>
            {/if}
          {/if}
          {#if warning}<p class="keyboard-warning" aria-live="polite">{warning()}</p>{/if}
        </div>
        <div class="panel-actions connection-actions">
          {#if hid}
            <button class="secondary-button" type="button" disabled={disabled || busy} onclick={() => { void connect(); }}>
              {busy ? text("keyboard-connection.connecting") : text("keyboard-connection.connect-a-device")}
            </button>
          {/if}
          <button class="secondary-button" type="button" disabled={disabled} onclick={() => { void requestLayout(); }}>{text("keyboard-connection.refresh-key-labels")}</button>
          {#if selected}
            <button class="secondary-button" type="button" disabled={disabled} onclick={onfindlayout}>{text("keyboard-connection.find-my-layout")}</button>
          {/if}
        </div>
      </div>
      {#if devices.length > 1}
        <label for="connected-keyboard">{text("keyboard-connection.choose-a-device")}</label>
        <select id="connected-keyboard" disabled={disabled || busy} value={selected ? devices.indexOf(selected) : ''} onchange={(event) => {
          const value = event.currentTarget.value;
          selectDevice(value === '' ? null : devices[Number(value)]);
          warning = selected ? null : () => text("keyboard-connection.choose-the-device-you-use-your-browser");
        }}>
          <option value="">{text("keyboard-connection.choose-a-device")}</option>
          {#each devices as device, index}
            <option value={index}>{text("keyboard-connection.device", { p0: device.productName || text('keyboard-connection.unnamed-device'), p1: String(index + 1) })}</option>
          {/each}
        </select>
      {/if}
      {#if layoutMessage}<p class="layout-message" role="status">{layoutMessage()}</p>{/if}
      <p class="connection-privacy"><strong>{text("keyboard-connection.your-information-stays-private")}</strong> {text("keyboard-connection.settings-and-scores-stay-in-this-browser")}</p>
    </div>
  </details>
</section>

{#if onboarding || (prompt && !disabled)}
  <KeyboardOnboarding deviceSupported={!!hid} onfinish={finish} />
{/if}

<style>
  .keyboard-connection {
    border-color: rgb(255 255 255 / 15%);
    color: #b8b8b8;
    font-size: 0.9rem;
    line-height: 1.6;
    background: var(--color-surface);
    padding: 0;
    overflow-wrap: anywhere;
  }

  summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    padding: 1rem clamp(1rem, 2.5vw, 1.4rem);
    cursor: pointer;
    list-style: none;
    border-radius: 0.6rem;
    min-height: 3.5rem;
  }
  summary::-webkit-details-marker { display: none; }
  summary:hover { background: rgb(255 255 255 / 3%); }
  summary:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  .connection-title { color: var(--color-text); font-size: 0.95rem; font-weight: 600; }
  .summary-device { flex: 1 1 12rem; min-width: 0; font-size: 0.82rem; }
  .disclosure-icon { flex-shrink: 0; margin-left: auto; }
  details[open] .disclosure-icon { transform: rotate(180deg); }
  .connection-content {
    border-top: 1px solid rgb(255 255 255 / 8%);
    padding: 1rem clamp(1rem, 2.5vw, 1.4rem);
  }
  .connection-overview {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
  }

  .connection-copy { flex: 1 1 25rem; min-width: 0; }
  .connection-intro, .connection-description { margin: 0.55rem 0 0; }
  .connection-intro { color: var(--color-text); }
  .connection-intro strong { font-weight: 600; }
  .connection-badge {
    border: 1px solid rgb(255 255 255 / 15%);
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
    font-size: 0.72rem;
  }
  .connection-badge[data-tone='warning'] {
    color: #f5ce72;
    border-color: rgb(245 206 114 / 35%);
    background: rgb(245 206 114 / 8%);
  }
  .connection-badge[data-tone='success'] {
    color: #8cdbac;
    border-color: rgb(140 219 172 / 35%);
    background: rgb(140 219 172 / 8%);
  }
  .connection-badge[data-tone='pending'] {
    color: #a9ceff;
    border-color: rgb(169 206 255 / 35%);
    background: rgb(169 206 255 / 8%);
  }
  .selected-device, .keyboard-warning { margin: 0.55rem 0 0; }
  .selected-device strong { color: var(--color-text); }
  .connection-actions { margin: 0; gap: 0.5rem; }
  .connection-actions button + button { margin-left: 0; }
  .connection-actions button { font-size: 0.8rem; }
  .connection-privacy {
    margin: 1rem 0 0;
    padding-top: 0.8rem;
    border-top: 1px solid rgb(255 255 255 / 8%);
    font-size: 0.78rem;
  }
  .connection-privacy strong { font-weight: 600; color: var(--color-text); }
  .layout-message { margin: 0.8rem 0 0; font-size: 0.8rem; }
  label { display: block; margin: 1rem 0 0.4rem; }
  select {
    width: min(100%, 32rem);
    max-width: 100%;
  }
</style>
