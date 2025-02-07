import { useTranslation } from "react-i18next";
interface AddUsernameProps {
  setCurrentStep: (step: string) => void;
}

export const AddUsername = ({setCurrentStep}: AddUsernameProps) => {
  const username = localStorage.getItem('username');
  const handleAddUsername = () => {
    setCurrentStep('chooseRole');
  };
  const { t } = useTranslation();
  return (
    <div className="text-center">
    <p className="text-lg text-gray-700">
      {username ? t('updateUsername') : t('addUsername')}
    </p>
    <input
      type="text"
      className="px-4 py-2 border border-gray-300 rounded-lg"
      placeholder="Enter your username"
      defaultValue={username || ''}
      onChange={(e) => {
        localStorage.setItem('username', e.target.value);
      }}
    />
    <button
      type="submit"
      className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300"
      onClick={handleAddUsername}
    >
      {t('continue')}
    </button>
  </div>
  );
};
