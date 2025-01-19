import React from 'react';
import { useRunnerStore } from '../../stores/use-runner-store';
import { useNodesStore } from '../../stores/use-nodes-store';
import { useGameStore } from '../../stores/use-game-store';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';

export const Panel = () => {
  const currentRole = useRunnerStore((state) => state.currentRole);
  const player = useGameStore((state) =>
    state.players.find((p) => p.role === currentRole)
  );

  const players = usePlayersSubscription();
  const runnerPosition = players.find((p) => p.role === currentRole)?.position;

  const node = useNodesStore((state) => state.getNode(runnerPosition || 0));
  const isSecret = useRunnerStore((state) => state.isSecret);
  const isDouble = useRunnerStore((state) => state.isDouble);
  const setIsSecret = useRunnerStore((state) => state.setIsSecret);
  const setIsDouble = useRunnerStore((state) => state.setIsDouble);
  const setCurrentType = useRunnerStore((state) => state.setCurrentType);
  const username = localStorage.getItem('username');

  if (!node) {
    return null;
  }

  const items = [
    {
      icon: '🚖',
      id: 'taxi',
      label: 'Taxi',
      bg: 'bg-yellow-400',
      count: player?.taxiTickets || 0,
    },
    {
      icon: '🚌',
      id: 'bus',
      label: 'Bus',
      bg: 'bg-green-400',
      count: player?.busTickets || 0,
    },
    {
      icon: '🚇',
      id: 'underground',
      label: 'Subway',
      bg: 'bg-red-500',
      count: player?.undergroundTickets || 0,
    },
  ];
  const culpritItems = [
    {
      icon: '🏃',
      id: 'secret',
      label: 'Hidden',
      bg: 'bg-black text-white',
      count: player?.secretTickets || 0,
    },
    {
      icon: '2️⃣',
      id: 'double',
      label: 'Double',
      bg: 'bg-gradient-to-r from-yellow-400 to-red-500',
      count: player?.doubleTickets || 0,
    },
  ];

  const handleCulpritMoveClick = (type: 'secret' | 'double') => {
    if (type === 'secret' && culpritItems[0].count > 0) {
      setCurrentType(undefined);
      setIsSecret(!isSecret);
    } else if (type === 'double' && culpritItems[1].count > 0) {
      setIsDouble(!isDouble);
    }
  };

  return (
    <div className="p-4 max-w-[120px]">

      <div className="flex flex-col gap-2">
          {currentRole ? (
            <div className="flex items-center flex-col gap-4">
              <img
                className="w-10"
                src={`/images/${currentRole}.png`}
                alt="player"
              />
              <p>{username}</p>
            </div>
          ) : (
            <p>Select a player to start</p>
          )}
        </div>

      {items.map((item, index) => {
        const available = item.id && node[item.id as keyof typeof node] && item.count;
        return (
          <div
            key={index}
            className={`flex items-center cursor-pointer justify-between px-4 py-2 rounded-lg mb-3 ${
              available ? item.bg : 'bg-gray-200'
            }`}
            onClick={
              available
                ? () => {
                    useRunnerStore.getState().setCurrentType(item.id as 'taxi');
                  }
                : undefined
            }
          >
            <span className="text-2xl">{item.icon}</span>
            {item.count && <span className="ml-4 text-sm">{item.count}</span>}
          </div>
        );
      })}
      {currentRole === 'culprit' && (
        <div className="flex flex-col gap-3">
          {culpritItems.map((item) => {
            return (
              <div
                key={item.id}
                className={`flex items-center cursor-pointer justify-between px-4 py-2 rounded-lg mb-3 ${
                  item.count > 0 ? item.bg : 'bg-gray-200'
                }`}
                onClick={item.count ? () => handleCulpritMoveClick(item.id as 'secret') : undefined}
              >
                <span className="text-2xl">{item.icon}</span>
                {item.count > 0 && (
                  <span className="ml-4 text-sm">{item.count}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
