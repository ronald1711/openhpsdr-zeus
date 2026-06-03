// SPDX-License-Identifier: GPL-2.0-or-later
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import { create } from 'zustand';

export type UiScale = 100 | 110 | 125 | 150;
export type AppFontSize = 'sm' | 'md' | 'lg' | 'xl';
export type CanvasDpr = 'performance' | 'balanced' | 'crisp';

export const FONT_SIZE_PX: Record<AppFontSize, string> = {
  sm: '11px', md: '12px', lg: '14px', xl: '16px',
};

export interface UiPrefsState {
  uiScale: UiScale;
  fontSize: AppFontSize;
  fontBold: boolean;
  canvasDpr: CanvasDpr;
  setUiScale: (v: UiScale) => void;
  setFontSize: (v: AppFontSize) => void;
  setFontBold: (v: boolean) => void;
  setCanvasDpr: (v: CanvasDpr) => void;
}

const STORAGE_KEY = 'zeus.uiPrefs';

const UI_SCALES: ReadonlyArray<UiScale> = [100, 110, 125, 150];
const FONT_SIZES: ReadonlyArray<AppFontSize> = ['sm', 'md', 'lg', 'xl'];
const CANVAS_DPRS: ReadonlyArray<CanvasDpr> = ['performance', 'balanced', 'crisp'];

function isUiScale(v: unknown): v is UiScale {
  return UI_SCALES.includes(v as UiScale);
}
function isAppFontSize(v: unknown): v is AppFontSize {
  return FONT_SIZES.includes(v as AppFontSize);
}
function isCanvasDpr(v: unknown): v is CanvasDpr {
  return CANVAS_DPRS.includes(v as CanvasDpr);
}

interface StoredPrefs {
  uiScale: UiScale;
  fontSize: AppFontSize;
  fontBold: boolean;
  canvasDpr: CanvasDpr;
}

function readPrefs(): StoredPrefs {
  const defaults: StoredPrefs = {
    uiScale: 100,
    fontSize: 'md',
    fontBold: false,
    canvasDpr: 'performance',
  };
  try {
    if (typeof localStorage === 'undefined') return defaults;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      uiScale: isUiScale(parsed?.uiScale) ? parsed.uiScale : defaults.uiScale,
      fontSize: isAppFontSize(parsed?.fontSize) ? parsed.fontSize : defaults.fontSize,
      fontBold: typeof parsed?.fontBold === 'boolean' ? parsed.fontBold : defaults.fontBold,
      canvasDpr: isCanvasDpr(parsed?.canvasDpr) ? parsed.canvasDpr : defaults.canvasDpr,
    };
  } catch {
    return defaults;
  }
}

function writePrefs(prefs: StoredPrefs): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // quota exceeded / private mode — accept silently.
  }
}

function applyUiPrefs(prefs: StoredPrefs): void {
  const root = document.documentElement;
  // Apply zoom via data attribute so CSS can scope it to .app only.
  // Zooming html directly distorts 100vh/100vw and clips the sidebar + transport bar.
  if (prefs.uiScale === 100) {
    delete root.dataset['uiScale'];
  } else {
    root.dataset['uiScale'] = String(prefs.uiScale);
  }
  root.style.setProperty('--app-font-size', FONT_SIZE_PX[prefs.fontSize]);
  root.style.setProperty('--app-font-weight', prefs.fontBold ? '700' : '400');
}

// Apply at module load using persisted values.
const _initial = readPrefs();
applyUiPrefs(_initial);

export const useUiPrefsStore = create<UiPrefsState>((set, get) => ({
  uiScale: _initial.uiScale,
  fontSize: _initial.fontSize,
  fontBold: _initial.fontBold,
  canvasDpr: _initial.canvasDpr,

  setUiScale: (v) => {
    set({ uiScale: v });
    const s = get();
    const prefs: StoredPrefs = { uiScale: v, fontSize: s.fontSize, fontBold: s.fontBold, canvasDpr: s.canvasDpr };
    writePrefs(prefs);
    applyUiPrefs(prefs);
  },
  setFontSize: (v) => {
    set({ fontSize: v });
    const s = get();
    const prefs: StoredPrefs = { uiScale: s.uiScale, fontSize: v, fontBold: s.fontBold, canvasDpr: s.canvasDpr };
    writePrefs(prefs);
    applyUiPrefs(prefs);
  },
  setFontBold: (v) => {
    set({ fontBold: v });
    const s = get();
    const prefs: StoredPrefs = { uiScale: s.uiScale, fontSize: s.fontSize, fontBold: v, canvasDpr: s.canvasDpr };
    writePrefs(prefs);
    applyUiPrefs(prefs);
  },
  setCanvasDpr: (v) => {
    set({ canvasDpr: v });
    const s = get();
    const prefs: StoredPrefs = { uiScale: s.uiScale, fontSize: s.fontSize, fontBold: s.fontBold, canvasDpr: v };
    writePrefs(prefs);
    applyUiPrefs(prefs);
  },
}));
