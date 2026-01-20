import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { MediaItem } from '@/services/mediaService';

interface VideoPlayerProps {
  media: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPlayer({ media, isOpen, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked
      });
    }
  }, [isOpen]);

  if (!media) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl border-none bg-black/95 p-0 backdrop-blur-xl">
        <VisuallyHidden>
          <DialogTitle>{media.title || media.file_name}</DialogTitle>
        </VisuallyHidden>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-white hover:bg-white/20"
              onClick={() => window.open(media.file_url, '_blank')}
            >
              <ExternalLink className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-white hover:bg-white/20"
              asChild
            >
              <a href={media.file_url} download={media.file_name}>
                <Download className="h-5 w-5" />
              </a>
            </Button>
          </div>
          
          <h2 className="text-lg font-semibold text-white truncate max-w-md">
            {media.title || media.file_name}
          </h2>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Video */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative aspect-video w-full"
        >
          <video
            ref={videoRef}
            src={media.file_url}
            controls
            className="h-full w-full"
            poster={media.thumbnail_url || undefined}
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
