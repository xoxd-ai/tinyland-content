







import { describe, it, expect, beforeEach } from 'vitest';
import {
  configure,
  getConfig,
  resetConfig,
  getRecentActivityServer,
  getActivityByTypeServer,
  getActivityByCategoryServer,
  getActivityByTagServer,
  searchActivityServer,
} from '../src/activity-feed/index.js';
import type {
  BlogPostItem,
  ProfileItem,
  ProductItem,
  ActivityFeedConfig,
} from '../src/activity-feed/index.js';





function makeBlogPost(overrides: Partial<BlogPostItem> = {}): BlogPostItem {
  return {
    title: 'Test Blog Post',
    slug: 'test-blog-post',
    excerpt: 'A test blog post excerpt',
    date: '2025-06-15T00:00:00Z',
    author: 'Alice',
    category: 'tech',
    tags: ['svelte', 'typescript'],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ProfileItem> = {}): ProfileItem {
  return {
    name: 'Bob Smith',
    slug: 'bob-smith',
    bio: 'A community member bio',
    publishedAt: '2025-06-10T00:00:00Z',
    role: 'moderator',
    tags: ['community', 'events'],
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductItem> = {}): ProductItem {
  return {
    name: 'Cool Widget',
    slug: 'cool-widget',
    description: 'A useful widget',
    publishedAt: '2025-06-12T00:00:00Z',
    category: 'tools',
    tags: ['utility', 'widget'],
    license: 'MIT',
    ...overrides,
  };
}





beforeEach(() => {
  resetConfig();
});





describe('Configuration DI', () => {
  it('should return empty config by default', () => {
    const config = getConfig();
    expect(config).toEqual({});
  });

  it('should configure with loadBlogPosts', () => {
    const loader = () => [makeBlogPost()];
    configure({ loadBlogPosts: loader });
    const config = getConfig();
    expect(config.loadBlogPosts).toBeDefined();
  });

  it('should configure with loadProfiles', () => {
    const loader = () => [makeProfile()];
    configure({ loadProfiles: loader });
    const config = getConfig();
    expect(config.loadProfiles).toBeDefined();
  });

  it('should configure with loadProducts', () => {
    const loader = () => [makeProduct()];
    configure({ loadProducts: loader });
    const config = getConfig();
    expect(config.loadProducts).toBeDefined();
  });

  it('should merge configs incrementally', () => {
    configure({ loadBlogPosts: () => [] });
    configure({ loadProfiles: () => [] });
    const config = getConfig();
    expect(config.loadBlogPosts).toBeDefined();
    expect(config.loadProfiles).toBeDefined();
  });

  it('should override a previously configured loader', () => {
    const first = () => [makeBlogPost({ title: 'First' })];
    const second = () => [makeBlogPost({ title: 'Second' })];
    configure({ loadBlogPosts: first });
    configure({ loadBlogPosts: second });
    const config = getConfig();
    expect(config.loadBlogPosts!()).toEqual([makeBlogPost({ title: 'Second' })]);
  });

  it('should reset config to empty state', () => {
    configure({ loadBlogPosts: () => [] });
    resetConfig();
    const config = getConfig();
    expect(config).toEqual({});
  });

  it('should return a copy that cannot mutate internal state', () => {
    configure({ loadBlogPosts: () => [] });
    const config = getConfig();
    (config as Record<string, unknown>).loadBlogPosts = undefined;
    const fresh = getConfig();
    expect(fresh.loadBlogPosts).toBeDefined();
  });

  it('should configure all three loaders at once', () => {
    configure({
      loadBlogPosts: () => [],
      loadProfiles: () => [],
      loadProducts: () => [],
    });
    const config = getConfig();
    expect(config.loadBlogPosts).toBeDefined();
    expect(config.loadProfiles).toBeDefined();
    expect(config.loadProducts).toBeDefined();
  });

  it('should handle configure called with empty object', () => {
    configure({});
    const config = getConfig();
    expect(config).toEqual({});
  });
});





describe('getRecentActivityServer', () => {
  it('should return empty array with no loaders configured', () => {
    const result = getRecentActivityServer();
    expect(result).toEqual([]);
  });

  it('should return blog posts as activity items', () => {
    configure({ loadBlogPosts: () => [makeBlogPost()] });
    const result = getRecentActivityServer();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('post');
    expect(result[0].title).toBe('Test Blog Post');
  });

  it('should return profiles as activity items', () => {
    configure({ loadProfiles: () => [makeProfile()] });
    const result = getRecentActivityServer();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('profile');
    expect(result[0].title).toBe('Bob Smith');
  });

  it('should return products as activity items', () => {
    configure({ loadProducts: () => [makeProduct()] });
    const result = getRecentActivityServer();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('product');
    expect(result[0].title).toBe('Cool Widget');
  });

  it('should combine items from all three sources', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost()],
      loadProfiles: () => [makeProfile()],
      loadProducts: () => [makeProduct()],
    });
    const result = getRecentActivityServer(100);
    expect(result).toHaveLength(3);
    const types = result.map((r) => r.type);
    expect(types).toContain('post');
    expect(types).toContain('profile');
    expect(types).toContain('product');
  });

  it('should sort items by date descending (most recent first)', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'old', date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'new', date: '2025-12-01T00:00:00Z' }),
        makeBlogPost({ slug: 'mid', date: '2025-06-01T00:00:00Z' }),
      ],
    });
    const result = getRecentActivityServer(100);
    expect(result[0].slug).toBe('new');
    expect(result[1].slug).toBe('mid');
    expect(result[2].slug).toBe('old');
  });

  it('should sort mixed types by date descending', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'post-1', date: '2025-06-15T00:00:00Z' }),
      ],
      loadProfiles: () => [
        makeProfile({ slug: 'profile-1', publishedAt: '2025-07-01T00:00:00Z' }),
      ],
      loadProducts: () => [
        makeProduct({ slug: 'product-1', publishedAt: '2025-05-01T00:00:00Z' }),
      ],
    });
    const result = getRecentActivityServer(100);
    expect(result[0].slug).toBe('profile-1');
    expect(result[1].slug).toBe('post-1');
    expect(result[2].slug).toBe('product-1');
  });

  it('should respect the limit parameter', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'a', date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'b', date: '2025-02-01T00:00:00Z' }),
        makeBlogPost({ slug: 'c', date: '2025-03-01T00:00:00Z' }),
        makeBlogPost({ slug: 'd', date: '2025-04-01T00:00:00Z' }),
        makeBlogPost({ slug: 'e', date: '2025-05-01T00:00:00Z' }),
      ],
    });
    const result = getRecentActivityServer(3);
    expect(result).toHaveLength(3);
  });

  it('should default limit to 10', () => {
    const posts = Array.from({ length: 15 }, (_, i) =>
      makeBlogPost({
        slug: `post-${i}`,
        date: `2025-${String(i + 1).padStart(2, '0')}-01T00:00:00Z`,
      }),
    );
    configure({ loadBlogPosts: () => posts });
    const result = getRecentActivityServer();
    expect(result).toHaveLength(10);
  });

  it('should return fewer than limit if not enough items', () => {
    configure({ loadBlogPosts: () => [makeBlogPost()] });
    const result = getRecentActivityServer(100);
    expect(result).toHaveLength(1);
  });

  it('should handle empty loaders (returning empty arrays)', () => {
    configure({
      loadBlogPosts: () => [],
      loadProfiles: () => [],
      loadProducts: () => [],
    });
    const result = getRecentActivityServer();
    expect(result).toEqual([]);
  });

  it('should filter out draft blog posts', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'published', draft: false }),
        makeBlogPost({ slug: 'draft', draft: true }),
      ],
    });
    const result = getRecentActivityServer(100);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('published');
  });

  it('should filter out unpublished blog posts (published=false)', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'visible' }),
        makeBlogPost({ slug: 'hidden', published: false }),
      ],
    });
    const result = getRecentActivityServer(100);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('visible');
  });

  it('should include posts with published=true', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'yes', published: true }),
      ],
    });
    const result = getRecentActivityServer(100);
    expect(result).toHaveLength(1);
  });

  it('should include posts with no published/draft fields', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'default' }),
      ],
    });
    const result = getRecentActivityServer(100);
    expect(result).toHaveLength(1);
  });

  it('should use post.date as primary date', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ date: '2025-03-15T00:00:00Z', publishedAt: '2025-01-01T00:00:00Z' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].date).toBe('2025-03-15T00:00:00Z');
  });

  it('should fall back to publishedAt if date is missing', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ date: undefined, publishedAt: '2025-04-20T00:00:00Z' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].date).toBe('2025-04-20T00:00:00Z');
  });

  it('should extract author name from object', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ author: { name: 'Jane Doe' } }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].author).toBe('Jane Doe');
  });

  it('should use author string directly', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ author: 'John Smith' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].author).toBe('John Smith');
  });

  it('should default author to Unknown when missing', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ author: undefined }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].author).toBe('Unknown');
  });

  it('should use categories[0] as category', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ categories: ['programming', 'web'], category: undefined }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].category).toBe('programming');
  });

  it('should fall back to category field if categories is missing', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ categories: undefined, category: 'design' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].category).toBe('design');
  });

  it('should pick the first image from multiple image fields', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({
          featuredImage: '/img/featured.jpg',
          coverImage: '/img/cover.jpg',
          heroImage: '/img/hero.jpg',
        }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].image).toBe('/img/featured.jpg');
  });

  it('should fall back to coverImage if featuredImage is missing', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({
          featuredImage: undefined,
          coverImage: '/img/cover.jpg',
          heroImage: '/img/hero.jpg',
        }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].image).toBe('/img/cover.jpg');
  });

  it('should fall back to heroImage if others are missing', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({
          featuredImage: undefined,
          coverImage: undefined,
          heroImage: '/img/hero.jpg',
        }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].image).toBe('/img/hero.jpg');
  });

  it('should use displayName if name is missing for profile', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ name: undefined, displayName: 'Display Bob' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].title).toBe('Display Bob');
  });

  it('should default profile title to Community Member', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ name: undefined, displayName: undefined }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].title).toBe('Community Member');
  });
});





