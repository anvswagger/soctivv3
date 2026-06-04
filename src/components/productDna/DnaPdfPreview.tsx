/**
 * DnaPdfPreview — In-browser PDF preview with download and close controls.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, X, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDnaPdfDataUrl, downloadDnaPdf, cleanupDnaPdfUrl } from '@/services/pdfExportService';
import type { ProductDNA } from '@/types/productDNA';

interface DnaPdfPreviewProps {
    dna: ProductDNA;
    onClose?: () => void;
    className?: string;
}

export function DnaPdfPreview({ dna, onClose, className }: DnaPdfPreviewProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pdfUrlRef = useRef<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        setIsLoading(true);
        setError(null);

        getDnaPdfDataUrl(dna)
            .then((url) => {
                if (!mountedRef.current) return;
                if (pdfUrlRef.current && pdfUrlRef.current !== url) {
                    cleanupDnaPdfUrl(pdfUrlRef.current);
                }
                pdfUrlRef.current = url;
                setPdfUrl(url);
                setIsLoading(false);
            })
            .catch((err) => {
                if (!mountedRef.current) return;
                setError(err instanceof Error ? err.message : 'Failed to generate PDF preview');
                setIsLoading(false);
            });

        return () => {
            mountedRef.current = false;
            if (pdfUrlRef.current) {
                cleanupDnaPdfUrl(pdfUrlRef.current);
                pdfUrlRef.current = null;
            }
        };
    }, [dna]);

    const handleRetry = useCallback(() => {
        if (!mountedRef.current) return;
        setError(null);
        setIsLoading(true);
        if (pdfUrlRef.current) {
            cleanupDnaPdfUrl(pdfUrlRef.current);
            pdfUrlRef.current = null;
        }
        setPdfUrl(null);
    }, []);

    const handleDownload = useCallback(async () => {
        setIsDownloading(true);
        try {
            await downloadDnaPdf(dna);
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setIsDownloading(false);
        }
    }, [dna]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('w-full max-w-4xl mx-auto', className)}
        >
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">
                            معاينة تقرير Product DNA
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading || !!error}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            <Download className="w-3.5 h-3.5" />
                            {isDownloading ? 'Downloading...' : 'Download'}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="relative bg-muted/20" style={{ height: '600px' }}>
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Generating PDF preview...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80">
                            <p className="text-sm text-destructive">{error}</p>
                            <button
                                onClick={handleRetry}
                                className="text-sm text-primary hover:underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {pdfUrl && !isLoading && !error && (
                        <iframe
                            src={pdfUrl}
                            className="w-full h-full border-0"
                            title="Product DNA PDF Preview"
                            onError={() => setError('Failed to load PDF preview')}
                        />
                    )}
                </div>
            </div>
        </motion.div>
    );
}
