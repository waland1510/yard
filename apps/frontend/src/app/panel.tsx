import React from "react";

const Panel = () => {
  const items = [
    { icon: "🚖", label: "Taxi", bg: "bg-yellow-400" },
    { icon: "🚌", label: "Bus", bg: "bg-green-400" },
    { icon: "🚇", label: "Subway", bg: "bg-red-500" },
    { icon: "🏃", label: "Hidden", bg: "bg-black text-white", count: "5" },
    { icon: "2️⃣", label: "Double", bg: "bg-gradient-to-r from-yellow-400 to-red-500", count: "3" },
  ];

  return (
    <div className="p-4 max-w-[120px] bg-gray-100 rounded-lg shadow-lg">
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex items-center justify-between px-4 py-2 rounded-lg mb-3 ${item.bg}`}
        >
          <span className="text-2xl">{item.icon}</span>
          {item.count && <span className="ml-4 text-sm">{item.count}</span>}
        </div>
      ))}
    </div>
  );
};

export default Panel;
