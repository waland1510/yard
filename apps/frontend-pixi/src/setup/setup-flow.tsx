// Pre-game lobby: welcome → theme → name → role → AI toggle → start.
// Drives the rest-client + url-params-router. Hands off to the game route once started.

import { useEffect, useMemo, useState } from 'react';
import type { RoleType } from '@yard/shared-utils';
import { THEMES, type ThemeName } from '../core/theme-registry';
import { ROLE_PALETTE } from '../core/map-data';
import { useRunnerStore } from '../stores/runner-store';
import { createGame, getGeo, makeMockChannel, updatePlayer } from '../net/rest-client';

type Step = 'welcome' | 'theme' | 'name' | 'role' | 'options' | 'launching';

const STEP_ORDER: readonly Step[] = ['welcome', 'theme', 'name', 'role', 'options'];
const ROLES: readonly RoleType[] = [
  'culprit',
  'detective1',
  'detective2',
  'detective3',
  'detective4',
  'detective5',
];

interface SetupFlowProps {
  /** Called with the final session info once the user clicks "Start". */
  onStart: (session: { channel: string; role: RoleType; name: string; theme: ThemeName }) => void;
}

export function SetupFlow({ onStart }: SetupFlowProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [theme, setTheme] = useState<ThemeName>('classic');
  const lastUsername = useRunnerStore((s) => s.lastUsername);
  const [name, setName] = useState(lastUsername);
  const [role, setRole] = useState<RoleType | null>(null);
  const [withAI, setWithAI] = useState(true);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  // Geo greeting on mount
  useEffect(() => {
    getGeo().then((g) => {
      if (g?.city) setGreeting(`from ${g.city}`);
    });
  }, []);

  const themeDef = THEMES[theme];

  const goNext = () => {
    const i = STEP_ORDER.indexOf(step);
    if (i >= 0 && i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]);
  };
  const goBack = () => {
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]);
  };

  const handleStart = async () => {
    if (!role || !name.trim()) return;
    setLaunching(true);
    setStep('launching');
    // Try real backend first
    const created = await createGame({ theme, withAI });
    const channel = created?.channel ?? makeMockChannel();
    // If AI mode is enabled, flip every NON-selected role to isAI=true so the
    // backend's handleAIMove fires for them. Mirrors the legacy frontend's
    // choose-role flow which did the same patch loop.
    if (withAI && created?.players) {
      await Promise.all(
        created.players
          .filter((p) => p.role !== role)
          .map((p) => updatePlayer(p.id, { isAI: true, username: `AI_${p.role}` }))
      );
    }
    onStart({ channel, role, name: name.trim(), theme });
  };

  const accent = themeDef.palette.accent;

  return (
    <div style={{ ...backdrop, background: bgGradient(theme) }}>
      <ParticleField accent={accent} />

      <header style={topBar}>
        <div style={brand}>
          <span style={{ ...brandTitle, color: accent }}>SCOTLAND YARD</span>
          <span style={brandSub}>first-person</span>
        </div>
        <ProgressDots step={step} accent={accent} />
      </header>

      <main style={mainCard}>
        {step === 'welcome' && (
          <Welcome name={lastUsername} greeting={greeting} accent={accent} onContinue={goNext} />
        )}
        {step === 'theme' && (
          <ThemePicker selected={theme} onSelect={setTheme} onNext={goNext} onBack={goBack} />
        )}
        {step === 'name' && (
          <NameEntry name={name} onChange={setName} accent={accent} onNext={goNext} onBack={goBack} />
        )}
        {step === 'role' && (
          <RolePicker
            theme={themeDef}
            selected={role}
            onSelect={setRole}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === 'options' && (
          <OptionsScreen
            withAI={withAI}
            onToggleAI={setWithAI}
            accent={accent}
            onStart={handleStart}
            onBack={goBack}
            canStart={!!role && name.trim().length > 0}
          />
        )}
        {step === 'launching' && <LaunchingScreen accent={accent} />}
      </main>

      <footer style={footer}>
        <span style={footerText}>Catch Mr. X · or be Mr. X</span>
      </footer>
    </div>
  );
}

