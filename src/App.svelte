<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import AppFooter from './lib/components/AppFooter.svelte';
  import AppHeader from './lib/components/AppHeader.svelte';
  import PracticePanel from './lib/components/PracticePanel.svelte';
  import SettingsPanel from './lib/components/SettingsPanel.svelte';
  import StatsPanel from './lib/components/StatsPanel.svelte';
  import KeyboardOnboarding from './lib/components/KeyboardOnboarding.svelte';
  import KeyboardTestPanel from './lib/components/KeyboardTestPanel.svelte';
  import { type PracticeSettings } from './lib/typing/exercise-generator';
  import {
    DEFAULT_PREFERENCES, loadPreferences, savePreferences, PreferenceMigrationError, type Preferences
  } from './lib/storage/preferences';
  import { StorageError } from './lib/storage/errors';
  import { SessionHistory, type SessionRecord } from './lib/storage/session-history';
  import { TypingSound, TypingSoundError } from './lib/audio/typing-sound';

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
      wordBankTier: value.wordBankTier, punctuation: value.punctuation, numbers: value.numbers
    };
  }

  const initial = initialPreferences();
  let preferences = $state<Preferences>(initial.settings);
  let settings = $state(practicePreferences(initial.settings));
  let running = $state(false);
  let view = $state<'practice' | 'settings' | 'stats' | 'keyboard-test'>('practice');
  let preferenceError = $state(initial.error);
  let preferenceOperation = $state<'load' | 'save'>(initial.operation);
  let preserveStored = initial.operation === 'load';
  let onboarding = $state(!initial.settings.onboardingComplete);
  let layoutMessage = $state('');
  let audioError = $state('');
  let revision = $state(0);
  let pending = $state<{ record: SessionRecord; saving: boolean; error: string }[]>([]);
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
    if (preferences.soundEnabled) void sound.play().catch(audioFailed);
  }

  function updateSettings(next: Preferences) {
    const enabling = next.soundEnabled && !preferences.soundEnabled;
    changePreferences(next);
    if (enabling) audioError = '';
  }

  async function requestLayout() {
    try {
      const keyboardNavigator = navigator as Navigator & {
        keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> };
      };
      if (keyboardNavigator.keyboard?.getLayoutMap) {
        const map = await keyboardNavigator.keyboard.getLayoutMap();
        if (!alive) return;
        const labels = ['KeyQ', 'KeyA', 'KeyY', 'KeyZ'].map((code) => `${code}: ${map.get(code) ?? 'unknown'}`);
        layoutMessage = `Browser layout sample (${labels.join(', ')}). The diagram retains generic US ANSI legends; this does not identify hardware.`;
      } else {
        layoutMessage = 'Optional layout access is not supported here. Practice uses generic US ANSI legends.';
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (alive) layoutMessage = `Optional layout access was unavailable: ${error.message}. Practice uses generic US ANSI legends.`;
    }
  }

  async function finishOnboarding(useLayout: boolean) {
    onboarding = false;
    preferences = { ...preferences, onboardingComplete: true };
    if (!preserveStored) persist();
    if (useLayout) {
      view = 'practice';
      void requestLayout();
    }
    await tick();
    if (!alive) return;
    if (useLayout) document.getElementById('practice-input')?.focus();
    else document.querySelector<HTMLButtonElement>('.view-navigation button')?.focus();
  }
</script>

<div class="app-shell">
  <AppHeader mode={settings.mode} disabled={running} {view} onviewchange={navigate} onmodechange={(mode) => {
    changePreferences({ ...preferences, mode });
    if (view !== 'practice') void navigate('practice');
  }} />

  <main class="main-content">
    {#if preferenceError}
      <div class="notice" role="alert">
        <p>{preferenceError} Current selections work in memory; saved data has not been replaced.</p>
        <button class="secondary-button" type="button" disabled={running} onclick={retryPreferences}>Retry preferences</button>
        <button class="secondary-button" type="button" onclick={() => { preferenceError = ''; }}>Dismiss preference warning</button>
      </div>
    {/if}
    {#each pending as entry (entry.record.id)}
      {#if entry.error}
        <div class="notice" role="alert">
          <p>Completed session was not saved. {entry.error}</p>
          <button class="secondary-button" type="button" disabled={entry.saving} onclick={() => saveSession(entry.record)}>Retry session save</button>
        </div>
      {/if}
    {/each}
    {#if audioError}
      <div class="notice" role="alert"><p>{audioError} Sound is off for this visit. Enable it in Settings to retry.</p>
        <button class="secondary-button" type="button" onclick={() => { audioError = ''; }}>Dismiss sound warning</button>
      </div>
    {/if}
    {#if layoutMessage}<p class="panel-copy layout-message" role="status">{layoutMessage}
      <button class="secondary-button" type="button" onclick={() => { layoutMessage = ''; }}>Dismiss layout note</button>
    </p>{/if}
    <div hidden={view !== 'practice'}>
      <div class="intro">
        <p class="eyebrow"><span class="eyebrow-dot"></span>A quieter kind of practice</p>
        <h2>Find your rhythm.</h2>
        <p class="intro-copy">A little focus goes a long way. Settle in and let the words flow.</p>
      </div>

      <PracticePanel {settings} bind:running onsettingschange={(next) => changePreferences({ ...preferences, ...next })}
        caretStyle={preferences.caretStyle} showLiveStats={preferences.showLiveStats}
        oncharacter={playClick} oncomplete={completed} />
    </div>
    {#if view === 'settings'}
      <SettingsPanel settings={preferences} onchange={updateSettings} onpractice={() => navigate('practice')} onreset={() => {
        changePreferences({ ...DEFAULT_PREFERENCES, onboardingComplete: preferences.onboardingComplete });
      }} />
    {:else if view === 'stats'}
      <StatsPanel {history} {revision} pending={pending.length > 0} />
    {:else if view === 'keyboard-test'}
      <KeyboardTestPanel
        soundEnabled={preferences.keyboardTestSoundEnabled}
        soundEffect={preferences.keyboardTestSoundEffect}
        onsoundchange={(keyboardTestSoundEnabled, keyboardTestSoundEffect) =>
          changePreferences({ ...preferences, keyboardTestSoundEnabled, keyboardTestSoundEffect })}
        onaudiofailure={() => { preferences = { ...preferences, keyboardTestSoundEnabled: false }; }}
      />
    {/if}
  </main>

  <AppFooter />
</div>

{#if onboarding}<KeyboardOnboarding onfinish={finishOnboarding} />{/if}
