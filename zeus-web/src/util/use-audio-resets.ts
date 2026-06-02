// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import { useEffect } from 'react';
import { getAudioClient } from '../audio/audio-client';
import { useConnectionStore } from '../state/connection-store';
import { useTxStore } from '../state/tx-store';

export function useAudioResets() {
  useEffect(() => {
    return useConnectionStore.subscribe((state, prev) => {
      if (state.mode !== prev.mode) getAudioClient().reset();
    });
  }, []);

  useEffect(() => {
    return useTxStore.subscribe((state, prev) => {
      if (state.moxOn !== prev.moxOn) {
        // PERF_PASS_3_DEBUG: arm one-shot capture in audio-client. Uncommitted.
        (window as unknown as { __zeusFirstAudioAfterMox?: boolean }).__zeusFirstAudioAfterMox = !state.moxOn;
        getAudioClient().reset();
      }
    });
  }, []);
}
