import { useDisclosure } from '@chakra-ui/hooks';
import {
  Box, Card, Drawer,
  DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader,
  DrawerOverlay, Spinner, useToast, Button, HStack
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { createIpInfo, getGameByChannel } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import { AddUsername } from './add-username';
import ChooseRole from './choose-role';
import { Start } from './start';
import { VideoBackground } from './video-background';
import { CORSTest } from '../../components/cors-test';

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
  const [showCORSTest, setShowCORSTest] = useState(false);

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
        <Box
          as='button'
          bg="#ACD8AF"
          color="black"
          borderRadius="lg"
          px={4}
          py={2}
          boxShadow="md"
          _hover={{ bg: '#8CC690' }}
          transition="background-color 0.3s"
          className='absolute top-0 right-0 ml-auto mr-10 mt-10'
          onClick={onOpen}
        >
          {t('gameRules')}
        </Box>
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

        {/* CORS Test Button - only show in development or if there are connection issues */}
        {(process.env.NODE_ENV === 'development' || window.location.hostname.includes('vercel')) && (
          <Box position="fixed" bottom={4} right={4} zIndex={1000}>
            <Button
              size="sm"
              colorScheme="blue"
              variant="outline"
              onClick={() => setShowCORSTest(true)}
            >
              Test API Connection
            </Button>
          </Box>
        )}
      </div>
      <VideoBackground />

      {/* CORS Test Modal */}
      <Drawer isOpen={showCORSTest} placement="right" onClose={() => setShowCORSTest(false)} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>API Connection Test</DrawerHeader>
          <DrawerBody>
            <CORSTest />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

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
