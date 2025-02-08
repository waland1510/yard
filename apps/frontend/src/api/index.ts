import { GameState, IpInfo, Move, Player } from '@yard/shared-utils';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,

  headers: {
    'Content-Type': 'application/json',
  },
});

export const createGame = async () => {
  try {
    const response = await api.post('/api/games');
    return response.data;
  } catch (error) {
    console.error('Error creating game:', error);
    throw error;
  }
};

export const getGameByChannel = async (
  channel: string,
  signal?: AbortSignal
): Promise<GameState> => {
  try {
    const response = await api.get(`/api/games/${channel}`, { signal });
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
    const response = await api.patch(`/api/games/${gameId}`, gameData);
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

export const updatePlayer = async (
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

export const addMove = async (moveData: Move) => {
  try {
    const response = await api.post('/api/moves', moveData);
    return response.data;
  } catch (error) {
    console.error('Error adding move:', error);
    throw error;
  }
};

export const createIpInfo = async (ipInfo: IpInfo ) => {
  try {
    const response = await api.post('/api/ip-info', ipInfo);
    return response.data;
  } catch (error) {
    console.error('Error creating ip info:', error);
    throw error;
  }
};

