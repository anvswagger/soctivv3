import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Plus, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { VideoUploader } from '@/components/media/VideoUploader';
import { VideoCard } from '@/components/media/VideoCard';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { Skeleton } from '@/components/ui/skeleton';
import { getClientMedia, deleteMedia, getMyClientId, type MediaItem } from '@/services/mediaService';
import { toast } from 'sonner';

function LibrarySkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 py-20"
    >
      <div className="mb-6 rounded-full bg-primary/10 p-6">
        <FolderOpen className="h-12 w-12 text-primary" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">لا توجد فيديوهات</h3>
      <p className="mb-6 max-w-sm text-center text-muted-foreground">
        ابدأ برفع فيديوهات تعرض أعمالك ومشاريعك السابقة
      </p>
      <Button onClick={onUpload} size="lg" className="gap-2">
        <Plus className="h-5 w-5" />
        رفع فيديو جديد
      </Button>
    </motion.div>
  );
}

export default function Library() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const queryClient = useQueryClient();

  // Get client ID first
  const { data: clientId } = useQuery({
    queryKey: ['myClientId'],
    queryFn: getMyClientId,
  });

  // Fetch media
  const { data: media, isLoading } = useQuery({
    queryKey: ['clientMedia', clientId],
    queryFn: () => getClientMedia(clientId || undefined),
    enabled: !!clientId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientMedia'] });
      toast.success('تم حذف الفيديو بنجاح');
    },
    onError: () => {
      toast.error('فشل في حذف الفيديو');
    },
  });

  const handlePlay = (item: MediaItem) => {
    setSelectedMedia(item);
    setIsPlayerOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['clientMedia'] });
    setIsUploadOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <Video className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">مكتبة الوسائط</h1>
              <p className="text-sm text-muted-foreground">
                {media?.length || 0} فيديو
              </p>
            </div>
          </div>

          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 shadow-lg">
                <Plus className="h-5 w-5" />
                رفع فيديو جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Video className="h-5 w-5 text-primary" />
                  رفع فيديو جديد
                </DialogTitle>
              </DialogHeader>
              <VideoUploader 
                source="library" 
                onUploadComplete={handleUploadComplete}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Content */}
        {isLoading ? (
          <LibrarySkeleton />
        ) : !media || media.length === 0 ? (
          <EmptyState onUpload={() => setIsUploadOpen(true)} />
        ) : (
          <motion.div 
            layout
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
              {media.map((item) => (
                <VideoCard
                  key={item.id}
                  media={item}
                  onPlay={handlePlay}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Video Player Modal */}
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => {
            setIsPlayerOpen(false);
            setSelectedMedia(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
