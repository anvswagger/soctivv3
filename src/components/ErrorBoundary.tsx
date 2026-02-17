import { Component, ReactNode } from 'react';

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
let sentryInitialized = false;

function initSentryOnce() {
    if (!SENTRY_DSN || !import.meta.env.PROD) return;
    if (sentryInitialized) return;
    sentryInitialized = true;

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0,
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
                Sentry.withScope((scope) => {
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
