// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import { useEffect } from 'react';
import { useLayoutStore } from '../state/layout-store';
import type { SettingsTabId } from '../components/SettingsMenu';

const VALID_TABS: SettingsTabId[] = ['qrz', 'rotator', 'pa', 'server', 'about'];

// Handle deeplink via URL hash (#qrz, #rotator, #pa, #server, #about).
// Opens the settings view and navigates to the specified tab.
export function useDeepLink() {
  const setSettingsView = useLayoutStore((s) => s.setSettingsView);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1) as SettingsTabId;
      if (VALID_TABS.includes(hash)) {
        setSettingsView(true, hash);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [setSettingsView]);
}
