import { mapData, showCulpritAtMoves } from '@yard/shared-utils';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Fragment } from 'react/jsx-runtime';
import { usePlayerSubscription } from '../../../hooks/use-player-subscription';
import { usePlayersSubscription } from '../../../hooks/use-players-subscription';
import { useGameStore } from '../../../stores/use-game-store';
import { useRunnerStore } from '../../../stores/use-runner-store';
import { getAvailableType } from '../../../utils/available-type';
import { isMoveAllowed } from '../../../utils/move-allowed';
import { AnimatedImage } from './animated-image';
import { useToast } from '@chakra-ui/react';

interface NodeItemProps {
  node: (typeof mapData.nodes)[number];
  moveColor: string | undefined;
  isYourTurn: boolean;
  shouldHideText: boolean;
  isCurrentPosition: boolean;
  onSend: (nodeId: number) => void;
}

const NodeItem = ({
  node,
  moveColor,
  isYourTurn,
  shouldHideText,
  isCurrentPosition,
  onSend,
}: NodeItemProps) => {
  const [hovered, setHovered] = useState(false);
  const [invalidFlash, setInvalidFlash] = useState(false);
  const isValid = Boolean(moveColor);
  const hasBus = node.bus && node.bus.length > 0;
  const hasUnderground = node.underground && node.underground.length > 0;
  const showAura = isValid && isYourTurn && !isCurrentPosition;

  const handleClick = () => {
    if (!isValid && isYourTurn) {
      setInvalidFlash(true);
      window.setTimeout(() => setInvalidFlash(false), 400);
      return;
    }
    onSend(node.id);
  };

  const r = hovered && isValid ? 16 : 14;

  return (
    <motion.g
      animate={invalidFlash ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {showAura && (
        <motion.circle
          cx={node.x}
          cy={node.y}
          fill="none"
          stroke={moveColor}
          strokeWidth={3}
          initial={{ r: 16, opacity: 0.6 }}
          animate={{ r: [16, 26, 16], opacity: [0.8, 0.15, 0.8] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          pointerEvents="none"
        />
      )}
      {invalidFlash && (
        <motion.circle
          cx={node.x}
          cy={node.y}
          fill="#ef4444"
          initial={{ r: 14, opacity: 0.85 }}
          animate={{ r: 32, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          pointerEvents="none"
        />
      )}
      {hasBus && (
        <circle
          cx={node.x}
          cy={node.y}
          r="18"
          fill="none"
          stroke="#080"
          strokeWidth="4"
        />
      )}
      {hasUnderground && (
        <circle
          cx={node.x}
          cy={node.y}
          r="22"
          fill="none"
          stroke="#d00"
          strokeWidth="4"
        />
      )}
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={moveColor ?? 'white'}
        stroke={hovered && isValid ? '#ffffff' : 'black'}
        strokeWidth="4"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          cursor: isValid ? 'pointer' : 'default',
          transition: 'r 0.12s ease-out, stroke 0.12s ease-out',
          filter: hovered && isValid ? 'drop-shadow(0 0 8px rgba(255,255,255,0.7))' : 'none',
        }}
        strokeDasharray={node.river ? '5 5' : 'none'}
      />
      <text
        x={node.x}
        y={node.y + 5}
        textAnchor="middle"
        fontWeight="normal"
        fontSize={isCurrentPosition ? '16' : '14'}
        fill={
          shouldHideText
            ? 'transparent'
            : isCurrentPosition
            ? 'purple'
            : isValid
            ? 'white'
            : 'black'
        }
        onClick={handleClick}
        style={{ cursor: isValid ? 'pointer' : 'default', pointerEvents: 'all' }}
      >
        {node.id}
      </text>
    </motion.g>
  );
};

export const Nodes = () => {
  const players = usePlayersSubscription();
  const currentPosition = usePlayerSubscription().currentPosition;
  const {
    batchUpdate,
    currentRole: role,
    isSecret,
    isDouble,
  } = useRunnerStore();
  const toast = useToast();
  const runnerData = {
    position: players.find((p) => p.role === role)?.position,
    currentRole: players.find((p) => p.position === currentPosition)?.role,
  };
  const { moves, players: storePlayers, currentTurn } = useGameStore();
  const playerStorePosition = storePlayers.find(
    (p) => p.role === role
  )?.position;
  const isYourTurn = role === currentTurn;

  const handleSend = (position: number) => {
    const currentType =
      getAvailableType(position, runnerData.position, role) || 'taxi';

    if (currentType === 'river') {
      toast({
        title: 'This move requires a secret ticket',
        description: 'The secret ticket was selected for you',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    }

    batchUpdate({
      currentType,
      move: {
        role,
        type: currentType,
        position,
        secret: isSecret,
        double: isDouble,
      },
      currentPosition: position,
      isSecret: currentType === 'river',
    });
  };

  return (
    <>
      {mapData.nodes.map((node) => {
        if (node.id < 1) return null;

        const player = players.find((p) => p.position === node.id);
        const shouldHideText =
          player?.role === 'culprit' &&
          (role === 'culprit' || showCulpritAtMoves.includes(moves.length));
        const moveColor = isMoveAllowed(
          node.id,
          playerStorePosition ?? runnerData.position,
          role
        );
        const isCurrentPosition = currentPosition === node.id;

        return (
          <NodeItem
            key={`static-${node.id}`}
            node={node}
            moveColor={moveColor}
            isYourTurn={isYourTurn}
            shouldHideText={shouldHideText}
            isCurrentPosition={isCurrentPosition}
            onSend={handleSend}
          />
        );
      })}

      {mapData.nodes.map((node) => {
        if (node.id < 1) return null;
        const player = players.find((p) => p.position === node.id);
        const playerRole = player?.role;
        const playersNode = mapData.nodes.find(
          (n) => n.id === player?.previousPosition
        );
        const showImage =
          playerRole &&
          (playerRole !== 'culprit' ||
            role === 'culprit' ||
            (playerRole === 'culprit' &&
              showCulpritAtMoves.includes(moves.length)));

        if (!showImage) return null;

        return (
          <Fragment key={`player-${node.id}`}>
            <AnimatedImage
              href={`/images/${playerRole}.png`}
              previousX={playersNode?.x || node.x}
              previousY={playersNode?.y || node.y}
              targetX={node.x}
              targetY={node.y}
              isCurrentPlayer={playerRole === role}
              nodeId={node.id}
            />
          </Fragment>
        );
      })}
    </>
  );
};
