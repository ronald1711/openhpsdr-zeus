// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See LICENSE for the full GPL text.

import { useLayoutStore } from '../state/layout-store';
import type { CSSProperties } from 'react';

const CONTROLS = [
  { id: 'mode', label: 'Mode Selection', desc: 'SDR operating modes (LSB, USB, CW, FT8, etc.)' },
  { id: 'filter', label: 'Bandwidth Filter', desc: 'Pre-configured receiver bandwidth filters' },
  { id: 'band', label: 'Band Selection', desc: 'Quick band-switching shortcuts (160m to 10m)' },
  { id: 'step', label: 'Tuning Step', desc: 'Tuning dial increment options (10 Hz to 100 kHz)' },
  { id: 'frontend', label: 'Front-End Settings', desc: 'Receiver preamplifier and S-attenuator controls' },
  { id: 'agc', label: 'AGC Decay Slider', desc: 'Automatic gain control decay timing control' },
  { id: 'af', label: 'AF Gain Slider', desc: 'Audio output volume control' },
];

export function ToolbarSettingsPanel() {
  const showTopbar = useLayoutStore((s) => s.showTopbar);
  const setShowTopbar = useLayoutStore((s) => s.setShowTopbar);
  const visibleControls = useLayoutStore((s) => s.visibleToolbarControls);
  const setVisibleControls = useLayoutStore((s) => s.setVisibleToolbarControls);

  const compactType = useLayoutStore((s) => s.compactType);
  const setCompactType = useLayoutStore((s) => s.setCompactType);
  const preventCollision = useLayoutStore((s) => s.preventCollision);
  const setPreventCollision = useLayoutStore((s) => s.setPreventCollision);
  const customMargin = useLayoutStore((s) => s.customMargin);
  const setCustomMargin = useLayoutStore((s) => s.setCustomMargin);

  const toggleControl = (id: string) => {
    if (visibleControls.includes(id)) {
      setVisibleControls(visibleControls.filter((c) => c !== id));
    } else {
      setVisibleControls([...visibleControls, id]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Toolbar Customization */}
      <div>
        <div style={sectionHead}>
          <h3 style={sectionH3}>Top Toolbar Customization</h3>
          <p style={sectionP}>
            Configure which inline radio controls are visible in the top toolbar, or hide the toolbar entirely to maximize panadapter screen space.
          </p>
        </div>

        <div style={panelBody}>
          <label style={topbarToggleLabel}>
            <input
              type="checkbox"
              checked={showTopbar}
              onChange={(e) => setShowTopbar(e.target.checked)}
              style={checkboxStyle}
            />
            <span style={topbarToggleText}>Show Top Toolbar</span>
          </label>

          {showTopbar && (
            <div style={controlGrid}>
              {CONTROLS.map((ctrl) => {
                const checked = visibleControls.includes(ctrl.id);
                return (
                  <button
                    key={ctrl.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleControl(ctrl.id)}
                    style={cardStyle(checked)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      style={checkboxStyle}
                    />
                    <div style={cardTextContainer}>
                      <span style={cardTitle}>{ctrl.label}</span>
                      <span style={cardDesc}>{ctrl.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Workspace Grid Options */}
      <div>
        <div style={sectionHead}>
          <h3 style={sectionH3}>Workspace Grid Options</h3>
          <p style={sectionP}>
            Adjust panel snap alignment, prevent card collisions, and customize layout pixel spacing.
          </p>
        </div>

        <div style={panelBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={topbarToggleLabel}>
              <input
                type="checkbox"
                checked={compactType === 'vertical'}
                onChange={(e) => setCompactType(e.target.checked ? 'vertical' : null)}
                style={checkboxStyle}
              />
              <div style={cardTextContainer}>
                <span style={topbarToggleText}>Auto-Align Panels (Snap Up)</span>
                <span style={cardDesc}>When enabled, panels automatically float upwards to fill empty space. Turn off for free placement anywhere on the grid.</span>
              </div>
            </label>

            <label style={topbarToggleLabel}>
              <input
                type="checkbox"
                checked={preventCollision}
                onChange={(e) => setPreventCollision(e.target.checked)}
                style={checkboxStyle}
              />
              <div style={cardTextContainer}>
                <span style={topbarToggleText}>Prevent Panel Collisions</span>
                <span style={cardDesc}>When dragging a panel, prevent it from pushing other panels out of their positions.</span>
              </div>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={topbarToggleText}>Grid Panel Spacing (Gap)</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-bright)', fontWeight: 600 }}>
                  {customMargin === -1 ? 'Theme default' : `${customMargin} px`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min="-1"
                  max="16"
                  step="1"
                  value={customMargin}
                  onChange={(e) => setCustomMargin(parseInt(e.target.value, 10))}
                  style={{ flex: 1, cursor: 'pointer', height: 6 }}
                />
                {customMargin !== -1 && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setCustomMargin(-1)}
                    style={{
                      border: '1px solid var(--line-strong)',
                      padding: '4px 10px',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 11,
                      background: 'var(--bg-2)'
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <span style={cardDesc}>Tweak the pixel gap size between cards. Spacing -1 uses standard theme defaults (classic: 3px, dark/light: 6px).</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionHead: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: 10,
  marginBottom: 12,
};

const sectionH3: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--fg-0)',
};

const sectionP: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--fg-2)',
};

const panelBody: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 18,
  background: 'var(--bg-1)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
};

const topbarToggleLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  cursor: 'pointer',
  userSelect: 'none',
  padding: '4px 0',
};

const topbarToggleText: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--fg-0)',
};

const checkboxStyle: CSSProperties = {
  cursor: 'pointer',
  accentColor: 'var(--accent)',
  width: 16,
  height: 16,
  marginTop: 2,
};

const controlGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 10,
  marginTop: 6,
};

function cardStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    background: active ? 'var(--bg-2)' : 'var(--bg-1)',
    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
    borderRadius: 'var(--r-md)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color var(--dur-fast), background var(--dur-fast)',
    boxShadow: active
      ? '0 0 0 2px rgba(46,142,255,0.1)'
      : 'inset 0 0 0 1px rgba(255,255,255,0.01)',
  };
}

const cardTextContainer: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const cardTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--fg-0)',
};

const cardDesc: CSSProperties = {
  fontSize: 11,
  color: 'var(--fg-2)',
  lineHeight: 1.4,
};
