




export interface ProfileFrontmatter {
  name?: string;
  displayName?: string;
  layout?: string;
  slug?: string;
  role?: string;
  roles?: string[];
  bio?: string;
  tags?: string[];
  interests?: string[];
  featured?: boolean;
  visibility?: string;
  published?: boolean;
  hidden?: boolean;
  displayOrder?: number;
  [key: string]: any;
}






export interface Profile {
  frontmatter: ProfileFrontmatter;
  content: string;
  slug: string;
}
