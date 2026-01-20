import { motion, AnimatePresence } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultipleChoiceQuestionProps {
  options: Option[];
  selectedValue: string | string[];
  customValue: string;
  onSelect: (value: string | string[]) => void;
  onCustomChange: (value: string) => void;
  customPlaceholder?: string;
  isTextArea?: boolean;
  lottieUrl?: string;
  multiSelect?: boolean;
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
  multiSelect = false,
}: MultipleChoiceQuestionProps) {
  // Convert to array for multi-select handling
  const selectedValues = Array.isArray(selectedValue) ? selectedValue : (selectedValue ? [selectedValue] : []);
  const isOtherSelected = selectedValues.includes('other');

  const handleOptionClick = (value: string) => {
    if (multiSelect) {
      if (selectedValues.includes(value)) {
        // Remove if already selected
        onSelect(selectedValues.filter(v => v !== value));
      } else {
        // Add to selection
        onSelect([...selectedValues, value]);
      }
    } else {
      // Single select - just set the value
      onSelect(value);
    }
  };

  const isSelected = (value: string) => selectedValues.includes(value);

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
            onClick={() => handleOptionClick(option.value)}
            className={cn(
              'w-full p-3.5 rounded-xl border-2 text-right transition-all duration-200',
              isSelected(option.value)
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
            )}
          >
            <div className="flex items-center gap-3">
              {multiSelect ? (
                // Checkbox style for multi-select
                <div
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200',
                    isSelected(option.value)
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/30'
                  )}
                >
                  {isSelected(option.value) && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
              ) : (
                // Radio style for single select
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                    isSelected(option.value)
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/30'
                  )}
                >
                  {isSelected(option.value) && (
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  )}
                </div>
              )}
              <span className="text-foreground font-medium text-sm">{option.label}</span>
            </div>
          </button>
        ))}

        {/* Other option */}
        <button
          type="button"
          onClick={() => handleOptionClick('other')}
          className={cn(
            'w-full p-3.5 rounded-xl border-2 text-right transition-all duration-200',
            isOtherSelected
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
          )}
        >
          <div className="flex items-center gap-3">
            {multiSelect ? (
              <div
                className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200',
                  isOtherSelected
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/30'
                )}
              >
                {isOtherSelected && (
                  <Check className="w-3 h-3 text-primary-foreground" />
                )}
              </div>
            ) : (
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
            )}
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
