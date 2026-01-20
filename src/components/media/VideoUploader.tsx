import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Video, CheckCircle2, XCircle, Loader2, X, CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useImageKit } from '@/hooks/useImageKit';
import { createMedia, getMyClientId } from '@/services/mediaService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface VideoUploaderProps {
  source?: 'onboarding' | 'library';
  onUploadComplete?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  className?: string;
}

export function VideoUploader({ 
  source = 'library', 
  onUploadComplete, 
  maxFiles = 10,
  className 
}: VideoUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading, progress } = useImageKit();

  const handleFiles = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const clientId = await getMyClientId();
    if (!clientId) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    const validFiles = Array.from(selectedFiles)
      .filter(file => file.type.startsWith('video/'))
      .slice(0, maxFiles - files.length);

    if (validFiles.length === 0) {
      toast.error('يرجى اختيار ملفات فيديو فقط');
      return;
    }

    for (const file of validFiles) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      
      setFiles(prev => [...prev, {
        id: tempId,
        name: file.name,
        url: '',
        status: 'uploading',
        progress: 0,
      }]);

      try {
        const result = await upload(file, '/client-media');
        
        // Save to database
        const savedMedia = await createMedia({
          client_id: clientId,
          file_id: result.fileId,
          file_url: result.url,
          thumbnail_url: result.thumbnailUrl,
          file_name: result.name,
          file_type: result.fileType,
          file_size: result.size,
          source,
        });

        setFiles(prev => prev.map(f => 
          f.id === tempId 
            ? { ...f, id: savedMedia.id, url: result.url, thumbnailUrl: result.thumbnailUrl, status: 'success', progress: 100 }
            : f
        ));

        toast.success(`تم رفع ${file.name} بنجاح`);
      } catch (error) {
        console.error('Upload error:', error);
        setFiles(prev => prev.map(f => 
          f.id === tempId 
            ? { ...f, status: 'error', error: 'فشل في رفع الملف' }
            : f
        ));
        toast.error(`فشل في رفع ${file.name}`);
      }
    }

    if (onUploadComplete) {
      onUploadComplete(files);
    }
  }, [files, maxFiles, source, upload, onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleRemove = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const successfulUploads = files.filter(f => f.status === 'success');
  const hasUploads = files.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300",
          "flex flex-col items-center justify-center p-8 text-center",
          "min-h-[200px]",
          isDragging 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
        )}
        animate={{ scale: isDragging ? 1.02 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <motion.div
          animate={{ 
            y: isDragging ? -5 : 0,
            scale: isDragging ? 1.1 : 1 
          }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <CloudUpload className="h-10 w-10 text-primary" />
          </div>
        </motion.div>

        <h3 className="mb-2 text-lg font-semibold text-foreground">
          {isDragging ? 'أفلت الملفات هنا' : 'اسحب الفيديوهات هنا'}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          أو اضغط لاختيار الملفات
        </p>
        <p className="text-xs text-muted-foreground/70">
          يدعم ملفات الفيديو (MP4, MOV, AVI, etc.)
        </p>
      </motion.div>

      {/* Upload Progress */}
      <AnimatePresence mode="popLayout">
        {files.map((file) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
              "relative rounded-xl border p-4",
              file.status === 'success' && "border-green-500/30 bg-green-500/5",
              file.status === 'error' && "border-destructive/30 bg-destructive/5",
              file.status === 'uploading' && "border-primary/30 bg-primary/5",
            )}
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                file.status === 'success' && "bg-green-500/20",
                file.status === 'error' && "bg-destructive/20",
                file.status === 'uploading' && "bg-primary/20",
              )}>
                {file.status === 'uploading' && (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                )}
                {file.status === 'success' && (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                )}
                {file.status === 'error' && (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">{file.name}</p>
                {file.status === 'uploading' && progress && (
                  <div className="mt-2 space-y-1">
                    <Progress value={progress.percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {progress.percentage}% - جاري الرفع...
                    </p>
                  </div>
                )}
                {file.status === 'success' && (
                  <p className="text-sm text-green-600">تم الرفع بنجاح ✓</p>
                )}
                {file.status === 'error' && (
                  <p className="text-sm text-destructive">{file.error}</p>
                )}
              </div>

              {/* Remove Button */}
              {file.status !== 'uploading' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(file.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Summary */}
      {successfulUploads.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg bg-green-500/10 p-3 text-center"
        >
          <p className="text-sm font-medium text-green-600">
            تم رفع {successfulUploads.length} فيديو بنجاح
          </p>
        </motion.div>
      )}
    </div>
  );
}
