// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import { useEffect, useState } from 'react';

// Hold-to-steer: while Alt/Option is held (outside a text field), the Leaflet
// map becomes interactive and the spectrum canvas stops intercepting events.
// Pairs with the alt+wheel zoom and alt+drag pan in use-pan-tune-gesture.
// Keyup — and a defensive blur/visibilitychange — release the modifier so
// you don't get stuck if focus leaves the window mid-press.
export function useMapModifier(): boolean {
  const [mapModifier, setMapModifier] = useState(false);

  useEffect(() => {
    const inField = (t: EventTarget | null) =>
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLElement && t.isContentEditable);

    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Alt' && !inField(e.target)) setMapModifier(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setMapModifier(false);
    };
    const release = () => setMapModifier(false);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, []);

  return mapModifier;
}
