const rawVersion = (import.meta.env.APP_VERSION || '').trim();
const normalizedVersion = rawVersion === '0.1' ? '0.1' : '1.0';

export const appVersion = normalizedVersion;
export const isFullVersion = appVersion === '1.0';
export const isLiteVersion = appVersion === '0.1';
