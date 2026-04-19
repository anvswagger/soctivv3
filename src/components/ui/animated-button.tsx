import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, ButtonProps } from './button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedButtonProps extends ButtonProps {
  loading?: boolean;
  success?: boolean;
  showParticles?: boolean;
}

const Particle = ({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
    animate={{ 
      opacity: [0, 1, 0], 
      scale: [0, 1, 0], 
      x, 
      y,
    }}
    transition={{ 
      duration: 0.4, 
      delay,
      ease: 'easeOut',
    }}
    className="absolute w-1 h-1 rounded-full pointer-events-none"
    style={{ backgroundColor: color }}
  />
);

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ children, loading, success, showParticles = true, className, disabled, ...props }, ref) => {
    const [showSuccess, setShowSuccess] = useState(false);
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
    
    useEffect(() => {
      if (success && showParticles) {
        const newParticles = Array.from({ length: 6 }, (_, i) => ({
          id: i,
          x: (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 60,
          delay: i * 0.03,
        }));
        setParticles(newParticles);
        setShowSuccess(true);
        
        const timer = setTimeout(() => {
          setShowSuccess(false);
          setParticles([]);
        }, 800);
        
        return () => clearTimeout(timer);
      }
    }, [success, showParticles]);
    
  return (
    <div className="relative">
      <AnimatePresence mode="popLayout">
        {particles.map((p) => (
          <Particle 
            key={p.id} 
            x={p.x} 
            y={p.y} 
            delay={p.delay}
            color="hsl(var(--primary))"
          />
        ))}
      </AnimatePresence>
      
      <motion.div
        whileHover={{ scale: 1.015, y: -1 }}
        whileTap={{ scale: 0.985, y: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="w-full"
      >
        <Button
          ref={ref}
          className={cn(
            "relative overflow-hidden transition-all duration-200 w-full",
            loading ? "pointer-events-none" : "",
            className
          )}
          disabled={disabled || loading}
          {...props}
        >
          <AnimatePresence mode="popLayout">
            {!loading && !showSuccess && (
              <motion.span
                key="text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ 
                  duration: 0.2, 
                  type: 'spring',
                  stiffness: 350,
                  damping: 25
                }}
                className="flex items-center justify-center gap-2"
              >
                {children}
              </motion.span>
            )}
            
            {loading && (
              <motion.div
                key="loader"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  className="absolute inset-0 bg-primary/90"
                  initial={{ x: '-100%' }}
                  animate={{ x: '0%' }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 50%, hsl(var(--primary)) 100%)',
                  }}
                />
                <Loader2 className="h-5 w-5 animate-spin z-10" />
              </motion.div>
            )}
            
            {showSuccess && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: [1, 1.2, 1] }}
                transition={{ 
                  duration: 0.3, 
                  type: 'spring',
                  stiffness: 400,
                  damping: 15,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>
    </div>
  );
}
);

AnimatedButton.displayName = 'AnimatedButton';

export { AnimatedButton };