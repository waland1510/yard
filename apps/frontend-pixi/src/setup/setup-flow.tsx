// Pre-game lobby: welcome → theme → name → role → AI toggle → start.
// Drives the rest-client + url-params-router. Hands off to the game route once started.

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoleType } from '@yard/shared-utils';
import { THEMES, THEME_NAMES, type ThemeName } from '../core/theme-registry';
import { PLAYER_COLOR } from '../hud/tokens';
import { useRunnerStore } from '../stores/runner-store';
import {
  createGame,
  getGame,
  getGeo,
  makeMockChannel,
  recordVisit,
  updatePlayer,
} from '../net/rest-client';
import { RulesButton } from '../hud/rules-panel';
import './setup-flow.css';

type Step = 'welcome' | 'theme' | 'name' | 'role' | 'options' | 'launching';

const STEP_ORDER: readonly Step[] = [
  'welcome',
  'theme',
  'name',
  'role',
  'options',
];
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
  onStart: (session: {
    channel: string;
    role: RoleType;
    name: string;
    theme: ThemeName;
  }) => void;
}

export function SetupFlow({ onStart }: SetupFlowProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [theme, setTheme] = useState<ThemeName>('classic');
  const lastUsername = useRunnerStore((s) => s.lastUsername);
  const [name, setName] = useState(lastUsername);
  const [role, setRole] = useState<RoleType | null>(null);
  const [withAI, setWithAI] = useState(true);
  const [greeting, setGreeting] = useState<string | null>(null);

  // Geo greeting on mount
  useEffect(() => {
    getGeo().then((g) => {
      if (g?.city) setGreeting(`from ${g.city}`);
    });
  }, []);

  const navigate = useNavigate();
  const lastGamePath = useRunnerStore((s) => s.lastGamePath);
  const setLastGamePath = useRunnerStore((s) => s.setLastGamePath);
  const [resumePath, setResumePath] = useState<string | null>(null);
  useEffect(() => {
    const channel = lastGamePath.match(/^\/game\/([^/?]+)/)?.[1];
    if (!channel) return;
    let cancelled = false;
    getGame(decodeURIComponent(channel)).then((game) => {
      if (cancelled) return;
      if (game?.status === 'active') setResumePath(lastGamePath);
      else setLastGamePath('');
    });
    return () => {
      cancelled = true;
    };
  }, [lastGamePath, setLastGamePath]);

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
    setStep('launching');
    recordVisit(name.trim());
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
          .map((p) =>
            updatePlayer(p.id, { isAI: true, username: `AI_${p.role}` })
          )
      );
    }
    onStart({ channel, role, name: name.trim(), theme });
  };

  const accent = themeDef.palette.accent;
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = mainRef.current;
    const initialFocus = main?.querySelector<HTMLElement>('[data-setup-focus]:not(:disabled)');
    if (initialFocus) initialFocus.focus();
    else if (document.activeElement === document.body) main?.focus();
  }, [step]);

  return (
    <div
      className={`setup setup--${theme}`}
      style={{ '--setup-accent': accent } as CSSProperties}
    >
      <div className="setup-grid" aria-hidden="true" />

      <header className="setup-topBar">
        <div className="setup-brand">
          <span className="setup-brandTitle">SCOTLAND YARD</span>
          <span className="setup-brandSub">first-person</span>
        </div>
        <div className="setup-headerRight">
          <RulesButton
            themeId={theme}
            renderTrigger={(open) => (
              <button type="button" className="setup-rulesLink" onClick={open}>
                How to play
              </button>
            )}
          />
          <ProgressDots step={step} />
        </div>
      </header>

      <main
        className="setup-main"
        ref={mainRef}
        tabIndex={-1}
        aria-label="Game setup"
      >
        <div className="setup-eyebrow">
          {step === 'welcome'
            ? 'One fugitive. Five detectives. All of London.'
            : 'Prepare for the pursuit'}
        </div>
        {step === 'welcome' && (
          <Welcome
            name={lastUsername}
            greeting={greeting}
            onContinue={goNext}
            onResume={resumePath ? () => navigate(resumePath) : undefined}
          />
        )}
        {step === 'theme' && (
          <ThemePicker
            selected={theme}
            onSelect={setTheme}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === 'name' && (
          <NameEntry
            name={name}
            onChange={setName}
            onNext={goNext}
            onBack={goBack}
          />
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
            onStart={handleStart}
            onBack={goBack}
            canStart={!!role && name.trim().length > 0}
          />
        )}
        {step === 'launching' && <LaunchingScreen />}
      </main>

      <footer className="setup-footer">
        <span className="setup-footerText">Catch Mr. X · or be Mr. X</span>
      </footer>
    </div>
  );
}

