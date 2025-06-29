import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../stores/use-game-store';
import { useRunnerStore } from '../stores/use-runner-store';
import { usePlayersSubscription } from './use-players-subscription';
import { Player, RoleType, Move, MoveType } from '@yard/shared-utils';

interface OptimizedGameState {
  // Memoized selectors
  currentPlayer: Player | undefined;
  culpritPlayer: Player | undefined;
  detectivePlayers: Player[];
  isCurrentPlayerTurn: boolean;
  canMakeMove: boolean;
  availableTickets: {
    taxi: number;
    bus: number;
    underground: number;
    secret: number;
    double: number;
  };
  
  // Optimized actions
  makeMove: (position: number, type: MoveType, isSecret?: boolean, isDouble?: boolean) => void;
  updatePlayerPosition: (role: RoleType, position: number) => void;
  
  // Performance metrics
  renderCount: number;
  lastUpdate: number;
}

export const useOptimizedGameState = (): OptimizedGameState => {
  const renderCountRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  
  // Increment render count for performance monitoring
  renderCountRef.current++;
  
  // Get state from stores
  const gameState = useGameStore();
  const runnerState = useRunnerStore();
  const players = usePlayersSubscription();
  
  // Memoized current player
  const currentPlayer = useMemo(() => {
    return players.find(player => player.role === runnerState.currentRole);
  }, [players, runnerState.currentRole]);
  
  // Memoized culprit player
  const culpritPlayer = useMemo(() => {
    return players.find(player => player.role === 'culprit');
  }, [players]);
  
  // Memoized detective players
  const detectivePlayers = useMemo(() => {
    return players.filter(player => player.role !== 'culprit');
  }, [players]);
  
  // Check if it's current player's turn
  const isCurrentPlayerTurn = useMemo(() => {
    return gameState.currentTurn === runnerState.currentRole;
  }, [gameState.currentTurn, runnerState.currentRole]);
  
  // Check if player can make a move
  const canMakeMove = useMemo(() => {
    return isCurrentPlayerTurn && 
           gameState.status === 'active' && 
           currentPlayer !== undefined;
  }, [isCurrentPlayerTurn, gameState.status, currentPlayer]);
  
  // Memoized available tickets
  const availableTickets = useMemo(() => {
    if (!currentPlayer) {
      return { taxi: 0, bus: 0, underground: 0, secret: 0, double: 0 };
    }
    
    return {
      taxi: currentPlayer.taxiTickets || 0,
      bus: currentPlayer.busTickets || 0,
      underground: currentPlayer.undergroundTickets || 0,
      secret: currentPlayer.secretTickets || 0,
      double: currentPlayer.doubleTickets || 0,
    };
  }, [currentPlayer]);
  
  // Optimized move action with debouncing
  const makeMove = useCallback((
    position: number, 
    type: MoveType, 
    isSecret = false, 
    isDouble = false
  ) => {
    if (!canMakeMove || !currentPlayer) {
      console.warn('Cannot make move: invalid state');
      return;
    }
    
    // Validate ticket availability
    const tickets = availableTickets;
    if (isSecret && tickets.secret <= 0) {
      console.warn('No secret tickets available');
      return;
    }
    
    if (isDouble && tickets.double <= 0) {
      console.warn('No double tickets available');
      return;
    }
    
    if (!isSecret && tickets[type] <= 0) {
      console.warn(`No ${type} tickets available`);
      return;
    }
    
    // Create move object
    const move: Move = {
      gameId: gameState.id!,
      role: currentPlayer.role,
      type,
      position,
      secret: isSecret,
      double: isDouble,
    };
    
    // Update stores
    runnerState.setMove(move);
    gameState.updateMoves(move);
    gameState.setPosition(currentPlayer.role, position);
    gameState.updateTicketsCount(currentPlayer.role, type, isSecret, isDouble);
    
    lastUpdateRef.current = Date.now();
  }, [canMakeMove, currentPlayer, availableTickets, gameState, runnerState]);
  
  // Optimized position update
  const updatePlayerPosition = useCallback((role: RoleType, position: number) => {
    gameState.setPosition(role, position);
    lastUpdateRef.current = Date.now();
  }, [gameState]);
  
  // Performance monitoring effect
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;
      
      if (renderCountRef.current % 10 === 0) {
        console.log(`[Performance] Game state hook rendered ${renderCountRef.current} times, last update ${timeSinceLastUpdate}ms ago`);
      }
    }
  });
  
  return {
    currentPlayer,
    culpritPlayer,
    detectivePlayers,
    isCurrentPlayerTurn,
    canMakeMove,
    availableTickets,
    makeMove,
    updatePlayerPosition,
    renderCount: renderCountRef.current,
    lastUpdate: lastUpdateRef.current,
  };
};

// Hook for optimized node selection
export const useOptimizedNodeSelection = (currentPosition: number) => {
  const { nodes, getNode } = useNodesStore();
  
  // Memoized current node
  const currentNode = useMemo(() => {
    return getNode(currentPosition);
  }, [currentPosition, getNode]);
  
  // Memoized available connections
  const availableConnections = useMemo(() => {
    if (!currentNode) return { taxi: [], bus: [], underground: [] };
    
    return {
      taxi: currentNode.taxi || [],
      bus: currentNode.bus || [],
      underground: currentNode.underground || [],
    };
  }, [currentNode]);
  
  // Memoized all possible moves
  const allPossibleMoves = useMemo(() => {
    const moves: Array<{ position: number; type: MoveType }> = [];
    
    Object.entries(availableConnections).forEach(([type, positions]) => {
      positions.forEach(position => {
        moves.push({ position, type: type as MoveType });
      });
    });
    
    return moves;
  }, [availableConnections]);
  
  return {
    currentNode,
    availableConnections,
    allPossibleMoves,
  };
};

// Hook for optimized game statistics
export const useGameStatistics = () => {
  const gameState = useGameStore();
  const players = usePlayersSubscription();
  
  const statistics = useMemo(() => {
    const totalMoves = gameState.moves.length;
    const culpritMoves = gameState.moves.filter(move => move.role === 'culprit').length;
    const detectiveMoves = totalMoves - culpritMoves;
    
    const secretMovesUsed = gameState.moves.filter(move => move.secret).length;
    const doubleMovesUsed = gameState.moves.filter(move => move.double).length;
    
    const ticketsUsed = gameState.moves.reduce((acc, move) => {
      if (!move.secret) {
        acc[move.type] = (acc[move.type] || 0) + 1;
      }
      return acc;
    }, {} as Record<MoveType, number>);
    
    return {
      totalMoves,
      culpritMoves,
      detectiveMoves,
      secretMovesUsed,
      doubleMovesUsed,
      ticketsUsed,
      gameStartTime: gameState.createdAt,
      gameDuration: gameState.createdAt ? Date.now() - new Date(gameState.createdAt).getTime() : 0,
    };
  }, [gameState.moves, gameState.createdAt]);
  
  return statistics;
};

// Import the nodes store
import { useNodesStore } from '../stores/use-nodes-store';
