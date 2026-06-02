// SPDX-License-Identifier: GPL-2.0-or-later
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
// See ATTRIBUTIONS.md at the repository root.

import type { AppFontSize, CanvasDpr, UiScale } from '../state/ui-prefs-store';
import { useUiPrefsStore } from '../state/ui-prefs-store';

const UI_SCALES: { value: UiScale; label: string }[] = [
  { value: 100, label: '100%' },
  { value: 110, label: '110%' },
  { value: 125, label: '125%' },
  { value: 150, label: '150%' },
];

const FONT_SIZES: { value: AppFontSize; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Normal' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'X-Large' },
];

const CANVAS_DPRS: { value: CanvasDpr; label: string }[] = [
  { value: 'performance', label: 'Performance' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'crisp', label: 'Crisp' },
];

export function UIScalePanel() {
  const uiScale = useUiPrefsStore((s) => s.uiScale);
  const fontSize = useUiPrefsStore((s) => s.fontSize);
  const fontBold = useUiPrefsStore((s) => s.fontBold);
  const canvasDpr = useUiPrefsStore((s) => s.canvasDpr);
  const setUiScale = useUiPrefsStore((s) => s.setUiScale);
  const setFontSize = useUiPrefsStore((s) => s.setFontSize);
  const setFontBold = useUiPrefsStore((s) => s.setFontBold);
  const setCanvasDpr = useUiPrefsStore((s) => s.setCanvasDpr);

  return (
    <section>
      <div style={sectionHead}>
        <h3 style={sectionH3}>Interface Scaling</h3>
      </div>

      <div style={card}>
        <div style={row}>
          <span style={rowLabel}>UI Scale</span>
          <div style={btnGroup}>
            {UI_SCALES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={uiScale === value}
                onClick={() => setUiScale(value)}
                style={btnStyle(uiScale === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={divider} />

        <div style={row}>
          <span style={rowLabel}>Font Size</span>
          <div style={btnGroup}>
            {FONT_SIZES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={fontSize === value}
                onClick={() => setFontSize(value)}
                style={btnStyle(fontSize === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={divider} />

        <div style={row}>
          <span style={rowLabel}>Font Weight</span>
          <div style={btnGroup}>
            <button
              type="button"
              aria-pressed={!fontBold}
              onClick={() => setFontBold(false)}
              style={btnStyle(!fontBold)}
            >
              Normal
            </button>
            <button
              type="button"
              aria-pressed={fontBold}
              onClick={() => setFontBold(true)}
              style={btnStyle(fontBold)}
            >
              Bold
            </button>
          </div>
        </div>

        <div style={divider} />

        <div style={row}>
          <span style={rowLabel}>Canvas Sharpness</span>
          <div style={btnGroup}>
            {CANVAS_DPRS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={canvasDpr === value}
                onClick={() => setCanvasDpr(value)}
                style={btnStyle(canvasDpr === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p style={helpText}>
          Performance: 1&times; (GPU-efficient). Balanced: up to 1.5&times;. Crisp: native DPI — may impact performance on 4K+ displays.
        </p>
      </div>
    </section>
  );
}

const sectionHead: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: 10,
  marginBottom: 10,
};

const sectionH3: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--fg-0)',
};

const card: React.CSSProperties = {
  padding: 14,
  background: 'linear-gradient(180deg, var(--bg-1), var(--bg-0))',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
};

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
  padding: '8px 0',
};

const rowLabel: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--fg-2)',
  fontWeight: 600,
  minWidth: 110,
};

const btnGroup: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
};

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    letterSpacing: '0.04em',
    borderRadius: 'var(--r-sm)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
    background: active ? 'var(--accent)' : 'var(--bg-2)',
    color: active ? '#fff' : 'var(--fg-1)',
    cursor: 'pointer',
    transition: 'background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast)',
  };
}

const divider: React.CSSProperties = {
  borderTop: '1px dashed var(--line)',
  margin: '0',
};

const helpText: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 10,
  lineHeight: 1.6,
  color: 'var(--fg-3)',
};
