<script lang="ts">
  import AppHeader from '../../src/lib/components/AppHeader.svelte';
  import type { LanguageId } from '../../src/lib/i18n/languages';

  let language = $state<LanguageId>('en');
  let disabled = $state(false);
  let view = $state<'practice' | 'stats' | 'keyboard-test' | 'keyboard-details'>('practice');
</script>

<AppHeader {language} {disabled} {view} onviewchange={(next) => { view = next; }} />
<button type="button" onclick={() => { language = 'en'; }}>English fixture</button>
<button type="button" onclick={() => { language = 'vi'; }}>Vietnamese fixture</button>
<button type="button" onclick={() => { disabled = !disabled; }}>Toggle fixture lock</button>
<output data-testid="fixture-view">{view}</output>
