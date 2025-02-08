import { Card, Spinner, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameByChannel } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import { AddUsername } from './add-username';
import ChooseRole from './choose-role';
import { Start } from './start';
import { VideoBackground } from './video-background';
import { useTranslation } from "react-i18next";

const setupWorkflow = [
  'startGame',
  'createGame',
  'addUsername',
  'chooseRole',
  'invitePlayers',
];

interface SetupProps {
  renderSteps?: boolean;
}

export const Setup = ({ renderSteps = true }: SetupProps) => {
  const { channel: joiningChannel } = useParams();
  const navigate = useNavigate();
  const { channel, setChannel } = useGameStore();
  const [currentStep, setCurrentStep] = useState(setupWorkflow[0]);
  const { t } = useTranslation();
  const username = localStorage.getItem('username');
  const existingChannel = localStorage.getItem('channel');
  const  toast = useToast();

  useEffect(() => {
    (async () => {
      if (joiningChannel) {
        setCurrentStep('addUsername');
      }
      if (channel) {
        const game = getGameByChannel(channel);
        if ((await game).status === 'finished') {
          setCurrentStep('startGame');
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <p className="text-lg text-gray-700">{t('invite')}</p>
            <button
              className="px-6 py-2 bg-yellow-600 text-black rounded-lg shadow-md hover:bg-red-700 transition duration-300"
              onClick={play}
            >
              {t('copyAndPlay')}
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
    toast({
      title: t('linkCopied'),
      description: t('shareLink'),
      status: 'success',
      duration: 10000,
      isClosable: true,
    });
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
          className="w-full h-[300px] p-6 justify-center"
        >
          {username && (
            <p className="text-lg text-gray-700 text-center">
              {t('hey')} {username.toUpperCase()}
            </p>
          )}
          {renderSteps ? (
            renderStep()
          ) : (
            <div className="text-center">
              <div>
               {t('waitForServer')}
              </div>
              <Spinner />
            </div>
          )}
        </Card>
      </div>
      <VideoBackground />
    </div>
  );
};
