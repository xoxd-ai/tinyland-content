import { afterEach, describe, expect, it } from 'vitest';
import * as content from '../src/index.js';
import * as productLoader from '../src/product-loader/index.js';

// tummycrypt_tinyland_product_loader was merged into this module. The
// ./product-loader subpath keeps its exact API; the root facade keeps the
// aliased names it already re-exported from the standalone package.
describe('product loader merge', () => {
  afterEach(() => {
    productLoader.resetConfig();
  });

  it('keeps the original API on the ./product-loader subpath', () => {
    expect(Object.keys(productLoader).sort()).toEqual([
      'configure',
      'getAllCategoriesServer',
      'getAllProductTagsServer',
      'getConfig',
      'getFeaturedProductsServer',
      'getProductBySlugServer',
      'getProductsByCategoryServer',
      'getPublishedProductsServer',
      'getRelatedProductsServer',
      'loadProductsServer',
      'resetConfig',
      'searchProductsServer',
    ]);
  });

  it('re-exports the same functions on the root facade', () => {
    expect(content.loadProductsServer).toBe(productLoader.loadProductsServer);
    expect(content.getPublishedProductsServer).toBe(productLoader.getPublishedProductsServer);
    expect(content.getFeaturedProductsServer).toBe(productLoader.getFeaturedProductsServer);
    expect(content.getProductBySlugServer).toBe(productLoader.getProductBySlugServer);
    expect(content.getProductsByCategoryServer).toBe(productLoader.getProductsByCategoryServer);
    expect(content.getAllCategoriesServer).toBe(productLoader.getAllCategoriesServer);
    expect(content.getAllProductTagsServer).toBe(productLoader.getAllProductTagsServer);
    expect(content.searchProductsServer).toBe(productLoader.searchProductsServer);
    expect(content.getRelatedProductsServer).toBe(productLoader.getRelatedProductsServer);
    expect(content.configureProductLoader).toBe(productLoader.configure);
    expect(content.getProductLoaderConfig).toBe(productLoader.getConfig);
    expect(content.resetProductLoaderConfig).toBe(productLoader.resetConfig);
  });

  it('shares one configuration between the facade and the subpath', () => {
    const loaded: productLoader.LoadedContent[] = [
      {
        metadata: { name: 'Merged', category: 'tools', published: true },
        content: 'Body text',
        slug: 'merged',
        filePath: '/content/products/merged.md',
      },
    ];
    content.configureProductLoader({ loadContent: () => loaded });
    expect(productLoader.getPublishedProductsServer().map((product) => product.slug)).toEqual(['merged']);
    expect(content.getProductBySlugServer('merged')?.frontmatter.category).toBe('tools');
    productLoader.resetConfig();
    expect(content.getProductLoaderConfig()).toEqual({});
  });
});
