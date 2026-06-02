// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 2 of the License, or (at your
// option) any later version. See the LICENSE file at the root of this
// repository for the full text, or https://www.gnu.org/licenses/.
//
// Zeus is an independent reimplementation in .NET — not a fork. Its
// Protocol-1 / Protocol-2 framing, WDSP integration, meter pipelines, and
// TX behaviour were informed by studying the Thetis project
// (https://github.com/ramdor/Thetis), the authoritative reference
// implementation in the OpenHPSDR ecosystem. Zeus gratefully acknowledges
// the Thetis contributors whose work made this possible:
//
//   Richard Samphire (MW0LGE), Warren Pratt (NR0V),
//   Laurence Barker (G8NJJ),   Rick Koch (N1GP),
//   Bryan Rambo (W4WMT),       Chris Codella (W2PA),
//   Doug Wigley (W5WC),        FlexRadio Systems,
//   Richard Allen (W5SD),      Joe Torrey (WD5Y),
//   Andrew Mansfield (M0YGG),  Reid Campbell (MI0BOT),
//   Sigi Jetzlsperger (DH1KLM).
//
// Thetis itself continues the GPL-governed lineage of FlexRadio PowerSDR
// and the OpenHPSDR (TAPR/OpenHPSDR) ecosystem; that lineage is preserved
// here. See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.
//
// Protocol-2 / PureSignal / Saturn-class behaviour was additionally informed
// by pihpsdr (https://github.com/dl1ycf/pihpsdr), maintained by Christoph
// Wüllen (DL1YCF); and by DeskHPSDR
// (https://github.com/dl1bz/deskhpsdr), maintained by Heiko (DL1BZ).
// Both are GPL-2.0-or-later.
//
// WDSP — loaded by Zeus via P/Invoke — is Copyright (C) Warren Pratt
// (NR0V), distributed under GPL v2 or later.
//
// Zeus is distributed WITHOUT ANY WARRANTY; see the GNU General Public
// License for details.

import { useEffect, useMemo, useRef } from 'react';
import { WorkspaceContext } from './layout/WorkspaceContext';
import { FlexWorkspace } from './layout/FlexWorkspace';
import { AfGainSlider } from './components/AfGainSlider';
import { AgcSlider } from './components/AgcSlider';
import { AlertBanner } from './components/AlertBanner';
import { AudioSuiteWindow } from './components/AudioSuiteWindow';
import { AttenuatorSlider } from './components/AttenuatorSlider';
import { AudioToggle } from './components/AudioToggle';
import { BandFavorites } from './components/toolbar/BandFavorites';
import { ConnectPanel } from './components/ConnectPanel';
import { FilterPanel } from './components/filter/FilterPanel';
import { LeftLayoutBar } from './components/LeftLayoutBar';
import { MicMeter } from './components/MicMeter';
import { ModeFavorites } from './components/toolbar/ModeFavorites';
import { MoxButton } from './components/MoxButton';
import { PreampButton } from './components/PreampButton';
import { PsToggleButton } from './components/PsToggleButton';
import { PaTempChip } from './components/PaTempChip';
import { QrzStatusPill } from './components/QrzStatusPill';
import { RotatorStatusPill } from './components/RotatorStatusPill';
import { SettingsView, type SettingsTabId } from './components/SettingsMenu';
import { ThemeApplier } from './components/ThemeApplier';
import { StepFavorites } from './components/toolbar/StepFavorites';
import { TunButton } from './components/TunButton';
import { BOARD_LABELS } from './api/radio';
import { useFilterRibbonOpenSync } from './components/filter/FilterRibbon';
import { useSwUpdatePrompt } from './pwa/useSwUpdatePrompt';
import { startRealtime } from './realtime/ws-client';
import { setAudioHostMode } from './audio/host-mode';
import { useMicUplink } from './audio/use-mic-uplink';
import { useConnectionStore } from './state/connection-store';
import { useRadioStore } from './state/radio-store';

import { useLayoutStore } from './state/layout-store';
import { useCapabilitiesStore } from './state/capabilities-store';
import { useKeyboardShortcuts } from './util/use-keyboard-shortcuts';
import { useStatePoll } from './util/use-state-poll';
import { useAudioResets } from './util/use-audio-resets';
import { useThemeInit } from './util/use-theme-init';
import { useDeepLink } from './util/use-deep-link';
import { useCapacitorFirstRun } from './util/use-capacitor-first-run';
import { useSwUpdate } from './util/use-sw-update';
import { useQrzPanel } from './util/use-qrz-panel';
import { SpectrumWheelActionsContext, type SpectrumWheelActions } from './util/use-pan-tune-gesture';
import { BandPlanProvider } from './context/BandPlanContext';
import { UpdatePrompt } from './service-worker/UpdatePrompt';
import { MobileApp, useIsMobileViewport } from './mobile/MobileApp';
import type L from 'leaflet';

