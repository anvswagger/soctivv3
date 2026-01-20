import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadResult {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  size: number;
  fileType: string;
}

interface UseImageKitReturn {
  upload: (file: File, folder?: string) => Promise<UploadResult>;
  deleteFile: (fileId: string) => Promise<void>;
  isUploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
}

// These are public keys, safe to expose in frontend
const IMAGEKIT_PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY || '';
const IMAGEKIT_URL_ENDPOINT = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT || '';

export function useImageKit(): UseImageKitReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAuthParams = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await supabase.functions.invoke('imagekit-auth', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to get auth params');
    }

    return response.data as { token: string; expire: number; signature: string };
  }, []);

  const upload = useCallback(async (file: File, folder: string = '/client-media'): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress({ loaded: 0, total: file.size, percentage: 0 });
    setError(null);

    try {
      // Get authentication params from our edge function
      const authParams = await getAuthParams();

      // Create form data for ImageKit upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('folder', folder);
      formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
      formData.append('signature', authParams.signature);
      formData.append('expire', authParams.expire.toString());
      formData.append('token', authParams.token);

      // Upload to ImageKit
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<UploadResult>((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setProgress({
              loaded: event.loaded,
              total: event.total,
              percentage,
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve({
              fileId: response.fileId,
              url: response.url,
              thumbnailUrl: response.thumbnailUrl || `${response.url}/tr:w-400,h-300,fo-auto`,
              name: response.name,
              size: response.size,
              fileType: response.fileType,
            });
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.onabort = () => reject(new Error('Upload aborted'));
      });

      xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');
      xhr.send(formData);

      const result = await uploadPromise;
      setProgress({ loaded: file.size, total: file.size, percentage: 100 });
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [getAuthParams]);

  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    // Note: File deletion should be handled via a backend function for security
    // For now, we'll just remove from our database
    console.log('File deletion requested for:', fileId);
  }, []);

  return {
    upload,
    deleteFile,
    isUploading,
    progress,
    error,
  };
}
