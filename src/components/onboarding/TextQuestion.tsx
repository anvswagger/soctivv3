import { motion } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface TextQuestionProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isTextArea?: boolean;
  lottieUrl?: string;
}

// Smooth tween transition - no bounce, predictable
const smoothTransition = {
  type: 'tween' as const,
  duration: 0.25,
  ease: 'easeOut',
};

export function TextQuestion({
  value,
  onChange,
  placeholder = 'اكتب هنا...',
  isTextArea = false,
  lottieUrl,
}: TextQuestionProps) {
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

      {/* Input field - no entry animation since parent handles it */}
      <div>
        {isTextArea ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[120px] resize-none text-right"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="text-right"
          />
        )}
      </div>
    </div>
  );
}