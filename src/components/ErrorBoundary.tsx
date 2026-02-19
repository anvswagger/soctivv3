import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { getLastCorrelationId } from '@/lib/correlationId';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const APP_RELEASE = import.meta.env.VITE_APP_VERSION ?? 'dev';
const COMMIT_SHA = (import.meta.env.VITE_COMMIT_SHA as string | undefined) ?? APP_RELEASE;
let sentryInitialized = false;

type ErrorTaxonomy =
    | 'network'
    | 'auth'
    | 'permission'
    | 'validation'
    | 'server'
    | 'unknown';

function parseSampleRate(rawValue: unknown, fallback: number): number {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    if (parsed < 0) return 0;
    if (parsed > 1) return 1;
    return parsed;
}

function normalizeErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
        return error.toLowerCase();
    }

    if (error instanceof Error) {
        return `${error.name} ${error.message}`.toLowerCase();
    }

    return '';
}

function classifyErrorTaxonomy(error: unknown): ErrorTaxonomy {
    const message = normalizeErrorMessage(error);

    if (!message) return 'unknown';
    if (message.includes('failed to fetch') || message.includes('network') || message.includes('timeout')) return 'network';
    if (message.includes('auth') || message.includes('token') || message.includes('session')) return 'auth';
    if (message.includes('forbidden') || message.includes('permission') || message.includes('unauthorized')) return 'permission';
    if (message.includes('validation') || message.includes('invalid') || message.includes('bad request')) return 'validation';
    if (message.includes('500') || message.includes('server') || message.includes('internal')) return 'server';

    return 'unknown';
}

function initSentryOnce() {
    if (!SENTRY_DSN || !import.meta.env.PROD) return;
    if (sentryInitialized) return;
    sentryInitialized = true;

    const tracesSampleRate = parseSampleRate(
        import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
        0.1,
    );
    const profilesSampleRate = parseSampleRate(
        import.meta.env.VITE_SENTRY_PROFILES_SAMPLE_RATE,
        0.03,
    );

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        release: APP_RELEASE,
        tracesSampleRate,
        profilesSampleRate,
        beforeSend: (event, hint) => {
            const taxonomy = classifyErrorTaxonomy(hint.originalException);
            const correlationId = getLastCorrelationId();

            event.tags = {
                ...event.tags,
                error_taxonomy: taxonomy,
                app_release: APP_RELEASE,
                commit_sha: COMMIT_SHA,
            };

            if (correlationId) {
                event.tags.correlation_id = correlationId;
            }

            return event;
        },
    });
}

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);

        try {
            initSentryOnce();
            if (SENTRY_DSN && import.meta.env.PROD) {
                const taxonomy = classifyErrorTaxonomy(error);
                const correlationId = getLastCorrelationId();

                Sentry.withScope((scope) => {
                    scope.setTag('error_taxonomy', taxonomy);
                    scope.setTag('app_release', APP_RELEASE);
                    scope.setTag('commit_sha', COMMIT_SHA);
                    if (correlationId) {
                        scope.setTag('correlation_id', correlationId);
                    }
                    scope.setExtra('componentStack', errorInfo.componentStack);
                    Sentry.captureException(error);
                });
            }
        } catch (reportingError) {
            // Never let reporting break the fallback UI.
            if (import.meta.env.DEV) {
                console.warn('Error reporting failed:', reportingError);
            }
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
                    <div className="text-center space-y-4 max-w-md">
                        <div className="text-6xl">⚠️</div>
                        <h1 className="text-2xl font-bold text-foreground">حدث خطأ غير متوقع</h1>
                        <p className="text-muted-foreground">
                            نعتذر، حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                            إعادة تحميل الصفحة
                        </button>
                        {import.meta.env.DEV && this.state.error && (
                            <details className="mt-4 text-left text-xs text-muted-foreground bg-muted p-3 rounded">
                                <summary className="cursor-pointer">تفاصيل الخطأ (للمطورين)</summary>
                                <pre className="mt-2 overflow-auto">{this.state.error.message}</pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

