<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import AppFooter from './lib/components/AppFooter.svelte';
  import AppHeader from './lib/components/AppHeader.svelte';
  import PracticePanel from './lib/components/PracticePanel.svelte';
  import StatsPanel from './lib/components/StatsPanel.svelte';
  import KeyboardConnection from './lib/components/KeyboardConnection.svelte';
  import { applyLayoutLegends, type KeyboardDevice } from './lib/keyboard/keyboard-access';
  import KeyboardTestPanel from './lib/components/KeyboardTestPanel.svelte';
  import KeyboardDetailsPanel from './lib/components/KeyboardDetailsPanel.svelte';
  import {
    findKeyboardProfile, GENERIC_ALICE_TEST_LAYOUT, isTestLayoutEligible
  } from './lib/keyboard/keyboard-profiles';
  import {
    LayoutProfileLoadError, findCatalogEntry, isResolvedLayoutEligible, isValidVariant, loadLayoutProfile,
    resolveImportedLayout, type ResolvedKeyboardLayout
  } from './lib/keyboard/layout-catalog';
  import { type PracticeSettings } from './lib/typing/exercise-generator';
  import {
    DEFAULT_PREFERENCES, loadPreferences, savePreferences, PreferenceMigrationError, type Preferences
  } from './lib/storage/preferences';
  import { StorageError } from './lib/storage/errors';
  import { SessionHistory, type SessionRecord } from './lib/storage/session-history';
  import { TypingSound, TypingSoundError } from './lib/audio/typing-sound';
  import { provideLocalization } from './lib/i18n/context';
  import { getLanguage } from './lib/i18n/languages';

  function initialPreferences() {
    try {
      return { settings: loadPreferences(), error: '', operation: 'save' as const };
    } catch (error) {
      if (error instanceof PreferenceMigrationError) {
        return { settings: error.settings, error: error.message, operation: 'save' as const };
      }
      if (!(error instanceof StorageError)) throw error;
      return { settings: { ...DEFAULT_PREFERENCES }, error: error.message, operation: 'load' as const };
    }
  }

  function practicePreferences(value: PracticeSettings): PracticeSettings {
    return {
      mode: value.mode, durationSeconds: value.durationSeconds, wordLimit: value.wordLimit,
      wordBankTier: value.wordBankTier, punctuation: value.punctuation, numbers: value.numbers,
      language: value.language ?? 'en'
    };
  }

  const initial = initialPreferences();
  let preferences = $state<Preferences>(initial.settings);
  const i18n = provideLocalization(() => preferences.language);
  const { text } = i18n;
  $effect(() => {
    document.documentElement.lang = getLanguage(preferences.language).documentLanguage;
    document.title = text("app.alicetype-find-your-rhythm-on-an-alice");
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      text("app.browser-only-typing-practice-for-alice-keyboards"));
  });
  let settings = $state(practicePreferences(initial.settings));
  let running = $state(false);
  let contentReset = $state(0);
  let view = $state<'practice' | 'stats' | 'keyboard-test' | 'keyboard-details'>('practice');
  let preferenceError = $state(initial.error);
  let preferenceOperation = $state<'load' | 'save'>(initial.operation);
  let preserveStored = initial.operation === 'load';
  let onboarding = $state(!initial.settings.onboardingComplete);
  let connectedDevice = $state<KeyboardDevice | null>(null);
  let layoutLegends = $state<ReadonlyMap<string, string> | null>(null);
  let audioError = $state('');
  let revision = $state(0);
  let pending = $state<{ record: SessionRecord; saving: boolean; error: string }[]>([]);
  const activeTestLayout = $derived.by(() => {
    const profile = findKeyboardProfile(preferences.keyboardProfileId);
    return isTestLayoutEligible(profile) ? profile.testLayout : GENERIC_ALICE_TEST_LAYOUT;
  });
  const activeLayout = $derived(applyLayoutLegends(activeTestLayout.layout, layoutLegends));
  const confirmationKey = $derived(JSON.stringify(preferences.keyboardLayoutConfirmation));
  let resolvedLayout = $state.raw<ResolvedKeyboardLayout | null>(null);
  let layoutNotice = $state('');
  // The layout shared by Practice, Keyboard Test, and Stats; a running session is never changed in place.
  let appliedLayout = $state.raw<ResolvedKeyboardLayout | null>(null);
  const confirmedKeys = $derived(appliedLayout ? applyLayoutLegends(appliedLayout.keys, layoutLegends) : null);
  const confirmedSequence = $derived(appliedLayout ? applyLayoutLegends(appliedLayout.testSequence, layoutLegends) : null);
  const genericLabel = $derived(activeTestLayout.label.replace(/ test layout$/, ''));

  $effect(() => {
    const confirmation = JSON.parse(confirmationKey) as Preferences['keyboardLayoutConfirmation'];
    layoutNotice = '';
    if (!confirmation) {
      resolvedLayout = null;
      return;
    }
    const entry = findCatalogEntry(confirmation.profileId);
    if (!entry || !isValidVariant(entry, confirmation.variant)) {
      resolvedLayout = null;
      layoutNotice = 'Your confirmed layout is no longer available in this catalog version. The generic Alice layout is active; your saved confirmation is kept. Find and confirm your layout again in Keyboard Details.';
      return;
    }
    let cancelled = false;
    loadLayoutProfile(entry.id).then((profile) => {
      if (cancelled) return;
      const layout = resolveImportedLayout(entry, profile, confirmation.variant);
      if (isResolvedLayoutEligible(layout)) {
        resolvedLayout = layout;
      } else {
        resolvedLayout = null;
        layoutNotice = `The confirmed ${entry.displayName} layout is missing required keys (${layout.missingCodes.join(', ')}), so the generic Alice layout is active.`;
      }
    }).catch((error: unknown) => {
      if (!(error instanceof LayoutProfileLoadError)) throw error;
      if (cancelled) return;
      resolvedLayout = null;
      layoutNotice = `${error.message} The generic Alice layout is active. Reload the page to try again.`;
    });
    return () => { cancelled = true; };
  });

  $effect(() => {
    const next = resolvedLayout;
    if (!running) appliedLayout = next;
  });
  const history = new SessionHistory();
  const sound = new TypingSound();
  let alive = true;

  onDestroy(() => {
    alive = false;
    history.close();
    void sound.close().catch((error: unknown) => {
      console.error('Typing audio cleanup failed.', error);
    });
  });

  function persist() {
    preferenceOperation = 'save';
    try {
      savePreferences(preferences);
      preferenceError = '';
      preserveStored = false;
    } catch (error) {
      if (!(error instanceof StorageError)) throw error;
      preferenceError = error.message;
    }
  }

  function changePreferences(next: Preferences) {
    if (running) return;
    const practice = practicePreferences(next);
    if (JSON.stringify(practice) !== JSON.stringify(settings)) settings = practice;
    preferences = next;
    persist();
  }

  function retryPreferences() {
    if (preferenceOperation === 'save') {
      persist();
      return;
    }
    try {
      const loaded = loadPreferences();
      preferences = loaded;
      settings = practicePreferences(loaded);
      preserveStored = false;
      preferenceError = '';
      onboarding = !loaded.onboardingComplete;
    } catch (error) {
      if (!(error instanceof StorageError)) throw error;
      if (error instanceof PreferenceMigrationError) {
        preferences = error.settings;
        settings = practicePreferences(error.settings);
        preferenceOperation = 'save';
        preserveStored = false;
        onboarding = !error.settings.onboardingComplete;
      }
      preferenceError = error.message;
    }
  }

  async function navigate(next: typeof view) {
    if (running) return;
    view = next;
    await tick();
    if (!alive) return;
    document.getElementById(next === 'practice' ? 'practice-panel-heading' : `${next}-heading`)?.focus();
  }

  async function findLayout() {
    if (running) return;
    await navigate('keyboard-details');
    if (!alive) return;
    document.getElementById('layout-match-heading')?.focus();
  }

  async function saveSession(record: SessionRecord) {
    pending = pending.map((entry) => entry.record.id === record.id ? { ...entry, saving: true, error: '' } : entry);
    try {
      await history.save(record);
      if (!alive) return;
      pending = pending.filter((entry) => entry.record.id !== record.id);
      revision += 1;
    } catch (error) {
      if (!(error instanceof StorageError)) throw error;
      if (!alive) return;
      pending = pending.map((entry) => entry.record.id === record.id ? { ...entry, saving: false, error: error.message } : entry);
    }
  }

  function completed(record: SessionRecord) {
    if (pending.some((entry) => entry.record.id === record.id)) return;
    pending = [...pending, { record, saving: true, error: '' }];
    void saveSession(record);
  }

  function audioFailed(error: unknown) {
    if (!(error instanceof TypingSoundError)) throw error;
    if (!alive) return;
    preferences = { ...preferences, soundEnabled: false };
    audioError = error.message;
  }

  function playClick() {
    if (settings.mode !== 'zen' && preferences.soundEnabled) void sound.play().catch(audioFailed);
  }

  function updateSound(soundEnabled: boolean) {
    const enabling = soundEnabled && !preferences.soundEnabled;
    changePreferences({ ...preferences, soundEnabled });
    if (enabling) audioError = '';
  }

  function restoreDefaults() {
    contentReset += 1;
    changePreferences({ ...DEFAULT_PREFERENCES, onboardingComplete: preferences.onboardingComplete });
    audioError = '';
  }

  async function finishOnboarding(focusPractice: boolean) {
    onboarding = false;
    preferences = { ...preferences, onboardingComplete: true };
    if (!preserveStored) persist();
    if (focusPractice) {
      view = 'practice';
    }
    await tick();
    if (!alive) return;
    if (focusPractice) (document.getElementById('practice-input') ?? document.getElementById('custom-draft') ?? document.getElementById('practice-panel-heading'))?.focus();
    else document.querySelector<HTMLButtonElement>('.view-navigation button')?.focus();
  }
