'use client';

import { useEffect, useState } from 'react';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function Sparkles() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    const positions = [
      { x: '10%', y: '20%' },
      { x: '15%', y: '50%' },
      { x: '8%', y: '70%' },
    ];

    const initialSparkles = positions.map((pos, index) => ({
      id: index,
      x: parseFloat(pos.x),
      y: parseFloat(pos.y),
      size: 16 + Math.random() * 8,
    }));

    setSparkles(initialSparkles);
  }, []);

  return (
    <>
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          className="absolute animate-pulse"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full text-purple-400/40"
          >
            <path
              d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
              fill="currentColor"
            />
          </svg>
        </div>
      ))}
    </>
  );
}