describe('getActivityByTypeServer', () => {
  const allConfig: ActivityFeedConfig = {
    loadBlogPosts: () => [
      makeBlogPost({ slug: 'post-1', date: '2025-06-01T00:00:00Z' }),
      makeBlogPost({ slug: 'post-2', date: '2025-05-01T00:00:00Z' }),
    ],
    loadProfiles: () => [
      makeProfile({ slug: 'profile-1', publishedAt: '2025-04-01T00:00:00Z' }),
    ],
    loadProducts: () => [
      makeProduct({ slug: 'product-1', publishedAt: '2025-03-01T00:00:00Z' }),
      makeProduct({ slug: 'product-2', publishedAt: '2025-02-01T00:00:00Z' }),
    ],
  };

  it('should filter by post type', () => {
    configure(allConfig);
    const result = getActivityByTypeServer('post');
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.type === 'post')).toBe(true);
  });

  it('should filter by profile type', () => {
    configure(allConfig);
    const result = getActivityByTypeServer('profile');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('profile');
  });

  it('should filter by product type', () => {
    configure(allConfig);
    const result = getActivityByTypeServer('product');
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.type === 'product')).toBe(true);
  });

  it('should apply limit to filtered results', () => {
    configure(allConfig);
    const result = getActivityByTypeServer('post', 1);
    expect(result).toHaveLength(1);
  });

  it('should return all if limit is undefined', () => {
    configure(allConfig);
    const result = getActivityByTypeServer('post');
    expect(result).toHaveLength(2);
  });

  it('should return empty array if no items of that type', () => {
    configure({ loadBlogPosts: () => [makeBlogPost()] });
    const result = getActivityByTypeServer('product');
    expect(result).toEqual([]);
  });

  it('should return empty array with no loaders configured', () => {
    const result = getActivityByTypeServer('post');
    expect(result).toEqual([]);
  });

  it('should sort results by date descending', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'old', date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'new', date: '2025-12-01T00:00:00Z' }),
      ],
    });
    const result = getActivityByTypeServer('post');
    expect(result[0].slug).toBe('new');
    expect(result[1].slug).toBe('old');
  });

  it('should not include other types when filtering', () => {
    configure(allConfig);
    const result = getActivityByTypeServer('profile');
    expect(result.every((r) => r.type === 'profile')).toBe(true);
    expect(result.some((r) => r.type === 'post')).toBe(false);
  });

  it('should exclude drafts when filtering posts', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'visible' }),
        makeBlogPost({ slug: 'draft', draft: true }),
      ],
    });
    const result = getActivityByTypeServer('post');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('visible');
  });

  it('should return products sorted by date', () => {
    configure({
      loadProducts: () => [
        makeProduct({ slug: 'old', publishedAt: '2024-01-01T00:00:00Z' }),
        makeProduct({ slug: 'new', publishedAt: '2025-01-01T00:00:00Z' }),
      ],
    });
    const result = getActivityByTypeServer('product');
    expect(result[0].slug).toBe('new');
  });

  it('should limit products when limit is provided', () => {
    configure({
      loadProducts: () => [
        makeProduct({ slug: 'a' }),
        makeProduct({ slug: 'b' }),
        makeProduct({ slug: 'c' }),
      ],
    });
    const result = getActivityByTypeServer('product', 2);
    expect(result).toHaveLength(2);
  });

  it('should handle limit larger than results', () => {
    configure({ loadProfiles: () => [makeProfile()] });
    const result = getActivityByTypeServer('profile', 100);
    expect(result).toHaveLength(1);
  });

  it('should handle limit of 0', () => {
    configure({ loadBlogPosts: () => [makeBlogPost()] });
    const result = getActivityByTypeServer('post', 0);
    expect(result).toHaveLength(0);
  });

  it('should set profileRole on profile items', () => {
    configure({ loadProfiles: () => [makeProfile({ role: 'admin' })] });
    const result = getActivityByTypeServer('profile');
    expect(result[0].profileRole).toBe('admin');
  });
});





