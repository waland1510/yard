// The one class component in the app: React only catches render errors through
// componentDidCatch / getDerivedStateFromError, which have no hook equivalent.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { COLOR, FONT, RADIUS } from '../hud/tokens';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render crash:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={overlay} role="alert">
        <div style={panel}>
          <div style={kicker}>Something went wrong</div>
          <div style={message}>{error.message || 'The game hit an unexpected error.'}</div>
          <div style={actions}>
            <button type="button" style={primary} onClick={() => window.location.reload()}>
              Reload game
            </button>
            <button type="button" style={secondary} onClick={() => window.location.assign('/')}>
              Back to lobby
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: '#0b0d12',
  color: COLOR.fg,
  fontFamily: FONT.ui,
  zIndex: 1000,
};

const panel: React.CSSProperties = {
  maxWidth: 440,
  width: '100%',
  padding: '24px 24px 20px',
  background: COLOR.panel,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.dock,
};

const kicker: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: COLOR.redTint,
  fontWeight: 700,
};

const message: React.CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  lineHeight: 1.5,
  color: COLOR.fg2,
  wordBreak: 'break-word',
};

const actions: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 20,
  flexWrap: 'wrap',
};

const buttonBase: React.CSSProperties = {
  padding: '9px 16px',
  border: 0,
  borderRadius: 999,
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const primary: React.CSSProperties = { ...buttonBase, background: COLOR.gold, color: COLOR.onGold };
const secondary: React.CSSProperties = { ...buttonBase, background: COLOR.pill, color: COLOR.fg };
