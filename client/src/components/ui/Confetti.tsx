'use client';
import { useEffect, useState } from 'react';

const COLORS = ['#c9a959', '#e8c84a', '#b8860b', '#ff9d2e', '#d4a039'];
const SHAPES = ['✦', '⚔', '★', '⬥', '✧'];

interface Piece {
  id: number;
  left: number;
  color: string;
  shape: string;
  delay: number;
  duration: number;
  size: number;
}

export default function Confetti({ count = 30 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    const items: Piece[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      delay: Math.random() * 0.8,
      duration: 1.8 + Math.random() * 1.5,
      size: 10 + Math.random() * 14,
    }));
    setPieces(items);

    // Auto-cleanup after animations complete
    const timer = setTimeout(() => setPieces([]), 4000);
    return () => clearTimeout(timer);
  }, [count]);

  if (pieces.length === 0) return null;

  return (
    <div aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            color: p.color,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.shape}
        </span>
      ))}
    </div>
  );
}
