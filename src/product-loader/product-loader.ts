/**
 * Product loader functions.
 *
 * All functions are synchronous and stateless -- they read products fresh from
 * the configured content loader on every call (no caching).
 */

import type { Product, ProductFrontmatter } from './types.js';
import { getContentLoader } from './config.js';

/**
 * Load all products from the configured content loader.
 * Products are sorted by `order` (ascending) then alphabetically by `name`.
 */
export function loadProductsServer(): Product[] {
  const products: Product[] = [];

  try {
    const loadContent = getContentLoader();
    const loadedProducts = loadContent('products');

    for (const item of loadedProducts) {
      const { metadata, content, slug, filePath, ownerHandle } = item;

      products.push({
        frontmatter: {
          name:
            (metadata.name as string) ||
            (metadata.title as string) ||
            'Untitled Product',
          slug: (metadata.slug as string) || slug,
          description: (metadata.description as string) || '',
          category: (metadata.category as string) || 'resource',
          author: (metadata.author as ProductFrontmatter['author']) || {
            name: ownerHandle,
            handle: ownerHandle,
          },
          ...metadata,
        } as ProductFrontmatter,
        content,
        slug: (metadata.slug as string) || slug,
        filePath,
      });
    }

    // Sort by order first (when both have order), then alphabetically by name
    products.sort((a, b) => {
      if (
        a.frontmatter.order !== undefined &&
        b.frontmatter.order !== undefined
      ) {
        return a.frontmatter.order - b.frontmatter.order;
      }
      return a.frontmatter.name.localeCompare(b.frontmatter.name);
    });

    return products;
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

/**
 * Get published products only.
 * A product is considered published unless `published` is explicitly `false`.
 */
export function getPublishedProductsServer(): Product[] {
  const products = loadProductsServer();
  return products.filter((product) => product.frontmatter.published !== false);
}

/**
 * Get featured products (published only).
 * @param limit - Optional maximum number of results.
 */
export function getFeaturedProductsServer(limit?: number): Product[] {
  const products = getPublishedProductsServer();
  const featured = products.filter(
    (product) => product.frontmatter.featured === true
  );
  return limit ? featured.slice(0, limit) : featured;
}

/**
 * Find a single product by its slug.
 * @returns The matching product or `null`.
 */
export function getProductBySlugServer(slug: string): Product | null {
  const products = loadProductsServer();
  return products.find((product) => product.slug === slug) || null;
}

/**
 * Get published products in a specific category.
 * Comparison is case-sensitive.
 */
export function getProductsByCategoryServer(category: string): Product[] {
  const products = getPublishedProductsServer();
  return products.filter(
    (product) => product.frontmatter.category === category
  );
}

/**
 * Get all unique category strings from published products, sorted.
 */
export function getAllCategoriesServer(): string[] {
  const products = getPublishedProductsServer();
  const categorySet = new Set<string>();
  products.forEach((product) => {
    if (product.frontmatter.category) {
      categorySet.add(product.frontmatter.category);
    }
  });
  return Array.from(categorySet).sort();
}

/**
 * Get all unique tags from published products, sorted.
 */
export function getAllProductTagsServer(): string[] {
  const products = getPublishedProductsServer();
  const tagSet = new Set<string>();
  products.forEach((product) => {
    product.frontmatter.tags?.forEach((tag) => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

/**
 * Search published products across name, description, excerpt, tagline,
 * content, and tags. Search is case-insensitive.
 */
export function searchProductsServer(query: string): Product[] {
  const products = getPublishedProductsServer();
  const searchTerm = query.toLowerCase();

  return products.filter((product) => {
    if (product.frontmatter.name.toLowerCase().includes(searchTerm)) {
      return true;
    }
    if (
      product.frontmatter.description?.toLowerCase().includes(searchTerm)
    ) {
      return true;
    }
    if (product.frontmatter.excerpt?.toLowerCase().includes(searchTerm)) {
      return true;
    }
    if (product.frontmatter.tagline?.toLowerCase().includes(searchTerm)) {
      return true;
    }
    if (product.content.toLowerCase().includes(searchTerm)) {
      return true;
    }
    if (
      product.frontmatter.tags?.some((tag) =>
        tag.toLowerCase().includes(searchTerm)
      )
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Get related products by category or shared tags (published only).
 * @param currentSlug - Slug of the product to find relations for.
 * @param limit - Maximum number of related products to return (default 3).
 */
export function getRelatedProductsServer(
  currentSlug: string,
  limit: number = 3
): Product[] {
  const products = getPublishedProductsServer();
  const currentProduct = products.find((p) => p.slug === currentSlug);

  if (!currentProduct) return [];

  const related = products.filter((product) => {
    if (product.slug === currentSlug) return false;

    // Check for matching category
    if (
      product.frontmatter.category === currentProduct.frontmatter.category
    ) {
      return true;
    }

    // Check for matching tags
    const currentTags = currentProduct.frontmatter.tags || [];
    const productTags = product.frontmatter.tags || [];
    const hasMatchingTag = currentTags.some((tag) =>
      productTags.includes(tag)
    );

    return hasMatchingTag;
  });

  return related.slice(0, limit);
}
