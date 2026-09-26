// Game rules: a "Rules" trigger plus the modal it opens. Used in the lobby and in-game.
// Names follow the active theme (e.g. Bellatrix / Floo Network in the Harry Potter theme).

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ThemeName } from '../core/theme-registry';
import { getTheme } from '../core/theme-registry';
import { SHOW_CULPRIT_AT_MOVES } from '../core/map-data';
import { TOTAL_ROUNDS } from '../core/move-validator';
import { COLOR, FONT, RADIUS } from './tokens';

interface RulesButtonProps {
  themeId: ThemeName | string | undefined;
  /** Rendered trigger; receives the open handler. */
  renderTrigger: (open: () => void) => React.ReactNode;
}

export function RulesButton({ themeId, renderTrigger }: RulesButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {renderTrigger(() => setOpen(true))}
      {open && createPortal(<RulesModal themeId={themeId} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function RulesModal({ themeId, onClose }: { themeId: RulesButtonProps['themeId']; onClose: () => void }) {
  const theme = getTheme(themeId);
  const x = theme.characters.culprit.name;
  const t = theme.transportation;
  const reveals = SHOW_CULPRIT_AT_MOVES.join(', ');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sections: { title: string; items: string[] }[] = [
    {
      title: 'Goal',
      items: [
        `${x} hides somewhere in London; up to five detectives hunt them down.`,
        `Detectives win by landing on ${x}'s junction.`,
        `${x} wins by staying free for all ${TOTAL_ROUNDS} rounds, or if every detective is stuck with no legal move.`,
      ],
    },
    {
      title: 'Turns',
      items: [
        `Each round ${x} moves first, then every detective in order.`,
        `A move follows one connection from your junction, paying one ticket of that kind: ${t.taxi} (yellow), ${t.bus} (green) or ${t.underground} (red).`,
        'Detectives cannot share a junction. A detective with no affordable move is skipped.',
      ],
    },
    {
      title: 'Tickets',
      items: [
        `Detectives start with 10 ${t.taxi}, 8 ${t.bus} and 4 ${t.underground} tickets, and they run out.`,
        `${x} starts with 24 of each, plus 5 ${t.secret} and 2 ${t.double} tickets.`,
      ],
    },
    {
      title: `${x}'s tricks`,
      items: [
        `${x} is invisible except on rounds ${reveals}, when their position is revealed.`,
        `A ${t.secret} ticket hides which transport ${x} used.`,
        `A ${t.double} ticket lets ${x} move twice in a row.`,
        `The ${t.river} (blue, dashed) is ${x}'s alone and always costs a ${t.secret} ticket.`,
      ],
    },
    {
      title: 'Controls',
      items: [
        'Street view: look around and click a vehicle or station to ride it.',
        'Strategic map: click a highlighted junction to move; right-click any junction for Street View.',
        'Tab switches between street view and the strategic map.',
      ],
    },
  ];

  return (
    <div style={backdrop} onClick={onClose} role="presentation">
      <div
        style={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={header}>
          <h2 id="rules-title" style={title}>
            How to play
          </h2>
          <button type="button" style={close} onClick={onClose} aria-label="Close rules">
            ✕
          </button>
        </div>
        <div style={body}>
          {sections.map((section) => (
            <section key={section.title} style={sectionStyle}>
              <h3 style={sectionTitle}>{section.title}</h3>
              <ul style={list}>
                {section.items.map((item) => (
                  <li key={item} style={listItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  fontFamily: FONT.ui,
};

const panel: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  maxHeight: 'calc(100vh - 32px)',
  display: 'flex',
  flexDirection: 'column',
  background: COLOR.panel,
  color: COLOR.fg,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.dock,
  boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 20px 12px',
  borderBottom: `1px solid ${COLOR.hairline}`,
};

const title: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700 };

const close: React.CSSProperties = {
  width: 32,
  height: 32,
  border: 0,
  borderRadius: RADIUS.control,
  background: COLOR.pill,
  color: COLOR.fg,
  cursor: 'pointer',
  fontSize: 13,
};

const body: React.CSSProperties = { overflowY: 'auto', padding: '6px 20px 20px' };

const sectionStyle: React.CSSProperties = { marginTop: 14 };

const sectionTitle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: 11,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  color: COLOR.gold,
  fontWeight: 700,
};

const list: React.CSSProperties = { margin: 0, paddingLeft: 18 };

const listItem: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.55, color: COLOR.fg2, marginTop: 3 };
