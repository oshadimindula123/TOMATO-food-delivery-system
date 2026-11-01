const configuredOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

function isAllowedOrigin(origin) {
  if (!origin || origin === configuredOrigin) return true;
  if (process.env.NODE_ENV === 'production') return false;

  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname) &&
      Number(url.port) >= 5173 && Number(url.port) <= 5199 &&
      url.protocol === 'http:';
  } catch {
    return false;
  }
}

export const clientCors = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true
};
