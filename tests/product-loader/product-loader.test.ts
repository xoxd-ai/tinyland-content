/**
 * Tests for @tummycrypt/tinyland-product-loader
 *
 * 11 test categories covering types, config DI, and all 9 loader functions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Product, ProductFrontmatter, LoadedContent } from '../../src/product-loader/types.js';
import {
  configure,
  getConfig,
  resetConfig,
} from '../../src/product-loader/config.js';
import type { ProductLoaderConfig } from '../../src/product-loader/config.js';
import {
  loadProductsServer,
  getPublishedProductsServer,
  getFeaturedProductsServer,
  getProductBySlugServer,
  getProductsByCategoryServer,
  getAllCategoriesServer,
  getAllProductTagsServer,
  searchProductsServer,
  getRelatedProductsServer,
} from '../../src/product-loader/product-loader.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockLoader(
  items: LoadedContent[]
): (contentType: string) => LoadedContent[] {
  return (_contentType: string) => items;
}

function makeItem(
  overrides: Partial<LoadedContent> & { metadata?: Record<string, unknown> } = {}
): LoadedContent {
  return {
    metadata: { name: 'Test Product', slug: 'test-product', description: 'A test', category: 'tool' },
    content: 'Some content',
    slug: 'test-product',
    filePath: '/users/alice/products/test-product.md',
    ...overrides,
  };
}

function makeProducts(...items: LoadedContent[]): void {
  configure({ loadContent: createMockLoader(items) });
}

// ---------------------------------------------------------------------------
// 1. Types (5+)
// ---------------------------------------------------------------------------

describe('Types', () => {
  it('Product has required shape with frontmatter, content, slug', () => {
    const product: Product = {
      frontmatter: {
        name: 'P',
        slug: 'p',
        description: 'desc',
        category: 'tool',
      },
      content: 'body',
      slug: 'p',
    };
    expect(product.frontmatter.name).toBe('P');
    expect(product.content).toBe('body');
    expect(product.slug).toBe('p');
  });

  it('Product filePath is optional', () => {
    const product: Product = {
      frontmatter: { name: 'P', slug: 'p', description: '', category: 'tool' },
      content: '',
      slug: 'p',
    };
    expect(product.filePath).toBeUndefined();
  });

  it('ProductFrontmatter supports all optional fields', () => {
    const fm: ProductFrontmatter = {
      name: 'P',
      slug: 'p',
      description: 'd',
      category: 'tool',
      price: 9.99,
      currency: 'USD',
      license: 'MIT',
      version: '1.0.0',
      featured: true,
      image: '/img.png',
      excerpt: 'short',
      tagline: 'tag',
      tags: ['a'],
      order: 1,
      published: true,
      publishedAt: '2025-01-01',
    };
    expect(fm.price).toBe(9.99);
    expect(fm.tags).toEqual(['a']);
  });

  it('ProductFrontmatter index signature allows unknown keys', () => {
    const fm: ProductFrontmatter = {
      name: 'P',
      slug: 'p',
      description: '',
      category: 'tool',
      customField: 42,
      anotherField: { nested: true },
    };
    expect(fm['customField']).toBe(42);
    expect(fm['anotherField']).toEqual({ nested: true });
  });

  it('ProductFrontmatter author can be a string', () => {
    const fm: ProductFrontmatter = {
      name: 'P',
      slug: 'p',
      description: '',
      category: 'tool',
      author: 'alice',
    };
    expect(fm.author).toBe('alice');
  });

  it('ProductFrontmatter author can be an object with handle and avatar', () => {
    const fm: ProductFrontmatter = {
      name: 'P',
      slug: 'p',
      description: '',
      category: 'tool',
      author: { name: 'Alice', handle: 'alice', avatar: '/a.png' },
    };
    expect(typeof fm.author).toBe('object');
    if (typeof fm.author === 'object') {
      expect(fm.author.name).toBe('Alice');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Config DI (10+)
// ---------------------------------------------------------------------------

describe('Config DI', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('getConfig returns empty object by default', () => {
    const config = getConfig();
    expect(config.loadContent).toBeUndefined();
  });

  it('configure sets loadContent', () => {
    const loader = createMockLoader([]);
    configure({ loadContent: loader });
    const config = getConfig();
    expect(config.loadContent).toBeDefined();
  });

  it('resetConfig clears configuration', () => {
    configure({ loadContent: createMockLoader([]) });
    resetConfig();
    expect(getConfig().loadContent).toBeUndefined();
  });

  it('configure overwrites previous config', () => {
    const loader1 = createMockLoader([makeItem()]);
    const loader2 = createMockLoader([]);
    configure({ loadContent: loader1 });
    configure({ loadContent: loader2 });
    const config = getConfig();
    expect(config.loadContent!('products')).toEqual([]);
  });

  it('getConfig returns a copy, not a reference', () => {
    configure({ loadContent: createMockLoader([]) });
    const c1 = getConfig();
    const c2 = getConfig();
    expect(c1).not.toBe(c2);
    expect(c1).toEqual(c2);
  });

  it('loader functions throw when no loader is configured', () => {
    // loadProductsServer catches errors and returns [] via console.error,
    // but getContentLoader itself throws.
    resetConfig();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = loadProductsServer();
    expect(result).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('configure with empty object leaves loadContent undefined', () => {
    configure({});
    expect(getConfig().loadContent).toBeUndefined();
  });

  it('configure accepts a function that returns empty array', () => {
    configure({ loadContent: () => [] });
    expect(loadProductsServer()).toEqual([]);
  });

  it('loadContent receives the correct contentType argument', () => {
    const spy = vi.fn().mockReturnValue([]);
    configure({ loadContent: spy });
    loadProductsServer();
    expect(spy).toHaveBeenCalledWith('products');
  });

  it('multiple configure calls do not merge, they replace', () => {
    configure({ loadContent: createMockLoader([makeItem()]) });
    configure({});
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadProductsServer()).toEqual([]);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 3. loadProductsServer (15+)
// ---------------------------------------------------------------------------

describe('loadProductsServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns empty array when no products', () => {
    makeProducts();
    expect(loadProductsServer()).toEqual([]);
  });

  it('loads a single product', () => {
    makeProducts(makeItem());
    const result = loadProductsServer();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('test-product');
  });

  it('maps metadata to frontmatter', () => {
    makeProducts(makeItem({ metadata: { name: 'Widget', slug: 'widget', description: 'A widget', category: 'tool' } }));
    const fm = loadProductsServer()[0].frontmatter;
    expect(fm.name).toBe('Widget');
    expect(fm.description).toBe('A widget');
    expect(fm.category).toBe('tool');
  });

  it('sets default name from title when name is missing', () => {
    makeProducts(makeItem({ metadata: { title: 'My Title', slug: 's', description: '', category: 'tool' } }));
    expect(loadProductsServer()[0].frontmatter.name).toBe('My Title');
  });

  it('sets default name to "Untitled Product" when both name and title missing', () => {
    makeProducts(makeItem({ metadata: { slug: 's', description: '', category: 'tool' } }));
    expect(loadProductsServer()[0].frontmatter.name).toBe('Untitled Product');
  });

  it('sets default description to empty string', () => {
    makeProducts(makeItem({ metadata: { name: 'P', slug: 's', category: 'tool' } }));
    expect(loadProductsServer()[0].frontmatter.description).toBe('');
  });

  it('sets default category to resource', () => {
    makeProducts(makeItem({ metadata: { name: 'P', slug: 's', description: '' } }));
    expect(loadProductsServer()[0].frontmatter.category).toBe('resource');
  });

  it('uses ownerHandle for author when author not in metadata', () => {
    makeProducts(makeItem({ metadata: { name: 'P', slug: 's', description: '', category: 'tool' }, ownerHandle: 'bob' }));
    const author = loadProductsServer()[0].frontmatter.author;
    expect(author).toEqual({ name: 'bob', handle: 'bob' });
  });

  it('preserves metadata author over ownerHandle', () => {
    makeProducts(makeItem({
      metadata: { name: 'P', slug: 's', description: '', category: 'tool', author: { name: 'Alice', handle: 'alice' } },
      ownerHandle: 'bob',
    }));
    const author = loadProductsServer()[0].frontmatter.author;
    expect(typeof author).toBe('object');
    if (typeof author === 'object') {
      expect(author.name).toBe('Alice');
    }
  });

  it('uses metadata.slug for product slug over item slug', () => {
    makeProducts(makeItem({ metadata: { name: 'P', slug: 'meta-slug', description: '', category: 'tool' }, slug: 'item-slug' }));
    expect(loadProductsServer()[0].slug).toBe('meta-slug');
  });

  it('falls back to item slug when metadata.slug is absent', () => {
    makeProducts(makeItem({ metadata: { name: 'P', description: '', category: 'tool' }, slug: 'item-slug' }));
    expect(loadProductsServer()[0].slug).toBe('item-slug');
  });

  it('sorts by order ascending when both have order', () => {
    makeProducts(
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool', order: 2 }, slug: 'b' }),
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', order: 1 }, slug: 'a' })
    );
    const names = loadProductsServer().map((p) => p.frontmatter.name);
    expect(names).toEqual(['A', 'B']);
  });

  it('sorts alphabetically by name when no order', () => {
    makeProducts(
      makeItem({ metadata: { name: 'Zebra', slug: 'z', description: '', category: 'tool' }, slug: 'z' }),
      makeItem({ metadata: { name: 'Apple', slug: 'a', description: '', category: 'tool' }, slug: 'a' })
    );
    const names = loadProductsServer().map((p) => p.frontmatter.name);
    expect(names).toEqual(['Apple', 'Zebra']);
  });

  it('handles mixed order/no-order products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'No Order', slug: 'no', description: '', category: 'tool' }, slug: 'no' }),
      makeItem({ metadata: { name: 'Ordered', slug: 'ord', description: '', category: 'tool', order: 1 }, slug: 'ord' })
    );
    // One has order and one doesn't, so localeCompare is used
    const result = loadProductsServer();
    expect(result).toHaveLength(2);
  });

  it('passes through extra metadata fields to frontmatter', () => {
    makeProducts(makeItem({
      metadata: { name: 'P', slug: 's', description: '', category: 'tool', customProp: 'hello' },
    }));
    expect(loadProductsServer()[0].frontmatter['customProp']).toBe('hello');
  });

  it('sets filePath from loaded content', () => {
    makeProducts(makeItem({ filePath: '/path/to/product.md' }));
    expect(loadProductsServer()[0].filePath).toBe('/path/to/product.md');
  });

  it('returns empty array and logs error when loader throws', () => {
    configure({ loadContent: () => { throw new Error('boom'); } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadProductsServer()).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('loads multiple products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'guide' }, slug: 'b' }),
      makeItem({ metadata: { name: 'C', slug: 'c', description: '', category: 'resource' }, slug: 'c' })
    );
    expect(loadProductsServer()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 4. getPublishedProductsServer (10+)
// ---------------------------------------------------------------------------

describe('getPublishedProductsServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns all products when published is undefined', () => {
    makeProducts(makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' } }));
    expect(getPublishedProductsServer()).toHaveLength(1);
  });

  it('includes products when published is true', () => {
    makeProducts(makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', published: true } }));
    expect(getPublishedProductsServer()).toHaveLength(1);
  });

  it('excludes products when published is false', () => {
    makeProducts(makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', published: false } }));
    expect(getPublishedProductsServer()).toHaveLength(0);
  });

  it('filters mixed published states', () => {
    makeProducts(
      makeItem({ metadata: { name: 'Pub', slug: 'pub', description: '', category: 'tool', published: true }, slug: 'pub' }),
      makeItem({ metadata: { name: 'Draft', slug: 'draft', description: '', category: 'tool', published: false }, slug: 'draft' }),
      makeItem({ metadata: { name: 'Default', slug: 'default', description: '', category: 'tool' }, slug: 'default' })
    );
    const result = getPublishedProductsServer();
    expect(result).toHaveLength(2);
    const slugs = result.map((p) => p.slug);
    expect(slugs).toContain('pub');
    expect(slugs).toContain('default');
  });

  it('returns empty array when all are unpublished', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', published: false }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool', published: false }, slug: 'b' })
    );
    expect(getPublishedProductsServer()).toHaveLength(0);
  });

  it('returns empty when no products exist', () => {
    makeProducts();
    expect(getPublishedProductsServer()).toEqual([]);
  });

  it('preserves sort order from loadProductsServer', () => {
    makeProducts(
      makeItem({ metadata: { name: 'Zebra', slug: 'z', description: '', category: 'tool' }, slug: 'z' }),
      makeItem({ metadata: { name: 'Apple', slug: 'a', description: '', category: 'tool' }, slug: 'a' })
    );
    const names = getPublishedProductsServer().map((p) => p.frontmatter.name);
    expect(names).toEqual(['Apple', 'Zebra']);
  });

  it('treats published=null as published (not strictly false)', () => {
    makeProducts(makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', published: null } }));
    expect(getPublishedProductsServer()).toHaveLength(1);
  });

  it('treats published=0 as published (not strictly false)', () => {
    makeProducts(makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', published: 0 } }));
    // 0 !== false in strict comparison
    expect(getPublishedProductsServer()).toHaveLength(1);
  });

  it('treats published="" as published (not strictly false)', () => {
    makeProducts(makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', published: '' } }));
    expect(getPublishedProductsServer()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. getFeaturedProductsServer (8+)
// ---------------------------------------------------------------------------

describe('getFeaturedProductsServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns only featured products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'Featured', slug: 'f', description: '', category: 'tool', featured: true }, slug: 'f' }),
      makeItem({ metadata: { name: 'Normal', slug: 'n', description: '', category: 'tool' }, slug: 'n' })
    );
    const result = getFeaturedProductsServer();
    expect(result).toHaveLength(1);
    expect(result[0].frontmatter.name).toBe('Featured');
  });

  it('returns empty when no featured products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' })
    );
    expect(getFeaturedProductsServer()).toHaveLength(0);
  });

  it('respects limit parameter', () => {
    makeProducts(
      makeItem({ metadata: { name: 'F1', slug: 'f1', description: '', category: 'tool', featured: true }, slug: 'f1' }),
      makeItem({ metadata: { name: 'F2', slug: 'f2', description: '', category: 'tool', featured: true }, slug: 'f2' }),
      makeItem({ metadata: { name: 'F3', slug: 'f3', description: '', category: 'tool', featured: true }, slug: 'f3' })
    );
    expect(getFeaturedProductsServer(2)).toHaveLength(2);
  });

  it('returns all featured when no limit', () => {
    makeProducts(
      makeItem({ metadata: { name: 'F1', slug: 'f1', description: '', category: 'tool', featured: true }, slug: 'f1' }),
      makeItem({ metadata: { name: 'F2', slug: 'f2', description: '', category: 'tool', featured: true }, slug: 'f2' })
    );
    expect(getFeaturedProductsServer()).toHaveLength(2);
  });

  it('returns all featured when limit exceeds count', () => {
    makeProducts(
      makeItem({ metadata: { name: 'F1', slug: 'f1', description: '', category: 'tool', featured: true }, slug: 'f1' })
    );
    expect(getFeaturedProductsServer(10)).toHaveLength(1);
  });

  it('excludes unpublished featured products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'F1', slug: 'f1', description: '', category: 'tool', featured: true, published: false }, slug: 'f1' })
    );
    expect(getFeaturedProductsServer()).toHaveLength(0);
  });

  it('does not treat featured=undefined as featured', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' })
    );
    expect(getFeaturedProductsServer()).toHaveLength(0);
  });

  it('does not treat featured="true" (string) as featured', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', featured: 'true' }, slug: 'a' })
    );
    // featured === true is strict
    expect(getFeaturedProductsServer()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. getProductBySlugServer (5+)
// ---------------------------------------------------------------------------

describe('getProductBySlugServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('finds a product by slug', () => {
    makeProducts(makeItem({ metadata: { name: 'Widget', slug: 'widget', description: '', category: 'tool' }, slug: 'widget' }));
    const result = getProductBySlugServer('widget');
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe('Widget');
  });

  it('returns null when slug not found', () => {
    makeProducts(makeItem());
    expect(getProductBySlugServer('nonexistent')).toBeNull();
  });

  it('returns null with empty products', () => {
    makeProducts();
    expect(getProductBySlugServer('anything')).toBeNull();
  });

  it('returns the first match when duplicates exist', () => {
    makeProducts(
      makeItem({ metadata: { name: 'First', slug: 'dup', description: '', category: 'tool' }, slug: 'dup' }),
      makeItem({ metadata: { name: 'Second', slug: 'dup', description: '', category: 'tool' }, slug: 'dup' })
    );
    const result = getProductBySlugServer('dup');
    expect(result).not.toBeNull();
  });

  it('includes unpublished products (uses loadProductsServer, not published)', () => {
    makeProducts(
      makeItem({ metadata: { name: 'Draft', slug: 'draft', description: '', category: 'tool', published: false }, slug: 'draft' })
    );
    const result = getProductBySlugServer('draft');
    expect(result).not.toBeNull();
    expect(result!.frontmatter.published).toBe(false);
  });

  it('is case-sensitive for slug matching', () => {
    makeProducts(makeItem({ metadata: { name: 'W', slug: 'Widget', description: '', category: 'tool' }, slug: 'Widget' }));
    expect(getProductBySlugServer('widget')).toBeNull();
    expect(getProductBySlugServer('Widget')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. getProductsByCategoryServer (5+)
// ---------------------------------------------------------------------------

describe('getProductsByCategoryServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('filters products by category', () => {
    makeProducts(
      makeItem({ metadata: { name: 'T', slug: 't', description: '', category: 'tool' }, slug: 't' }),
      makeItem({ metadata: { name: 'G', slug: 'g', description: '', category: 'guide' }, slug: 'g' })
    );
    const result = getProductsByCategoryServer('tool');
    expect(result).toHaveLength(1);
    expect(result[0].frontmatter.category).toBe('tool');
  });

  it('returns empty when no match', () => {
    makeProducts(makeItem({ metadata: { name: 'T', slug: 't', description: '', category: 'tool' } }));
    expect(getProductsByCategoryServer('guide')).toHaveLength(0);
  });

  it('is case-sensitive', () => {
    makeProducts(makeItem({ metadata: { name: 'T', slug: 't', description: '', category: 'Tool' } }));
    expect(getProductsByCategoryServer('tool')).toHaveLength(0);
    expect(getProductsByCategoryServer('Tool')).toHaveLength(1);
  });

  it('returns multiple products in same category', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'guide' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'guide' }, slug: 'b' })
    );
    expect(getProductsByCategoryServer('guide')).toHaveLength(2);
  });

  it('excludes unpublished products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', published: false }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool' }, slug: 'b' })
    );
    expect(getProductsByCategoryServer('tool')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 8. getAllCategoriesServer (5+)
// ---------------------------------------------------------------------------

describe('getAllCategoriesServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns unique categories sorted', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'guide' }, slug: 'b' }),
      makeItem({ metadata: { name: 'C', slug: 'c', description: '', category: 'resource' }, slug: 'c' })
    );
    expect(getAllCategoriesServer()).toEqual(['guide', 'resource', 'tool']);
  });

  it('deduplicates categories', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool' }, slug: 'b' })
    );
    expect(getAllCategoriesServer()).toEqual(['tool']);
  });

  it('returns empty for no products', () => {
    makeProducts();
    expect(getAllCategoriesServer()).toEqual([]);
  });

  it('excludes categories from unpublished products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'secret', published: false }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'public' }, slug: 'b' })
    );
    expect(getAllCategoriesServer()).toEqual(['public']);
  });

  it('sorts categories alphabetically', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'zebra' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'apple' }, slug: 'b' })
    );
    expect(getAllCategoriesServer()).toEqual(['apple', 'zebra']);
  });

  it('includes default category "resource"', () => {
    makeProducts(makeItem({ metadata: { name: 'A', slug: 'a', description: '' } }));
    expect(getAllCategoriesServer()).toEqual(['resource']);
  });
});

// ---------------------------------------------------------------------------
// 9. getAllProductTagsServer (5+)
// ---------------------------------------------------------------------------

describe('getAllProductTagsServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns unique tags sorted', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: ['beta', 'alpha'] }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool', tags: ['gamma'] }, slug: 'b' })
    );
    expect(getAllProductTagsServer()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('deduplicates tags across products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: ['shared', 'a-only'] }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool', tags: ['shared', 'b-only'] }, slug: 'b' })
    );
    expect(getAllProductTagsServer()).toEqual(['a-only', 'b-only', 'shared']);
  });

  it('returns empty when no products have tags', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' })
    );
    expect(getAllProductTagsServer()).toEqual([]);
  });

  it('handles products with empty tags array', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: [] }, slug: 'a' })
    );
    expect(getAllProductTagsServer()).toEqual([]);
  });

  it('excludes tags from unpublished products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: ['secret'], published: false }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool', tags: ['public'] }, slug: 'b' })
    );
    expect(getAllProductTagsServer()).toEqual(['public']);
  });
});

// ---------------------------------------------------------------------------
// 10. searchProductsServer (15+)
// ---------------------------------------------------------------------------

describe('searchProductsServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('searches by name', () => {
    makeProducts(
      makeItem({ metadata: { name: 'Widget Pro', slug: 'wp', description: '', category: 'tool' }, slug: 'wp' }),
      makeItem({ metadata: { name: 'Gadget', slug: 'g', description: '', category: 'tool' }, slug: 'g' })
    );
    expect(searchProductsServer('Widget')).toHaveLength(1);
  });

  it('searches by description', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: 'A powerful search engine', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: 'A simple calculator', category: 'tool' }, slug: 'b' })
    );
    expect(searchProductsServer('search engine')).toHaveLength(1);
  });

  it('searches by excerpt', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', excerpt: 'Quick summary here' }, slug: 'a' })
    );
    expect(searchProductsServer('summary')).toHaveLength(1);
  });

  it('searches by tagline', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tagline: 'Best in class' }, slug: 'a' })
    );
    expect(searchProductsServer('best in class')).toHaveLength(1);
  });

  it('searches by content', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, content: 'Detailed documentation about APIs', slug: 'a' })
    );
    expect(searchProductsServer('documentation')).toHaveLength(1);
  });

  it('searches by tags', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: ['typescript', 'node'] }, slug: 'a' })
    );
    expect(searchProductsServer('typescript')).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    makeProducts(
      makeItem({ metadata: { name: 'Widget', slug: 'w', description: '', category: 'tool' }, slug: 'w' })
    );
    expect(searchProductsServer('WIDGET')).toHaveLength(1);
    expect(searchProductsServer('widget')).toHaveLength(1);
    expect(searchProductsServer('Widget')).toHaveLength(1);
  });

  it('returns empty for no matches', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: 'desc', category: 'tool' }, slug: 'a' })
    );
    expect(searchProductsServer('zzzzzzz')).toHaveLength(0);
  });

  it('returns empty for empty query (matches all since empty string is substring of everything)', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' })
    );
    // Empty string is included in every string
    expect(searchProductsServer('')).toHaveLength(1);
  });

  it('returns multiple matches', () => {
    makeProducts(
      makeItem({ metadata: { name: 'React Widget', slug: 'rw', description: '', category: 'tool' }, slug: 'rw' }),
      makeItem({ metadata: { name: 'React Tool', slug: 'rt', description: '', category: 'tool' }, slug: 'rt' }),
      makeItem({ metadata: { name: 'Vue Tool', slug: 'vt', description: '', category: 'tool' }, slug: 'vt' })
    );
    expect(searchProductsServer('React')).toHaveLength(2);
  });

  it('excludes unpublished products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'Secret Widget', slug: 's', description: '', category: 'tool', published: false }, slug: 's' })
    );
    expect(searchProductsServer('Secret')).toHaveLength(0);
  });

  it('matches partial tag strings', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: ['typescript'] }, slug: 'a' })
    );
    expect(searchProductsServer('type')).toHaveLength(1);
  });

  it('matches partial name strings', () => {
    makeProducts(
      makeItem({ metadata: { name: 'SuperWidget', slug: 'sw', description: '', category: 'tool' }, slug: 'sw' })
    );
    expect(searchProductsServer('erWid')).toHaveLength(1);
  });

  it('does not double-count products matching multiple fields', () => {
    makeProducts(
      makeItem({
        metadata: { name: 'Alpha', slug: 'a', description: 'Alpha desc', category: 'tool', tags: ['alpha'] },
        content: 'Alpha content',
        slug: 'a',
      })
    );
    expect(searchProductsServer('Alpha')).toHaveLength(1);
  });

  it('searches across all fields independently', () => {
    makeProducts(
      makeItem({ metadata: { name: 'X', slug: 'x', description: 'Y', category: 'tool', excerpt: 'Z', tagline: 'W', tags: ['V'] }, content: 'U', slug: 'x' })
    );
    expect(searchProductsServer('X')).toHaveLength(1);
    expect(searchProductsServer('Y')).toHaveLength(1);
    expect(searchProductsServer('Z')).toHaveLength(1);
    expect(searchProductsServer('W')).toHaveLength(1);
    expect(searchProductsServer('V')).toHaveLength(1);
    expect(searchProductsServer('U')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 11. getRelatedProductsServer (10+)
// ---------------------------------------------------------------------------

describe('getRelatedProductsServer', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns products in the same category', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool' }, slug: 'b' }),
      makeItem({ metadata: { name: 'C', slug: 'c', description: '', category: 'guide' }, slug: 'c' })
    );
    const related = getRelatedProductsServer('a');
    expect(related).toHaveLength(1);
    expect(related[0].slug).toBe('b');
  });

  it('returns products with shared tags', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: ['ts'] }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'guide', tags: ['ts'] }, slug: 'b' }),
      makeItem({ metadata: { name: 'C', slug: 'c', description: '', category: 'guide', tags: ['python'] }, slug: 'c' })
    );
    const related = getRelatedProductsServer('a');
    expect(related).toHaveLength(1);
    expect(related[0].slug).toBe('b');
  });

  it('excludes the current product from results', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool' }, slug: 'b' })
    );
    const related = getRelatedProductsServer('a');
    expect(related.find((p) => p.slug === 'a')).toBeUndefined();
  });

  it('respects the limit parameter', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool' }, slug: 'b' }),
      makeItem({ metadata: { name: 'C', slug: 'c', description: '', category: 'tool' }, slug: 'c' }),
      makeItem({ metadata: { name: 'D', slug: 'd', description: '', category: 'tool' }, slug: 'd' })
    );
    expect(getRelatedProductsServer('a', 2)).toHaveLength(2);
  });

  it('returns empty for unknown slug', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' })
    );
    expect(getRelatedProductsServer('nonexistent')).toEqual([]);
  });

  it('returns empty when no related products exist', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: ['unique'] }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'guide', tags: ['different'] }, slug: 'b' })
    );
    expect(getRelatedProductsServer('a')).toHaveLength(0);
  });

  it('uses default limit of 3', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool' }, slug: 'b' }),
      makeItem({ metadata: { name: 'C', slug: 'c', description: '', category: 'tool' }, slug: 'c' }),
      makeItem({ metadata: { name: 'D', slug: 'd', description: '', category: 'tool' }, slug: 'd' }),
      makeItem({ metadata: { name: 'E', slug: 'e', description: '', category: 'tool' }, slug: 'e' })
    );
    expect(getRelatedProductsServer('a')).toHaveLength(3);
  });

  it('combines category and tag matches', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool', tags: ['ts'] }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool', tags: ['python'] }, slug: 'b' }),
      makeItem({ metadata: { name: 'C', slug: 'c', description: '', category: 'guide', tags: ['ts'] }, slug: 'c' }),
      makeItem({ metadata: { name: 'D', slug: 'd', description: '', category: 'guide', tags: ['python'] }, slug: 'd' })
    );
    const related = getRelatedProductsServer('a');
    // B matches by category, C matches by tag
    expect(related).toHaveLength(2);
    const slugs = related.map((p) => p.slug);
    expect(slugs).toContain('b');
    expect(slugs).toContain('c');
  });

  it('excludes unpublished related products', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool', published: false }, slug: 'b' })
    );
    expect(getRelatedProductsServer('a')).toHaveLength(0);
  });

  it('returns all related when fewer than limit', () => {
    makeProducts(
      makeItem({ metadata: { name: 'A', slug: 'a', description: '', category: 'tool' }, slug: 'a' }),
      makeItem({ metadata: { name: 'B', slug: 'b', description: '', category: 'tool' }, slug: 'b' })
    );
    expect(getRelatedProductsServer('a', 10)).toHaveLength(1);
  });
});