// ───────── Steps ─────────

function Welcome({
  name,
  greeting,
  onContinue,
  onResume,
}: {
  name: string;
  greeting: string | null;
  onContinue: () => void;
  onResume?: () => void;
}) {
  const display = name ? `Hey ${name}` : 'Welcome, detective';
  return (
    <>
      <p className="setup-subtitle">{display}</p>
      <h1 className="setup-hero">
        The city is yours.
        <br />
        <span>The chase is on.</span>
      </h1>
      {greeting && <div className="setup-subtitle">{greeting}</div>}
      <p className="setup-blurb">
        A turn-based detective game in first-person London. You'll deduce,
        pursue, or evade across the streets of London.
      </p>
      <div className="setup-welcomeActions">
        {onResume && (
          <button className="setup-primaryBtn" onClick={onResume}>
            Continue game
          </button>
        )}
        <button
          className={onResume ? 'setup-ghostBtn' : 'setup-primaryBtn'}
          onClick={onContinue}
        >
          {onResume ? 'New game' : 'Start a new game'}{' '}
          <span aria-hidden="true">→</span>
        </button>
      </div>
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
  const nextRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <h2 className="setup-stepTitle">Choose your world</h2>
      <p className="setup-stepBlurb">
        The theme dresses the city, the characters, and the language of
        transport.
      </p>
      <div
        className="setup-cardRow"
        role="group"
        aria-label="Choose your world"
      >
        {THEME_NAMES.map((name) => {
          const t = THEMES[name];
          const isSel = selected === name;
          return (
            <button
              key={name}
              className="setup-themeCard"
              aria-pressed={isSel}
              style={{ '--choice-accent': t.palette.accent } as CSSProperties}
              onClick={() => {
                onSelect(name);
                nextRef.current?.focus();
              }}
            >
              <div className="setup-themeCardTitle">{t.name}</div>
              <div className="setup-themeCardSub">
                {t.transportation.taxi} · {t.transportation.bus} ·{' '}
                {t.transportation.underground}
              </div>
              <div className="setup-themeCardChars">
                {t.characters.culprit.name} vs{' '}
                {name === 'classic' ? '5 detectives' : t.characters.detectives.map((d) => d.name).join(', ')}
              </div>
            </button>
          );
        })}
      </div>
      <NavRow onBack={onBack} onNext={onNext} canNext nextRef={nextRef} />
    </>
  );
}

function NameEntry({
  name,
  onChange,
  onNext,
  onBack,
}: {
  name: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <h2 className="setup-stepTitle">What's your name?</h2>
      <p className="setup-stepBlurb">
        How other players (and Mr. X) will see you.
      </p>
      <label className="setup-fieldLabel" htmlFor="setup-player-name">
        Player name
      </label>
      <input
        id="setup-player-name"
        autoComplete="nickname"
        data-setup-focus
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Detective Alice"
        maxLength={32}
        className="setup-nameInput"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim().length > 0) onNext();
        }}
      />
      <NavRow
        onBack={onBack}
        onNext={onNext}
        canNext={name.trim().length > 0}
        hint="Enter a name to continue"
      />
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
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) nextRef.current?.focus();
  }, [selected]);
  const culpritName = theme.characters.culprit.name;
  return (
    <>
      <h2 className="setup-stepTitle">Pick your role</h2>
      <p className="setup-stepBlurb">
        {culpritName === 'Mr. X' ? culpritName : culpritName + ' (Mr. X)'} hides while the five detectives pursue.
      </p>
      <div
        className="setup-roleGrid"
        role="group"
        aria-label="Choose your role"
      >
        {ROLES.map((r) => {
          const isCulprit = r === 'culprit';
          const idx = isCulprit
            ? -1
            : parseInt(r.replace('detective', ''), 10) - 1;
          const char = isCulprit
            ? theme.characters.culprit
            : theme.characters.detectives[idx];
          const color = PLAYER_COLOR[r];
          const roleLabel = isCulprit ? 'Mr. X' : 'Detective ' + (idx + 1);
          const isSel = selected === r;
          return (
            <button
              key={r}
              className="setup-roleCard"
              aria-pressed={isSel}
              style={
                {
                  '--choice-accent': color,
                } as CSSProperties
              }
              onClick={() => onSelect(r)}
            >
              <img className="setup-roleAvatar" src={char.image} alt="" />
              <div className="setup-roleName">{char.name}</div>
              <div className="setup-roleSub">
                {roleLabel !== char.name ? roleLabel : isCulprit ? 'Hides' : 'Pursues'}
              </div>
            </button>
          );
        })}
      </div>
      <NavRow
        onBack={onBack}
        onNext={onNext}
        canNext={selected != null}
        hint="Pick a role to continue"
        nextRef={nextRef}
      />
    </>
  );
}

