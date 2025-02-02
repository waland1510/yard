import { Card } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameByChannel } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import { AddUsername } from './add-username';
import ChooseRole from './choose-role';
import { Start } from './start';
import { VideoBackground } from './video-background';

const setupWorkflow = [
  'startGame',
  'createGame',
  'addUsername',
  'chooseRole',
  'invitePlayers',
];

export const Setup = () => {
  const { channel: joiningChannel } = useParams();
  const navigate = useNavigate();
  const { channel, setChannel } = useGameStore();
  const [currentStep, setCurrentStep] = useState(setupWorkflow[0]);

  const username = localStorage.getItem('username');
  const existingChannel = localStorage.getItem('channel');

  useEffect(() => {
    (async () => {
      if (channel) {
        const game = getGameByChannel(channel);
        if ((await game).status === 'finished') {
          setCurrentStep('startGame');

        }
        setCurrentStep('addUsername');
      }
    })();
  }, []);

  const handleContinueGame = async () => {
    if (existingChannel) {
      const game = await getGameByChannel(existingChannel);
      if (!game) return;
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
              onClick={play}
            >
              Copy Link and Play
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const play = () => {
    navigate(`/game/${joiningChannel ?? channel}`);
    navigator.clipboard.writeText(`${window.location.origin}/game/${channel}`);
  };

  return (
    <div className="flex relative w-full h-full">
      <div className="flex flex-col absolute w-full h-full z-10 p-10 items-start justify-start text-black">
        <img
          className="w-96 rounded mb-6"
          src="/images/catch.png"
          alt="Game Logo"
        />
        <Card
          style={{ backgroundColor: 'inherit' }}
          className="w-[900px] h-[300px] p-6"
        >
          {username && (
            <p className="text-lg text-gray-700 text-center">
              Hey {username.toUpperCase()}
            </p>
          )}
          {renderStep()}
        </Card>
      </div>
      <VideoBackground />
    </div>
  );
};
