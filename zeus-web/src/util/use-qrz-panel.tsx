// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { CONTACTS, bandOf } from '../components/design/data';
import { bearingDeg, distanceKm } from '../components/design/geo';
import { useQrzStore } from '../state/qrz-store';
import { useLoggerStore } from '../state/logger-store';
import { useRotatorStore } from '../state/rotator-store';
import { useConnectionStore } from '../state/connection-store';
import { useDisplaySettingsStore } from '../state/display-settings-store';
import { useMapModifier } from './use-map-modifier';
import type { QrzStation } from '../api/qrz';
import type { Contact } from '../components/design/data';

// QRZ XML gives us a sparser record than the design-time Contact type; fill
// the design-only fields ("local", "rig", "ant", "age"…) with em-dashes so
// QrzCard still renders without needing a schema change.
function qrzStationToContact(s: QrzStation | null, home: QrzStation | null): Contact | null {
  if (!s || s.lat == null || s.lon == null) return null;
  const bearing = home?.lat != null && home?.lon != null
    ? bearingDeg(home.lat, home.lon, s.lat, s.lon)
    : 0;
  const distance = home?.lat != null && home?.lon != null
    ? distanceKm(home.lat, home.lon, s.lat, s.lon)
    : 0;
  const first = (s.firstName || s.name || '').trim().charAt(0).toUpperCase();
  const last = (s.name || '').trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '';
  const initials = (first + last) || s.callsign.slice(0, 2);
  const location = [s.city, s.state, s.country].filter(Boolean).join(', ') || (s.country ?? '—');
  const fullName = [s.firstName, s.name].filter(Boolean).join(' ') || '—';
  return {
    callsign: s.callsign,
    name: fullName,
    location,
    grid: s.grid ?? '—',
    cq: s.cqZone != null ? String(s.cqZone).padStart(2, '0') : '—',
    itu: s.ituZone != null ? String(s.ituZone).padStart(2, '0') : '—',
    latlon: `${Math.abs(s.lat).toFixed(2)}°${s.lat >= 0 ? 'N' : 'S'} / ${Math.abs(s.lon).toFixed(2)}°${s.lon >= 0 ? 'E' : 'W'}`,
    lat: s.lat,
    lon: s.lon,
    local: '—',
    qsl: '—',
    licensed: '—',
    initials,
    flag: '',
    bearing,
    distance,
    age: 0,
    class: '—',
    rig: '—',
    ant: '—',
    power: '—',
    qth: s.city ?? s.country ?? '—',
    email: '—',
    photoUrl: s.imageUrl ?? undefined,
    qrzUrl: `https://www.qrz.com/db/${s.callsign}`,
  };
}

