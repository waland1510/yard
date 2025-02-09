import { useState } from "react";
import { useTranslation } from "react-i18next";
interface AddUsernameProps {
  setCurrentStep: (step: string) => void;
}

export const AddUsername = ({setCurrentStep}: AddUsernameProps) => {
  const username = localStorage.getItem('username');
  const [value, setValue] = useState(username || '');
  const handleAddUsername = () => {
    localStorage.setItem('username', value);
    setCurrentStep('chooseRole');
  };
  const { t } = useTranslation();
  return (
    <div className="text-center">
    <p className="text-lg text-gray-700">
      {username || value ? t('updateUsername') : t('addUsername')}
    </p>
    <input
      type="text"
      className="px-4 py-2 border border-gray-300 rounded-lg"
      placeholder={t('enterName')}
      defaultValue={value}
      onChange={(e) => {
        setValue(e.target.value);
      }}
    />
    <button
      type="submit"
      className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300 disabled:bg-slate-500 disabled:cursor-not-allowed"
      onClick={handleAddUsername}
      disabled={!value}
    >
      {t('continue')}
    </button>
  </div>
  );
};
