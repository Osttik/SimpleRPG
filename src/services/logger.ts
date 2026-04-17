export interface FrontendLogger {
  log: (message: string, details?: unknown) => void;
  warn: (message: string, details?: unknown) => void;
  error: (message: string, details?: unknown) => void;
}

function shouldLog() {
  if (import.meta.env.VITE_FRONTEND_LOG === '0') {
    return false;
  }

  return import.meta.env.DEV || import.meta.env.VITE_FRONTEND_LOG === '1';
}

function emit(level: 'log' | 'warn' | 'error', scope: string, message: string, details?: unknown) {
  if (!shouldLog()) {
    return;
  }

  const prefix = `[frontend][${scope}]`;
  if (details === undefined) {
    console[level](prefix, message);
    return;
  }

  console[level](prefix, message, details);
}

export function createFrontendLogger(scope: string): FrontendLogger {
  return {
    log: (message, details) => emit('log', scope, message, details),
    warn: (message, details) => emit('warn', scope, message, details),
    error: (message, details) => emit('error', scope, message, details),
  };
}