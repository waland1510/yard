// Companion-pairing UI (#1/#12). On the desktop (map-primary) this offers a "Pair phone"
// action that asks the server for a single-use code and shows a scannable QR + shareable
// link + short code. Once paired it shows a live status chip (connected / disconnected via
// the #12 heartbeat) with an Unpair action.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useRunnerStore } from '../stores/runner-store';
import { getCompanionSession } from '../net/companion-session';
import { notifications } from '../core/notification-service';

function pairingLink(code: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('pair', code);
  return url.toString();
}

export function PairControl() {
  const deviceType = useRunnerStore((s) => s.deviceType);
  const pairingRole = useRunnerStore((s) => s.pairingRole);
  const peerConnected = useRunnerStore((s) => s.peerConnected);
  const [code, setCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  // True once a phone has actually attached. Distinguishes "waiting for a phone" (keep
  // showing the QR) from "a phone paired then dropped" (show the disconnected chip).
  const [everPaired, setEverPaired] = useState(false);

  // A phone attaching consumes the outstanding code and latches everPaired so a later drop
  // reads as "disconnected" rather than "waiting".
  useEffect(() => {
    if (peerConnected) {
      setEverPaired(true);
      setCode(null);
      setPending(false);
    }
  }, [peerConnected]);

  // Render a scannable QR of the pairing link whenever a code is issued.
  useEffect(() => {
    if (!code) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(pairingLink(code), {
      width: 180,
      margin: 1,
      color: { dark: '#0b0d12', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // The companion phone never shows the pairing controls (it IS the companion).
  const isCompanion = pairingRole === 'controller';
  if (isCompanion) return null;

  // Once a phone has actually paired, show the live status chip (connected, or disconnected
  // after a drop). Issuing a code alone makes us map-primary but is NOT "paired" — gate on a
  // real peer so the QR panel below stays visible while waiting for the phone.
  if (everPaired || peerConnected) {
    return (
      <div style={peerConnected ? badge : badgeWarn}>
        <span style={dot} />
        {peerConnected ? 'Phone paired' : 'Phone disconnected'}
        <button
          type="button"
          style={unpairBtn}
          onClick={() => {
            getCompanionSession()?.unpair();
            useRunnerStore.getState().setPairingRole(null);
            setEverPaired(false);
            setCode(null);
          }}
          title="End the companion session"
        >
          Unpair
        </button>
      </div>
    );
  }

  // Only the desktop offers to pair a phone.
  if (deviceType !== 'desktop') return null;

  const requestCode = async () => {
    const session = getCompanionSession();
    if (!session) {
      notifications.push('warning', 'Connect to a live game first — pairing needs the server');
      return;
    }
    setPending(true);
    try {
      const issued = await session.issuePairingCode();
      setCode(issued.code);
    } finally {
      setPending(false);
    }
  };

  const copyLink = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(pairingLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the link is still visible to copy manually */
    }
  };

  if (!code) {
    return (
      <button type="button" style={pairBtn} onClick={requestCode} disabled={pending}>
        📱 {pending ? 'Preparing…' : 'Pair phone'}
      </button>
    );
  }

  return (
    <div style={panel}>
      <div style={panelTitle}>Pair your phone</div>
      {qrDataUrl && (
        <div style={qrWrap}>
          <img src={qrDataUrl} alt="Pairing QR code" style={qrImg} width={180} height={180} />
        </div>
      )}
      <div style={hint}>Scan with your phone — or open the link / enter the code:</div>
      <div style={codeBox}>{code}</div>
      <div style={linkRow}>
        <input style={linkInput} readOnly value={pairingLink(code)} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" style={copyBtn} onClick={copyLink}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
      <div style={waiting}>Waiting for phone to connect…</div>
    </div>
  );
}

const panelBase: React.CSSProperties = {
  position: 'fixed',
  top: 14,
  left: 14,
  zIndex: 30,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: '#f2f4f8',
};

const pairBtn: React.CSSProperties = {
  ...panelBase,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'rgba(18, 20, 26, 0.72)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 22,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
};

const panel: React.CSSProperties = {
  ...panelBase,
  width: 280,
  padding: 16,
  background: 'rgba(18, 20, 26, 0.92)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 14,
  boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
  backdropFilter: 'blur(8px)',
};

const panelTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.3,
  marginBottom: 10,
};

const qrWrap: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: 8,
  background: '#fff',
  borderRadius: 10,
  marginBottom: 10,
};

const qrImg: React.CSSProperties = {
  display: 'block',
  width: 180,
  height: 180,
  imageRendering: 'pixelated',
};

const codeBox: React.CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: 6,
  textAlign: 'center',
  padding: '10px 0',
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
};

const hint: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.7)',
  margin: '10px 0 6px',
};

const linkRow: React.CSSProperties = { display: 'flex', gap: 6 };

const linkInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '6px 8px',
  fontSize: 11,
  background: 'rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  color: '#cdd6e4',
};

const copyBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'rgba(90, 141, 222, 0.9)',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const waiting: React.CSSProperties = {
  marginTop: 10,
  fontSize: 11,
  color: 'rgba(255,255,255,0.55)',
  fontStyle: 'italic',
};

const badge: React.CSSProperties = {
  ...panelBase,
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '7px 13px',
  background: 'rgba(46, 155, 79, 0.85)',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
};

const badgeWarn: React.CSSProperties = {
  ...badge,
  background: 'rgba(226, 133, 51, 0.9)',
};

const unpairBtn: React.CSSProperties = {
  marginLeft: 4,
  padding: '3px 9px',
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.35)',
  borderRadius: 12,
  color: '#fff',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};

const dot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#fff',
  boxShadow: '0 0 6px #fff',
};
