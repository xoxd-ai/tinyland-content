










import type { ActivityFeedConfig } from './types.js';

let _config: ActivityFeedConfig = {};





export function configure(config: Partial<ActivityFeedConfig>): void {
  _config = { ..._config, ...config };
}





export function getConfig(): ActivityFeedConfig {
  return { ..._config };
}





export function resetConfig(): void {
  _config = {};
}