</script>

<div class="app-shell">
  <AppHeader disabled={running} {view} language={preferences.language} onviewchange={navigate}
    onlanguagechange={(language) => {
      if (running || language === preferences.language) return;
      changePreferences({ ...preferences, language });
    }} />

  <main class="main-content">
    <KeyboardConnection {onboarding} disabled={running} onfinish={finishOnboarding}
      ondevicechange={(device) => { connectedDevice = device; }}
      onlayoutchange={(legends) => { layoutLegends = legends; }}
      onfindlayout={() => { void findLayout(); }}
      confirmedLayoutLabel={appliedLayout?.label ?? null} />
    {#if layoutNotice}
      <div class="notice" role="alert">
        <p>{text("app.layout-unavailable", { p0: String(layoutNotice) })}</p>
        {#if view !== 'keyboard-details'}
          <button class="secondary-button" type="button" disabled={running} onclick={() => { void findLayout(); }}>{text("app.open-find-my-layout")}</button>
        {/if}
      </div>
    {/if}
    {#if preferenceError}
      <div class="notice" role="alert">
        <p>{preferenceOperation === 'load'
          ? text("app.current-selections-work-in-memory-saved-data", { p0: String(preferenceError) })
          : text("app.current-selections-work-in-memory-saved-data-2", { p0: String(preferenceError) })}</p>
        <button class="secondary-button" type="button" disabled={running} onclick={retryPreferences}>{text("app.retry-preferences")}</button>
        <button class="secondary-button" type="button" onclick={() => { preferenceError = ''; }}>{text("app.dismiss-preference-warning")}</button>
      </div>
    {/if}
    {#each pending as entry (entry.record.id)}
      {#if entry.error}
        <div class="notice" role="alert">
          <p>{text("app.completed-session-was-not-saved", { p0: String(entry.error) })}</p>
          <button class="secondary-button" type="button" disabled={entry.saving} onclick={() => saveSession(entry.record)}>{text("app.retry-session-save")}</button>
        </div>
      {/if}
    {/each}
    {#if audioError}
      <div class="notice" role="alert"><p>{text("app.sound-is-off-for-this-visit-turn", { p0: String(audioError) })}</p>
        <button class="secondary-button" type="button" onclick={() => { audioError = ''; }}>{text("app.dismiss-sound-warning")}</button>
      </div>
    {/if}
    <div hidden={view !== 'practice'}>
      <PracticePanel {settings} bind:running active={view === 'practice'} {contentReset}
        onsettingschange={(next) => changePreferences({ ...preferences, ...next })}
        layout={confirmedKeys ?? activeLayout} layoutLabel={appliedLayout?.label ?? genericLabel}
        inertKeys={appliedLayout?.inertKeys} viewBox={appliedLayout?.viewBox} layoutConfirmed={!!appliedLayout}
        browserLegends={layoutLegends !== null}
        caretStyle={preferences.caretStyle} showLiveStats={preferences.showLiveStats}
        soundEnabled={preferences.soundEnabled}
        oncaretchange={(caretStyle) => changePreferences({ ...preferences, caretStyle })}
        onlivestatschange={(showLiveStats) => changePreferences({ ...preferences, showLiveStats })}
        onsoundchange={updateSound} onreset={restoreDefaults}
        oncharacter={playClick} oncomplete={completed} />
    </div>
    {#if view === 'stats'}
      <StatsPanel {history} {revision} pending={pending.length > 0}
        layout={confirmedKeys ?? activeLayout} layoutLabel={appliedLayout?.label ?? genericLabel}
        inertKeys={appliedLayout?.inertKeys} viewBox={appliedLayout?.viewBox}
        layoutConfirmed={!!appliedLayout} browserLegends={layoutLegends !== null} />
    {:else if view === 'keyboard-test'}
      {#key appliedLayout}
        <KeyboardTestPanel
          soundEnabled={preferences.keyboardTestSoundEnabled}
          soundEffect={preferences.keyboardTestSoundEffect}
          testLayout={confirmedKeys ?? activeLayout}
          testSequence={confirmedSequence ?? activeLayout}
          inertKeys={appliedLayout?.inertKeys}
          viewBox={appliedLayout?.viewBox}
          confirmed={!!appliedLayout}
          browserLegends={layoutLegends !== null}
          testLayoutLabel={appliedLayout?.label ?? genericLabel}
          onsoundchange={(keyboardTestSoundEnabled, keyboardTestSoundEffect) =>
            changePreferences({ ...preferences, keyboardTestSoundEnabled, keyboardTestSoundEffect })}
          onaudiofailure={() => { preferences = { ...preferences, keyboardTestSoundEnabled: false }; }}
        />
      {/key}
    {:else if view === 'keyboard-details'}
      <KeyboardDetailsPanel
        {connectedDevice}
        profileId={preferences.keyboardProfileId}
        userDetails={preferences.keyboardUserDetails}
        layoutConfirmation={preferences.keyboardLayoutConfirmation}
        {layoutNotice}
        onprofilechange={(keyboardProfileId) => changePreferences({
          ...preferences,
          keyboardProfileId,
          keyboardLayoutConfirmation: preferences.keyboardLayoutConfirmation?.profileId === keyboardProfileId
            ? preferences.keyboardLayoutConfirmation : null
        })}
        onuserdetailschange={(keyboardUserDetails) => changePreferences({ ...preferences, keyboardUserDetails })}
        onlayoutconfirm={(keyboardLayoutConfirmation) => changePreferences({
          ...preferences, keyboardProfileId: keyboardLayoutConfirmation.profileId, keyboardLayoutConfirmation
        })}
        onlayoutclear={() => changePreferences({ ...preferences, keyboardLayoutConfirmation: null })}
      />
    {/if}
  </main>

  <AppFooter />
</div>
