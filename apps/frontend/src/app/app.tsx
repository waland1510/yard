import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Game } from './game';
import { Setup } from './setup';
import ErrorBoundary from './error-boundary';

export function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/join/:channel" element={<Setup />} />
          <Route path="/game/:id" element={<Game />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
