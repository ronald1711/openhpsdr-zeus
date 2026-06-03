// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See LICENSE for the full GPL text.

import { useEffect, useMemo } from 'react';
import { useThemeStore } from '../state/theme-store';

// ThemeApplier — single mounted instance (in App.tsx) that:
//   1. sets `data-theme` on <html> when the operator picks Dark / Light;
//   2. injects a runtime <style> tag with `:root { --accent: #...; … }`
//      so any operator colour overrides cascade *under* both theme overlays.
//
// Renders nothing visible. Kept as a top-level mount rather than a side
// effect in App.tsx so the initial state (read from localStorage in the
// store factory) lands on <html> before the first paint of the workspace.

export function ThemeApplier(): null {
  const theme = useThemeStore((s) => s.theme);
  const overrides = useThemeStore((s) => s.overrides);
  const hydrate = useThemeStore((s) => s.hydrate);

  // Pull the authoritative theme + overrides from the backend on mount.
  // The store's initial values come from localStorage (synchronous, so
  // [data-theme] lands before first paint — no light/dark flash); hydrate
  // then reconciles against /api/theme-settings so the operator's choice
  // follows them across browsers. Fire-and-forget — hydrate() catches its
  // own errors and falls back to the local cache.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Build the override CSS body once per change. Empty overrides → empty
  // rule, which is harmless. We keep this as a memoised string so React
  // doesn't re-create the textContent of the <style> tag every render.
  const css = useMemo(() => {
    const entries = Object.entries(overrides);
    if (entries.length === 0) return '';
    const decls = entries
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    // Use the same selector specificity as the active theme block in tokens.css.
    // Non-dark themes use :root[data-theme="xxx"] (specificity 0,1,0); a plain
    // :root override (0,0,1) loses the cascade even when appended last. Matching
    // the selector gives us equal specificity so the later-in-document injected
    // <style> wins correctly.
    const sel = theme === 'dark' ? ':root' : `:root[data-theme="${theme}"]`;
    return `${sel} {\n${decls}\n}\n`;
  }, [overrides, theme]);

  useEffect(() => {
    const id = 'zeus-theme-overrides';
    let tag = document.getElementById(id) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = id;
      // Appending to <head> last keeps these declarations after tokens.css
      // (which is imported at module load), so the overrides win the
      // cascade against both the :root defaults and the [data-theme="light"]
      // block.
      document.head.appendChild(tag);
    }
    tag.textContent = css;
  }, [css]);

  return null;
}
