import { VStack, Text, Badge } from '@chakra-ui/react';
import { Player, RoleType, showCulpritAtMoves } from '@yard/shared-utils';
import { PlayerPosition } from './player-position';
import { useGameStore } from '../../stores/use-game-store';
import { characterImageFor } from '../../utils/resolve-character';
import { themes } from '../themes';

interface PlayerInfoProps {
  player: Player;
  currentRole?: string;
  onRoleChange: (role: RoleType) => void;
}

export const PlayerInfo = ({
  player,
}: PlayerInfoProps) => {
  const { moves, theme } = useGameStore();
  const showCulpritPosition = showCulpritAtMoves.includes(moves.length);
  const selectedTheme = themes[theme];

  return (
    <VStack
      key={player.id}
      w="128px"
      marginBottom="auto"
      bg="#ACD8AF"
      p={3}
      rounded="lg"
    >
      <Text fontSize="lg" fontWeight="bold" color="teal.900">
        {player.username?.slice(0, 10) ?? player.characterName}
      </Text>
      <img
        className="w-10 h-12 object-contain"
        src={characterImageFor(player.role, theme, player.characterImage)}
        alt="player"
      />
      <PlayerPosition
        position={player.position}
        showPosition={player.role !== 'culprit' || showCulpritPosition}
      />
      {player.role === 'culprit' ? (
        <>
          <Badge colorScheme="gray">
            {selectedTheme.transportation.secret}: {player.secretTickets}
          </Badge>
          <Badge colorScheme="orange">
            {selectedTheme.transportation.double}: {player.doubleTickets}
          </Badge>
        </>
      ) : (
        <>
          <Badge colorScheme="yellow">
            {selectedTheme.transportation.taxi}: {player.taxiTickets}
          </Badge>
          <Badge colorScheme="green">
            {selectedTheme.transportation.bus}: {player.busTickets}
          </Badge>
          <Badge colorScheme="red">
            {selectedTheme.transportation.underground}:{' '}
            {[player.undergroundTickets]}
          </Badge>
        </>
      )}
    </VStack>
  );
};
