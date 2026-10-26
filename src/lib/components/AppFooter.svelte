<script lang="ts">
  import vocabularyNotice from '../typing/word-banks/NOTICE.txt?url&no-inline';
  import vocabularyLicense from '../typing/word-banks/LICENSE-CC-BY-SA-4.0.txt?url&no-inline';
  import appLicense from '../../../LICENSE?url&no-inline';
  import layoutNotice from '../keyboard/layout-data/NOTICE.txt?url&no-inline';
  import layoutLicense from '../keyboard/layout-data/LICENSE-GPL-3.0.txt?url&no-inline';
</script>

<footer class="app-footer">
  <span class="footer-brand">Created by Nguyen Viet Tung <span aria-hidden="true">·</span> &copy; 2026 <span aria-hidden="true">·</span> <a href={appLicense}>MIT License</a></span>
  <span>AliceType <span aria-hidden="true">·</span> Timed &amp; Words practice</span>
  <span class="data-notices">
    <a href={vocabularyNotice}>Vocabulary attribution</a>
    <a href={vocabularyLicense}>CC BY-SA 4.0 data</a>
    <a href={layoutNotice}>Keyboard layout attribution</a>
    <a href={layoutLicense}>GPL-3.0 layout data</a>
  </span>
</footer>

<style>
  .data-notices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }

  a {
    color: inherit;
    text-underline-offset: 0.2em;
  }
</style>