export default function App() {
  useSwUpdatePrompt();
  const settingsViewOpen = useLayoutStore((s) => s.settingsViewOpen);
  const settingsInitialTab = useLayoutStore((s) => s.settingsInitialTab);
  const setSettingsView = useLayoutStore((s) => s.setSettingsView);
  const showTopbar = useLayoutStore((s) => s.showTopbar);
  const visibleToolbarControls = useLayoutStore((s) => s.visibleToolbarControls);
  const { updateAvailable, installUpdate } = useSwUpdate();
  const status = useConnectionStore((s) => s.status);
  const preampOn = useConnectionStore((s) => s.preampOn);
  const endpoint = useConnectionStore((s) => s.endpoint);
  const connected = status === 'Connected';
  // Brand sub label reflects what discovery actually saw on the wire
  // (selection.connected), not the operator's preferred override — showing
  // "ANAN G2" when an HL2 is plugged in would just confuse anyone reading
  // the bottom status bar to confirm what they're talking to. The bar
  // itself reads radio-store; we still trigger a reload here whenever the
  // connection flips so the label is fresh after Connect.
  const radioConnected = useRadioStore((s) => s.selection.connected);
  const radioLoad = useRadioStore((s) => s.load);
  // Reload on mount AND every time the wire connection flips to Connected.
  // Clicking Connect on a discovered radio doesn't refresh radio-store on
  // its own (only the manual-connect path does).
  useEffect(() => { radioLoad(); }, [radioLoad, connected]);
  const brandSub = radioConnected !== 'Unknown'
    ? BOARD_LABELS[radioConnected]
    : 'Not Connected';

  // Per-radio layouts (issue #241): the layout-store is keyed on the active
  // BoardKind. "default" is the sentinel for "no radio yet" — discovery
  // landing flips this to e.g. "HermesLite2" / "AnanG2" and the store
  // re-fetches that radio's named-layout collection from the server.
  const loadLayoutsForRadio = useLayoutStore((s) => s.loadForRadio);
  useEffect(() => {
    const key = radioConnected !== 'Unknown' ? radioConnected : 'default';
    void loadLayoutsForRadio(key);
  }, [loadLayoutsForRadio, radioConnected]);
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);

  useKeyboardShortcuts();
  useMicUplink();
  useFilterRibbonOpenSync();
  useStatePoll();
  useAudioResets();
  useThemeInit();
  useDeepLink();
  useCapacitorFirstRun();

  useEffect(() => {
    const stop = startRealtime();
    return () => {
      stop();
    };
  }, []);

  // Fetch host capabilities once on mount. The backend snapshot is built
  // at startup and doesn't change at runtime, so a single fetch is enough;
  // failures fall back to "no features available" which hides feature-gated
  // UI rather than rendering broken controls.
  useEffect(() => {
    void useCapabilitiesStore.getState().refresh();
    // Mirror the resolved host mode into the audio-host-mode flag so the
    // non-React consumers (audio-client, ws-client, mic-uplink) can opt
    // out of browser audio paths in desktop mode without each needing its
    // own Zustand subscription on the hot path.
    return useCapabilitiesStore.subscribe((state) => {
      const host = state.capabilities?.host;
      if (host) setAudioHostMode(host === 'desktop' ? 'native' : 'browser');
    });
  }, []);

  const qrz = useQrzPanel();

  // Handle on the Leaflet map so spectrum wheel bindings (alt / alt+shift +
  // wheel) can drive pan/zoom imperatively. Null until LeafletWorldMap mounts.
  const mapApiRef = useRef<L.Map | null>(null);
  const spectrumWheelActions = useMemo<SpectrumWheelActions>(() => ({
    onMapPan: (dx, dy) => {
      mapApiRef.current?.panBy([dx, dy], { animate: false });
    },
    onMapZoom: (delta) => {
      const m = mapApiRef.current;
      if (!m || delta === 0) return;
      m.setZoom(m.getZoom() + delta, { animate: false });
    },
  }), []);

  // When no radio is connected, dim the workspace and centre the full
  // ConnectPanel on top so the eye lands on it. The backdrop is
  // pointer-events:none so the topbar stays interactive (QRZ sign-in,
  // Tweaks, etc.); the ConnectPanel itself re-enables pointer events so
  // Discover / Connect buttons still click through.
  const disconnectedOverlay = useMemo(() => {
    if (connected) return null;
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <ConnectPanel />
        </div>
      </div>
    );
  }, [connected]);

  // Mobile viewport (≤900px) reactively tracked. Also honours `?mobile=1` so
  // the mobile shell can be previewed on a desktop browser without resizing.
  // The matchMedia listener is mounted in a layout effect so we don't paint
  // a stale variant after a window resize / device-rotate.
  const isMobile = useIsMobileViewport();

  // Bundle workspace state into a context so panel components can consume it
  // without prop-drilling through the FlexWorkspace factory.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const workspaceCtx = useMemo(() => ({ ...qrz }), [
    qrz.callsign, qrz.terminatorActive, qrz.imageMode, qrz.bgActive,
    qrz.panBackground, qrz.backgroundImage, qrz.backgroundImageFit,
    qrz.enriching, qrz.lookupKey, qrz.contact,
    qrz.qrzLookupError, qrz.qrzActive, qrz.mapAvailable, qrz.mapInteractive,
    qrz.effectiveHome, qrz.beamOverrideDeg, qrz.beamInputStr,
    qrz.rotLiveAz, qrz.sp, qrz.lp, qrz.dist,
    // heroTitle and logbookActions are ReactNodes; primitive deps above cover them
    qrz.dspActive, qrz.logbookTitle,
    qrz.handleLogQso, qrz.handleClearQrz, qrz.runQrzLookup,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  // Mobile viewport short-circuit. All initialization hooks above (realtime,
  // state poll, keyboard, mic uplink, service worker) have already run, so
  // the mobile shell inherits the same live data feeds and the same store
  // state — it just renders a different UI tree. SpectrumWheelActions is
  // still required because Panadapter depends on the gesture context.
  if (isMobile) {
    return (
      <WorkspaceContext.Provider value={workspaceCtx}>
        <SpectrumWheelActionsContext.Provider value={spectrumWheelActions}>
          <ThemeApplier />
          <MobileApp />
        </SpectrumWheelActionsContext.Provider>
      </WorkspaceContext.Provider>
    );
  }

  return (
    <BandPlanProvider>
    <WorkspaceContext.Provider value={workspaceCtx}>
    <SpectrumWheelActionsContext.Provider value={spectrumWheelActions}>
    <ThemeApplier />
    <div
      className="app"
      data-screen-label="01 Main Console"
      style={{
        position: 'relative',
        gridTemplateRows: showTopbar ? 'minmax(60px, auto) 1fr 38px' : '0px 1fr 38px',
      }}
    >
      {/* Left layout bar — issue #241. Spans the full app height; lists named
          layouts for the active radio with switch/add/delete/reset actions. */}
      <LeftLayoutBar />

      {/* Top bar — brand on the left, transport-level inline controls
          (mode/filter/band/step/front-end/AGC/AF) in the middle, status
          pills + settings on the right. These controls stay always-visible
          across default layouts so they're reachable mid-QSO without hunting
          through the workspace (see feedback memory: top bar keeps inline
          controls). The bar sits above the disconnected overlay so QRZ
          sign-in stays usable before a radio is connected. */}
      {showTopbar && (
        <header className="topbar" style={{ position: 'relative', zIndex: 300 }}>
          <div className="brand">
            <div className="brand-mark">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                <circle cx="12" cy="12" r="3" fill="var(--accent)" />
                <circle cx="12" cy="12" r="7" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
                <circle cx="12" cy="12" r="11" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.25" />
              </svg>
            </div>
            <div className="brand-text">
              <div className="brand-name mono">OpenHpsdr Zeus</div>
              <div className="brand-sub label-xs hide-mobile">{brandSub}</div>
            </div>
          </div>

          <span className="topbar-divider hide-mobile" aria-hidden />

          <div className="topbar-controls hide-mobile">
            {visibleToolbarControls.includes('mode') && <ModeFavorites />}
            {visibleToolbarControls.includes('mode') && visibleToolbarControls.includes('filter') && <span className="strip-divider" aria-hidden />}
            {visibleToolbarControls.includes('filter') && <FilterPanel />}
            {visibleToolbarControls.includes('filter') && visibleToolbarControls.includes('band') && <span className="strip-divider" aria-hidden />}
            {visibleToolbarControls.includes('band') && <BandFavorites />}
            {visibleToolbarControls.includes('band') && visibleToolbarControls.includes('step') && <span className="strip-divider" aria-hidden />}
            {visibleToolbarControls.includes('step') && <StepFavorites />}
            {visibleToolbarControls.includes('step') && visibleToolbarControls.includes('frontend') && <span className="strip-divider" aria-hidden />}
            {visibleToolbarControls.includes('frontend') && (
              <div className="ctrl-group">
                <div className="label-xs ctrl-lbl">FRONT-END</div>
                <div className="btn-row" style={{ gap: 6, alignItems: 'center' }}>
                  <PreampButton />
                  <AttenuatorSlider />
                </div>
              </div>
            )}
            {visibleToolbarControls.includes('frontend') && visibleToolbarControls.includes('agc') && <span className="strip-divider" aria-hidden />}
            {visibleToolbarControls.includes('agc') && (
              <div className="ctrl-group">
                <div className="label-xs ctrl-lbl">AGC</div>
                <AgcSlider />
              </div>
            )}
            {visibleToolbarControls.includes('agc') && visibleToolbarControls.includes('af') && <span className="strip-divider" aria-hidden />}
            {visibleToolbarControls.includes('af') && (
              <div className="ctrl-group">
                <div className="label-xs ctrl-lbl">AF</div>
                <AfGainSlider />
              </div>
            )}
          </div>

          <div className="spacer" style={{ flex: 1 }} />

          {/* Settings is reached from the LeftLayoutBar (bottom slot). The
              top bar is now reserved for Disconnect when connected; while
              disconnected the centre overlay owns Discover so we mount only
              one ConnectPanel at a time. */}
          {connected && <ConnectPanel compact />}
        </header>
      )}

      {/* Workspace area — alert banner + active layout (or settings view).
          Wrapped together so the grid only needs one row for both, which
          keeps the gap between the topbar and the first panel a single
          6px unit instead of stacking two grid gaps around an empty
          alert row. */}
      <div className="workspace-area">
        <AlertBanner />
        {settingsViewOpen ? (
          <SettingsView
            initialTab={settingsInitialTab as SettingsTabId | undefined}
            onClose={() => setSettingsView(false)}
          />
        ) : (
          <FlexWorkspace key={activeLayoutId} />
        )}
      </div>

      {/* Audio Suite floating window — position:fixed overlay rendered
          outside the workspace grid so it can drift to wherever the
          operator drags it without getting clipped by a parent. Mounted
          unconditionally (returns null when closed) so the open/close
          state in the store is the single source of truth. */}
      <AudioSuiteWindow />

      {/* Transport — MOX/TUN + audio + mic + macro buttons on the left,
          PA/PRE chips, then the per-radio status (radio IP, rotator, QRZ)
          and "+ Add Panel" trigger on the right. This is the single
          bottom-pinned bar; the previous separate BottomStatusBar was
          merged in here so the chrome doesn't duplicate. */}
      <div className="transport">
        <MoxButton />
        <TunButton />
        <PsToggleButton />
        <div className="transport-sep" />
        <AudioToggle />
        <MicMeter />
        <div className="transport-sep hide-mobile" />
        <button type="button" className="btn ghost hide-mobile">SPLIT</button>
        <button type="button" className="btn ghost hide-mobile">RIT</button>
        <button type="button" className="btn ghost hide-mobile">SAVE MEM</button>
        <div className="spacer" style={{ flex: 1 }} />
        <PaTempChip />
        <div className="chip hide-mobile">
          <span className="k">PRE</span>
          <span className="v">{preampOn ? 'ON' : 'OFF'}</span>
        </div>
        <span className={`chip ${connected ? 'accent' : ''}`}>
          <span className="k">RADIO</span>
          <span className="v mono">{connected ? (endpoint ?? '—') : '—'}</span>
        </span>
        <RotatorStatusPill />
        <QrzStatusPill />
        {/* Add Panel + Reset live together at the bottom-right: both act on
            the active layout's tile arrangement, so keeping them adjacent
            makes the relationship obvious. Disabled while the Settings
            view is showing (no active workspace to mutate). */}
        <button
          type="button"
          className="btn"
          onClick={() => useLayoutStore.getState().setAddPanelOpen(true)}
          disabled={settingsViewOpen}
          title="Add a panel to the active layout"
        >
          + Add Panel
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            const s = useLayoutStore.getState();
            const active = s.layouts.find((l) => l.id === s.activeLayoutId);
            if (!active) return;
            if (!window.confirm(`Reset “${active.name}” to the default panel arrangement?`)) return;
            s.resetActiveLayout();
          }}
          disabled={settingsViewOpen}
          title="Reset active layout to default"
          aria-label="Reset active layout to default"
        >
          ⟳ Default
        </button>
      </div>

      {disconnectedOverlay}
      <UpdatePrompt show={updateAvailable} onUpdate={installUpdate} />
    </div>
    </SpectrumWheelActionsContext.Provider>
    </WorkspaceContext.Provider>
    </BandPlanProvider>
  );
}
