import { useEffect, useRef } from 'react';
import { COLOR, FONT, RADIUS, SHADOW } from './tokens';
import './intro.css';

interface IntroProps {
  touch: boolean;
  onDismiss: () => void;
}

const MOUSE_HINTS: readonly [string, string][] = [
  ['Mouse', 'Look around'],
  ['Click', 'Lock pointer or board a vehicle in your crosshair'],
  ['Esc', 'Unlock pointer'],
];

const TOUCH_HINTS: readonly [string, string][] = [
  ['Drag', 'Look around'],
  ['Tap', 'Choose a vehicle'],
];

export function Intro({ touch, onDismiss }: IntroProps) {
  const hints = touch ? TOUCH_HINTS : MOUSE_HINTS;
  const enterRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    enterRef.current?.focus();
  }, []);

  return (
    <div className="street-intro" style={overlay}>
      {!touch && (
        <div className="street-intro-backdrop" onClick={onDismiss} aria-hidden="true" />
      )}
      <div className="street-intro-card" style={card}>
        <p style={eyebrow}>Scotland Yard · First-person</p>
        <h1 style={title}>
          Step into the chase<span style={{ color: COLOR.gold }}>.</span>
        </h1>
        <p style={subtitle}>London is waiting. Get your bearings before you move.</p>
        <div style={divider} />
        <p style={label}>Street view controls</p>
        <dl style={controls}>
          {hints.map(([key, action]) => (
            <div key={key} style={controlRow}>
              <dt>
                <kbd style={kbd}>{key}</kbd>
              </dt>
              <dd style={controlText}>{action}</dd>
            </div>
          ))}
        </dl>
        <button ref={enterRef} type="button" className="hud-pill-gold" style={enterButton} onClick={onDismiss}>
          Enter street view <span aria-hidden>→</span>
        </button>
        {!touch && <p style={hint}>Or click outside this card to begin</p>}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 6,
  display: 'flex',
  overflowY: 'auto',
  padding: 'var(--street-intro-padding, 28px) 20px',
  background: 'rgba(6, 10, 16, 0.62)',
  backdropFilter: 'blur(3px)',
  color: COLOR.fg,
  fontFamily: FONT.ui,
};

const card: React.CSSProperties = {
  width: 'min(100%, 500px)',
  margin: 'var(--street-intro-card-margin, auto) auto auto',
  padding: 'clamp(24px, 5vw, 40px)',
  background: COLOR.panel,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.dock,
  boxShadow: SHADOW.dock,
  textAlign: 'left',
};

const eyebrow: React.CSSProperties = {
  font: `600 11px ${FONT.mono}`,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: COLOR.gold,
};

const title: React.CSSProperties = {
  marginTop: 16,
  fontSize: 'clamp(30px, 5vw, 44px)',
  fontWeight: 800,
  letterSpacing: '-0.03em',
  lineHeight: 1.08,
};

const subtitle: React.CSSProperties = {
  marginTop: 12,
  fontSize: 15,
  lineHeight: 1.6,
  color: COLOR.fg2,
};

const divider: React.CSSProperties = {
  height: 1,
  margin: '24px 0',
  background: COLOR.hairline,
};

const label: React.CSSProperties = {
  marginBottom: 14,
  font: `600 11px ${FONT.mono}`,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: COLOR.fg2,
};

const controls: React.CSSProperties = {
  display: 'grid',
  gap: 12,
};

const controlRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70px 1fr',
  alignItems: 'center',
  gap: 16,
};

const controlText: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.45,
};

const kbd: React.CSSProperties = {
  display: 'block',
  padding: '6px 8px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: RADIUS.chip,
  font: `600 11px ${FONT.mono}`,
  textAlign: 'center',
};

const enterButton: React.CSSProperties = {
  minHeight: 48,
  marginTop: 28,
  padding: '12px 22px',
  background: COLOR.gold,
  color: COLOR.onGold,
  border: 0,
  borderRadius: RADIUS.control,
  font: `700 14px ${FONT.ui}`,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 16,
};

const hint: React.CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  color: COLOR.fg2,
};
