import { Header } from './header';
import GameBoard from './map';
import {Panel} from './panel';
import WebSocketClient from './websocket-client';

export function App() {
  return (
    <div className="grid grid-cols-12 gap-4 p-4">
      <div className="col-span-12 mb-4 text-center">
      <Header />
      </div>
      <div className="col-span-1">
        <WebSocketClient />
        <Panel />
      </div>
      <div className="col-span-11">
        <GameBoard />
      </div>
    </div>
  );
}

export default App;
