import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface TextQuestionProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isTextArea?: boolean;
  animationData?: object;
}

export function TextQuestion({
  value,
  onChange,
  placeholder = 'اكتب هنا...',
  isTextArea = false,
  animationData,
}: TextQuestionProps) {
  return (
    <div className="space-y-4 w-full">
      {/* Lottie Animation */}
      {animationData && (
        <div className="flex justify-center mb-2">
          <Lottie 
            animationData={animationData} 
            loop 
            className="w-16 h-16"
          />
        </div>
      )}

      {/* Input field */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {isTextArea ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[150px] resize-none text-right"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="text-right"
          />
        )}
      </motion.div>
    </div>
  );
}
