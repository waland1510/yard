import { GameState, Player } from '@yard/shared-utils';
import axios from 'axios';

const api = axios.create({
  baseURL:
    // process.env.NODE_ENV === 'production'? 
    'https://yard-1.onrender.com/',

    //   : 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json', // Ensures that the body is sent as JSON
  },
});

export const createGame = async (gameData: GameState) => {
  try {
    const response = await api.post('/api/games', gameData);
    return response.data;
  } catch (error) {
    console.error('Error creating game:', error);
    throw error;
  }
};

export const getGameByChannel = async (
  channel: string
): Promise<GameState[]> => {
  try {
    const response = await api.get(`/api/games/${channel}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching game with ID ${channel}:`, error);
    throw error;
  }
};

export const updateGame = async (
  gameId: number,
  gameData: Partial<GameState>
) => {
  try {
    const response = await api.put(`/api/games/${gameId}`, gameData);
    return response.data;
  } catch (error) {
    console.error(`Error updating game with ID ${gameId}:`, error);
    throw error;
  }
};

export const createPlayer = async (playerData: Player) => {
  try {
    const response = await api.post('/api/players', playerData);
    return response.data;
  } catch (error) {
    console.error('Error creating player:', error);
    throw error;
  }
};

export const patchPlayer = async (
  playerId: number,
  playerData: Partial<Player>
) => {
  try {
    const response = await api.patch(`/api/players/${playerId}`, playerData);
    return response.data;
  } catch (error) {
    console.error(`Error patching player with ID ${playerId}:`, error);
    throw error;
  }
};

export const addMove = async (moveData: {
  gameId: number;
  role: string;
  move_type: string;
  isSecret: boolean;
  isDouble: boolean;
  position: number;
}) => {
  try {
    const response = await api.post('/api/moves', moveData);
    return response.data;
  } catch (error) {
    console.error('Error adding move:', error);
    throw error;
  }
};
