import React, { useEffect } from 'react';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { useRunnerStore } from '../../stores/use-runner-store';
import { RoleType } from '@yard/shared-utils';
import useWebSocket from '../use-websocket';
import { useGameStore } from '../../stores/use-game-store';
import { updatePlayer } from '../../api';

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

  const onRoleChange = async (role: string) => {
    const player = players.find((p) => p.role === role);
    if (!player) return;
    useRunnerStore.setState({ currentRole: role as RoleType });
    useRunnerStore.setState({
      currentPosition: player.position,
    });
    player.username = username as string;
    setPlayer(player);
    sendMessage('joinGame', { channel, username, currentRole });
    await updatePlayer(player.id, { username: username as string });
    setCurrentStep('invitePlayers');
  };
  const existingPlayers = players.filter((p) => p.username);

  return (
    <div className="text-center">
      {players && (
        <div className="flex justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-lg text-gray-700">Choose Your Role</p>
            <div className="flex gap-2 items-center">
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
            </div>
          </div>
          <div className="flex gap-2">
            {existingPlayers.length ? (
              <div className="flex flex-col gap-2 items-center">
                <p>Already joined</p>
                <div className="flex gap-2 items-center">
                  {players
                    .filter((player) => player.username)
                    .map((p) => (
                      <span key={p.id} className="flex flex-col items-center">
                        <img
                          className="w-10 h-12"
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
    </div>
  );
};

export default ChooseRole;
