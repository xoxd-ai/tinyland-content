







export interface EventLoaderConfig {
  
  baseDir: string;
  
  contentSubPath?: string;
  
  wordsPerMinute?: number;
}

interface ResolvedConfig {
  baseDir: string;
  contentSubPath: string;
  wordsPerMinute: number;
}

const DEFAULT_CONTENT_SUB_PATH = 'src/content/events';
const DEFAULT_WORDS_PER_MINUTE = 225;

let currentConfig: ResolvedConfig | null = null;





export function configure(config: EventLoaderConfig): void {
  currentConfig = {
    baseDir: config.baseDir,
    contentSubPath: config.contentSubPath ?? DEFAULT_CONTENT_SUB_PATH,
    wordsPerMinute: config.wordsPerMinute ?? DEFAULT_WORDS_PER_MINUTE,
  };
}





export function getConfig(): ResolvedConfig {
  if (!currentConfig) {
    throw new Error(
      'tinyland-event-loader: configure() must be called before using loader functions. ' +
      'Call configure({ baseDir: "/path/to/project" }) first.'
    );
  }
  return currentConfig;
}





export function resetConfig(): void {
  currentConfig = null;
}
