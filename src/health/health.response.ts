import { version as serviceVersion } from '../../package.json';

export interface ServiceHealthResponse {
  status: 'ok';
  version: string;
  buildAt: string;
}

const buildAt = process.env.BUILD_AT ?? new Date().toISOString();

export function createHealthResponse(): ServiceHealthResponse {
  return {
    status: 'ok',
    version: serviceVersion,
    buildAt,
  };
}
