import React, { Fragment } from 'react';
import { useRunnerStore } from '../../stores/use-runner-store';
import { useNodesStore } from '../../stores/use-nodes-store';
import { useGameStore } from '../../stores/use-game-store';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { BusIcon } from './icons/bus-icon';
import { TaxiIcon } from './icons/taxi-icon';
import { UndergroundIcon } from './icons/underground-icon';
import { SecretIcon } from './icons/secret-icon';
import { DoubleIcon } from './icons/double-icon';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const players = usePlayersSubscription();
  const runnerPosition = players.find((p) => p.role === currentRole)?.position;
  const node = useNodesStore((state) => state.getNode(runnerPosition || 0));
  const username = localStorage.getItem('username');

  if (!node) return null;

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
      disabled: !node.taxi?.length || !player?.taxiTickets,
    },
    {
      icon: (
        <BusIcon available={Boolean(node.bus?.length && player?.busTickets)} />
      ),
      id: 'bus',
      label: 'Bus',
      count: player?.busTickets || 0,
      disabled: !node.bus?.length || !player?.busTickets,
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
      disabled: !node.underground?.length || !player?.undergroundTickets,
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
      setIsSecret(!isSecret);
    } else if (type === 'double' && culpritItems[1].count > 0) {
      setIsDouble(!isDouble);
    }
  };

  return (
    <div className="w-[120px] flex flex-col bg-[#ACD8AF] rounded-lg text-slate-900 shadow-lg">
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center">
          <p className="text-xl font-semibold py-0">{t('hey')}, </p>
          <p className="text-xl font-semibold py-0">
            {username?.slice(0, 10)}!
          </p>
        </div>
        <img
          className="w-10 h-12 rounded-full"
          src={`/images/${currentRole}.png`}
          alt="player"
        />
      </div>
      <div className="flex flex-col gap-2 mt-4 text-center">
        {currentRole === 'culprit' && (
          <div className="flex flex-col gap-2 text-center">
            {culpritItems.map((item) => (
              <Fragment key={item.id}>
                <button
                  className="flex items-center justify-center rounded-md transition-transform transform active:scale-90 disabled:scale-100 disabled:pointer-events-none"
                  onClick={
                    item.count
                      ? () => handleCulpritMoveClick(item.id as 'secret')
                      : undefined
                  }
                >
                  <div className="text-2xl">{item.icon}</div>
                </button>
                <div className="text-lg font-medium">{item.count}</div>
              </Fragment>
            ))}
          </div>
        )}
        {items.map((item) => (
          <Fragment key={item.id}>
            <button
              className="flex items-center justify-center rounded-md transition-transform transform active:scale-90 disabled:scale-100 disabled:pointer-events-none"
              onClick={
                item.count ? () => setCurrentType(item.id as 'taxi') : undefined
              }
              disabled={item.disabled}
            >
              <span className="text-2xl">{item.icon}</span>
            </button>
            <div className="text-lg font-medium">{item.count}</div>
          </Fragment>
        ))}
      </div>
    </div>
  );
};
