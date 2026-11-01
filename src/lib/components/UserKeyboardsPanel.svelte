<script lang="ts">
  import { tick } from 'svelte';
  import { useLocalization } from '../i18n/context';
  import { formatNumber } from '../i18n/format';
  import {
    DEFAULT_HARDWARE, KEYBOARD_FAMILIES, KEYBOARD_NAME_LENGTH, MAX_USER_KEYBOARDS, SWITCH_TYPES, THUMB_ROLES,
    validateKeyboardIdentity, type ThumbRole, type UserKeyboard
  } from '../keyboard/user-keyboards';
  import { StorageError } from '../storage/errors';
  import ConfirmationDialog from './ConfirmationDialog.svelte';

  let { board, count, oncreate, onedit, ondelete }: {
    board: UserKeyboard;
    count: number;
    oncreate: (name: string, duplicate: boolean) => void;
    onedit: (board: UserKeyboard) => void;
    ondelete: () => void;
  } = $props();
  const i18n = useLocalization();
  const { text } = i18n;
  const measurement = (value: number | null) => value === null ? text('boards.role-unknown')
    : formatNumber(i18n.language, value, Number.isInteger(value) ? 0 : 1);
  let operation = $state<'new' | 'duplicate' | 'edit' | null>(null);
  let name = $state('');
  let hardware = $state({ ...DEFAULT_HARDWARE });
  let thumbs = $state<{ left: ThumbRole; right: ThumbRole }>({ left: 'unknown', right: 'unknown' });
  let force = $state<number | undefined>();
  let tenting = $state<number | undefined>();
  let error = $state('');
  let confirming = $state(false);

  async function begin(next: NonNullable<typeof operation>) {
    operation = next;
    name = next === 'new' ? '' : board.name;
    hardware = { ...board.hardware };
    thumbs = { ...board.thumbs };
    force = board.hardware.actuationForce ?? undefined;
    tenting = board.hardware.tentingAngle ?? undefined;
    error = '';
    await tick();
    document.getElementById('board-name')?.focus();
  }

  async function finish() {
    operation = null;
    await tick();
    document.getElementById('user-keyboards-heading')?.focus();
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    try {
      const identity = validateKeyboardIdentity({
        ...board, name, hardware: { ...hardware, actuationForce: force ?? null, tentingAngle: tenting ?? null }, thumbs
      });
      if (operation === 'edit') onedit({ ...board, ...identity });
      else oncreate(identity.name, operation === 'duplicate');
      void finish();
    } catch (failure) {
      if (!(failure instanceof StorageError)) throw failure;
      error = failure.message;
    }
  }
</script>

