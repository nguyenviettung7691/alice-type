<script lang="ts">
  import { onMount } from 'svelte';
  import { useLocalization } from '../i18n/context';
  const localization = useLocalization();
  const { text } = localization;

  let { title, message, confirmText, onconfirm, oncancel }: {
    title: string;
    message: string;
    confirmText: string;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();
  let dialog: HTMLDialogElement;
  const id = $props.id();

  onMount(() => {
    const previous = document.activeElement;
    dialog.showModal();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  });
</script>

<dialog bind:this={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onclose={oncancel}>
  <h2 id={`${id}-title`}>{title}</h2>
  <p id={`${id}-description`}>{message}</p>
  <div class="panel-actions">
    <button type="button" class="secondary-button" onclick={oncancel}>{text("confirmation-dialog.cancel")}</button>
    <button type="button" class="primary-button danger-button" onclick={onconfirm}>{confirmText}</button>
  </div>
</dialog>
