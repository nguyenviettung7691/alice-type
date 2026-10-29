<script lang="ts">
  import { tick } from 'svelte';
  import {
    KEYBOARD_PROFILES, KEYBOARD_PROFILE_CATALOG_REVISION, KEYBOARD_PROFILE_CATALOG_UPDATED_AT, findKeyboardProfile
  } from '../keyboard/keyboard-profiles';
  import {
    KEYBOARD_DETAIL_BOOLEAN_FIELDS, KEYBOARD_DETAIL_MAX_LENGTH, KEYBOARD_DETAIL_TEXT_FIELDS,
    type KeyboardKeymapImport, type KeyboardLayoutConfirmation, type KeyboardUserDetails
  } from '../storage/preferences';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  import KeymapImportPanel from './KeymapImportPanel.svelte';
  import LayoutMatchPanel from './LayoutMatchPanel.svelte';
  import { deviceId, type KeyboardDevice } from '../keyboard/keyboard-access';
  import { useLocalization } from '../i18n/context';
  const localization = useLocalization();
  const { text } = localization;

  type TextField = typeof KEYBOARD_DETAIL_TEXT_FIELDS[number];
  type BooleanField = typeof KEYBOARD_DETAIL_BOOLEAN_FIELDS[number];
  type DetailField = TextField | BooleanField;

  let {
    profileId, userDetails, onprofilechange, onuserdetailschange, connectedDevice = null,
    layoutConfirmation, layoutNotice = '', onlayoutconfirm, onlayoutclear,
    keymapImport = null, onkeymapapply, onkeymapclear
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
    keymapImport?: KeyboardKeymapImport | null;
    onkeymapapply: (keymap: KeyboardKeymapImport) => void;
    onkeymapclear: () => void;
  } = $props();

  const fieldLabels: Record<DetailField, string> = $derived({
    name: text("keyboard-details-panel.name"),
    brand: text("keyboard-details-panel.brand"),
    model: text("keyboard-details-panel.model"),
    version: text("keyboard-details-panel.version"),
    connectivity: text("keyboard-details-panel.connectivity"),
    rgbBacklighting: text("keyboard-details-panel.rgb-backlighting"),
    keyRollover: text("keyboard-details-panel.key-rollover"),
    programmableKeys: text("keyboard-details-panel.programmable-keys")
  });
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
      return { value: typeof userValue === 'boolean' ? (userValue ? text("keyboard-details-panel.yes") : text("keyboard-details-panel.no")) : userValue, source: text("keyboard-details-panel.you-provided-this") };
    }
    const catalog = catalogValue(field);
    if (catalog) {
      return { value: typeof catalog.value === 'boolean' ? (catalog.value ? text("keyboard-details-panel.yes") : text("keyboard-details-panel.no")) : catalog.value,
        source: text("keyboard-details-panel.catalog-verified"), citation: catalog.source };
    }
    return { value: text("keyboard-details-panel.unknown"), source: text("keyboard-details-panel.unknown") };
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
  <p class="eyebrow">{text("keyboard-details-panel.make-it-yours")}</p>
  <h2 id="keyboard-details-heading" tabindex="-1">{text("keyboard-details-panel.keyboard-details")}</h2>
  <p class="panel-copy">
    {text("keyboard-details-panel.find-a-layout-that-looks-like-your")}
  </p>

  <LayoutMatchPanel {connectedDevice} boardNames={[
    userDetails.name ?? '', userDetails.model ?? '',
    [userDetails.brand, userDetails.name].filter(Boolean).join(' '),
    [userDetails.brand, userDetails.model].filter(Boolean).join(' ')
  ]}
    confirmation={layoutConfirmation} {layoutNotice} onconfirm={onlayoutconfirm} onclear={onlayoutclear} />

  <KeymapImportPanel confirmation={layoutConfirmation} {keymapImport} onapply={onkeymapapply} onclear={onkeymapclear} />

  <details class="device-disclosure">
  <summary>{text("keyboard-details-panel.connected-keyboard")} <span>{connectedDevice?.productName || (connectedDevice ? text("keyboard-connection.unnamed-device") : text("keyboard-connection.no-device-selected"))}</span></summary>
  <fieldset class="browser-device">
    <legend>{text("keyboard-details-panel.browser-reported-device")}</legend>
    {#if connectedDevice}
      <div class="browser-device-card">
        <span class="device-source">{text("keyboard-details-panel.shared-by-your-browser")}</span>
        <dl class="browser-device-values">
          <div class="device-product"><dt>{text("keyboard-details-panel.product-name")}</dt><dd>{connectedDevice.productName || text("keyboard-details-panel.not-provided")}</dd></div>
          <div><dt>{text("keyboard-details-panel.vendor-id")}</dt><dd><code>{deviceId(connectedDevice.vendorId)}</code></dd></div>
          <div><dt>{text("keyboard-details-panel.product-id")}</dt><dd><code>{deviceId(connectedDevice.productId)}</code></dd></div>
          <div><dt>VID:PID (VPID)</dt><dd><code>{deviceId(connectedDevice.vendorId).slice(2)}:{deviceId(connectedDevice.productId).slice(2)}</code></dd></div>
        </dl>
        <p class="device-explanation">{text("keyboard-details-panel.device-ids-help-find-suggestions-but-do")}</p>
      </div>
      <p class="device-limitation"><strong>{text("keyboard-details-panel.reference-layout-only")}</strong> {text("keyboard-details-panel.your-browser-cannot-report-the-physical-layout")}</p>
    {:else}
      <div class="browser-device-card">
        <p class="device-empty-title">{text("keyboard-connection.no-device-selected")}</p>
        <p class="device-explanation">{text("keyboard-details-panel.use-connect-keyboard-above-if-available-you")}</p>
      </div>
    {/if}
  </fieldset>
  </details>

  <details class="details-disclosure">
  <summary>{text("keyboard-details-panel.device-details-reference-profile")} <span>{text("keyboard-details-panel.optional")}</span></summary>
  <p class="details-intro">{text("keyboard-details-panel.add-notes-or-choose-a-catalog-reference")}</p>
  <fieldset>
    <legend>{text("keyboard-details-panel.keyboard-profile")}</legend>
    <label for="keyboard-profile">{text("keyboard-details-panel.reference-profile")}</label>
    <select id="keyboard-profile" value={profileId ?? ''} onchange={(event) => {
      const value = event.currentTarget.value;
      onprofilechange(value || null);
    }}>
      <option value="">{text("keyboard-details-panel.no-profile-selected")}</option>
      {#each KEYBOARD_PROFILES as profile (profile.id)}
        <option value={profile.id}>{profile.displayName}</option>
      {/each}
    </select>
    {#if layoutConfirmation}
      <p class="profile-summary">{text("keyboard-details-panel.choosing-a-different-reference-profile-clears-your")}</p>
    {/if}
    {#if selectedProfile}
      <p class="profile-summary">
        <strong>{selectedProfile.displayName}</strong>
        {text("keyboard-details-panel.catalog-revision-reviewed", { p0: String(KEYBOARD_PROFILE_CATALOG_REVISION), p1: String(KEYBOARD_PROFILE_CATALOG_UPDATED_AT) })}
      </p>
      <details class="profile-provenance">
        <summary>{text("keyboard-details-panel.reference-sources")}</summary>
        {#if selectedProfile.testLayout}
          <p class="profile-summary">
            {text("keyboard-details-panel.test-map")} <strong>{selectedProfile.testLayout.label}</strong>
            <span class="source-label">{text("keyboard-details-panel.catalog-verified")}</span>
            {#if selectedProfile.testLayout.source.kind === 'internal'}
              <span class="source-reference">{text("keyboard-details-panel.source")} {selectedProfile.testLayout.source.label} ({selectedProfile.testLayout.source.path})</span>
            {:else}
              <a href={selectedProfile.testLayout.source.url} target="_blank" rel="noreferrer">
                {selectedProfile.testLayout.source.title}
              </a>
            {/if}
          </p>
        {/if}
      </details>
    {:else}
      <p class="profile-summary">{text("keyboard-details-panel.no-catalog-profile-is-selected-add-your")}</p>
    {/if}
  </fieldset>

  {#if !editing}
  <div class="specification-grid">
  <fieldset>
    <legend>{text("keyboard-details-panel.device-information")}</legend>
    {#each identityFields as field (field)}
      {@const resolved = resolvedValue(field)}
      <div class="detail-row">
        <span class="detail-name">{fieldLabels[field]}</span>
        <span class="detail-value">{resolved.value}</span>
        <span class="source-label">{resolved.source}</span>
        {#if resolved.citation?.kind === 'external'}
          <a href={resolved.citation.url} target="_blank" rel="noreferrer">{resolved.citation.title}</a>
        {:else if resolved.citation?.kind === 'internal'}
          <span class="source-reference">{text("keyboard-details-panel.source")} {resolved.citation.label} ({resolved.citation.path})</span>
        {/if}
      </div>
    {/each}
  </fieldset>

  <fieldset>
    <legend>{text("keyboard-details-panel.supported-features")}</legend>
    {#each featureFields as field (field)}
      {@const resolved = resolvedValue(field)}
      <div class="detail-row">
        <span class="detail-name">{fieldLabels[field]}</span>
        <span class="detail-value">{resolved.value}</span>
        <span class="source-label">{resolved.source}</span>
        {#if resolved.citation?.kind === 'external'}
          <a href={resolved.citation.url} target="_blank" rel="noreferrer">{resolved.citation.title}</a>
        {:else if resolved.citation?.kind === 'internal'}
          <span class="source-reference">{text("keyboard-details-panel.source")} {resolved.citation.label} ({resolved.citation.path})</span>
        {/if}
      </div>
    {/each}
  </fieldset>
  </div>
  {/if}

  <fieldset>
    <legend>{text("keyboard-details-panel.your-device-details")}</legend>
    <p>{text("keyboard-details-panel.your-notes-appear-instead-of-catalog-values")}</p>
    {#if editing}
      <div class="edit-grid">
      {#each KEYBOARD_DETAIL_TEXT_FIELDS as field (field)}
        <div>
        <label for={`keyboard-detail-${field}`}>{fieldLabels[field]}</label>
        <input
          id={`keyboard-detail-${field}`}
          name={field}
          type="text"
          autocomplete="off"
          maxlength={KEYBOARD_DETAIL_MAX_LENGTH}
          value={textValue(field)}
          oninput={(event) => updateText(field, event.currentTarget.value)}
        />
        </div>
      {/each}
      {#each KEYBOARD_DETAIL_BOOLEAN_FIELDS as field (field)}
        <div>
        <label for={`keyboard-detail-${field}`}>{fieldLabels[field]}</label>
        <select id={`keyboard-detail-${field}`} value={draft[field] === undefined ? '' : draft[field] ? 'yes' : 'no'}
          onchange={(event) => updateBoolean(field, event.currentTarget.value)}>
          <option value="">{text("keyboard-details-panel.no-personal-override")}</option>
          <option value="yes">{text("keyboard-details-panel.yes")}</option>
          <option value="no">{text("keyboard-details-panel.no")}</option>
        </select>
        </div>
      {/each}
      </div>
      <div class="panel-actions">
        <button class="primary-button" type="button" onclick={saveDetails}>{text("keyboard-details-panel.save-details")}</button>
        <button class="secondary-button" type="button" onclick={cancelEditing}>{text("confirmation-dialog.cancel")}</button>
      </div>
    {:else}
      <div class="panel-actions">
        <button bind:this={editButton} class="secondary-button" type="button" onclick={beginEditing}>{text("keyboard-details-panel.edit-device-details")}</button>
        <button class="secondary-button danger-button" type="button" disabled={Object.keys(userDetails).length === 0}
          onclick={() => { confirmingClear = true; }}>{text("keyboard-details-panel.clear-my-details")}</button>
      </div>
    {/if}
  </fieldset>
  </details>
</section>

{#if confirmingClear}
  <ConfirmationDialog
    title={text("keyboard-details-panel.clear-your-device-details")}
    message={text("keyboard-details-panel.this-removes-only-your-saved-personal-details")}
    confirmText={text("keyboard-details-panel.clear-my-details")}
    oncancel={() => { confirmingClear = false; }}
    onconfirm={clearDetails}
  />
{/if}

<style>
  summary { cursor: pointer; padding: 1rem 0; color: var(--color-text); font-weight: 550; overflow-wrap: anywhere; }
  summary span { color: #b8b8b8; font-size: 0.82rem; font-weight: 400; margin-left: 0.5rem; }
  summary:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
  .device-disclosure, .details-disclosure { border-top: 1px solid rgb(255 255 255 / 12%); }
  .profile-provenance summary { padding: 0.5rem 0; font-size: 0.82rem; }
  .specification-grid, .edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .edit-grid > div { min-width: 0; }
  .specification-grid fieldset { min-width: 0; }
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
  .detail-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: 0.45rem 1rem;
    padding-block: 0.8rem;
    border-bottom: 1px solid rgb(255 255 255 / 8%);
  }
  .detail-name { color: #b8b8b8; }
  .detail-value { overflow-wrap: anywhere; }
  .source-label { color: var(--color-accent); font-size: 0.82rem; }
  .detail-row > .source-label { grid-column: 2; }
  .source-reference { grid-column: 2 / -1; color: #b8b8b8; font-size: 0.78rem; overflow-wrap: anywhere; }
  .detail-row a { grid-column: 2 / -1; color: var(--color-accent); font-size: 0.82rem; overflow-wrap: anywhere; }
  @media (max-width: 600px) {
    .specification-grid, .edit-grid { grid-template-columns: minmax(0, 1fr); }
    .specification-grid { gap: 0; }
    .detail-row { grid-template-columns: minmax(0, 1fr); }
    .source-reference, .detail-row a, .detail-row > .source-label { grid-column: auto; }
  }
</style>