<section class="practice-panel settings-panel" aria-labelledby="user-keyboards-heading">
  <h2 id="user-keyboards-heading" tabindex="-1">{text('boards.heading')}</h2>
  <p class="panel-copy">{text('boards.description')}</p>
  <p><strong>{board.name}</strong></p>
  {#if operation}
    <form onsubmit={save}>
      <label>{text('boards.name')}
        <input id="board-name" type="text" bind:value={name} required maxlength={KEYBOARD_NAME_LENGTH} />
      </label>
      {#if operation === 'edit'}
        <div class="board-fields">
          <label>{text('boards.family')}
            <select bind:value={hardware.family} aria-label={text('boards.family')}>
              {#each KEYBOARD_FAMILIES as family}<option value={family}>{text(`boards.family-${family}`)}</option>{/each}
            </select>
          </label>
          <label>{text('boards.switch')}
            <select bind:value={hardware.switchType} aria-label={text('boards.switch')}>
              {#each SWITCH_TYPES as type}<option value={type}>{text(`boards.switch-${type}`)}</option>{/each}
            </select>
          </label>
          <label>{text('boards.force')}
            <input type="number" min="1" max="200" step="0.1" bind:value={force} />
          </label>
          <label>{text('boards.keycaps')}
            <input type="text" maxlength="40" list="keycap-profiles" bind:value={hardware.keycapProfile} />
          </label>
          <datalist id="keycap-profiles"><option>Cherry</option><option>KAT</option><option>MT3</option><option>SA</option></datalist>
          <label>{text('boards.tenting')}
            <input type="number" min="0" max="90" step="0.1" bind:value={tenting} />
          </label>
          <label>{text('boards.left')}
            <select bind:value={thumbs.left} aria-label={text('boards.left')}>
              {#each THUMB_ROLES as role}<option value={role}>{text(`boards.role-${role}`)}</option>{/each}
            </select>
          </label>
          <label>{text('boards.right')}
            <select bind:value={thumbs.right} aria-label={text('boards.right')}>
              {#each THUMB_ROLES as role}<option value={role}>{text(`boards.role-${role}`)}</option>{/each}
            </select>
          </label>
        </div>
        <p class="panel-copy" id="board-metadata-help">{text('boards.metadata-help')}</p>
      {/if}
      {#if error}<p class="notice" role="alert">{text('boards.error', { detail: error })}</p>{/if}
      <div class="panel-actions">
        <button class="primary-button" type="submit">{text('boards.save')}</button>
        <button class="secondary-button" type="button" onclick={finish}>{text('confirmation-dialog.cancel')}</button>
      </div>
    </form>
  {:else}
    <dl class="board-summary">
      <div><dt>{text('boards.family')}</dt><dd>{text(`boards.family-${board.hardware.family}`)}</dd></div>
      <div><dt>{text('boards.switch')}</dt><dd>{text(`boards.switch-${board.hardware.switchType}`)}</dd></div>
      <div><dt>{text('boards.force')}</dt><dd>{measurement(board.hardware.actuationForce)}</dd></div>
      <div><dt>{text('boards.keycaps')}</dt><dd>{board.hardware.keycapProfile || text('boards.role-unknown')}</dd></div>
      <div><dt>{text('boards.tenting')}</dt><dd>{measurement(board.hardware.tentingAngle)}</dd></div>
      <div><dt>{text('boards.left')}</dt><dd>{text(`boards.role-${board.thumbs.left}`)}</dd></div>
      <div><dt>{text('boards.right')}</dt><dd>{text(`boards.role-${board.thumbs.right}`)}</dd></div>
    </dl>
    <p class="panel-copy">{text('boards.metadata-help')}</p>
    <div class="panel-actions">
      <button class="secondary-button" type="button" onclick={() => begin('new')} disabled={count >= MAX_USER_KEYBOARDS}>{text('boards.add')}</button>
      <button class="secondary-button" type="button" onclick={() => begin('duplicate')} disabled={count >= MAX_USER_KEYBOARDS}>{text('boards.duplicate')}</button>
      <button class="secondary-button" type="button" onclick={() => begin('edit')}>{text('boards.edit')}</button>
      <button class="secondary-button danger-button" type="button" onclick={() => { confirming = true; }} disabled={count === 1}>{text('boards.delete')}</button>
    </div>
    <p class="panel-copy">{text('boards.collection-limit', { count: MAX_USER_KEYBOARDS })}</p>
  {/if}
</section>

{#if confirming}
  <ConfirmationDialog title={text('boards.delete')} message={text('boards.delete-help', { name: board.name })}
    confirmText={text('boards.delete')} oncancel={() => { confirming = false; }}
    onconfirm={() => { confirming = false; ondelete(); void finish(); }} />
{/if}

<style>
  form > label, .board-fields label { display: grid; gap: 0.5rem; min-width: 0; }
  input { width: 100%; min-height: 40px; padding: 0.5rem 0.75rem; background: #242424; color: #eee; border: 1px solid #777; border-radius: 0.4rem; }
  input:focus-visible { outline: 2px solid #ff5d00; outline-offset: 3px; }
  .board-fields, .board-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-top: 1rem; }
  .board-summary dt { color: #b8b8b8; font-size: 0.85rem; }
  .board-summary dd { margin: 0.4rem 0 0; overflow-wrap: anywhere; }
</style>
