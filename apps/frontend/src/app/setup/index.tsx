import { Card, Spinner, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameByChannel } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import { AddUsername } from './add-username';
import ChooseRole from './choose-role';
import { Start } from './start';
import { VideoBackground } from './video-background';
import { useTranslation } from 'react-i18next';
import { createIpInfo } from '../../api';
import {
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Button,
} from '@chakra-ui/react';
import { useDisclosure } from '@chakra-ui/hooks';

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
  const [city, setCity] = useState<string | null>(null);
  const { t } = useTranslation();
  const username = localStorage.getItem('username');
  const existingChannel = localStorage.getItem('channel');
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

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
    const fetchLocation = async () => {
      try {
        const response = await fetch(
          `https://ipinfo.io/json?token=${import.meta.env.VITE_IPINFO_TOKEN}`
        );
        const { loc, ...rest } = await response.json();
        setCity(rest.city);
        await createIpInfo({
          username,
          loc: loc.split(',').map(Number),
          ...rest,
        });
      } catch (error) {
        console.error('Error fetching location', error);
      }
    };
    fetchLocation();
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
  const rules = t('rulesContent', { returnObjects: true });
  return (
    <div className="flex relative w-full h-full">
      <div className="flex flex-col absolute w-full h-[100vh] z-10 p-10 items-start justify-start text-black">
        <Button
          className="absolute top-0 right-0 ml-auto bg-[#ACD8AF]"
          onClick={onOpen}
        >
          {t('gameRules')}
        </Button>
        <img
          className="w-96 rounded"
          src="/images/catch.png"
          alt="Game Logo"
        />
        <Card
          style={{ backgroundColor: 'inherit' }}
          className="w-full h-[300px] px-6 justify-center"
        >
          {username && (
            <p className="text-lg text-gray-700 text-center">
              {t('hey')} {username.toUpperCase()}
              {city ? ` ${t('from', { city })}` : ''}
            </p>
          )}
          {renderSteps ? (
            renderStep()
          ) : (
            <div className="text-center">
              <div>{t('waitForServer')}</div>
              <Spinner />
            </div>
          )}
        </Card>
      </div>
      <VideoBackground />
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader bg="#ACD8AF">{t('gameRules')}</DrawerHeader>
          <DrawerBody bg="#ACD8AF">
            {Array.isArray(rules) ? (
              <ul className="list-disc pl-4">
                {rules.map((rule, index) => (
                  <li key={index}>{rule}</li>
                ))}
              </ul>
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
