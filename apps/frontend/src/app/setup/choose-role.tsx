import React, { useEffect } from 'react';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { useRunnerStore } from '../../stores/use-runner-store';
import { RoleType } from '@yard/shared-utils';
import useWebSocket from '../use-websocket';
import { useGameStore } from '../../stores/use-game-store';
import { patchPlayer } from '../../api';
import { PlayerInfo } from '../game/player-info';

interface ChooseRoleProps {
  setCurrentStep: (step: string) => void;
}

const ChooseRole = ({ setCurrentStep }: ChooseRoleProps) => {
  const players = usePlayersSubscription();
  const channel = useGameStore((state) => state.channel);
  const { sendMessage } = useWebSocket(channel);
  const username = localStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);

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

  const onRoleChange = async (role: string) => {
    const player = players.find((p) => p.role === role);
    if (!player) return;
    useRunnerStore.setState({ currentRole: role as RoleType });
    useRunnerStore.setState({
      currentPosition: player.position,
    });
    sendMessage('joinGame', { channel, username, currentRole });
    await patchPlayer(player.id, { username: username as string });
    setCurrentStep('invitePlayers');
  };
  return (
    <div className="text-center">
      <p className="text-lg text-gray-700">Choose Your Role</p>
      {players && (
        <div className="flex gap-2 ">
          {players
            .filter((player) => !player.username)
            .map((p) => (
              <span key={p.id} className="flex flex-col items-center">
                <img
                  className="w-10 h-12"
                  src={`/images/${p.role}.png`}
                  alt="player"
                  onClick={() => onRoleChange(p.role)}
                />
                <p>{p.role.toUpperCase()}</p>
              </span>
            ))}
          <p>Existing players</p>
          {players
            .filter((player) => player.username)
            .map((p) => (
              <PlayerInfo
                key={p.id}
                player={p}
                currentRole={currentRole}
                onRoleChange={onRoleChange}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default ChooseRole;
