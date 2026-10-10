/**
 * @tummycrypt/tinyland-content/product-loader
 *
 * Framework-agnostic product content loader with filtering, search,
 * and related-product resolution.
 *
 * @example
 * ```ts
 * import {
 *   configure,
 *   loadProductsServer,
 *   getPublishedProductsServer,
 * } from '@tummycrypt/tinyland-content/product-loader';
 *
 * configure({ loadContent: myContentLoader });
 * const products = getPublishedProductsServer();
 * ```
 */

// Types
export type {
  Product,
  ProductFrontmatter,
  AuthorReference,
  LoadedContent,
} from './types.js';

// Configuration
export {
  configure,
  getConfig,
  resetConfig,
} from './config.js';

export type { ProductLoaderConfig } from './config.js';

// Loader functions
export {
  loadProductsServer,
  getPublishedProductsServer,
  getFeaturedProductsServer,
  getProductBySlugServer,
  getProductsByCategoryServer,
  getAllCategoriesServer,
  getAllProductTagsServer,
  searchProductsServer,
  getRelatedProductsServer,
} from './product-loader.js';
