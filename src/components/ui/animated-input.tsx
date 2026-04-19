import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from './input';
import { Label } from './label';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface AnimatedInputProps extends React.ComponentProps<typeof Input> {
  label: string;
  error?: string;
  valid?: boolean;
  showValidation?: boolean;
}

const AnimatedInput = React.forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ label, error, valid, showValidation = false, className, onFocus, onBlur, onChange, type, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(!!props.value);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      setHasValue(!!props.value && props.value.toString().length > 0);
    }, [props.value]);
    
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };
    
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value && e.target.value.length > 0);
      onChange?.(e);
    };
    
    const labelFloated = isFocused || hasValue;
    
    return (
      <div className="relative" ref={containerRef}>
        <div className="relative">
          <motion.div
            className="absolute z-10 pointer-events-none"
            initial={false}
            animate={{
              y: labelFloated ? -10 : 0,
              x: labelFloated ? 0 : 12,
              scale: labelFloated ? 0.85 : 1,
              backgroundColor: labelFloated ? 'hsl(var(--background))' : 'transparent',
              paddingLeft: labelFloated ? 8 : 0,
              paddingRight: labelFloated ? 8 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              mass: 0.8,
            }}
            style={{
              top: labelFloated ? 0 : '50%',
              translateY: labelFloated ? '-50%' : '-50%',
              right: labelFloated ? 12 : 0,
            }}
          >
            <Label className={cn(
              "transition-colors duration-200",
              isFocused ? "text-primary" : "text-muted-foreground",
              error ? "text-destructive" : "",
            )}>
              {label}
            </Label>
          </motion.div>
          
            <Input
              ref={ref || inputRef}
              type={type}
              className={cn(
                "h-12 text-base rounded-2xl border-2 pr-4 transition-all duration-200",
                isFocused && !error ? "border-primary" : "",
                error ? "border-destructive focus-visible:ring-destructive" : "",
                valid && showValidation ? "border-emerald-500 focus-visible:ring-emerald-500" : "",
                className
              )}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onChange={handleChange}
              {...props}
            />
          
          <AnimatePresence mode="wait">
            {showValidation && valid && !error && (
              <motion.div
                key="valid"
                initial={{ x: -10, opacity: 0, scale: 0.5 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: 10, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.15, delay: 0.1 }}
                >
                  <Check size={18} strokeWidth={2.5} />
                </motion.div>
              </motion.div>
            )}
            
            {error && (
              <motion.div
                key="error"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 10, opacity: 0 }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-destructive"
              >
                <X size={18} strokeWidth={2.5} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-sm text-destructive mt-1"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

AnimatedInput.displayName = 'AnimatedInput';

export { AnimatedInput };