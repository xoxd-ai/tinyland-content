/**
 * Dependency-injection configuration for the product loader.
 *
 * Call `configure()` once at application startup to provide a content-loading
 * function. If no loader is configured, all loader functions will throw with a
 * clear message explaining that a content loader must be injected.
 */

import type { LoadedContent } from './types.js';

/**
 * Configuration accepted by `configure()`.
 */
export interface ProductLoaderConfig {
  /**
   * A function that loads raw content items for a given content type.
   * When called with `'products'`, it should return an array of loaded content
   * objects representing product markdown files.
   */
  loadContent?: (contentType: string) => LoadedContent[];
}

let currentConfig: ProductLoaderConfig = {};

/**
 * Set the product loader configuration.
 *
 * @param config - Configuration object with an optional `loadContent` function.
 */
export function configure(config: ProductLoaderConfig): void {
  currentConfig = { ...config };
}

/**
 * Return the current configuration snapshot.
 */
export function getConfig(): ProductLoaderConfig {
  return { ...currentConfig };
}

/**
 * Reset configuration to empty defaults.
 */
export function resetConfig(): void {
  currentConfig = {};
}

/**
 * Internal helper -- returns the configured content loader or throws.
 */
export function getContentLoader(): (contentType: string) => LoadedContent[] {
  if (!currentConfig.loadContent) {
    throw new Error(
      'tinyland-product-loader: No content loader configured. ' +
        'Call configure({ loadContent }) before using any loader function.'
    );
  }
  return currentConfig.loadContent;
}
