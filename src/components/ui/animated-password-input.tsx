import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedInput } from './animated-input';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedPasswordInputProps extends Omit<React.ComponentProps<typeof AnimatedInput>, 'type'> {
  strength: number; // 0-4
  showToggle?: boolean;
}

const strengthColors = [
  'border-input',
  'border-red-500',
  'border-orange-500',
  'border-yellow-500',
  'border-emerald-500',
];

const strengthLabels = [
  'يجب أن تكون 8 أحرف على الأقل.',
  'ضعيفة جداً',
  'ضعيفة',
  'جيدة',
  'قوية',
];

const AnimatedPasswordInput = React.forwardRef<HTMLInputElement, AnimatedPasswordInputProps>(
  ({ label, strength, showToggle = true, className, error, valid, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    
    const safeStrength = Math.min(Math.max(strength, 0), 4);
    
    return (
      <div className="relative">
        <AnimatedInput
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          label={label}
          className={cn(
            "pl-10",
            strength >= 1 && !error ? strengthColors[safeStrength] : "",
            className
          )}
          error={error}
          valid={valid}
          {...props}
        />
        
        {showToggle && (
          <button
            type="button"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20"
            onClick={() => setShowPassword(!showPassword)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={showPassword ? 'eye-off' : 'eye'}
                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                transition={{ duration: 0.15 }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </motion.div>
            </AnimatePresence>
          </button>
        )}
        
        {props.value && typeof props.value === 'string' && props.value.length > 0 && (
          <motion.div className="mt-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${
                  safeStrength === 0 ? 'bg-transparent' :
                  safeStrength === 1 ? 'bg-red-500' :
                  safeStrength === 2 ? 'bg-orange-500' :
                  safeStrength === 3 ? 'bg-yellow-500' :
                  'bg-emerald-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: safeStrength === 0 ? '0%' : `${safeStrength * 25}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            <motion.p 
              className="text-sm text-muted-foreground mt-1"
              key={safeStrength}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {strengthLabels[safeStrength]}
            </motion.p>
          </motion.div>
        )}
      </div>
    );
  }
);

AnimatedPasswordInput.displayName = 'AnimatedPasswordInput';

export { AnimatedPasswordInput };