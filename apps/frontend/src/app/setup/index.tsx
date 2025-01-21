import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameByChannel } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import { AddUsername } from './add-username';
import ChooseRole from './choose-role';
import { Mode } from './mode';
import { Start } from './start';
import { CreateGame } from './create-game';
import { VideoBackground } from './video-background';

const setupWorkflow = [
  'startGame',
  'chooseMode',
  'createGame',
  'addUsername',
  'chooseRole',
  'invitePlayers',
];

export const Setup = () => {
  const { channel: joiningChannel } = useParams();
  useEffect(() => {
    if (channel) {
      setCurrentStep('addUsername');
    }
  }, []);
  const navigate = useNavigate();
  const channel = useGameStore((state) => state.channel);
  const setChannel = useGameStore((state) => state.setChannel);
  const setGame = useGameStore((state) => state.setGame);
  const username = localStorage.getItem('username');
  const [currentStep, setCurrentStep] = useState(setupWorkflow[0]);
  const existingChannel = localStorage.getItem('channel');
  console.log({currentStep});

  const handleContinueGame = async () => {
    if (existingChannel) {
      const [game] = await getGameByChannel(existingChannel);
      if (!game) return;
      // setGame(game);
      setChannel(channel);
      navigate(`/game/${existingChannel}`);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'startGame':
        return (
          <Start
            existingChannel={existingChannel}
            handleContinueGame={handleContinueGame}
            setCurrentStep={setCurrentStep}
          />
        );
      case 'chooseMode':
        return <Mode setCurrentStep={setCurrentStep} />;
      case 'createGame':
        return <CreateGame setCurrentStep={setCurrentStep} />;
      case 'addUsername':
        return <AddUsername setCurrentStep={setCurrentStep} />;
      case 'chooseRole':
        return <ChooseRole setCurrentStep={setCurrentStep} />;
      case 'invitePlayers':
        return (
          <div className="text-center">
            <p className="text-lg text-gray-700">Invite Players</p>
            <button
              className="px-6 py-2 bg-yellow-600 text-black rounded-lg shadow-md hover:bg-red-700 transition duration-300"
              onClick={() => navigate(`/game/${joiningChannel ?? channel}`)}
            >
              Play
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex relative w-full h-full">
      <div className="flex flex-col absolute w-full h-full z-10 p-10 text-white">

      {/* </div>
    <div className="flex flex-col gap-5 items-center justify-center h-screen bg-white"> */}
      <img
        className="w-96 rounded mb-6"
        src="/images/logo.jpg"
        alt="Game Logo"
      />
      {username && <p className="text-lg text-gray-700">Welcome, {username}</p>}
      {renderStep()}
    </div>
    <VideoBackground />
    </div>
  );
};
