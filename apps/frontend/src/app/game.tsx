import { useEffect } from 'react';
import { Header } from './header';
import { Board } from './board';
import { Panel } from './panel';
import { useGameStore } from '../stores/use-game-store';
// import useWebSocket from './use-websocket';
import { Moves } from './moves';
import { useNavigate, useParams } from 'react-router-dom';

export const Game = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const channel = window.location.pathname.split('/').pop() || '';
  // const { sendMessage } = useWebSocket(channel);
  const setChannel = useGameStore((state) => state.setChannel);
  const username = localStorage.getItem('username');
  useEffect(() => {
    if (!username) {
      navigate(`/join/${id}`);
    }
  }, []);

  useEffect(() => {
    setChannel(channel);

    // sendMessage('updateGameState', game);

    useGameStore.setState({ channel });
  }, [channel, setChannel]);

  return (
    <div className="grid grid-cols-12 gap-4 p-4">
      <div className="col-span-12 mb-4 text-center">
        <Header />
      </div>
      <div className="col-span-1">
        <Panel />
      </div>
      <div className="col-span-10">
        <Board channel={channel} />
      </div>
      <div className="col-span-1">
        <Moves />
      </div>
    </div>
  );
};
