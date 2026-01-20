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
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-[#1877F2] border-[#1877F2] hover:bg-[#1877F2]/10"
            onClick={() => window.open('https://www.facebook.com/pages/?category=your_pages', '_blank')}
            type="button"
          >
            <Facebook className="w-4 h-4" />
            انتقل إلى صفحاتي
          </Button>
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