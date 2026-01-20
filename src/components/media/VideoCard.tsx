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
import type { MediaItem, MediaWithClient } from '@/services/mediaService';
import { Badge } from '@/components/ui/badge';

interface VideoCardProps {
  media: MediaItem | MediaWithClient;
  onPlay: (media: MediaItem) => void;
  onDelete: (id: string) => void;
  showClientName?: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'غير محدد';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function VideoCard({ media, onPlay, onDelete, showClientName = false }: VideoCardProps) {
  const thumbnailUrl = media.thumbnail_url || `${media.file_url}/tr:w-400,h-300,fo-auto`;
  const clientName = 'clients' in media && media.clients?.company_name;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <Card className="group overflow-hidden border-border/40 bg-card transition-all hover:border-primary/30 hover:shadow-xl active:scale-[0.98]">
        {/* Thumbnail */}
        <div 
          className="relative aspect-[16/10] cursor-pointer overflow-hidden bg-muted"
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/30 active:bg-black/40">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-white/95 text-primary shadow-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            >
              <Play className="h-5 w-5 sm:h-6 sm:w-6 mr-[-2px]" fill="currentColor" />
            </motion.div>
          </div>

          {/* Source Badge */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
            <span className={cn(
              "rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium shadow-sm",
              media.source === 'onboarding' 
                ? "bg-blue-500/90 text-white" 
                : "bg-primary/90 text-primary-foreground"
            )}>
              {media.source === 'onboarding' ? 'تسجيل' : 'مكتبة'}
            </span>
          </div>

          {/* Menu - Always visible on mobile */}
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-7 w-7 sm:h-8 sm:w-8 bg-background/90 backdrop-blur-sm shadow-sm"
                >
                  <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => onPlay(media)} className="text-sm">
                  <Play className="ml-2 h-4 w-4" />
                  تشغيل
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive text-sm"
                    >
                      <Trash2 className="ml-2 h-4 w-4" />
                      حذف
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف هذا الفيديو نهائياً ولا يمكن استرجاعه.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 flex-col-reverse sm:flex-row">
                      <AlertDialogCancel className="mt-0">إلغاء</AlertDialogCancel>
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
        <CardContent className="p-3 sm:p-4">
          {showClientName && clientName && (
            <Badge variant="secondary" className="mb-1.5 sm:mb-2 text-[10px] sm:text-xs px-2 py-0.5">
              {clientName}
            </Badge>
          )}
          <h3 className="mb-1.5 sm:mb-2 truncate font-semibold text-sm sm:text-base text-foreground leading-tight">
            {media.title || media.file_name}
          </h3>
          
          <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span>{format(new Date(media.created_at), 'dd MMM yyyy', { locale: ar })}</span>
            </div>
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span>{formatFileSize(media.file_size)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
