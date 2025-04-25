import { GameState, initialPlayers } from "@yard/shared-utils";

export interface CreateGameOptions {
  aiRoles?: string[];
}

export function createGameState(): GameState {
  const startingPositions = getStartingPositions();
  const channel = Math.random().toString(36).substring(7);

  return {
    channel,
    players: initialPlayers.map((player) => ({
      ...player,
      position: startingPositions[player.role],
      previousPosition: startingPositions[player.role],
      isAI: false
    })),
    currentTurn: 'culprit',
    moves: [],
    isDoubleMove: false,
    status: 'active'
  };
}

interface StartingPositions {
  culprit: number;
  detective1: number;
  detective2: number;
  detective3: number;
  detective4: number;
  detective5: number;
}

const getStartingPositions = (): StartingPositions => {
  const possiblePositions = [13, 26, 29, 34, 50, 53, 91, 94, 103, 112, 117, 132, 138, 141, 155, 174, 197, 198];
  const shuffled = [...possiblePositions].sort(() => Math.random() - 0.5);

  return {
    culprit: shuffled[0],
    detective1: shuffled[1],
    detective2: shuffled[2],
    detective3: shuffled[3],
    detective4: shuffled[4],
    detective5: shuffled[5]
  };
};

export { getStartingPositions };
