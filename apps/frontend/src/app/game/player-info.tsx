import { VStack, Text, Badge } from '@chakra-ui/react';
import { Player, RoleType, showCulpritAtMoves } from '@yard/shared-utils';
import { PlayerPosition } from './player-position';
import { useGameStore } from '../../stores/use-game-store';

interface PlayerInfoProps {
  player: Player;
  currentRole?: string;
  onRoleChange: (role: RoleType) => void;
}

export const PlayerInfo = ({
  player,
  currentRole,
  onRoleChange,
}: PlayerInfoProps) => {
  const {moves} = useGameStore();
  const showCulpritPosition = showCulpritAtMoves.includes(moves.length);
  return (
  <VStack key={player.id} marginBottom="auto" bg="#ACD8AF" p={3} rounded="lg">
    <Text fontSize="lg" fontWeight="bold" color="teal.900">
      {player.username?.slice(0,10) ?? 'Waiting...'}
    </Text>
    <img
      className="w-10 h-12"
      src={`/images/${player.role}.png`}
      alt="player"
    />
    <PlayerPosition
      position={player.position}
      showPosition={player.role !== 'culprit' || showCulpritPosition}
    />
    {player.role === 'culprit' ? (
      <>
        <Badge colorScheme="gray">Secret: {player.secretTickets}</Badge>
        <Badge colorScheme="orange">Double: {player.doubleTickets}</Badge>
      </>
    ) : (
      <>
        <Badge colorScheme="yellow">Taxi: {player.taxiTickets}</Badge>
        <Badge colorScheme="green">Bus: {player.busTickets}</Badge>
        <Badge colorScheme="red">Metro: {[player.undergroundTickets]}</Badge>
      </>
    )}
  </VStack>
)};
