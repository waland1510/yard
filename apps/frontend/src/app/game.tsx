import { useEffect, useState } from 'react';
import { Header } from './header';
import { Board } from './board';
import { Panel } from './panel';
import { useGameStore } from '../stores/use-game-store';
// import useWebSocket from './use-websocket';
import { Moves } from './moves';
import { useNavigate, useParams } from 'react-router-dom';
import { Move } from '@yard/shared-utils';
import { useRunnerStore } from '../stores/use-runner-store';

export const Game = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const channel = window.location.pathname.split('/').pop() || '';

  // const { sendMessage } = useWebSocket(channel);
  const setChannel = useGameStore((state) => state.setChannel);
  const players = useGameStore((state) => state.players);
  const username = sessionStorage.getItem('username');
  console.log('players', players.map((player) => player.username));

  useEffect(() => {
    console.log('playersUE', players.map((player) => player.username));
    if (!players.find((player) => player.username === username)) {
      // navigate(`/join/${id}`);
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
