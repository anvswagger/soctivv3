import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface MultipleChoiceQuestionProps {
  question: string;
  description?: string;
  options: Option[];
  selectedValue: string;
  customValue: string;
  onSelect: (value: string) => void;
  onCustomChange: (value: string) => void;
  customPlaceholder?: string;
  isTextArea?: boolean;
}

export function MultipleChoiceQuestion({
  question,
  description,
  options,
  selectedValue,
  customValue,
  onSelect,
  onCustomChange,
  customPlaceholder = 'اكتب هنا...',
  isTextArea = false,
}: MultipleChoiceQuestionProps) {
  const isOtherSelected = selectedValue === 'other';

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl md:text-2xl font-semibold text-foreground">
          {question}
        </h2>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>

      <div className="space-y-3">
        {options.map((option, index) => (
          <motion.button
            key={option.value}
            type="button"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(option.value)}
            className={cn(
              'w-full p-4 rounded-xl border-2 text-right transition-all duration-200',
              'hover:border-primary/50 hover:bg-accent/50',
              selectedValue === option.value
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  selectedValue === option.value
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/30'
                )}
              >
                {selectedValue === option.value && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 rounded-full bg-primary-foreground"
                  />
                )}
              </div>
              <span className="text-foreground font-medium">{option.label}</span>
            </div>
          </motion.button>
        ))}

        {/* Other option */}
        <motion.button
          type="button"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: options.length * 0.05 }}
          onClick={() => onSelect('other')}
          className={cn(
            'w-full p-4 rounded-xl border-2 text-right transition-all duration-200',
            'hover:border-primary/50 hover:bg-accent/50',
            isOtherSelected
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border bg-card'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                isOtherSelected
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/30'
              )}
            >
              {isOtherSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 rounded-full bg-primary-foreground"
                />
              )}
            </div>
            <span className="text-foreground font-medium">أخرى</span>
          </div>
        </motion.button>

        {/* Custom input for "other" option */}
        {isOtherSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3"
          >
            {isTextArea ? (
              <Textarea
                value={customValue}
                onChange={(e) => onCustomChange(e.target.value)}
                placeholder={customPlaceholder}
                className="min-h-[120px] resize-none"
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
      </div>
    </div>
  );
}
