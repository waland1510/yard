import { VStack, Text, Badge } from '@chakra-ui/react';
import { Player, RoleType } from '@yard/shared-utils';
import { PlayerPosition } from './player-position';

interface PlayerInfoProps {
  player: Player;
  currentRole?: string;
  onRoleChange: (role: RoleType) => void;
}

export const PlayerInfo = ({
  player,
  currentRole,
  onRoleChange,
}: PlayerInfoProps) => (
  <VStack key={player.id} spacing={2}>
    <Text fontSize="lg" fontWeight="bold">
      {player.username}
    </Text>
    <img
      className="w-10 h-12"
      src={`/images/${player.role}.png`}
      alt="player"
      onClick={
        currentRole !== 'culprit' && player.role !== 'culprit'
          ? () => onRoleChange(player.role)
          : undefined
      }
    />
    <Text fontSize="lg" fontWeight="bold">
      {player.role !== 'culprit' ? (
        <PlayerPosition position={player.position} />
      ) : (
        <p>??</p>
      )}
    </Text>
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
);
