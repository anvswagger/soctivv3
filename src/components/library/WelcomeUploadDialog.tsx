import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, X, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface WelcomeUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
}

export function WelcomeUploadDialog({ open, onClose, onUpload }: WelcomeUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            مرحباً بك في المكتبة!
            <Sparkles className="w-5 h-5 text-primary" />
          </DialogTitle>
        </DialogHeader>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-6 py-4"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <Video className="w-10 h-10 text-primary" />
          </motion.div>
          
          {/* Message */}
          <div className="text-center space-y-2">
            <p className="text-foreground font-medium">
              ارفع فيديو يعرض أعمالك السابقة
            </p>
            <p className="text-sm text-muted-foreground">
              زيادة ثقة العملاء بك عبر عرض إنجازاتك
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              لاحقاً
            </Button>
            <Button
              onClick={onUpload}
              className="flex-1 gap-2"
            >
              <Video className="w-4 h-4" />
              رفع فيديو
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