// ───────── Steps ─────────

function Welcome({
  name,
  greeting,
  accent,
  onContinue,
}: {
  name: string;
  greeting: string | null;
  accent: string;
  onContinue: () => void;
}) {
  const display = name ? `Hey ${name}` : 'Welcome, detective';
  return (
    <>
      <h1 style={hero}>{display}</h1>
      {greeting && <div style={subtitle}>{greeting}</div>}
      <p style={blurb}>
        A turn-based detective game in first-person London. You'll deduce, pursue,
        or evade across 200 nodes of the underground.
      </p>
      <button style={primaryBtn(accent)} onClick={onContinue}>
        Begin
      </button>
    </>
  );
}

function ThemePicker({
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  selected: ThemeName;
  onSelect: (t: ThemeName) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <h2 style={stepTitle}>Choose your world</h2>
      <p style={stepBlurb}>The theme dresses the city, the characters, and the language of transport.</p>
      <div style={cardRow}>
        {(['classic', 'harry-potter'] as ThemeName[]).map((name) => {
          const t = THEMES[name];
          const isSel = selected === name;
          return (
            <button
              key={name}
              style={themeCard(isSel, t.palette.accent)}
              onClick={() => onSelect(name)}
            >
              <div style={{ ...themeCardTitle, color: t.palette.accent }}>{t.name}</div>
              <div style={themeCardSub}>
                {t.transportation.taxi} · {t.transportation.bus} · {t.transportation.underground}
              </div>
              <div style={themeCardChars}>
                {t.characters.culprit.name} vs {t.characters.detectives.map((d) => d.name.split(' ')[0]).join(', ')}
              </div>
            </button>
          );
        })}
      </div>
      <NavRow onBack={onBack} onNext={onNext} canNext />
    </>
  );
}

function NameEntry({
  name,
  onChange,
  accent,
  onNext,
  onBack,
}: {
  name: string;
  onChange: (v: string) => void;
  accent: string;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <h2 style={stepTitle}>What's your name?</h2>
      <p style={stepBlurb}>How other players (and Mr. X) will see you.</p>
      <input
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Detective Alice"
        autoFocus
        maxLength={32}
        style={{ ...nameInput, borderColor: accent }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim().length > 0) onNext();
        }}
      />
      <NavRow onBack={onBack} onNext={onNext} canNext={name.trim().length > 0} />
    </>
  );
}

function RolePicker({
  theme,
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  theme: (typeof THEMES)[ThemeName];
  selected: RoleType | null;
  onSelect: (r: RoleType) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <h2 style={stepTitle}>Pick your role</h2>
      <p style={stepBlurb}>
        {theme.characters.culprit.name} (Mr. X) hides; the five detectives pursue.
      </p>
      <div style={roleGrid}>
        {ROLES.map((r) => {
          const isCulprit = r === 'culprit';
          const idx = isCulprit ? -1 : parseInt(r.replace('detective', ''), 10) - 1;
          const char = isCulprit ? theme.characters.culprit : theme.characters.detectives[idx];
          const color = ROLE_PALETTE[r as keyof typeof ROLE_PALETTE];
          const isSel = selected === r;
          return (
            <button
              key={r}
              style={roleCard(isSel, isCulprit ? '#ce2b2b' : color)}
              onClick={() => onSelect(r)}
            >
              <div style={{ ...roleEmoji, color }}>{isCulprit ? '🎭' : '🕵️'}</div>
              <div style={roleName}>{char.name}</div>
              <div style={roleSub}>{isCulprit ? 'Mr. X' : `Detective ${idx + 1}`}</div>
            </button>
          );
        })}
      </div>
      <NavRow onBack={onBack} onNext={onNext} canNext={selected != null} />
    </>
  );
}

