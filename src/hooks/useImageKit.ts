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

interface UploadOptions {
  onProgress?: (progress: UploadProgress & { indeterminate: boolean }) => void;
}

interface UseImageKitReturn {
  upload: (file: File, folder?: string, options?: UploadOptions) => Promise<UploadResult>;
  deleteFile: (fileId: string) => Promise<void>;
  isUploading: boolean;
  error: string | null;
}

interface ImageKitAuthParams {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
}

export function useImageKit(): UseImageKitReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthParams = useCallback(async (): Promise<ImageKitAuthParams> => {
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

    return response.data as ImageKitAuthParams;
  }, []);

  const upload = useCallback(async (
    file: File, 
    folder: string = '/client-media',
    options?: UploadOptions
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setError(null);

    // Send initial progress
    options?.onProgress?.({ loaded: 0, total: file.size, percentage: 0, indeterminate: false });

    try {
      // Get authentication params from our edge function
      const authParams = await getAuthParams();

      // Create form data for ImageKit upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('folder', folder);
      formData.append('publicKey', authParams.publicKey);
      formData.append('signature', authParams.signature);
      formData.append('expire', authParams.expire.toString());
      formData.append('token', authParams.token);

      // Upload to ImageKit
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<UploadResult>((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            options?.onProgress?.({
              loaded: event.loaded,
              total: event.total,
              percentage,
              indeterminate: false,
            });
          } else {
            // For large files, lengthComputable may be false
            options?.onProgress?.({
              loaded: event.loaded,
              total: file.size,
              percentage: Math.min(Math.round((event.loaded / file.size) * 100), 99),
              indeterminate: true,
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
            let errorMsg = `Upload failed: ${xhr.statusText}`;
            try {
              const errResponse = JSON.parse(xhr.responseText);
              errorMsg = errResponse.message || errResponse.error || errorMsg;
            } catch {}
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload aborted'));
      });

      xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');
      xhr.send(formData);

      const result = await uploadPromise;
      options?.onProgress?.({ loaded: file.size, total: file.size, percentage: 100, indeterminate: false });
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
    error,
  };
}
