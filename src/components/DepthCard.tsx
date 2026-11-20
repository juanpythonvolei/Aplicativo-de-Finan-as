import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

interface DepthCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  tiltStrength?: number;
  as?: 'div' | 'article' | 'section';
}

export function DepthCard({
  children,
  className = '',
  delay = 0,
  tiltStrength = 3.5,
  as = 'div',
}: DepthCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [glare, setGlare] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, { stiffness: 260, damping: 24, mass: 0.6 });
  const rotateY = useSpring(rawRotateY, { stiffness: 260, damping: 24, mass: 0.6 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const nextRotateY = (px - 0.5) * 2 * tiltStrength;
    const nextRotateX = (0.5 - py) * 2 * tiltStrength;

    rawRotateX.set(nextRotateX);
    rawRotateY.set(nextRotateY);
    setGlare({ x: px * 100, y: py * 100, active: true });
  };

  const handleMouseLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
    setGlare((prev) => ({ ...prev, active: false }));
  };

  const MotionTag =
    as === 'article' ? motion.article : as === 'section' ? motion.section : motion.div;

  return (
    <div className="perspective-stage h-full">
      <MotionTag
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.988 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.34,
          delay,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={
          prefersReducedMotion
            ? undefined
            : {
                rotateX,
                rotateY,
                transformStyle: 'preserve-3d',
              }
        }
        className={`relative overflow-hidden depth-card-3d ${className}`}
      >
        {!prefersReducedMotion && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
            style={{
              opacity: glare.active ? 1 : 0,
              background: `radial-gradient(320px circle at ${glare.x}% ${glare.y}%, rgba(20, 184, 166, 0.09), transparent 62%)`,
            }}
          />
        )}
        <div className="relative z-10 h-full">{children}</div>
      </MotionTag>
    </div>
  );
}