describe('getActivityByCategoryServer', () => {
  it('should match items by category', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'tech-post', category: 'tech' }),
        makeBlogPost({ slug: 'art-post', category: 'art' }),
      ],
    });
    const result = getActivityByCategoryServer('tech');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('tech-post');
  });

  it('should match products by productCategory', () => {
    configure({
      loadProducts: () => [
        makeProduct({ slug: 'tool-1', category: 'tools' }),
        makeProduct({ slug: 'game-1', category: 'games' }),
      ],
    });
    const result = getActivityByCategoryServer('tools');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('tool-1');
  });

  it('should match profiles by category field (profile)', () => {
    configure({
      loadProfiles: () => [makeProfile()],
    });
    const result = getActivityByCategoryServer('profile');
    expect(result).toHaveLength(1);
  });

  it('should match both category and productCategory', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'tech-post', category: 'tech' }),
      ],
      loadProducts: () => [
        makeProduct({ slug: 'tech-product', category: 'tech' }),
      ],
    });
    const result = getActivityByCategoryServer('tech');
    expect(result).toHaveLength(2);
  });

  it('should return empty when no matches', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ category: 'tech' })],
    });
    const result = getActivityByCategoryServer('nonexistent');
    expect(result).toEqual([]);
  });

  it('should apply limit', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'a', category: 'tech', date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'b', category: 'tech', date: '2025-02-01T00:00:00Z' }),
        makeBlogPost({ slug: 'c', category: 'tech', date: '2025-03-01T00:00:00Z' }),
      ],
    });
    const result = getActivityByCategoryServer('tech', 2);
    expect(result).toHaveLength(2);
  });

  it('should return all when limit is undefined', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'a', category: 'tech' }),
        makeBlogPost({ slug: 'b', category: 'tech' }),
      ],
    });
    const result = getActivityByCategoryServer('tech');
    expect(result).toHaveLength(2);
  });

  it('should return empty with no loaders', () => {
    const result = getActivityByCategoryServer('tech');
    expect(result).toEqual([]);
  });

  it('should sort results by date descending', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'old', category: 'tech', date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'new', category: 'tech', date: '2025-12-01T00:00:00Z' }),
      ],
    });
    const result = getActivityByCategoryServer('tech');
    expect(result[0].slug).toBe('new');
  });

  it('should be case-sensitive for category matching', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ category: 'Tech' })],
    });
    const result = getActivityByCategoryServer('tech');
    expect(result).toEqual([]);
  });

  it('should match products where general category is product', () => {
    configure({
      loadProducts: () => [makeProduct()],
    });
    const result = getActivityByCategoryServer('product');
    expect(result).toHaveLength(1);
  });

  it('should handle limit of 0', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ category: 'tech' })],
    });
    const result = getActivityByCategoryServer('tech', 0);
    expect(result).toEqual([]);
  });
});





