<script lang="ts">
  import { tick } from 'svelte';
  import {
    KEYBOARD_PROFILES, KEYBOARD_PROFILE_CATALOG_REVISION, KEYBOARD_PROFILE_CATALOG_UPDATED_AT, findKeyboardProfile
  } from '../keyboard/keyboard-profiles';
  import {
    KEYBOARD_DETAIL_BOOLEAN_FIELDS, KEYBOARD_DETAIL_MAX_LENGTH, KEYBOARD_DETAIL_TEXT_FIELDS,
    type KeyboardLayoutConfirmation, type KeyboardUserDetails
  } from '../storage/preferences';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  import LayoutMatchPanel from './LayoutMatchPanel.svelte';
  import { deviceId, type KeyboardDevice } from '../keyboard/keyboard-access';

  type TextField = typeof KEYBOARD_DETAIL_TEXT_FIELDS[number];
  type BooleanField = typeof KEYBOARD_DETAIL_BOOLEAN_FIELDS[number];
  type DetailField = TextField | BooleanField;

  let {
    profileId, userDetails, onprofilechange, onuserdetailschange, connectedDevice = null,
    layoutConfirmation, layoutNotice = '', onlayoutconfirm, onlayoutclear
  }: {
    profileId: string | null;
    userDetails: KeyboardUserDetails;
    onprofilechange: (profileId: string | null) => void;
    onuserdetailschange: (details: KeyboardUserDetails) => void;
    connectedDevice?: KeyboardDevice | null;
    layoutConfirmation: KeyboardLayoutConfirmation | null;
    layoutNotice?: string;
    onlayoutconfirm: (confirmation: KeyboardLayoutConfirmation) => void;
    onlayoutclear: () => void;
  } = $props();

  const fieldLabels: Record<DetailField, string> = {
    name: 'Name',
    brand: 'Brand',
    model: 'Model',
    version: 'Version',
    connectivity: 'Connectivity',
    rgbBacklighting: 'RGB / backlighting',
    keyRollover: 'Key rollover',
    programmableKeys: 'Programmable keys'
  };
  const identityFields: readonly DetailField[] = ['name', 'brand', 'model', 'version'];
  const featureFields: readonly DetailField[] = ['rgbBacklighting', 'connectivity', 'keyRollover', 'programmableKeys'];

  let editing = $state(false);
  let confirmingClear = $state(false);
  let draft = $state<KeyboardUserDetails>({});
  let editButton = $state<HTMLButtonElement>();
  const selectedProfile = $derived(findKeyboardProfile(profileId));

  function catalogValue(field: DetailField) {
    if (field === 'name' || field === 'brand' || field === 'model' || field === 'version') {
      return selectedProfile?.identity[field];
    }
    return selectedProfile?.features[field];
  }

  function resolvedValue(field: DetailField) {
    const userValue = userDetails[field];
    if (userValue !== undefined) {
      return { value: typeof userValue === 'boolean' ? (userValue ? 'Yes' : 'No') : userValue, source: 'You provided this' };
    }
    const catalog = catalogValue(field);
    if (catalog) {
      return { value: typeof catalog.value === 'boolean' ? (catalog.value ? 'Yes' : 'No') : catalog.value,
        source: 'Catalog verified', citation: catalog.source };
    }
    return { value: 'Unknown', source: 'Unknown' };
  }

  async function beginEditing() {
    draft = { ...userDetails };
    editing = true;
    await tick();
    document.getElementById('keyboard-detail-name')?.focus();
  }

  async function cancelEditing() {
    editing = false;
    await tick();
    editButton?.focus();
  }

  function updateText(field: TextField, value: string) {
    const next = { ...draft };
    if (value) next[field] = value;
    else delete next[field];
    draft = next;
  }

  function textValue(field: TextField): string {
    const value = draft[field];
    return typeof value === 'string' ? value : '';
  }

  function updateBoolean(field: BooleanField, value: string) {
    const next = { ...draft };
    if (value === '') delete next[field];
    else if (value === 'yes') next[field] = true;
    else if (value === 'no') next[field] = false;
    else throw new Error(`Unsupported ${field} selection.`);
    draft = next;
  }

  async function saveDetails() {
    const next: Partial<Record<TextField, string> & Record<BooleanField, boolean>> = {};
    for (const field of KEYBOARD_DETAIL_TEXT_FIELDS) {
      const value = draft[field]?.trim();
      if (!value) continue;
      if (value.length > KEYBOARD_DETAIL_MAX_LENGTH) throw new Error(`${fieldLabels[field]} is too long.`);
      next[field] = value;
    }
    for (const field of KEYBOARD_DETAIL_BOOLEAN_FIELDS) {
      const value = draft[field];
      if (value !== undefined) next[field] = value;
    }
    onuserdetailschange(next);
    editing = false;
    await tick();
    editButton?.focus();
  }

  function clearDetails() {
    onuserdetailschange({});
    draft = {};
    editing = false;
    confirmingClear = false;
  }
</script>

