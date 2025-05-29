import React, { useEffect } from 'react';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { useRunnerStore } from '../../stores/use-runner-store';
import { RoleType } from '@yard/shared-utils';
import useWebSocket from '../use-websocket';
import { useGameStore } from '../../stores/use-game-store';
import { updatePlayer } from '../../api';
import { useTranslation } from "react-i18next";
import { useLocation } from 'react-router-dom';

interface ChooseRoleProps {
  setCurrentStep: (step: string) => void;
}

const ChooseRole = ({ setCurrentStep }: ChooseRoleProps) => {
  const location = useLocation();
  const players = usePlayersSubscription();
  const channel = useGameStore((state) => state.channel);
  const { sendMessage } = useWebSocket(channel);
  const username = localStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const { t } = useTranslation();
  const [showAIOptions, setShowAIOptions] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(location.pathname.includes('join'));

  useEffect(() => {
    if (username) {
      const existingPlayer = players.find((p) => p.username === username);
      if (existingPlayer) {
        useRunnerStore.setState({
          currentRole: existingPlayer.role as RoleType,
        });
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
      useRunnerStore.setState({
        currentPosition: player.position,
      });
    }

    player.username = isAI ? `AI_${t(role)}` : username as string;
    player.isAI = isAI;
    setPlayer(player);

    if (!isAI) {
      sendMessage('joinGame', { username, role: currentRole });
      await updatePlayer(player.id, {
        username: username as string,
        isAI: false
      });
    } else {
      await updatePlayer(player.id, {
        username: `AI_${t(role)}`,
        isAI: true
      });
    }

      setCurrentStep('invitePlayers');
  };

  const handlePlayWithAI = (aiOption: 'culprit' | 'detectives') => {
    if (aiOption === 'culprit') {
        players
        .forEach((player) => {
          onRoleChange(player.role, player.role === 'culprit');
        });
    } else  {
      players
        .filter((p) => p.role.startsWith('detective'))
        .forEach((detective) => {
          onRoleChange(detective.role, true);
        });
        onRoleChange('culprit', false);
    }
    setCurrentStep('invitePlayers');
  };

  const handlePlayWithAISelection = () => {
    setShowAIOptions(true);
  };

  const handlePlayWithoutAI = () => {
    setShowOptions(true);
  };

  const existingPlayers = players.filter((p) => p.username);

  return (
    <div className="text-center">
      {!showAIOptions && !showOptions && !players.some((p) => p.username) ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg text-gray-700">{t('doYouWantToPlayWithAI')}</p>
          <div className="flex gap-4">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={handlePlayWithAISelection}
            >
              {t('yes')}
            </button>
            <button
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              onClick={handlePlayWithoutAI}
            >
              {t('no')}
            </button>
          </div>
        </div>
      ) : null}
      {showOptions && (
        <div className="flex justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-lg text-gray-700">{t('chooseRole')}</p>
            <div className="flex gap-10 items-center">
              {players
                .filter((player) => !player.username)
                .map((p) => (
                  <div key={p.id} className="flex flex-col items-center gap-2">
                    <img
                      className="w-20 h-22 cursor-pointer"
                      src={`/images/${p.role}.png`}
                      alt="player"
                      onClick={() => onRoleChange(p.role)}
                    />
                    <p>{t(p.role)}</p>
                  </div>
                ))}
            </div>
          </div>
          <div className="flex gap-2">
            {existingPlayers.length ? (
              <div className="flex flex-col gap-2 items-center">
                <p>{t('joined')}</p>
                <div className="flex gap-10 items-center">
                  {players
                    .filter((player) => player.username)
                    .map((p) => (
                      <span key={p.id} className="flex flex-col items-center">
                        <img
                          className="w-20 h-22"
                          src={`/images/${p.role}.png`}
                          alt="player"
                          onClick={() => onRoleChange(p.role)}
                        />
                        <p>{p.username}</p>
                      </span>
                    ))}
                </div>
              </div>
            ) : null}
        </div>
        </div>
      )}
      {showAIOptions && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg text-gray-700">{t('chooseAIOption')}</p>
          <div className="flex gap-4">
            <button
              className="px-4 py-2 bg-gray-400 text-gray-200 rounded cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-200"
              onClick={() => handlePlayWithAI('culprit')}
              disabled
            >
              {t('AIplaysCulprit')}
            </button>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => handlePlayWithAI('detectives')}
            >
              {t('AIplaysDetectives')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChooseRole;
