import React from 'react';
import { useRunnerStore } from '../../stores/use-runner-store';
import { useNodesStore } from '../../stores/use-nodes-store';
import { useGameStore } from '../../stores/use-game-store';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { BusIcon } from './icons/bus-icon';
import { TaxiIcon } from './icons/taxi-icon';
import { UndergroundIcon } from './icons/underground-icon';
import { SecretIcon } from './icons/secret-icon';
import { DoubleIcon } from './icons/double-icon';

export const Panel = () => {
  const {
    isSecret,
    isDouble,
    setIsSecret,
    setIsDouble,
    setCurrentType,
    currentRole,
  } = useRunnerStore();
  const player = useGameStore((state) =>
    state.players.find((p) => p.role === currentRole)
  );

  const players = usePlayersSubscription();
  const runnerPosition = players.find((p) => p.role === currentRole)?.position;

  const node = useNodesStore((state) => state.getNode(runnerPosition || 0));
  const username = localStorage.getItem('username');

  if (!node) {
    return null;
  }

  const items = [
    {
      icon: (
        <TaxiIcon
          available={Boolean(node.taxi?.length && player?.taxiTickets)}
        />
      ),
      id: 'taxi',
      label: 'Taxi',
      count: player?.taxiTickets || 0,
    },
    {
      icon: (
        <BusIcon available={Boolean(node.bus?.length && player?.busTickets)} />
      ),
      id: 'bus',
      label: 'Bus',
      count: player?.busTickets || 0,
    },
    {
      icon: (
        <UndergroundIcon
          available={Boolean(
            node.underground?.length && player?.undergroundTickets
          )}
        />
      ),
      id: 'underground',
      label: 'Subway',
      count: player?.undergroundTickets || 0,
    },
  ];
  const culpritItems = [
    {
      icon: <SecretIcon available={Boolean(player?.secretTickets)} />,
      id: 'secret',
      label: 'Hidden',
      count: player?.secretTickets || 0,
    },
    {
      icon: <DoubleIcon available={Boolean(player?.doubleTickets)} />,
      id: 'double',
      label: 'Double',
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
    <div className="max-w-[120px]">
      <div className="flex items-center flex-col pb-4">
        <p>{username}</p>
        <img className="w-10" src={`/images/${currentRole}.png`} alt="player" />
        <p>{currentRole}</p>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, index) => {
          const available =
            item.id && node[item.id as keyof typeof node] && item.count;
          return (
            <div
              key={index}
              className="flex items-center cursor-pointer flex-col gap-2"
              onClick={
                available
                  ? () => {
                      setCurrentType(item.id as 'taxi');
                    }
                  : undefined
              }
            >
              <span className="text-2xl">{item.icon}</span>
              {item.count && <span className="text-lg">{item.count}</span>}
            </div>
          );
        })}
      </div>
      {currentRole === 'culprit' && (
        <div className="flex flex-col gap-3">
          {culpritItems.map((item) => {
            return (
              <div
                key={item.id}
                className="flex items-center cursor-pointer flex-col gap-2"
                onClick={
                  item.count
                    ? () => handleCulpritMoveClick(item.id as 'secret')
                    : undefined
                }
              >
                <span className="text-2xl">{item.icon}</span>
                {item.count > 0 && (
                  <span className="text-lg">{item.count}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
