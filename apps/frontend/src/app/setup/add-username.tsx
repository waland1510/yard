import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AddUsernameProps {
  setCurrentStep: (step: string) => void;
}

export const AddUsername = ({ setCurrentStep }: AddUsernameProps) => {
  const username = localStorage.getItem('username');
  const [value, setValue] = useState(username || '');
  const { t } = useTranslation();

  const handleAddUsername = () => {
    localStorage.setItem('username', value);
    setCurrentStep('chooseRole');
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <p className="text-white/60 text-xs tracking-[0.25em] uppercase">
        {username || value ? t('updateUsername') : t('addUsername')}
      </p>
      <input
        type="text"
        className="w-full max-w-xs px-5 py-3 rounded-xl text-white text-center text-lg font-medium tracking-wide focus:outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
        placeholder={t('enterName')}
        defaultValue={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value) handleAddUsername();
        }}
      />
      <motion.button
        onClick={handleAddUsername}
        disabled={!value}
        whileHover={value ? { scale: 1.05, y: -2 } : {}}
        whileTap={value ? { scale: 0.96 } : {}}
        className="px-8 py-3 rounded-xl font-bold text-sm tracking-widest uppercase text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        style={{
          background: 'linear-gradient(135deg, #2a6a3a, #1a4a24)',
          boxShadow: '0 4px 20px rgba(40,120,60,0.4)',
        }}
      >
        {t('continue')}
      </motion.button>
    </div>
  );
};
