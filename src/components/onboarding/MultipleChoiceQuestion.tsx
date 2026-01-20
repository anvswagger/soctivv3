import { motion, AnimatePresence } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface MultipleChoiceQuestionProps {
  options: Option[];
  selectedValue: string;
  customValue: string;
  onSelect: (value: string) => void;
  onCustomChange: (value: string) => void;
  customPlaceholder?: string;
  isTextArea?: boolean;
  lottieUrl?: string;
}

// Fast spring transition for snappy feel
const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

export function MultipleChoiceQuestion({
  options,
  selectedValue,
  customValue,
  onSelect,
  onCustomChange,
  customPlaceholder = 'اكتب هنا...',
  isTextArea = false,
  lottieUrl,
}: MultipleChoiceQuestionProps) {
  const isOtherSelected = selectedValue === 'other';

  return (
    <div className="space-y-4 w-full">
      {/* Lottie Animation */}
      {lottieUrl && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springTransition}
          className="flex justify-center mb-2"
        >
          <DotLottieReact
            src={lottieUrl}
            loop
            autoplay
            style={{ width: 80, height: 80 }}
          />
        </motion.div>
      )}

      {/* Options */}
      <div className="space-y-2">
        {options.map((option, index) => (
          <motion.button
            key={option.value}
            type="button"
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              delay: index * 0.03, 
              ...springTransition 
            }}
            onClick={() => onSelect(option.value)}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full p-3.5 rounded-xl border-2 text-right transition-colors duration-150',
              selectedValue === option.value
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
            )}
          >
            <div className="flex items-center gap-3">
              <motion.div
                layout
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150',
                  selectedValue === option.value
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/30'
                )}
              >
                <AnimatePresence>
                  {selectedValue === option.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={springTransition}
                      className="w-2 h-2 rounded-full bg-primary-foreground"
                    />
                  )}
                </AnimatePresence>
              </motion.div>
              <span className="text-foreground font-medium text-sm">{option.label}</span>
            </div>
          </motion.button>
        ))}

        {/* Other option */}
        <motion.button
          type="button"
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            delay: options.length * 0.03, 
            ...springTransition 
          }}
          onClick={() => onSelect('other')}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'w-full p-3.5 rounded-xl border-2 text-right transition-colors duration-150',
            isOtherSelected
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
          )}
        >
          <div className="flex items-center gap-3">
            <motion.div
              layout
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150',
                isOtherSelected
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/30'
              )}
            >
              <AnimatePresence>
                {isOtherSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={springTransition}
                    className="w-2 h-2 rounded-full bg-primary-foreground"
                  />
                )}
              </AnimatePresence>
            </motion.div>
            <span className="text-foreground font-medium text-sm">أخرى</span>
          </div>
        </motion.button>

        {/* Custom input for "other" option */}
        <AnimatePresence>
          {isOtherSelected && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={springTransition}
            >
              {isTextArea ? (
                <Textarea
                  value={customValue}
                  onChange={(e) => onCustomChange(e.target.value)}
                  placeholder={customPlaceholder}
                  className="min-h-[100px] resize-none"
                  autoFocus
                />
              ) : (
                <Input
                  value={customValue}
                  onChange={(e) => onCustomChange(e.target.value)}
                  placeholder={customPlaceholder}
                  autoFocus
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
