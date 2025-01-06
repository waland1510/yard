import { Game } from './game';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Setup } from './setup';

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Setup />} />
        <Route path="/game/:id" element={<Game />} />
      </Routes>
    </Router>
  );
}

export default App;
