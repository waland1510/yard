import { useGameStore } from '../../stores/use-game-store';
import { themes } from '../themes';

export const ThemeSelector = () => {
  const { theme, setTheme } = useGameStore();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="theme-selector">Theme:</label>
      <select
        id="theme-selector"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="p-2 border rounded"
      >
        {Object.keys(themes).map((themeKey) => (
          <option key={themeKey} value={themeKey}>
            {themes[themeKey].name}
          </option>
        ))}
      </select>
    </div>
  );
};
