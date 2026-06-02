// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import { useEffect } from 'react';
import { fetchState } from '../api/client';
import { useConnectionStore } from '../state/connection-store';
import { useTxStore } from '../state/tx-store';

// StateDto is REST-poll only; WS is binary frames. 1 s poll keeps slow
// state (atten offset, adc overload) fresh — the previous 333 ms cadence
// accounted for ~3 of the ~5 idle-RX fetches/sec and drove repeated
// applyState/hydrateFromState fan-out into the React tree.
const STATE_POLL_MS = 1000;

export function useStatePoll() {
  const connected = useConnectionStore((s) => s.status === 'Connected');

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ctrl: AbortController | null = null;

    const tick = async () => {
      ctrl = new AbortController();
      try {
        const next = await fetchState(ctrl.signal);
        if (!cancelled) {
          useConnectionStore.getState().applyState(next);
          // Hydrate persistable PS / TwoTone fields from the server's StateDto
          // so server-persisted edits (e.g. operator changed MOX delay on
          // another tab) reach this tab even after the initial connect-time
          // hydrate. Master-arm fields are session-only and skipped.
          useTxStore.getState().hydrateFromState(next);
        }
      } catch {
        /* transient errors reconcile on the next tick */
      }
      if (!cancelled) timer = setTimeout(tick, STATE_POLL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
      ctrl?.abort();
    };
  }, [connected]);
}
