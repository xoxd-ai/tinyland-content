/**
 * Product type definitions for the product loader.
 *
 * These are simplified, framework-agnostic versions of the full Product types.
 * They cover only what the loader needs, with an index signature for pass-through
 * of any additional frontmatter fields.
 */

/**
 * Author reference - can be a structured object or a plain string handle.
 */
export type AuthorReference =
  | { name: string; handle?: string; avatar?: string }
  | string;

/**
 * Frontmatter fields parsed from a product markdown file.
 */
export interface ProductFrontmatter {
  name: string;
  slug: string;
  description: string;
  category: string;
  author?: AuthorReference;
  price?: number;
  currency?: string;
  license?: string;
  version?: string;
  featured?: boolean;
  image?: string;
  excerpt?: string;
  tagline?: string;
  tags?: string[];
  order?: number;
  published?: boolean;
  publishedAt?: string;
  /** Allow pass-through of all other frontmatter fields. */
  [key: string]: unknown;
}

/**
 * A loaded product with its frontmatter, markdown content, slug, and file path.
 */
export interface Product {
  frontmatter: ProductFrontmatter;
  content: string;
  slug: string;
  filePath?: string;
}

/**
 * Shape returned by a generic content loader (e.g. tinyland-content-loader).
 */
export interface LoadedContent {
  metadata: Record<string, unknown>;
  content: string;
  slug: string;
  filePath: string;
  ownerHandle?: string;
}
