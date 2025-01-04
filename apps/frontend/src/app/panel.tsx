import React from "react";
import { useRunnerStore } from "../stores/use-runner-store";
import { useNodesStore } from "../stores/use-nodes-store";

export const Panel = () => {
    const doubleTickets = useRunnerStore((state) => state.doubleTickets);
    const secretTickets = useRunnerStore((state) => state.secretTickets);
    const currentPosition = useRunnerStore((state) => state.currentPosition);

    const node = useNodesStore((state) => state.getNode(currentPosition)); 
    console.log({node});
      
    if (!node) {
      return null;
    }

  const items = [
    { icon: "🚖", id: 'taxi', label: "Taxi", bg: "bg-yellow-400" },
    { icon: "🚌", id: 'bus', label: "Bus", bg: "bg-green-400" },
    { icon: "🚇", id: 'underground', label: "Subway", bg: "bg-red-500" },
    { icon: "🏃", label: "Hidden", bg: "bg-black text-white", count: secretTickets },
    { icon: "2️⃣", label: "Double", bg: "bg-gradient-to-r from-yellow-400 to-red-500", count: doubleTickets },
  ];


  return (
    <div className="p-4 max-w-[120px] bg-gray-100 rounded-lg shadow-lg">
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
    </div>
  );
};
