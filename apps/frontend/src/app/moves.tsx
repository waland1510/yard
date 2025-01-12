import { showCulpritAtMoves } from "@yard/shared-utils";
import { useGameStore } from "../stores/use-game-store";

export const Moves = () => {
  const moves = useGameStore((state) => state.moves);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold text-gray-700">Moves</h2>
      <ul className="mt-2">
        {moves?.map((move, index) => (
          <li key={index} className="text-gray-600">
            {index + 1}. {move.type} - {showCulpritAtMoves.includes(index + 1) ? move.position : '??'}
          </li>
        ))}
      </ul>


    </div>
  );
};
