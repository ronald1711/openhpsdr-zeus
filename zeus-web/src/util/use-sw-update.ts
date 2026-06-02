// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import { useEffect, useState } from 'react';
import { registerServiceWorker } from '../service-worker/registerSW';

export function useSwUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installUpdate, setInstallUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const install = registerServiceWorker(() => setUpdateAvailable(true));
    if (install) setInstallUpdate(() => install);
  }, []);

  return { updateAvailable, installUpdate };
}
