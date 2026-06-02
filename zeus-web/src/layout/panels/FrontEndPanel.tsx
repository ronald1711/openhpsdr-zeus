// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See LICENSE for the full GPL text.

import { PreampButton } from '../../components/PreampButton';
import { AttenuatorSlider } from '../../components/AttenuatorSlider';

export function FrontEndPanel() {
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
      <div className="ctrl-group" style={{ minWidth: 200, width: '100%' }}>
        <div className="label-xs ctrl-lbl" style={{ marginBottom: 4 }}>FRONT-END</div>
        <div className="btn-row" style={{ gap: 6, alignItems: 'center' }}>
          <PreampButton />
          <AttenuatorSlider />
        </div>
      </div>
    </div>
  );
}
