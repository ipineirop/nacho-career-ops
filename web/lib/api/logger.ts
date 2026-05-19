export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function formatLog(entry: LogEntry): string {
  const { timestamp, level, message, context, error } = entry;
  const parts = [
    `[${timestamp}]`,
    `[${level.toUpperCase()}]`,
    message,
  ];

  if (context && Object.keys(context).length > 0) {
    parts.push(`| context: ${JSON.stringify(context)}`);
  }

  if (error) {
    parts.push(`| error: ${error.name}: ${error.message}`);
  }

  return parts.join(' ');
}

export const logger = {
  debug: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
    };
    console.log(formatLog(entry));
  },

  info: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    };
    console.log(formatLog(entry));
  },

  warn: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
    };
    console.warn(formatLog(entry));
  },

  error: (message: string, error?: Error, context?: Record<string, any>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
    console.error(formatLog(entry));
  },
};
