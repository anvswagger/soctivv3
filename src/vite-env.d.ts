/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_PUSH_DEV?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_VERSION?: string;
}
