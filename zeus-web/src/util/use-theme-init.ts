// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import { useEffect } from 'react';
// Ensure ui-prefs-store initialises (and calls applyUiPrefs) when the app
// first mounts. The store self-applies at module load, so no hook logic is
// needed here — the import alone is sufficient.
import '../state/ui-prefs-store';

// Apply saved theme attributes to <html> on first render. The Tweaks panel
// used to toggle these at runtime; now the defaults are fixed.
export function useThemeInit() {
  useEffect(() => {
    const variant = localStorage.getItem('zeus.variant') || 'console';
    const fonts = localStorage.getItem('zeus.fonts') || 'geist';
    document.documentElement.setAttribute('data-variant', variant);
    document.documentElement.setAttribute('data-fonts', fonts);
  }, []);
}
