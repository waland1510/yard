import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import GameUIWithDrawers from './chakra';
import { Game } from './game';
import { Setup } from './setup';

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Setup />} />
        <Route path="/join/:channel" element={<Setup />} />
        <Route path="/game/:id" element={<Game />} />
        <Route path="/chakra" element={<GameUIWithDrawers />} />
      </Routes>
    </Router>
  );
}

export default App;
