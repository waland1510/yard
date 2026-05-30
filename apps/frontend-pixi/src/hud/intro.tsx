interface IntroProps {
  onDismiss: () => void;
}

export function Intro({ onDismiss }: IntroProps) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 6,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        cursor: 'pointer',
        color: '#fff',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        SCOTLAND YARD
      </div>
      <div
        style={{
          fontSize: 14,
          letterSpacing: 4,
          color: 'rgba(255,255,255,0.7)',
          marginBottom: 38,
        }}
      >
        first-person
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 18px', fontSize: 14, lineHeight: 1.5 }}>
        <kbd style={kbd}>Mouse</kbd> <span>Look around</span>
        <kbd style={kbd}>Click</kbd> <span>Lock pointer / board a vehicle in your crosshair</span>
        <kbd style={kbd}>Esc</kbd> <span>Unlock pointer</span>
      </div>
      <div
        style={{
          marginTop: 42,
          fontSize: 12,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        click anywhere to begin
      </div>
    </div>
  );
}

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontWeight: 600,
  letterSpacing: 1,
  textAlign: 'center',
  minWidth: 56,
};
