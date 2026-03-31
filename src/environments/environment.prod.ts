import type { Environment } from './environment.type';
import { NG_APP_BUILD_API_URL } from './ng-app-api-url.generated';

/**
 * `NG_APP_BUILD_API_URL` is written by `scripts/prebuild-env.mjs` from `NG_APP_API_URL`
 * during `npm run build` (Vercel should set `NG_APP_API_URL` for production API base URL).
 */
function resolveApiUrl(value: string): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'https://default-server.com';
}

export const environment: Environment = {
  production: true,
  apiUrl: resolveApiUrl(NG_APP_BUILD_API_URL),
};
