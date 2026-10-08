












export interface ActivityItem {
  type: 'post' | 'profile' | 'product';
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  image?: string;
  author?: string;
  category?: string;
  tags?: string[];
  
  productCategory?: string;
  
  profileRole?: string;
  
  license?: string;
}





export interface BlogPostItem {
  title: string;
  slug: string;
  excerpt?: string;
  description?: string;
  date?: string;
  publishedAt?: string;
  featuredImage?: string;
  coverImage?: string;
  heroImage?: string;
  author?: string | { name: string };
  category?: string;
  categories?: string[];
  tags?: string[];
  published?: boolean;
  draft?: boolean;
}





export interface ProfileItem {
  name?: string;
  displayName?: string;
  slug: string;
  bio?: string;
  publishedAt?: string;
  updatedAt?: string;
  joinedDate?: string;
  avatar?: string;
  imageUrl?: string;
  role?: string;
  tags?: string[];
  interests?: string[];
}





export interface ProductItem {
  name: string;
  slug: string;
  excerpt?: string;
  description?: string;
  publishedAt?: string;
  updatedAt?: string;
  image?: string;
  category?: string;
  tags?: string[];
  license?: string;
}








export interface ActivityFeedConfig {
  
  loadBlogPosts?: () => BlogPostItem[];
  
  loadProfiles?: () => ProfileItem[];
  
  loadProducts?: () => ProductItem[];
}
