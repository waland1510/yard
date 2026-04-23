import { useDisclosure } from '@chakra-ui/hooks';
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Spinner,
  useToast,
} from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { createIpInfo, getGameByChannel } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import { AddUsername } from './add-username';
import { CinematicBackground } from './cinematic-background';
import ChooseRole from './choose-role';
import { Start } from './start';
import { ThemeSelector } from './theme-selector';

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
          <div className="flex flex-col items-center gap-4">
            <p className="text-white/70 text-sm tracking-widest uppercase">{t('invite')}</p>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={play}
              className="px-8 py-3 rounded-xl font-bold text-sm tracking-widest uppercase text-black"
              style={{
                background: 'linear-gradient(135deg, #c9922a, #a07010)',
                boxShadow: '0 4px 20px rgba(180,130,0,0.4)',
              }}
            >
              {t('copyAndPlay')}
            </motion.button>
          </div>
        );
      default:
        return null;
    }
  };

  const rules = t('rulesContent', { returnObjects: true });

  return (
    <div className="relative w-full min-h-screen flex flex-col items-center justify-center">
      <CinematicBackground />

      {/* Rules button */}
      <motion.button
        onClick={onOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="absolute top-6 right-6 z-20 px-4 py-2 rounded-lg text-sm font-semibold text-white/80 backdrop-blur-sm"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {t('gameRules')}
      </motion.button>

      {/* Main content column */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl px-8 py-12">
        {/* Logo */}
        <motion.img
          src="/images/catch.png"
          alt="Game Logo"
          className="w-72 rounded-lg mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.7))' }}
        />

        {/* Greeting */}
        {username && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-white/50 text-xs tracking-[0.25em] uppercase mb-6"
          >
            {t('hey')} {username.toUpperCase()}
            {city ? ` · ${city}` : ''}
          </motion.p>
        )}

        {/* Theme selector */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <ThemeSelector />
        </motion.div>

        {/* Glass step panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="w-full rounded-2xl p-8 min-h-[200px] flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {renderSteps ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="w-full"
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/70">
              <div className="text-sm tracking-widest uppercase">{t('waitForServer')}</div>
              <Spinner color="white" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Rules drawer */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent bg="#14141e" color="white">
          <DrawerCloseButton color="white" />
          <DrawerHeader borderBottom="1px solid rgba(255,255,255,0.1)">
            {t('gameRules')}
          </DrawerHeader>
          <DrawerBody>
            {Array.isArray(rules) ? (
              <ul className="list-disc pl-4 space-y-2 text-white/80">
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
