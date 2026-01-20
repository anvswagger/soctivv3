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

// Smooth tween transition - no bounce, predictable
const smoothTransition = {
  type: 'tween' as const,
  duration: 0.25,
  ease: 'easeOut' as const,
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
      {/* Lottie Animation - no entry animation since parent handles it */}
      {lottieUrl && (
        <div className="flex justify-center mb-2">
          <DotLottieReact
            src={lottieUrl}
            loop
            autoplay
            style={{ width: 80, height: 80 }}
          />
        </div>
      )}

      {/* Options */}
      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              'w-full p-3.5 rounded-xl border-2 text-right transition-all duration-200',
              selectedValue === option.value
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                  selectedValue === option.value
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/30'
                )}
              >
                {selectedValue === option.value && (
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                )}
              </div>
              <span className="text-foreground font-medium text-sm">{option.label}</span>
            </div>
          </button>
        ))}

        {/* Other option */}
        <button
          type="button"
          onClick={() => onSelect('other')}
          className={cn(
            'w-full p-3.5 rounded-xl border-2 text-right transition-all duration-200',
            isOtherSelected
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                isOtherSelected
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/30'
              )}
            >
              {isOtherSelected && (
                <div className="w-2 h-2 rounded-full bg-primary-foreground" />
              )}
            </div>
            <span className="text-foreground font-medium text-sm">أخرى</span>
          </div>
        </button>

        {/* Custom input for "other" option */}
        <AnimatePresence>
          {isOtherSelected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={smoothTransition}
              className="mt-2 overflow-hidden"
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