function OptionsScreen({
  withAI,
  onToggleAI,
  onStart,
  onBack,
  canStart,
}: {
  withAI: boolean;
  onToggleAI: (v: boolean) => void;
  onStart: () => void;
  onBack: () => void;
  canStart: boolean;
}) {
  return (
    <>
      <h2 className="setup-stepTitle">Assemble your squad</h2>
      <p className="setup-stepBlurb">How do you want the other seats filled?</p>
      <div
        className="setup-optionGroup"
        role="group"
        aria-label="Choose your squad"
      >
        <button
          className="setup-optionRow"
          aria-pressed={withAI}
          onClick={() => onToggleAI(true)}
        >
          <span className="setup-optionMark" aria-hidden="true">
            {withAI ? '●' : '○'}
          </span>
          <span>
            <strong>Fill empty seats with AI</strong>
            <div className="setup-optionDesc">
              Play right now — AI takes the rest of the table.
            </div>
          </span>
        </button>
        <button
          className="setup-optionRow"
          aria-pressed={!withAI}
          onClick={() => onToggleAI(false)}
        >
          <span className="setup-optionMark" aria-hidden="true">
            {!withAI ? '●' : '○'}
          </span>
          <span>
            <strong>Invite your friends</strong>
            <div className="setup-optionDesc">
              Share a game link and gather your squad.
            </div>
          </span>
        </button>
      </div>
      <div className="setup-navigation">
        <button className="setup-ghostBtn" onClick={onBack}>
          Back
        </button>
        <button
          className="setup-primaryBtn"
          data-setup-focus
          onClick={onStart}
          disabled={!canStart}
        >
          Start Game
        </button>
      </div>
    </>
  );
}

function LaunchingScreen() {
  return (
    <div className="setup-launching" role="status">
      <div className="setup-stepTitle">Launching…</div>
      <div className="setup-spinner" />
    </div>
  );
}

// ───────── Building blocks ─────────

function ProgressDots({ step }: { step: Step }) {
  const labels = ['Briefing', 'World', 'Identity', 'Role', 'Squad'];
  const currentIdx =
    step === 'launching' ? STEP_ORDER.length : STEP_ORDER.indexOf(step);
  return (
    <ol className="setup-progress" aria-label="Game setup progress">
      {STEP_ORDER.map((item, index) => (
        <li
          key={item}
          aria-label={index < currentIdx ? labels[index] + ', done' : labels[index]}
          aria-current={step === item ? 'step' : undefined}
          data-complete={index < currentIdx}
        >
          <span aria-hidden="true">{index < currentIdx ? '✓' : index + 1}</span>
          <span>{labels[index]}</span>
        </li>
      ))}
    </ol>
  );
}

function NavRow({
  onBack,
  onNext,
  canNext,
  hint,
  nextRef,
}: {
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
  hint?: string;
  nextRef?: RefObject<HTMLButtonElement>;
}) {
  return (
    <>
      <div className="setup-navigation">
        <button type="button" className="setup-ghostBtn" onClick={onBack}>
          Back
        </button>
        <button
          ref={nextRef}
          type="button"
          className="setup-primaryBtn"
          onClick={onNext}
          disabled={!canNext}
          aria-describedby={!canNext && hint ? 'setup-nav-hint' : undefined}
        >
          Next
        </button>
      </div>
      {!canNext && hint && <p className="setup-navHint" id="setup-nav-hint">{hint}</p>}
    </>
  );
}
