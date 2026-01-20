import React from 'react';
import { motion } from 'framer-motion';
import { Play, Trash2, Calendar, HardDrive, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/services/mediaService';

interface VideoCardProps {
  media: MediaItem;
  onPlay: (media: MediaItem) => void;
  onDelete: (id: string) => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'غير محدد';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function VideoCard({ media, onPlay, onDelete }: VideoCardProps) {
  const thumbnailUrl = media.thumbnail_url || `${media.file_url}/tr:w-400,h-300,fo-auto`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur transition-all hover:border-primary/30 hover:shadow-lg">
        {/* Thumbnail */}
        <div 
          className="relative aspect-video cursor-pointer overflow-hidden bg-muted"
          onClick={() => onPlay(media)}
        >
          <img
            src={thumbnailUrl}
            alt={media.title || media.file_name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
          
          {/* Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/40">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground opacity-0 shadow-xl transition-opacity duration-300 group-hover:opacity-100"
            >
              <Play className="h-7 w-7 mr-[-2px]" fill="currentColor" />
            </motion.div>
          </div>

          {/* Source Badge */}
          <div className="absolute top-2 left-2">
            <span className={cn(
              "rounded-full px-2 py-1 text-xs font-medium",
              media.source === 'onboarding' 
                ? "bg-blue-500/80 text-white" 
                : "bg-primary/80 text-primary-foreground"
            )}>
              {media.source === 'onboarding' ? 'تسجيل' : 'مكتبة'}
            </span>
          </div>

          {/* Menu */}
          <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-8 w-8 bg-background/80 backdrop-blur"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onPlay(media)}>
                  <Play className="ml-2 h-4 w-4" />
                  تشغيل
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="ml-2 h-4 w-4" />
                      حذف
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف هذا الفيديو نهائياً ولا يمكن استرجاعه.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(media.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Info */}
        <CardContent className="p-4">
          <h3 className="mb-2 truncate font-semibold text-foreground">
            {media.title || media.file_name}
          </h3>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{format(new Date(media.created_at), 'dd MMM yyyy', { locale: ar })}</span>
            </div>
            <div className="flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5" />
              <span>{formatFileSize(media.file_size)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
