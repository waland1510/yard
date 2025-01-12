import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useGameStore } from '../stores/use-game-store';
import {
  easyPositions,
  hardPositions,
  mediumPositions,
} from './starting-positions';
import useWebSocket from './use-websocket';
import { useRunnerStore } from '../stores/use-runner-store';
import { send } from 'process';
import { GameMode, RoleType } from '@yard/shared-utils';

export const Setup = () => {
  const { channel } = useParams();

  useEffect(() => {
    if (channel) {
      setCurrentStep('addUsername');
    }
  }, []);

  const channelRef = useRef<string | undefined>(
    Math.random().toString(36).substring(7)
  );
  const existingChannel = sessionStorage.getItem('channel');
  const navigate = useNavigate();
  const setGameMode = useGameStore((state) => state.setGameMode);
  const setPosition = useGameStore((state) => state.setPosition);
  const setChannel = useGameStore((state) => state.setChannel);
  const players = useGameStore((state) => state.players);
  const username = sessionStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);
  const [newGame, setNewGame] = useState(false);

  const { sendMessage } = useWebSocket(channelRef.current);
  const handleNewGame = async (gameMode: GameMode) => {
    setCurrentStep('addUsername');
    setChannel(channelRef.current);
    if (channelRef.current) {
      sendMessage('startGame', { ch: channelRef.current });
      useGameStore.setState({ channel: channelRef.current });
      const startingPositions = (() => {
        switch (gameMode) {
          case 'easy':
            setGameMode('easy');
            return easyPositions[
              Math.floor(Math.random() * easyPositions.length)
            ];
          case 'medium':
            setGameMode('medium');
            return mediumPositions[
              Math.floor(Math.random() * mediumPositions.length)
            ];
          case 'hard':
            setGameMode('hard');
            return hardPositions[
              Math.floor(Math.random() * hardPositions.length)
            ];
          default:
            return easyPositions[
              Math.floor(Math.random() * easyPositions.length)
            ];
        }
      })();
      if (!startingPositions) return;
      // await Promise.all(
      //   Object.entries(startingPositions).map(([role, position]) =>
      //     setPosition(role, position)
      //   )
      // );
      Object.entries(startingPositions).forEach(([role, position]) =>
        setPosition(role, position)
      );
      sendMessage('updateGameState', useGameStore.getState());
    }
  };

  const handleContinueGame = () => {
    if (channel) {
      setChannel(channel);
      console.log({ channel, username });
      navigate(`/game/${channel}`);
      return;
    }
    navigate(`/game/${channelRef.current}`);
  };

  const handleAddUsername = () => {
    setCurrentStep('chooseRole');
  };

  const onRoleChange = (role: string) => {
    useRunnerStore.setState({ currentRole: role as RoleType });
    useRunnerStore.setState({
      currentPosition: players.find((p) => p.role === role)?.position,
    });
    sendMessage('joinGame', { channel, username, currentRole });
    setCurrentStep('invitePlayers');
  };

  const setupWorkflow = [
    'startGame',
    'chooseMode',
    'addUsername',
    'chooseRole',
    'invitePlayers',
  ];
  const [currentStep, setCurrentStep] = useState(setupWorkflow[0]);

  const renderStep = () => {
    switch (currentStep) {
      case 'startGame':
        return (
          <div className="text-center">
            <p className="text-lg text-gray-700">
              {existingChannel ? 'Welcome back!' : 'Welcome to the Game'}
            </p>
            {existingChannel && (
              <button
                className="px-6 py-2 bg-yellow-600 text-black rounded-lg shadow-md hover:bg-red-700 transition duration-300"
                onClick={handleContinueGame}
              >
                Continue Existing Game
              </button>
            )}
            <button
              className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300"
              onClick={() => {
                setNewGame(true);
                setCurrentStep('chooseMode');
                sessionStorage.setItem('channel', channelRef.current!); 
              }}
            >
              Start New Game
            </button>
          </div>
        );
      case 'chooseMode':
        return (
          <div className="text-center">
            <p className="text-lg text-gray-700">Choose Game Mode</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleNewGame('easy')}
                className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
              >
                Easy
              </button>
              <button
                onClick={() => handleNewGame('medium')}
                className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
              >
                Medium
              </button>
              <button
                onClick={() => handleNewGame('hard')}
                className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
              >
                Hard
              </button>
            </div>
          </div>
        );
      case 'addUsername':
        return (
          <div className="text-center">
            <p className="text-lg text-gray-700">{username ? 'Update Username' : 'Add Username'}</p>
            <input
              type="text"
              className="px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Enter your username"
              defaultValue={username || ''}
              onChange={(e) => {
                sessionStorage.setItem('username', e.target.value);
              }}
            />
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300"
              onClick={handleAddUsername}
            >
              Continue
            </button>
          </div>
        );
      case 'chooseRole':
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
                {players.filter((player) => player.username).map((p) => (
                  <span key={p.id}>
                    <img
                      className="w-10 h-12"
                      src={`/images/${p.role}.png`}
                      alt="player"
                    />
                    <p>{p.position}</p>
                    <p>{p.username}</p>
                  </span>
                ))}
              </div>

            )}
          </div>
        );
      case 'invitePlayers':
        return (
          <div className="text-center">
            <p className="text-lg text-gray-700">Invite Players</p>
            <button
              className="px-6 py-2 bg-yellow-600 text-black rounded-lg shadow-md hover:bg-red-700 transition duration-300"
              onClick={handleContinueGame}
            >
              Copy this link
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-5 items-center justify-center h-screen bg-white">
      <img
        className="w-96 rounded mb-6"
        src="/images/logo.jpg"
        alt="Game Logo"
      />
      {username && <p className="text-lg text-gray-700">Welcome, {username}</p>}
      {/* <div className="text-center">
        <p className="text-lg text-gray-700">
          {existingChannel ? 'Welcome back!' : 'Welcome to the Game'}
        </p>
      </div>
      {existingChannel && (
        <button
          className="px-6 py-2 bg-yellow-600 text-black rounded-lg shadow-md hover:bg-red-700 transition duration-300"
          onClick={handleContinueGame}
        >
          Continue Existing Game
        </button>
      )} */}
      {renderStep()}
    </div>
  );
};
