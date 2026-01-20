import { motion } from 'framer-motion';
import { Player } from '@lottiefiles/react-lottie-player';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface TextQuestionProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isTextArea?: boolean;
  lottieUrl?: string;
}

export function TextQuestion({
  value,
  onChange,
  placeholder = 'اكتب هنا...',
  isTextArea = false,
  lottieUrl,
}: TextQuestionProps) {
  return (
    <div className="space-y-4 w-full">
      {/* Lottie Animation */}
      {lottieUrl && (
        <div className="flex justify-center mb-2">
          <Player
            autoplay
            loop
            src={lottieUrl}
            style={{ height: '80px', width: '80px' }}
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