describe('getActivityByTagServer', () => {
  it('should match items that have the tag', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'tagged', tags: ['svelte', 'typescript'] }),
        makeBlogPost({ slug: 'untagged', tags: ['python'] }),
      ],
    });
    const result = getActivityByTagServer('svelte');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('tagged');
  });

  it('should match profiles by tag', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ slug: 'tagged', tags: ['community'] }),
      ],
    });
    const result = getActivityByTagServer('community');
    expect(result).toHaveLength(1);
  });

  it('should match products by tag', () => {
    configure({
      loadProducts: () => [
        makeProduct({ slug: 'tagged', tags: ['utility'] }),
      ],
    });
    const result = getActivityByTagServer('utility');
    expect(result).toHaveLength(1);
  });

  it('should match across multiple content types', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ tags: ['shared'] })],
      loadProfiles: () => [makeProfile({ tags: ['shared'] })],
      loadProducts: () => [makeProduct({ tags: ['shared'] })],
    });
    const result = getActivityByTagServer('shared');
    expect(result).toHaveLength(3);
  });

  it('should return empty when no tags match', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ tags: ['svelte'] })],
    });
    const result = getActivityByTagServer('nonexistent');
    expect(result).toEqual([]);
  });

  it('should return empty with empty tags arrays', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ tags: [] })],
    });
    const result = getActivityByTagServer('svelte');
    expect(result).toEqual([]);
  });

  it('should apply limit', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'a', tags: ['svelte'], date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'b', tags: ['svelte'], date: '2025-02-01T00:00:00Z' }),
        makeBlogPost({ slug: 'c', tags: ['svelte'], date: '2025-03-01T00:00:00Z' }),
      ],
    });
    const result = getActivityByTagServer('svelte', 2);
    expect(result).toHaveLength(2);
  });

  it('should return all when limit is undefined', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'a', tags: ['svelte'] }),
        makeBlogPost({ slug: 'b', tags: ['svelte'] }),
      ],
    });
    const result = getActivityByTagServer('svelte');
    expect(result).toHaveLength(2);
  });

  it('should be case-sensitive', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ tags: ['Svelte'] })],
    });
    const result = getActivityByTagServer('svelte');
    expect(result).toEqual([]);
  });

  it('should return empty with no loaders', () => {
    const result = getActivityByTagServer('svelte');
    expect(result).toEqual([]);
  });

  it('should use profile interests as tags', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ tags: undefined, interests: ['coding', 'design'] }),
      ],
    });
    const result = getActivityByTagServer('coding');
    expect(result).toHaveLength(1);
  });

  it('should sort tagged results by date descending', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'old', tags: ['svelte'], date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'new', tags: ['svelte'], date: '2025-12-01T00:00:00Z' }),
      ],
    });
    const result = getActivityByTagServer('svelte');
    expect(result[0].slug).toBe('new');
  });
});





