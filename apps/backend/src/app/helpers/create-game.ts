import { easyPositions, GameMode, GameState, hardPositions, initialPlayers, mediumPositions, Player } from "@yard/shared-utils";


export function createGame(gameMode: GameMode): GameState {
  const startingPositions = getStartingPositions(gameMode);
  const channel = Math.random().toString(36).substring(7);

  return {
    channel,
    gameMode,
    players: initialPlayers.map((player) => ({
      ...player,
      position: startingPositions[player.role],
    })),
    currentTurn: 'culprit',
    moves: [],
    movesCount: 0,
    isDoubleMove: false,
    status: 'active'
  };
}

function getStartingPositions(gameMode: GameMode) {
  switch (gameMode) {
    case 'easy':
      return easyPositions[
        Math.floor(Math.random() * easyPositions.length)
      ];
    case 'medium':
      return mediumPositions[
        Math.floor(Math.random() * mediumPositions.length)
      ];
    case 'hard':
      return hardPositions[
        Math.floor(Math.random() * hardPositions.length)
      ];
    default:
      return easyPositions[
        Math.floor(Math.random() * easyPositions.length)
      ];
  }
}
