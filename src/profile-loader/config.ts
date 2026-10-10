



export interface ProfileLoaderConfig {
  
  baseDir: string;
  
  contentSubPath?: string;
}

const DEFAULT_CONFIG: ProfileLoaderConfig = {
  baseDir: process.cwd(),
  contentSubPath: 'src/content/profiles',
};

let currentConfig: ProfileLoaderConfig = { ...DEFAULT_CONFIG };





export function configure(config: Partial<ProfileLoaderConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}





export function getConfig(): ProfileLoaderConfig {
  return { ...currentConfig };
}




export function resetConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
}
