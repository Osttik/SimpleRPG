export interface ServerLogger {
  log: (message: string, details?: unknown) => void;
  warn: (message: string, details?: unknown) => void;
  error: (message: string, details?: unknown) => void;
}

function shouldLog() {
  return process.env.SIMPLERPG_SERVER_LOG !== '0';
}

function emit(level: 'log' | 'warn' | 'error', scope: string, message: string, details?: unknown) {
  if (!shouldLog()) {
    return;
  }

  const prefix = `[server][${scope}]`;
  if (details === undefined) {
    console[level](prefix, message);
    return;
  }

  console[level](prefix, message, details);
}

export function createServerLogger(scope: string): ServerLogger {
  return {
    log: (message, details) => emit('log', scope, message, details),
    warn: (message, details) => emit('warn', scope, message, details),
    error: (message, details) => emit('error', scope, message, details),
  };
}