function OptionsScreen({
  withAI,
  onToggleAI,
  accent,
  onStart,
  onBack,
  canStart,
}: {
  withAI: boolean;
  onToggleAI: (v: boolean) => void;
  accent: string;
  onStart: () => void;
  onBack: () => void;
  canStart: boolean;
}) {
  return (
    <>
      <h2 style={stepTitle}>One last thing</h2>
      <p style={stepBlurb}>How do you want the other seats filled?</p>
      <div style={optionGroup}>
        <button style={optionRow(withAI, accent)} onClick={() => onToggleAI(true)}>
          <span style={optionMark}>{withAI ? '●' : '○'}</span>
          <span>
            <strong>Fill empty seats with AI</strong>
            <div style={optionDesc}>Play right now — AI takes the rest of the table.</div>
          </span>
        </button>
        <button style={optionRow(!withAI, accent)} onClick={() => onToggleAI(false)}>
          <span style={optionMark}>{!withAI ? '●' : '○'}</span>
          <span>
            <strong>Wait for humans</strong>
            <div style={optionDesc}>Get a shareable link; play when 5 more join.</div>
          </span>
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button style={ghostBtn} onClick={onBack}>
          Back
        </button>
        <button style={primaryBtn(accent)} onClick={onStart} disabled={!canStart}>
          Start Game
        </button>
      </div>
    </>
  );
}

function LaunchingScreen({ accent }: { accent: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ ...hero, color: accent, marginBottom: 16 }}>Launching…</div>
      <div style={spinner(accent)} />
    </div>
  );
}

// ───────── Building blocks ─────────

function ProgressDots({ step, accent }: { step: Step; accent: string }) {
  const visibleSteps = STEP_ORDER;
  const currentIdx = visibleSteps.indexOf(step);
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {visibleSteps.map((s, i) => {
        const active = i <= currentIdx;
        return (
          <span
            key={s}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: active ? accent : 'rgba(255,255,255,0.15)',
              transition: 'background 200ms ease',
            }}
          />
        );
      })}
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  canNext,
}: {
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
      <button style={ghostBtn} onClick={onBack}>
        Back
      </button>
      <button style={primaryBtn('#fff')} onClick={onNext} disabled={!canNext}>
        Next
      </button>
    </div>
  );
}

function ParticleField({ accent }: { accent: string }) {
  // Generate a deterministic field of slow-floating dots for atmosphere
  const dots = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        x: ((i * 137) % 100) + ((i * 13) % 7),
        y: ((i * 211) % 100) + ((i * 17) % 11),
        size: 1 + (i % 3),
        opacity: 0.08 + ((i * 7) % 12) / 100,
      })),
    []
  );
  return (
    <svg style={particleSvg} xmlns="http://www.w3.org/2000/svg">
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={`${d.x}%`}
          cy={`${d.y}%`}
          r={d.size}
          fill={accent}
          opacity={d.opacity}
        />
      ))}
    </svg>
  );
}

// ───────── Styles ─────────

function bgGradient(theme: ThemeName): string {
  if (theme === 'harry-potter') {
    return 'radial-gradient(ellipse at top, #2c1a4a 0%, #0b0820 50%, #050410 100%)';
  }
  return 'radial-gradient(ellipse at top, #1a2230 0%, #0b1018 50%, #04060b 100%)';
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 24px',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  overflow: 'hidden',
};

const particleSvg: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

const topBar: React.CSSProperties = {
  width: '100%',
  maxWidth: 980,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'relative',
  zIndex: 1,
};

const brand: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 12 };
const brandTitle: React.CSSProperties = { fontSize: 18, fontWeight: 800, letterSpacing: 4 };
const brandSub: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 4,
  color: 'rgba(255,255,255,0.45)',
};

const mainCard: React.CSSProperties = {
  flex: 1,
  width: '100%',
  maxWidth: 820,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  position: 'relative',
  zIndex: 1,
  padding: '40px 20px',
};

const footer: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginTop: 12,
};

const footerText: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.35)',
  letterSpacing: 3,
};

