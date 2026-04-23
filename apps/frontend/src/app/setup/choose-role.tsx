import { RoleType } from '@yard/shared-utils';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { updatePlayer } from '../../api';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import { themes } from '../themes';
import useWebSocket from '../use-websocket';

const resolveCharacter = (
  role: string,
  themeName: string
): { name: string; image: string } => {
  const theme = themes[themeName] ?? themes.classic;
  if (role === 'culprit') return theme.characters.culprit;
  const idx = parseInt(role.replace('detective', ''), 10) - 1;
  return theme.characters.detectives[idx] ?? theme.characters.detectives[0];
};

interface ChooseRoleProps {
  setCurrentStep: (step: string) => void;
}

interface FanCardProps {
  player: any;
  index: number;
  total: number;
  themeName: string;
  onSelect: () => void;
}

const FanCard = ({ player, index, total, themeName, onSelect }: FanCardProps) => {
  const fallback = resolveCharacter(player.role, themeName);
  const image = player.characterImage || fallback.image;
  const name = player.characterName || fallback.name;
  const [hovered, setHovered] = useState(false);
  const center = (total - 1) / 2;
  const offset = index - center;
  const anglePer = total > 4 ? 7 : 10;
  const baseAngle = offset * anglePer;
  const baseY = Math.abs(offset) * 10;
  const isCulprit = player.role === 'culprit';

  return (
    <motion.div
      className="relative cursor-pointer select-none"
      style={{
        marginLeft: total > 3 ? '-18px' : '-6px',
        marginRight: total > 3 ? '-18px' : '-6px',
        zIndex: hovered ? 50 : 10 + index,
        transformOrigin: '50% 100%',
      }}
      initial={{ opacity: 0, y: 40, rotate: 0 }}
      animate={{
        opacity: 1,
        y: hovered ? baseY - 24 : baseY,
        rotate: hovered ? 0 : baseAngle,
        scale: hovered ? 1.15 : 1,
      }}
      transition={{
        duration: 0.3,
        ease: 'easeOut',
        opacity: { duration: 0.4, delay: index * 0.06 },
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onSelect}
      whileTap={{ scale: 0.95 }}
    >
      <div
        className="w-28 rounded-xl overflow-hidden flex flex-col pb-2 transition-colors"
        style={{
          background: isCulprit
            ? 'linear-gradient(165deg, rgba(180,40,40,0.25), rgba(80,10,10,0.15))'
            : 'linear-gradient(165deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
          border: hovered
            ? isCulprit
              ? '2px solid rgba(240,100,100,0.8)'
              : '2px solid rgba(255,255,255,0.55)'
            : isCulprit
            ? '2px solid rgba(200,60,60,0.4)'
            : '2px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
          boxShadow: hovered
            ? isCulprit
              ? '0 14px 40px rgba(180,40,40,0.35), 0 0 24px rgba(240,80,80,0.25)'
              : '0 14px 40px rgba(0,0,0,0.6), 0 0 20px rgba(255,255,255,0.12)'
            : '0 4px 16px rgba(0,0,0,0.45)',
        }}
      >
        <div
          className="w-full h-32 flex items-center justify-center overflow-hidden"
          style={{
            background: isCulprit
              ? 'radial-gradient(ellipse at center, rgba(100,20,20,0.5), rgba(30,5,5,0.6))'
              : 'radial-gradient(ellipse at center, rgba(30,40,60,0.5), rgba(10,12,20,0.6))',
          }}
        >
          <img
            src={image}
            alt={name}
            className="max-w-full max-h-full object-contain"
            style={{ display: 'block' }}
          />
        </div>
        <p
          className="text-white text-[11px] font-bold mt-1.5 tracking-wide text-center px-1"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
        >
          {name}
        </p>
      </div>
    </motion.div>
  );
};

const GhostButton = ({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    whileHover={!disabled ? { scale: 1.05, y: -2 } : {}}
    whileTap={!disabled ? { scale: 0.96 } : {}}
    className="px-7 py-2.5 rounded-xl text-sm font-bold tracking-widest uppercase text-white disabled:opacity-30 disabled:cursor-not-allowed"
    style={
      primary
        ? {
            background: 'linear-gradient(135deg, #2a4a8a, #1a3560)',
            boxShadow: '0 4px 16px rgba(40,80,160,0.4)',
          }
        : {
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
          }
    }
  >
    {children}
  </motion.button>
);

const ChooseRole = ({ setCurrentStep }: ChooseRoleProps) => {
  const location = useLocation();
  const players = usePlayersSubscription();
  const { channel, theme } = useGameStore();
  const { sendMessage } = useWebSocket(channel);
  const username = localStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const { t } = useTranslation();
  const [showAIOptions, setShowAIOptions] = useState(false);
  const [showOptions, setShowOptions] = useState(
    location.pathname.includes('join')
  );

  useEffect(() => {
    if (username) {
      const existingPlayer = players.find((p) => p.username === username);
      if (existingPlayer) {
        useRunnerStore.setState({ currentRole: existingPlayer.role as RoleType });
        useRunnerStore.setState({ currentPosition: existingPlayer.position });
        setCurrentStep('invitePlayers');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRoleChange = async (role: RoleType, isAI = false) => {
    const player = players.find((p) => p.role === role);
    if (!player) return;

    if (!isAI) {
      useRunnerStore.setState({ currentRole: role as RoleType });
      useRunnerStore.setState({ currentPosition: player.position });
    }

    player.username = isAI ? `AI_${t(role)}` : (username as string);
    player.isAI = isAI;
    setPlayer(player);

    if (!isAI) {
      sendMessage('joinGame', { username, role: currentRole });
      await updatePlayer(player.id, {
        username: username as string,
        isAI: false,
      });
    } else {
      await updatePlayer(player.id, {
        username: `AI_${t(role)}`,
        isAI: true,
      });
    }

    setCurrentStep('invitePlayers');
  };

  const handlePlayWithAI = (aiOption: 'culprit' | 'detectives') => {
    if (aiOption === 'culprit') {
      players.forEach((player) => {
        onRoleChange(player.role, player.role === 'culprit');
      });
    } else {
      players
        .filter((p) => p.role.startsWith('detective'))
        .forEach((d) => onRoleChange(d.role, true));
      onRoleChange('culprit', false);
    }
    setCurrentStep('invitePlayers');
  };

  const availablePlayers = players.filter((p) => !p.username);
  const existingPlayers = players.filter((p) => p.username);

  const view =
    !showAIOptions && !showOptions && !players.some((p) => p.username)
      ? 'ai-prompt'
      : showAIOptions
      ? 'ai-options'
      : 'role-select';

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <AnimatePresence mode="wait">
        {view === 'ai-prompt' && (
          <motion.div
            key="ai-prompt"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-5"
          >
            <p className="text-white/60 text-xs tracking-[0.25em] uppercase">
              {t('doYouWantToPlayWithAI')}
            </p>
            <div className="flex gap-4">
              <GhostButton primary onClick={() => setShowAIOptions(true)}>
                {t('yes')}
              </GhostButton>
              <GhostButton onClick={() => setShowOptions(true)}>
                {t('no')}
              </GhostButton>
            </div>
          </motion.div>
        )}

        {view === 'ai-options' && (
          <motion.div
            key="ai-options"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-5"
          >
            <p className="text-white/60 text-xs tracking-[0.25em] uppercase">
              {t('chooseAIOption')}
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              <GhostButton disabled>{t('AIplaysCulprit')}</GhostButton>
              <GhostButton primary onClick={() => handlePlayWithAI('detectives')}>
                {t('AIplaysDetectives')}
              </GhostButton>
            </div>
          </motion.div>
        )}

        {view === 'role-select' && (
          <motion.div
            key="role-select"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-6 w-full"
          >
            {availablePlayers.length > 0 && (
              <div className="flex flex-col items-center gap-4 w-full">
                <p className="text-white/60 text-xs tracking-[0.25em] uppercase">
                  {t('chooseRole')}
                </p>
                <div
                  className="flex items-end justify-center pt-8 pb-2 w-full"
                  style={{ perspective: '1000px' }}
                >
                  {availablePlayers.map((p, i) => (
                    <FanCard
                      key={p.id}
                      player={p}
                      index={i}
                      total={availablePlayers.length}
                      themeName={theme}
                      onSelect={() => onRoleChange(p.role)}
                    />
                  ))}
                </div>
              </div>
            )}

            {existingPlayers.length > 0 && (
              <div className="flex flex-col items-center gap-2 mt-2">
                <p className="text-white/40 text-[10px] tracking-[0.2em] uppercase">
                  {t('joined')}
                </p>
                <div className="flex gap-3 flex-wrap justify-center">
                  {existingPlayers.map((p) => {
                    const fb = resolveCharacter(p.role, theme);
                    return (
                      <div
                        key={p.id}
                        className="flex flex-col items-center gap-1 opacity-70"
                      >
                        <div className="w-12 h-16 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center bg-black/30">
                          <img
                            src={p.characterImage || fb.image}
                            alt={p.characterName || fb.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <p className="text-white/70 text-[10px]">{p.username}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChooseRole;