describe('searchActivityServer', () => {
  it('should search by title', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ title: 'Svelte Tutorial', slug: 'svelte', tags: ['frontend'] }),
        makeBlogPost({ title: 'Python Guide', slug: 'python', tags: ['backend'] }),
      ],
    });
    const result = searchActivityServer('Svelte');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('svelte');
  });

  it('should search by excerpt', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'match', excerpt: 'Learn about reactivity' }),
        makeBlogPost({ slug: 'no-match', excerpt: 'A different topic' }),
      ],
    });
    const result = searchActivityServer('reactivity');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('match');
  });

  it('should search by author', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'alice', author: 'Alice' }),
        makeBlogPost({ slug: 'bob', author: 'Bob' }),
      ],
    });
    const result = searchActivityServer('Alice');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('alice');
  });

  it('should search by tags', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'ts', tags: ['typescript'] }),
        makeBlogPost({ slug: 'py', tags: ['python'] }),
      ],
    });
    const result = searchActivityServer('typescript');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('ts');
  });

  it('should be case-insensitive', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ title: 'UPPERCASE TITLE', slug: 'upper' }),
      ],
    });
    const result = searchActivityServer('uppercase');
    expect(result).toHaveLength(1);
  });

  it('should search case-insensitively in excerpt', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'match', excerpt: 'Learn ADVANCED patterns' }),
      ],
    });
    const result = searchActivityServer('advanced');
    expect(result).toHaveLength(1);
  });

  it('should search case-insensitively in author', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'match', author: 'ALICE' }),
      ],
    });
    const result = searchActivityServer('alice');
    expect(result).toHaveLength(1);
  });

  it('should search case-insensitively in tags', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'match', tags: ['TypeScript'] }),
      ],
    });
    const result = searchActivityServer('typescript');
    expect(result).toHaveLength(1);
  });

  it('should apply limit', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'a', title: 'Svelte A', date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'b', title: 'Svelte B', date: '2025-02-01T00:00:00Z' }),
        makeBlogPost({ slug: 'c', title: 'Svelte C', date: '2025-03-01T00:00:00Z' }),
      ],
    });
    const result = searchActivityServer('Svelte', 2);
    expect(result).toHaveLength(2);
  });

  it('should return all matches when limit is undefined', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'a', title: 'Svelte A' }),
        makeBlogPost({ slug: 'b', title: 'Svelte B' }),
      ],
    });
    const result = searchActivityServer('Svelte');
    expect(result).toHaveLength(2);
  });

  it('should return empty for no matches', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ title: 'Hello World' })],
    });
    const result = searchActivityServer('zzzzzzz');
    expect(result).toEqual([]);
  });

  it('should return empty for empty query', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost()],
    });
    const result = searchActivityServer('');
    expect(result).toEqual([]);
  });

  it('should return empty for whitespace-only query', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost()],
    });
    const result = searchActivityServer('   ');
    expect(result).toEqual([]);
  });

  it('should search across multiple content types', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost({ title: 'Svelte Post' })],
      loadProfiles: () => [makeProfile({ name: 'Svelte Fan' })],
      loadProducts: () => [makeProduct({ name: 'Svelte Tool' })],
    });
    const result = searchActivityServer('Svelte');
    expect(result).toHaveLength(3);
  });

  it('should match partial strings', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ title: 'Introduction to SvelteKit' }),
      ],
    });
    const result = searchActivityServer('Svelte');
    expect(result).toHaveLength(1);
  });

  it('should search product descriptions via excerpt', () => {
    configure({
      loadProducts: () => [
        makeProduct({ name: 'Widget', description: 'A powerful search tool' }),
      ],
    });
    const result = searchActivityServer('powerful search');
    expect(result).toHaveLength(1);
  });

  it('should search profile bios via excerpt', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ name: 'Developer', bio: 'Loves writing clean code' }),
      ],
    });
    const result = searchActivityServer('clean code');
    expect(result).toHaveLength(1);
  });

  it('should not double-count items matching multiple fields', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({
          title: 'Svelte Tutorial',
          excerpt: 'Learn Svelte',
          tags: ['svelte'],
          author: 'Svelte Expert',
        }),
      ],
    });
    const result = searchActivityServer('Svelte');
    expect(result).toHaveLength(1);
  });

  it('should sort search results by date descending', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ slug: 'old', title: 'Svelte Old', date: '2025-01-01T00:00:00Z' }),
        makeBlogPost({ slug: 'new', title: 'Svelte New', date: '2025-12-01T00:00:00Z' }),
      ],
    });
    const result = searchActivityServer('Svelte');
    expect(result[0].slug).toBe('new');
  });

  it('should handle no loaders configured', () => {
    const result = searchActivityServer('anything');
    expect(result).toEqual([]);
  });
});





