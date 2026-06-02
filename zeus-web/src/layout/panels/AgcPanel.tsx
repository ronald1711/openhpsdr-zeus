// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See LICENSE for the full GPL text.

import { AgcSlider } from '../../components/AgcSlider';

export function AgcPanel() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '12px 14px',
        height: '100%',
        minHeight: 46,
      }}
    >
      <div className="ctrl-group" style={{ minWidth: 160, width: '100%' }}>
        <div className="label-xs ctrl-lbl" style={{ marginBottom: 4 }}>AGC DECAY</div>
        <AgcSlider />
      </div>
    </div>
  );
}
