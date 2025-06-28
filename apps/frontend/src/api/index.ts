import { GameState, IpInfo, Move, Player } from '@yard/shared-utils';
import axios from 'axios';
import { API_URL, ENABLE_DEBUG } from '../config/environment';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include credentials for CORS
});

// Request interceptor for debugging
if (ENABLE_DEBUG) {
  api.interceptors.request.use(
    (config) => {
      console.log('🚀 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
      });
      return config;
    },
    (error) => {
      console.error('❌ API Request Error:', error);
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => {
      console.log('✅ API Response:', {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
      return response;
    },
    (error) => {
      console.error('❌ API Response Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        message: error.message,
        data: error.response?.data,
      });
      return Promise.reject(error);
    }
  );
}

const handleApiError = (error: unknown, context: string) => {
  console.error(`${context}:`, error);

  // Customize error messages for user feedback
  const userMessage =
    error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again later.';

  // Optionally, log the error to an external service here

  throw new Error(userMessage);
};

export const createGame = async () => {
  try {
    const response = await api.post('/api/games');
    return response.data;
  } catch (error) {
    handleApiError(error, 'Error creating game');
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
    handleApiError(error, `Error fetching game with ID ${channel}`);
  }
  throw new Error('Failed to fetch game state'); // Ensure a return or throw in all paths
};

export const updateGame = async (
  gameId: number,
  gameData: Partial<GameState>
) => {
  try {
    const response = await api.patch(`/api/games/${gameId}`, gameData);
    return response.data;
  } catch (error) {
    handleApiError(error, `Error updating game with ID ${gameId}`);
  }
};

export const createPlayer = async (playerData: Player) => {
  try {
    const response = await api.post('/api/players', playerData);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Error creating player');
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
    handleApiError(error, `Error patching player with ID ${playerId}`);
  }
};

export const addMove = async (moveData: Move) => {
  try {
    const response = await api.post('/api/moves', moveData);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Error adding move');
  }
};

export const createIpInfo = async (ipInfo: IpInfo) => {
  try {
    const response = await api.post('/api/ip-info', ipInfo);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Error creating IP info');
  }
};

