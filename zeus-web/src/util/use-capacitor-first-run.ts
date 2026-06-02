// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import { useEffect } from 'react';
import { isCapacitorRuntime, getServerBaseUrl } from '../serverUrl';
import { useLayoutStore } from '../state/layout-store';

// First-run UX for native shells (Capacitor): if there is no server URL
// configured, pop the Settings → Server tab so the operator can paste their
// LAN address. Without this the app would spin trying to reach the WebView's
// own host.
export function useCapacitorFirstRun() {
  const setSettingsView = useLayoutStore((s) => s.setSettingsView);

  useEffect(() => {
    if (!isCapacitorRuntime()) return;
    if (getServerBaseUrl()) return;
    setSettingsView(true, 'server');
  }, [setSettingsView]);
}
