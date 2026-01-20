import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Plus, FolderOpen, Users, Film, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { VideoUploader } from '@/components/media/VideoUploader';
import { VideoCard } from '@/components/media/VideoCard';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { WelcomeUploadDialog } from '@/components/library/WelcomeUploadDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { 
  getClientMedia, 
  getAllMedia,
  getAllClients,
  getMediaStats,
  deleteMedia, 
  getMyClientId, 
  type MediaItem,
  type MediaWithClient 
} from '@/services/mediaService';
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

function EmptyState({ onUpload, isAdmin }: { onUpload: () => void; isAdmin?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 py-20"
    >
      <div className="mb-6 rounded-full bg-primary/10 p-6">
        <FolderOpen className="h-12 w-12 text-primary" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {isAdmin ? 'لا توجد فيديوهات في النظام' : 'لا توجد فيديوهات'}
      </h3>
      <p className="mb-6 max-w-sm text-center text-muted-foreground">
        {isAdmin 
          ? 'لم يقم أي عميل برفع فيديوهات بعد'
          : 'ابدأ برفع فيديوهات تعرض أعمالك ومشاريعك السابقة'
        }
      </p>
      {!isAdmin && (
        <Button onClick={onUpload} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          رفع فيديو جديد
        </Button>
      )}
    </motion.div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}

function StatCard({ icon, value, label, color }: StatCardProps) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-xl p-3 ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Library() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdmin: isAdminRole } = useAuth();
  
  const isAdminView = isSuperAdmin || isAdminRole;

  // Check if we should show the welcome dialog for new users
  useEffect(() => {
    if (!isAdminView) {
      const hasSeenWelcome = localStorage.getItem('library_welcome_shown');
      if (!hasSeenWelcome) {
        setShowWelcomeDialog(true);
      }
    }
  }, [isAdminView]);

  const handleWelcomeClose = () => {
    localStorage.setItem('library_welcome_shown', 'true');
    setShowWelcomeDialog(false);
  };

  const handleWelcomeUpload = () => {
    localStorage.setItem('library_welcome_shown', 'true');
    setShowWelcomeDialog(false);
    setIsUploadOpen(true);
  };

  // Get client ID for regular users
  const { data: clientId } = useQuery({
    queryKey: ['myClientId'],
    queryFn: getMyClientId,
    enabled: !isAdminView,
  });

  // Fetch client's own media
  const { data: clientMedia, isLoading: isLoadingClientMedia } = useQuery({
    queryKey: ['clientMedia', clientId],
    queryFn: () => getClientMedia(clientId || undefined),
    enabled: !isAdminView && !!clientId,
  });

  // Fetch all media for admin
  const { data: allMedia, isLoading: isLoadingAllMedia } = useQuery({
    queryKey: ['allMedia'],
    queryFn: getAllMedia,
    enabled: isAdminView,
  });

  // Fetch all clients for filter dropdown
  const { data: clients } = useQuery({
    queryKey: ['allClients'],
    queryFn: getAllClients,
    enabled: isAdminView,
  });

  // Fetch stats for admin
  const { data: stats } = useQuery({
    queryKey: ['mediaStats'],
    queryFn: getMediaStats,
    enabled: isAdminView,
  });

  // Filtered media for admin view
  const filteredMedia = useMemo(() => {
    if (!isAdminView || !allMedia) return [];
    
    return allMedia.filter(item => {
      const matchesClient = clientFilter === 'all' || item.client_id === clientFilter;
      const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
      return matchesClient && matchesSource;
    });
  }, [allMedia, clientFilter, sourceFilter, isAdminView]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientMedia'] });
      queryClient.invalidateQueries({ queryKey: ['allMedia'] });
      queryClient.invalidateQueries({ queryKey: ['mediaStats'] });
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
    queryClient.invalidateQueries({ queryKey: ['allMedia'] });
    queryClient.invalidateQueries({ queryKey: ['mediaStats'] });
    setIsUploadOpen(false);
  };

  const isLoading = isAdminView ? isLoadingAllMedia : isLoadingClientMedia;
  const displayMedia = isAdminView ? filteredMedia : (clientMedia || []);

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
              <h1 className="text-2xl font-bold text-foreground">
                {isAdminView ? 'مكتبة الوسائط (عرض المدير)' : 'مكتبة الوسائط'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isAdminView 
                  ? `${filteredMedia.length} فيديو ${clientFilter !== 'all' || sourceFilter !== 'all' ? '(مفلتر)' : ''}`
                  : `${clientMedia?.length || 0} فيديو`
                }
              </p>
            </div>
          </div>

          {!isAdminView && (
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
          )}
        </div>

        {/* Admin Stats */}
        {isAdminView && stats && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <StatCard 
              icon={<Film className="h-6 w-6 text-primary-foreground" />}
              value={stats.totalVideos}
              label="إجمالي الفيديوهات"
              color="bg-primary"
            />
            <StatCard 
              icon={<Users className="h-6 w-6 text-blue-100" />}
              value={stats.totalClients}
              label="عملاء لديهم فيديوهات"
              color="bg-blue-500"
            />
            <StatCard 
              icon={<Video className="h-6 w-6 text-green-100" />}
              value={stats.onboardingVideos}
              label="من التسجيل"
              color="bg-green-500"
            />
            <StatCard 
              icon={<Upload className="h-6 w-6 text-purple-100" />}
              value={stats.libraryVideos}
              label="من المكتبة"
              color="bg-purple-500"
            />
          </motion.div>
        )}

        {/* Admin Filters */}
        {isAdminView && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-4"
          >
            <div className="w-full sm:w-64">
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="كل العملاء" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل العملاء</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="كل المصادر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المصادر</SelectItem>
                  <SelectItem value="onboarding">من التسجيل</SelectItem>
                  <SelectItem value="library">من المكتبة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        )}

        {/* Content */}
        {isLoading ? (
          <LibrarySkeleton />
        ) : displayMedia.length === 0 ? (
          <EmptyState onUpload={() => setIsUploadOpen(true)} isAdmin={isAdminView} />
        ) : (
          <motion.div 
            layout
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
              {displayMedia.map((item) => (
                <VideoCard
                  key={item.id}
                  media={item}
                  onPlay={handlePlay}
                  onDelete={handleDelete}
                  showClientName={isAdminView}
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

        {/* Welcome Upload Dialog for new users */}
        <WelcomeUploadDialog
          open={showWelcomeDialog}
          onClose={handleWelcomeClose}
          onUpload={handleWelcomeUpload}
        />
      </div>
    </DashboardLayout>
  );
}
