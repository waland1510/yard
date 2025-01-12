import React from "react";
import { useRunnerStore } from "../stores/use-runner-store";
import { useNodesStore } from "../stores/use-nodes-store";
import { useGameStore } from "../stores/use-game-store";

export const Panel = () => {
    const currentRole = useRunnerStore((state) => state.currentRole);
    const player = useGameStore((state) => state.players.find((p) => p.role === currentRole));
    const currentPosition = useRunnerStore((state) => state.currentPosition);
    const currentTurn = useGameStore((state) => state.currentTurn);
    const node = useNodesStore((state) => state.getNode(currentPosition));
    console.log({node});

    if (!node) {
      return null;
    }

  const items = [
    { icon: "🚖", id: 'taxi', label: "Taxi", bg: "bg-yellow-400" , count: player?.taxiTickets},
    { icon: "🚌", id: 'bus', label: "Bus", bg: "bg-green-400", count: player?.busTickets },
    { icon: "🚇", id: 'underground', label: "Subway", bg: "bg-red-500", count: player?.undergroundTickets },
  ];
  const culpritItems = [
  { icon: "🏃", label: "Hidden", bg: "bg-black text-white", count: player?.secretTickets },
  { icon: "2️⃣", label: "Double", bg: "bg-gradient-to-r from-yellow-400 to-red-500", count: player?.doubleTickets },
  ];

  return (
    <div className="p-4 max-w-[120px] bg-gray-100 rounded-lg shadow-lg">
   <div className="flex flex-col items-center justify-between px-4 py-2 mb-5 rounded-lg bg-gray-200">
        <span className="text-2xl" role="img" aria-label="dice">🎲</span>
        <img
                className="w-10 h-12"
                src={`/images/${currentTurn}.png`}
                alt="player"
              />
        <div className="text-sm">{currentTurn}</div>
      </div>

      {items.map((item, index) => {
        const available = item.id && node[item.id as keyof typeof node]
        return(
        <div
          key={index}
          className={`flex items-center cursor-pointer justify-between px-4 py-2 rounded-lg mb-3 ${available ?item.bg : 'bg-gray-200' }`}
          onClick={() => {
            useRunnerStore.getState().setCurrentType(item.id as string);
          }}
        >
          <span className="text-2xl">{item.icon}</span>
          {item.count && <span className="ml-4 text-sm">{item.count}</span>}
        </div>
      )})}
      {currentRole === 'culprit' && (
        <div className="flex flex-col gap-3">
          {culpritItems.map((item, index) => (
            <div
              key={index}
              className={`flex items-center cursor-pointer justify-between px-4 py-2 rounded-lg mb-3 ${item.count ? item.bg : 'bg-gray-200'}`}
              onClick={() => {
                useRunnerStore.getState().setCurrentType(item.label);
              }}
            >
              <span className="text-2xl">{item.icon}</span>
              {item.count && <span className="ml-4 text-sm">{item.count}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
