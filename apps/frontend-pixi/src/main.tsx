import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './app/error-boundary';
import { Game } from './app/game';
import { SetupFlow } from './setup/setup-flow';
import './styles.css';

function SetupRoute() {
  const navigate = useNavigate();
  return (
    <SetupFlow
      onStart={({ channel, role, name, theme }) => {
        const params = new URLSearchParams({ role, name, theme });
        navigate(`/game/${encodeURIComponent(channel)}?${params.toString()}`);
      }}
    />
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element missing');
const root = createRoot(rootEl);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SetupRoute />} />
          <Route path="/game/:channel" element={<Game />} />
          <Route path="*" element={<SetupRoute />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