<section class="practice-panel settings-panel keyboard-details-panel" aria-labelledby="keyboard-details-heading">
  <p class="eyebrow">Your keyboard reference</p>
  <h2 id="keyboard-details-heading" tabindex="-1">Keyboard Details</h2>
  <p class="panel-copy">
    Choose a reference profile or add your own details. AliceType cannot detect your connected keyboard's physical layout or full specifications.
    These details stay in this browser and are not sent to a server.
  </p>

  <fieldset class="browser-device">
    <legend>Browser-reported device</legend>
    {#if connectedDevice}
      <div class="browser-device-card">
        <span class="device-source">Shared by your browser</span>
        <dl class="browser-device-values">
          <div class="device-product"><dt>Product name</dt><dd>{connectedDevice.productName || 'Not provided'}</dd></div>
          <div><dt>Vendor ID</dt><dd><code>{deviceId(connectedDevice.vendorId)}</code></dd></div>
          <div><dt>Product ID</dt><dd><code>{deviceId(connectedDevice.productId)}</code></dd></div>
          <div><dt>VID:PID (VPID)</dt><dd><code>{deviceId(connectedDevice.vendorId).slice(2)}:{deviceId(connectedDevice.productId).slice(2)}</code></dd></div>
        </dl>
        <p class="device-explanation">These details come from the device you authorized, not from your typing. The IDs are identifiers only; they do not verify a brand, model, or layout.</p>
      </div>
      <p class="device-limitation"><strong>Reference layout only.</strong> AliceType cannot detect this device's physical layout or specifications. Use Find my layout below to review catalog suggestions, or add your own notes.</p>
    {:else}
      <div class="browser-device-card">
        <p class="device-empty-title">No device selected</p>
        <p class="device-explanation">Choose your keyboard in the connection panel above, or use <strong>Connect keyboard</strong> if available. If your keyboard isn't listed, your browser may not allow device access.</p>
        <p class="device-explanation">You can still practice, test keys, and add a reference profile or personal notes below.</p>
      </div>
    {/if}
  </fieldset>

  <LayoutMatchPanel {connectedDevice} confirmation={layoutConfirmation} {layoutNotice}
    onconfirm={onlayoutconfirm} onclear={onlayoutclear} />

  <fieldset>
    <legend>Keyboard profile</legend>
    <label for="keyboard-profile">Reference profile</label>
    <select id="keyboard-profile" value={profileId ?? ''} onchange={(event) => {
      const value = event.currentTarget.value;
      onprofilechange(value || null);
    }}>
      <option value="">No profile selected</option>
      {#each KEYBOARD_PROFILES as profile (profile.id)}
        <option value={profile.id}>{profile.displayName}</option>
      {/each}
    </select>
    {#if layoutConfirmation}
      <p class="profile-summary">Choosing a different reference profile clears your confirmed layout.</p>
    {/if}
    {#if selectedProfile}
      <p class="profile-summary">
        Selected reference: <strong>{selectedProfile.displayName}</strong>
        ({selectedProfile.kind === 'generic-layout' ? 'generic layout' : 'catalog device profile'}).
        Catalog revision {KEYBOARD_PROFILE_CATALOG_REVISION}, reviewed {KEYBOARD_PROFILE_CATALOG_UPDATED_AT}.
      </p>
        {#if selectedProfile.testLayout}
          <p class="profile-summary">
            Test map: <strong>{selectedProfile.testLayout.label}</strong>
            <span class="source-label">Catalog verified</span>
            {#if selectedProfile.testLayout.source.kind === 'internal'}
              <span class="source-reference">Source: {selectedProfile.testLayout.source.label} ({selectedProfile.testLayout.source.path})</span>
            {:else}
              <a href={selectedProfile.testLayout.source.url} target="_blank" rel="noreferrer">
                {selectedProfile.testLayout.source.title}
              </a>
            {/if}
          </p>
          <p class="catalog-sources">
            This source supports: {selectedProfile.testLayout.source.fields.join(', ')}.
          </p>
        {/if}
    {:else}
      <p class="profile-summary">No catalog profile is selected. Device identity and features not entered below are unknown.</p>
    {/if}
  </fieldset>

  <fieldset>
    <legend>Device information</legend>
    {#each identityFields as field (field)}
      {@const resolved = resolvedValue(field)}
      <div class="detail-row">
        <span class="detail-name">{fieldLabels[field]}</span>
        <span class="detail-value">{resolved.value}</span>
        <span class="source-label">{resolved.source}</span>
        {#if resolved.citation?.kind === 'external'}
          <a href={resolved.citation.url} target="_blank" rel="noreferrer">{resolved.citation.title}</a>
        {:else if resolved.citation?.kind === 'internal'}
          <span class="source-reference">Source: {resolved.citation.label} ({resolved.citation.path})</span>
        {/if}
      </div>
    {/each}
  </fieldset>

  <fieldset>
    <legend>Supported features</legend>
    {#each featureFields as field (field)}
      {@const resolved = resolvedValue(field)}
      <div class="detail-row">
        <span class="detail-name">{fieldLabels[field]}</span>
        <span class="detail-value">{resolved.value}</span>
        <span class="source-label">{resolved.source}</span>
        {#if resolved.citation?.kind === 'external'}
          <a href={resolved.citation.url} target="_blank" rel="noreferrer">{resolved.citation.title}</a>
        {:else if resolved.citation?.kind === 'internal'}
          <span class="source-reference">Source: {resolved.citation.label} ({resolved.citation.path})</span>
        {/if}
      </div>
    {/each}
  </fieldset>

  <fieldset>
    <legend>Your device details</legend>
    <p>Personal details take display precedence over catalog values and are always labeled as user-provided.</p>
    {#if editing}
      {#each KEYBOARD_DETAIL_TEXT_FIELDS as field (field)}
        <label for={`keyboard-detail-${field}`}>{fieldLabels[field]}</label>
        <input
          id={`keyboard-detail-${field}`}
          type="text"
          maxlength={KEYBOARD_DETAIL_MAX_LENGTH}
          value={textValue(field)}
          oninput={(event) => updateText(field, event.currentTarget.value)}
        />
      {/each}
      {#each KEYBOARD_DETAIL_BOOLEAN_FIELDS as field (field)}
        <label for={`keyboard-detail-${field}`}>{fieldLabels[field]}</label>
        <select id={`keyboard-detail-${field}`} value={draft[field] === undefined ? '' : draft[field] ? 'yes' : 'no'}
          onchange={(event) => updateBoolean(field, event.currentTarget.value)}>
          <option value="">No personal override</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      {/each}
      <div class="panel-actions">
        <button class="primary-button" type="button" onclick={saveDetails}>Save details</button>
        <button class="secondary-button" type="button" onclick={cancelEditing}>Cancel</button>
      </div>
    {:else}
      <div class="panel-actions">
        <button bind:this={editButton} class="secondary-button" type="button" onclick={beginEditing}>Edit device details</button>
        <button class="secondary-button" type="button" disabled={Object.keys(userDetails).length === 0}
          onclick={() => { confirmingClear = true; }}>Clear my details</button>
      </div>
    {/if}
  </fieldset>
</section>

{#if confirmingClear}
  <ConfirmationDialog
    title="Clear your device details?"
    message="This removes only your saved personal details. Your selected catalog profile stays selected."
    confirmText="Clear my details"
    oncancel={() => { confirmingClear = false; }}
    onconfirm={clearDetails}
  />
{/if}

<style>
  .browser-device-card {
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 0.75rem;
    padding: clamp(1rem, 3vw, 1.4rem);
    background: rgb(0 0 0 / 12%);
    overflow-wrap: anywhere;
  }
  .device-source { color: #b8b8b8; font-size: 0.75rem; }
  .browser-device-values {
    display: grid;
    grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }
  .browser-device-values dt { margin-bottom: 0.35rem; color: #b8b8b8; font-size: 0.78rem; }
  .browser-device-values dd { margin: 0; color: var(--color-text); font-weight: 550; }
  .device-product dd { font-size: 1.1rem; }
  .browser-device-card .device-empty-title { margin: 0; color: var(--color-text); font-weight: 600; }
  .browser-device-card .device-explanation { margin: 0.65rem 0 0; font-size: 0.82rem; }
  .browser-device .device-limitation { margin: 0.85rem 0 0; font-size: 0.82rem; }
  .device-limitation strong { color: var(--color-text); font-weight: 600; }
  @media (max-width: 520px) {
    .browser-device-values { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .device-product { grid-column: 1 / -1; }
  }
  .keyboard-details-panel select,
  .keyboard-details-panel input {
    width: min(100%, 32rem);
  }
  .keyboard-details-panel input {
    border: 1px solid var(--color-muted);
    border-radius: 0.35rem;
    padding: 0.5rem;
    background: var(--color-background);
    color: var(--color-text);
    font: inherit;
  }
  .keyboard-details-panel input:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  .profile-summary { overflow-wrap: anywhere; }
  .catalog-sources { padding-left: 1.25rem; color: #b8b8b8; font-size: 0.78rem; overflow-wrap: anywhere; }
  .detail-row {
    display: grid;
    grid-template-columns: minmax(8rem, 0.7fr) minmax(8rem, 1fr) minmax(8rem, 0.8fr);
    align-items: start;
    gap: 0.45rem 1rem;
    padding-block: 0.8rem;
    border-bottom: 1px solid rgb(255 255 255 / 8%);
  }
  .detail-name { color: #b8b8b8; }
  .detail-value { overflow-wrap: anywhere; }
  .source-label { color: var(--color-accent); font-size: 0.82rem; }
  .source-reference { grid-column: 2 / -1; color: #b8b8b8; font-size: 0.78rem; overflow-wrap: anywhere; }
  .detail-row a { grid-column: 2 / -1; color: var(--color-accent); font-size: 0.82rem; overflow-wrap: anywhere; }
  @media (max-width: 600px) {
    .detail-row { grid-template-columns: minmax(0, 1fr); }
    .source-reference, .detail-row a { grid-column: auto; }
  }
</style>