export function useQrzPanel() {
  const mapModifier = useMapModifier();

  // Panadapter background (display-settings-store):
  //   'basic' | 'beam-map' | 'image'
  // terminatorActive = map + terminator chrome visible ('beam-map')
  // imageMode = custom background image active ('image' + loaded image)
  const panBackground = useDisplaySettingsStore((s) => s.panBackground);
  const backgroundImage = useDisplaySettingsStore((s) => s.backgroundImage);
  const backgroundImageFit = useDisplaySettingsStore((s) => s.backgroundImageFit);
  const terminatorActive = panBackground === 'beam-map';
  const imageMode = panBackground === 'image' && !!backgroundImage;
  const bgActive = terminatorActive || imageMode;

  // Local state
  const [callsign, setCallsign] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [lookupKey, setLookupKey] = useState(0);
  const [beamOverrideDeg, setBeamOverrideDeg] = useState<number | null>(null);
  const [beamInputStr, setBeamInputStr] = useState('');
  // Set to false when the map error boundary catches a load failure (missing
  // tiles, Leaflet init fail). QRZ info still renders but map-dependent UI
  // (beam chips, etc.) is hidden.
  const [mapAvailable, setMapAvailable] = useState(true);

  // QRZ store
  const qrzHome = useQrzStore((s) => s.home);
  const qrzLookup = useQrzStore((s) => s.lastLookup);
  const qrzHasXml = useQrzStore((s) => s.hasXmlSubscription);
  const qrzLookupError = useQrzStore((s) => s.lookupError);
  const qrzHasApiKey = useQrzStore((s) => s.hasApiKey);
  const qrzActive = !!qrzHome && qrzHasXml;

  // Logger store
  const addLogEntry = useLoggerStore((s) => s.addLogEntry);
  const logPublishInFlight = useLoggerStore((s) => s.publishInFlight);
  const logPublishResult = useLoggerStore((s) => s.lastPublishResult);
  const logPublishError = useLoggerStore((s) => s.publishError);
  const logSelectedIds = useLoggerStore((s) => s.selectedIds);
  const logPublishSelected = useLoggerStore((s) => s.publishSelectedToQrz);
  const logExportAdif = useLoggerStore((s) => s.exportAdif);

  // Rotator — live heading drives beam lines on the map
  const rotStatus = useRotatorStore((s) => s.status);
  const rotLiveAz = rotStatus?.connected ? rotStatus.currentAz : null;

  // Connection state — consumed by handleLogQso and heroTitle
  const mode = useConnectionStore((s) => s.mode);
  const vfoHz = useConnectionStore((s) => s.vfoHz);

  // DSP active indicator (used by workspaceCtx to style DSP button)
  const nrState = useConnectionStore((s) => s.nr);
  const dspActive =
    nrState.nrMode !== 'Off' ||
    nrState.nbMode !== 'Off' ||
    nrState.anfEnabled ||
    nrState.snbEnabled ||
    nrState.nbpNotchesEnabled;

  // Derive contact from live QRZ lookup or design-mock CONTACTS table
  const contact: Contact | null = qrzActive
    ? qrzStationToContact(qrzLookup, qrzHome)
    : (CONTACTS[callsign.toUpperCase()] ?? null);

  // Logbook UI
  const logbookTitle = logPublishInFlight
    ? 'Logbook · Uploading…'
    : logPublishError
      ? `Logbook · ${logPublishError.length > 28 ? 'Publish failed' : logPublishError}`
      : logPublishResult
        ? logPublishResult.failedCount > 0
          ? `Logbook · ${logPublishResult.successCount} ok, ${logPublishResult.failedCount} failed`
          : `Logbook · Published ${logPublishResult.successCount}`
        : 'Logbook';

  const logSelectedCount = logSelectedIds.size;
  const publishDisabled = logSelectedCount === 0 || logPublishInFlight || !qrzHasApiKey;
  const publishTitle = !qrzHasApiKey
    ? 'Set a QRZ API key in the QRZ panel to enable publishing'
    : logSelectedCount === 0
      ? 'Select one or more rows to publish'
      : 'Publish selected QSOs to QRZ logbook';

  const logbookActions: ReactNode = (
    <>
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => void logPublishSelected(Array.from(logSelectedIds))}
        disabled={publishDisabled}
        title={publishTitle}
      >
        {logPublishInFlight ? 'Publishing…' : `Publish (${logSelectedCount})`}
      </button>
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => void logExportAdif()}
        title="Export all log entries to ADIF file"
      >
        Export
      </button>
    </>
  );

  // Effective home for map + bearing math. Null until QRZ supplies a real
  // station — map omits home marker and great-circle until then.
  const effectiveHome = qrzHome && qrzHome.lat != null && qrzHome.lon != null
    ? {
        call: qrzHome.callsign,
        lat: qrzHome.lat,
        lon: qrzHome.lon,
        grid: qrzHome.grid ?? '',
        imageUrl: qrzHome.imageUrl ?? null,
      }
    : null;

  const sp = contact && effectiveHome
    ? bearingDeg(effectiveHome.lat, effectiveHome.lon, contact.lat, contact.lon)
    : 0;
  const lp = (sp + 180) % 360;
  const dist = contact && effectiveHome
    ? distanceKm(effectiveHome.lat, effectiveHome.lon, contact.lat, contact.lon)
    : 0;

  const bandLabel = bandOf(vfoHz);
  const heroTitle: ReactNode = terminatorActive && contact ? (
    <>
      Panadapter · World Map ·{' '}
      <span style={{ color: 'var(--accent)' }}>{contact.callsign}</span> ·{' '}
      {Math.round(dist).toLocaleString()} km · brg {sp.toFixed(0)}°
    </>
  ) : (
    <>Panadapter · {(vfoHz / 1e6).toFixed(3)} MHz · {bandLabel}</>
  );

  // While Alt/Option is held and the map is showing, the spectrum canvas
  // yields pointer events to Leaflet. Click-to-tune is suspended.
  const mapInteractive = terminatorActive && mapModifier && mapAvailable;

  // Ref for the callsign text input — used by the '/' focus shortcut and
  // passed into workspaceCtx so QrzCard can focus it programmatically.
  const csInputRef = useRef<HTMLInputElement | null>(null);

  // `/` focuses the callsign input so the operator can type a call + Enter.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        e.key === '/' &&
        !(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        csInputRef.current?.focus();
        csInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // QRZ is passively engaged whenever the user has it configured — no
  // separate engage/disengage step. Submitting a callsign runs a lookup;
  // the contact card renders off the resulting `contact` regardless of what's
  // drawn behind the panadapter.
  const runQrzLookup = useCallback((cs?: string) => {
    const target = (cs ?? callsign).toUpperCase();
    setCallsign(target);
    setEnriching(true);
    setLookupKey((k) => k + 1);
    setBeamOverrideDeg(null);
    setBeamInputStr('');
    const qrz = useQrzStore.getState();
    if (qrz.connected && qrz.hasXmlSubscription) {
      qrz.lookup(target).finally(() => setEnriching(false));
    } else {
      // Design-mock fallback: synchronous; brief delay so the card doesn't
      // pop in without a visual beat.
      setTimeout(() => setEnriching(false), 700);
    }
  }, [callsign]);

  // Log QSO — creates a log entry with RST derived from the active mode
  const handleLogQso = useCallback(() => {
    if (!contact || !qrzLookup) return;
    const isCwMode = mode === 'CWU' || mode === 'CWL';
    const rst = isCwMode ? '599' : '59';
    void addLogEntry({
      callsign: contact.callsign,
      name: qrzLookup.name ?? undefined,
      frequencyMhz: vfoHz / 1e6,
      band: bandOf(vfoHz),
      mode,
      rstSent: rst,
      rstRcvd: rst,
      grid: qrzLookup.grid ?? undefined,
      country: qrzLookup.country ?? undefined,
      dxcc: qrzLookup.dxcc ?? undefined,
      cqZone: qrzLookup.cqZone ?? undefined,
      ituZone: qrzLookup.ituZone ?? undefined,
      state: qrzLookup.state ?? undefined,
    });
  }, [contact, qrzLookup, mode, vfoHz, addLogEntry]);

  const handleClearQrz = useCallback(() => {
    useQrzStore.getState().clearLookup();
    setCallsign('');
  }, []);

  const onCallsignSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runQrzLookup();
  };

  function rotateToBearing(brg: number) {
    const normalized = ((brg % 360) + 360) % 360;
    setBeamOverrideDeg(normalized);
    setBeamInputStr(normalized.toFixed(0));
    const rot = useRotatorStore.getState();
    if (rot.config.enabled && rot.status?.connected) {
      void rot.setAzimuth(normalized);
    }
  }

  function submitBeam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = beamInputStr.trim();
    if (!trimmed) {
      setBeamOverrideDeg(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    rotateToBearing(parsed);
  }

  return {
    // Panadapter background
    panBackground,
    backgroundImage,
    backgroundImageFit,
    terminatorActive,
    imageMode,
    bgActive,
    // Callsign input
    callsign,
    setCallsign,
    csInputRef,
    enriching,
    lookupKey,
    // Map / beam
    mapAvailable,
    setMapAvailable,
    mapInteractive,
    beamOverrideDeg,
    setBeamOverrideDeg,
    beamInputStr,
    setBeamInputStr,
    // QRZ
    qrzActive,
    qrzLookupError,
    contact,
    effectiveHome,
    // Bearings / distance
    sp,
    lp,
    dist,
    rotLiveAz,
    // Panadapter title
    heroTitle,
    // DSP indicator
    dspActive,
    // Logbook
    logbookTitle,
    logbookActions,
    // Handlers
    runQrzLookup,
    onCallsignSubmit,
    submitBeam,
    handleLogQso,
    handleClearQrz,
  };
}
