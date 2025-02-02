// import { GameMode } from '@yard/shared-utils';
// import { createGame } from '../../api';
// import { useGameStore } from '../../stores/use-game-store';
// import useWebSocket from '../use-websocket';

// interface ModeProps {
//   setCurrentStep: (step: string) => void;
// }

// export const Mode = ({ setCurrentStep }: ModeProps) => {
//   const { sendMessage } = useWebSocket('');
//   const handleNewGame = async (gameMode: GameMode) => {
//     const { createdGame } = await createGame(gameMode);

//     useGameStore.setState(createdGame);
//     if (createdGame) {
//       setCurrentStep('createGame');
//       sendMessage('startGame', { ch: createdGame.channel });
//     }
//   };
//   return (
//     <div className="text-center">
//       <p className="text-lg text-gray-700">Choose Game Mode</p>
//       <div className="flex justify-center gap-4">
//         <button
//           onClick={() => handleNewGame('easy')}
//           className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
//         >
//           Easy
//         </button>
//         <button
//           onClick={() => handleNewGame('medium')}
//           className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
//         >
//           Medium
//         </button>
//         <button
//           onClick={() => handleNewGame('hard')}
//           className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
//         >
//           Hard
//         </button>
//       </div>
//     </div>
//   );
// };
