







import { getConfig } from './config.js';
import type {
  ActivityItem,
  BlogPostItem,
  ProfileItem,
  ProductItem,
} from './types.js';




function blogPostToActivity(post: BlogPostItem): ActivityItem | null {
  
  if (post.published === false || post.draft === true) {
    return null;
  }

  const date =
    post.date || post.publishedAt || new Date().toISOString();

  const author =
    typeof post.author === 'object' && post.author !== null
      ? post.author.name
      : post.author || 'Unknown';

  return {
    type: 'post',
    title: post.title || post.slug,
    slug: post.slug,
    excerpt: post.excerpt || post.description || '',
    date,
    image: post.featuredImage || post.coverImage || post.heroImage,
    author,
    category: post.categories?.[0] || post.category,
    tags: post.tags || [],
  };
}




function profileToActivity(profile: ProfileItem): ActivityItem {
  const date =
    profile.publishedAt ||
    profile.updatedAt ||
    profile.joinedDate ||
    new Date().toISOString();

  const name =
    profile.name || profile.displayName || 'Community Member';

  return {
    type: 'profile',
    title: name,
    slug: profile.slug,
    excerpt: profile.bio || '',
    date,
    image: profile.avatar || profile.imageUrl,
    author: name,
    category: 'profile',
    tags: profile.tags || profile.interests || [],
    profileRole: profile.role,
  };
}




function productToActivity(product: ProductItem): ActivityItem {
  const date =
    product.publishedAt ||
    product.updatedAt ||
    new Date().toISOString();

  return {
    type: 'product',
    title: product.name,
    slug: product.slug,
    excerpt: product.excerpt || product.description || '',
    date,
    image: product.image,
    category: 'product',
    tags: product.tags || [],
    productCategory: product.category,
    license: product.license,
  };
}





function loadAllActivity(): ActivityItem[] {
  const config = getConfig();
  const activities: ActivityItem[] = [];

  
  if (config.loadBlogPosts) {
    try {
      const posts = config.loadBlogPosts();
      for (const post of posts) {
        const item = blogPostToActivity(post);
        if (item !== null) {
          activities.push(item);
        }
      }
    } catch {
      
    }
  }

  
  if (config.loadProfiles) {
    try {
      const profiles = config.loadProfiles();
      for (const profile of profiles) {
        activities.push(profileToActivity(profile));
      }
    } catch {
      
    }
  }

  
  if (config.loadProducts) {
    try {
      const products = config.loadProducts();
      for (const product of products) {
        activities.push(productToActivity(product));
      }
    } catch {
      
    }
  }

  
  activities.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  return activities;
}







export function getRecentActivityServer(limit: number = 10): ActivityItem[] {
  const activities = loadAllActivity();
  return activities.slice(0, limit);
}







export function getActivityByTypeServer(
  type: 'post' | 'profile' | 'product',
  limit?: number,
): ActivityItem[] {
  const allActivity = loadAllActivity();
  const filtered = allActivity.filter((item) => item.type === type);
  return limit !== undefined ? filtered.slice(0, limit) : filtered;
}








export function getActivityByCategoryServer(
  category: string,
  limit?: number,
): ActivityItem[] {
  const allActivity = loadAllActivity();
  const filtered = allActivity.filter(
    (item) => item.category === category || item.productCategory === category,
  );
  return limit !== undefined ? filtered.slice(0, limit) : filtered;
}







export function getActivityByTagServer(
  tag: string,
  limit?: number,
): ActivityItem[] {
  const allActivity = loadAllActivity();
  const filtered = allActivity.filter((item) => item.tags?.includes(tag));
  return limit !== undefined ? filtered.slice(0, limit) : filtered;
}








export function searchActivityServer(
  query: string,
  limit?: number,
): ActivityItem[] {
  if (!query || query.trim() === '') {
    return [];
  }

  const allActivity = loadAllActivity();
  const searchTerm = query.toLowerCase();

  const filtered = allActivity.filter((item) => {
    if (item.title.toLowerCase().includes(searchTerm)) {
      return true;
    }
    if (item.excerpt?.toLowerCase().includes(searchTerm)) {
      return true;
    }
    if (item.author?.toLowerCase().includes(searchTerm)) {
      return true;
    }
    if (item.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))) {
      return true;
    }
    return false;
  });

  return limit !== undefined ? filtered.slice(0, limit) : filtered;
}