describe('Edge cases', () => {
  it('should handle blog post with missing excerpt and description', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ excerpt: undefined, description: undefined }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].excerpt).toBe('');
  });

  it('should handle blog post with description but no excerpt', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ excerpt: undefined, description: 'A description' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].excerpt).toBe('A description');
  });

  it('should handle profile with missing bio', () => {
    configure({
      loadProfiles: () => [makeProfile({ bio: undefined })],
    });
    const result = getRecentActivityServer();
    expect(result[0].excerpt).toBe('');
  });

  it('should handle product with excerpt field', () => {
    configure({
      loadProducts: () => [
        makeProduct({ excerpt: 'Short excerpt', description: 'Longer description' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].excerpt).toBe('Short excerpt');
  });

  it('should handle product falling back to description', () => {
    configure({
      loadProducts: () => [
        makeProduct({ excerpt: undefined, description: 'A description' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].excerpt).toBe('A description');
  });

  it('should handle product with no excerpt or description', () => {
    configure({
      loadProducts: () => [
        makeProduct({ excerpt: undefined, description: undefined }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].excerpt).toBe('');
  });

  it('should use slug as title when blog title is missing', () => {
    configure({
      loadBlogPosts: () => [
        { title: '', slug: 'my-post', tags: [] } as BlogPostItem,
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].title).toBe('my-post');
  });

  it('should handle profile with updatedAt as date', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ publishedAt: undefined, updatedAt: '2025-08-01T00:00:00Z', joinedDate: undefined }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].date).toBe('2025-08-01T00:00:00Z');
  });

  it('should handle profile with joinedDate as date', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ publishedAt: undefined, updatedAt: undefined, joinedDate: '2025-01-15T00:00:00Z' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].date).toBe('2025-01-15T00:00:00Z');
  });

  it('should handle product with updatedAt as date', () => {
    configure({
      loadProducts: () => [
        makeProduct({ publishedAt: undefined, updatedAt: '2025-09-01T00:00:00Z' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].date).toBe('2025-09-01T00:00:00Z');
  });

  it('should handle profile with imageUrl fallback', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ avatar: undefined, imageUrl: '/img/profile.jpg' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].image).toBe('/img/profile.jpg');
  });

  it('should handle profile with avatar as primary image', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ avatar: '/img/avatar.jpg', imageUrl: '/img/profile.jpg' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].image).toBe('/img/avatar.jpg');
  });

  it('should gracefully handle loader that throws', () => {
    configure({
      loadBlogPosts: () => {
        throw new Error('Blog loader failed');
      },
      loadProfiles: () => [makeProfile()],
    });
    const result = getRecentActivityServer();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('profile');
  });

  it('should handle profile loader that throws', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost()],
      loadProfiles: () => {
        throw new Error('Profile loader failed');
      },
    });
    const result = getRecentActivityServer();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('post');
  });

  it('should handle product loader that throws', () => {
    configure({
      loadBlogPosts: () => [makeBlogPost()],
      loadProducts: () => {
        throw new Error('Product loader failed');
      },
    });
    const result = getRecentActivityServer();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('post');
  });

  it('should handle all loaders throwing', () => {
    configure({
      loadBlogPosts: () => {
        throw new Error('fail');
      },
      loadProfiles: () => {
        throw new Error('fail');
      },
      loadProducts: () => {
        throw new Error('fail');
      },
    });
    const result = getRecentActivityServer();
    expect(result).toEqual([]);
  });

  it('should set license on product items', () => {
    configure({
      loadProducts: () => [makeProduct({ license: 'Apache-2.0' })],
    });
    const result = getRecentActivityServer();
    expect(result[0].license).toBe('Apache-2.0');
  });

  it('should set product image field', () => {
    configure({
      loadProducts: () => [makeProduct({ image: '/img/product.png' })],
    });
    const result = getRecentActivityServer();
    expect(result[0].image).toBe('/img/product.png');
  });

  it('should handle blog post with empty string title using slug', () => {
    configure({
      loadBlogPosts: () => [
        { title: '', slug: 'fallback-slug' } as BlogPostItem,
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].title).toBe('fallback-slug');
  });

  it('should default blog tags to empty array', () => {
    configure({
      loadBlogPosts: () => [
        makeBlogPost({ tags: undefined }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].tags).toEqual([]);
  });

  it('should default product tags to empty array', () => {
    configure({
      loadProducts: () => [
        makeProduct({ tags: undefined }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].tags).toEqual([]);
  });

  it('should set profile author to name', () => {
    configure({
      loadProfiles: () => [
        makeProfile({ name: 'Alice Author' }),
      ],
    });
    const result = getRecentActivityServer();
    expect(result[0].author).toBe('Alice Author');
  });

  it('should set profile category to profile', () => {
    configure({
      loadProfiles: () => [makeProfile()],
    });
    const result = getRecentActivityServer();
    expect(result[0].category).toBe('profile');
  });

  it('should set product category to product', () => {
    configure({
      loadProducts: () => [makeProduct()],
    });
    const result = getRecentActivityServer();
    expect(result[0].category).toBe('product');
  });
});
