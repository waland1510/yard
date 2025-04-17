import React, { useEffect } from 'react';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { useRunnerStore } from '../../stores/use-runner-store';
import { RoleType } from '@yard/shared-utils';
import useWebSocket from '../use-websocket';
import { useGameStore } from '../../stores/use-game-store';
import { updatePlayer } from '../../api';
import { useTranslation } from "react-i18next";
import { Checkbox } from '@chakra-ui/react';

interface ChooseRoleProps {
  setCurrentStep: (step: string) => void;
}

const ChooseRole = ({ setCurrentStep }: ChooseRoleProps) => {
  const players = usePlayersSubscription();
  const channel = useGameStore((state) => state.channel);
  const { sendMessage } = useWebSocket(channel);
  const username = localStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const { t } = useTranslation();

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
  }, []);

  const onRoleChange = async (role: string, isAI: boolean = false) => {
    const player = players.find((p) => p.role === role);
    if (!player) return;
    
    if (!isAI) {
      useRunnerStore.setState({ currentRole: role as RoleType });
      useRunnerStore.setState({
        currentPosition: player.position,
      });
    }
    
    player.username = isAI ? `AI_${role}` : username as string;
    player.isAI = isAI;
    setPlayer(player);
    
    if (!isAI) {
      sendMessage('joinGame', { channel, username, role: player.role });
      await updatePlayer(player.id, { 
        username: username as string,
        isAI: false 
      });
    } else {
      await updatePlayer(player.id, { 
        username: `AI_${role}`,
        isAI: true 
      });
    }

    // If this is the first player being selected, move to the next step
    if (players.filter(p => p.username).length === 0) {
      setCurrentStep('invitePlayers');
    }
  };

  const existingPlayers = players.filter((p) => p.username);

  return (
    <div className="text-center">
      {players && (
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
                    <Checkbox
                      colorScheme="green"
                      onChange={(e) => onRoleChange(p.role, e.target.checked)}
                    >
                      {t('ai')}
                    </Checkbox>
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
                        />
                        <p>{p.username}</p>
                        {p.isAI && <p className="text-sm text-gray-500">(AI)</p>}
                      </span>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChooseRole;
