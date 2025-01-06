import { useEffect } from 'react';
import { Header } from './header';
import { Board } from './board';
import { Panel } from './panel';
import { useGameStore } from '../stores/use-game-store';

import useWebSocket from './use-websocket';

export const Game = () => {
  const channel = window.location.pathname.split('/').pop() || '';
  console.log('channel Game', channel);
  
  const { sendMessage } = useWebSocket(channel);
  const setChannel = useGameStore((state) => state.setChannel);

  useEffect(() => {
    setChannel(channel);
    // sendMessage('updateGameState', game);

    useGameStore.setState({ channel });
  }, [channel]);

  return (
    <div className="grid grid-cols-12 gap-4 p-4">
      <div className="col-span-12 mb-4 text-center">
        <Header />
      </div>
      <div className="col-span-1">
        <Panel />
      </div>
      <div className="col-span-11">
        <Board channel={channel}/>
      </div>
    </div>
  );
};