const hero: React.CSSProperties = {
  fontSize: 56,
  fontWeight: 800,
  letterSpacing: 1,
  margin: 0,
  textShadow: '0 4px 24px rgba(0,0,0,0.5)',
};

const subtitle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 16,
  color: 'rgba(255,255,255,0.5)',
  fontStyle: 'italic',
  letterSpacing: 1,
};

const blurb: React.CSSProperties = {
  marginTop: 28,
  fontSize: 16,
  lineHeight: 1.55,
  color: 'rgba(255,255,255,0.7)',
  maxWidth: 480,
};

const stepTitle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  margin: 0,
  letterSpacing: 0.5,
};

const stepBlurb: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  color: 'rgba(255,255,255,0.55)',
  maxWidth: 480,
};

const cardRow: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  marginTop: 32,
  flexWrap: 'wrap',
  justifyContent: 'center',
};

function themeCard(selected: boolean, accent: string): React.CSSProperties {
  return {
    width: 280,
    padding: '22px 20px',
    background: selected ? `rgba(${hexToRgb(accent)}, 0.16)` : 'rgba(255,255,255,0.04)',
    border: `2px solid ${selected ? accent : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 12,
    cursor: 'pointer',
    color: '#fff',
    transition: 'all 200ms ease',
    textAlign: 'left',
  };
}

const themeCardTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: 1.5,
};

const themeCardSub: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: 'rgba(255,255,255,0.55)',
  letterSpacing: 0.5,
};

const themeCardChars: React.CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  color: 'rgba(255,255,255,0.45)',
  fontStyle: 'italic',
};

const nameInput: React.CSSProperties = {
  marginTop: 24,
  padding: '14px 18px',
  fontSize: 20,
  background: 'rgba(255,255,255,0.05)',
  border: '2px solid',
  borderRadius: 10,
  color: '#fff',
  fontFamily: 'inherit',
  width: 320,
  textAlign: 'center',
  outline: 'none',
};

const roleGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 14,
  marginTop: 28,
  width: '100%',
  maxWidth: 600,
};

function roleCard(selected: boolean, color: string): React.CSSProperties {
  return {
    padding: '20px 12px',
    background: selected ? `rgba(${hexToRgb(color)}, 0.18)` : 'rgba(255,255,255,0.04)',
    border: `2px solid ${selected ? color : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10,
    cursor: 'pointer',
    color: '#fff',
    transition: 'all 160ms ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  };
}

const roleEmoji: React.CSSProperties = { fontSize: 36 };
const roleName: React.CSSProperties = { fontSize: 14, fontWeight: 600 };
const roleSub: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
};

const optionGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  marginTop: 28,
  width: '100%',
  maxWidth: 480,
};

function optionRow(selected: boolean, accent: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '16px 18px',
    background: selected ? `rgba(${hexToRgb(accent)}, 0.14)` : 'rgba(255,255,255,0.04)',
    border: `2px solid ${selected ? accent : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10,
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'inherit',
    textAlign: 'left',
    fontSize: 14,
  };
}

const optionMark: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
  marginTop: 2,
};

const optionDesc: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.55)',
  marginTop: 4,
  fontWeight: 400,
};

function primaryBtn(accent: string): React.CSSProperties {
  return {
    marginTop: 24,
    padding: '12px 32px',
    background: accent,
    border: 'none',
    borderRadius: 8,
    color: '#0a0a0a',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontFamily: 'inherit',
    transition: 'transform 120ms ease',
  };
}

const ghostBtn: React.CSSProperties = {
  marginTop: 24,
  padding: '12px 24px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.8)',
  fontSize: 13,
  letterSpacing: 1.5,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textTransform: 'uppercase',
};

function spinner(accent: string): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    margin: '0 auto',
    border: `3px solid rgba(255,255,255,0.1)`,
    borderTopColor: accent,
    borderRadius: '50%',
    animation: 'sy-spin 0.9s linear infinite',
  };
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
