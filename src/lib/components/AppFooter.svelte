<script lang="ts">
  import vocabularyNotice from '../typing/word-banks/NOTICE.txt?url&no-inline';
  import quoteNotice from '../typing/QUOTE-NOTICE.txt?url&no-inline';
  import vocabularyLicense from '../typing/word-banks/LICENSE-CC-BY-SA-4.0.txt?url&no-inline';
  import appLicense from '../../../LICENSE?url&no-inline';
  import layoutNotice from '../keyboard/layout-data/NOTICE.txt?url&no-inline';
  import layoutLicense from '../keyboard/layout-data/LICENSE-GPL-3.0.txt?url&no-inline';
</script>

<footer class="app-footer">
  <span class="footer-brand">Created by Nguyen Viet Tung <span aria-hidden="true">·</span> &copy; 2026 <span aria-hidden="true">·</span> <a href={appLicense}>MIT License</a></span>
  <a class="github-link" href="https://github.com/nguyenviettung7691/alice-type" target="_blank" rel="noopener noreferrer" aria-label="AliceType on GitHub" title="AliceType on GitHub">
    <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
  </a>
  <span class="data-notices">
    <a href={vocabularyNotice}>Vocabulary attribution</a>
    <a href={quoteNotice}>Quote attribution</a>
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

  .github-link {
    display: inline-flex;
    margin-inline: auto 0;
    color: #b8b8b8;
  }

  .github-link:hover,
  .github-link:focus-visible {
    color: #ff5d00;
  }
</style>
