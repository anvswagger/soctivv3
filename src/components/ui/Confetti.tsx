import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";

interface Particle {
  id: number;
  angle: number;
  velocity: number;
  color: string;
  size: number;
  rotation: number;
}

const COLORS = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899"];
const PARTICLE_COUNT = 35;

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    angle: Math.random() * 360,
    velocity: 120 + Math.random() * 200,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 5 + Math.random() * 3,
    rotation: Math.random() * 720 - 360,
  }));
}

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

export function Confetti({ active, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) {
      setParticles(createParticles());
    }
  }, [active]);

  const rad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <AnimatePresence>
      {active && particles.length > 0 && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {particles.map((p) => {
            const dx = Math.cos(rad(p.angle)) * p.velocity;
            const dy = Math.sin(rad(p.angle)) * p.velocity;
            return (
              <motion.div
                key={p.id}
                initial={{
                  x: "50vw",
                  y: "50vh",
                  rotate: 0,
                  opacity: 1,
                  scale: 1,
                }}
                animate={{
                  x: `calc(50vw + ${dx}px)`,
                  y: `calc(50vh + ${dy}px)`,
                  rotate: p.rotation,
                  opacity: 0,
                  scale: 0.3,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                onAnimationComplete={
                  p.id === PARTICLE_COUNT - 1 ? onComplete : undefined
                }
                style={{
                  position: "absolute",
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: 2,
                }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

export function useConfetti() {
  const [show, setShow] = useState(false);

  const fire = useCallback(() => {
    setShow(true);
  }, []);

  return {
    show,
    fire,
    Confetti: () => <Confetti active={show} onComplete={() => setShow(false)} />,
  };
}
