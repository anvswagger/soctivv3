import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TextQuestionProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isTextArea?: boolean;
  lottieUrl?: string;
  showFacebookButton?: boolean;
}

export function TextQuestion({
  value,
  onChange,
  placeholder = 'اكتب هنا...',
  isTextArea = false,
  lottieUrl,
  showFacebookButton = false,
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

      {/* Facebook button */}
      {showFacebookButton && (
        <div className="flex justify-center mb-2">
          <button
            type="button"
            onClick={() => {
              // Navigate directly to exit any iframe context
              window.location.href = 'https://www.facebook.com/pages/?category=your_pages';
            }}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium h-9 px-4 rounded-md border border-[#1877F2] text-[#1877F2] hover:bg-[#1877F2]/10 transition-colors"
          >
            <Facebook className="w-4 h-4" />
            انتقل إلى صفحاتي
          </button>
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