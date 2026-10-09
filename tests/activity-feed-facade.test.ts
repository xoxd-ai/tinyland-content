import { describe, expect, it } from 'vitest';
import * as content from '../src/index.js';
import * as activityFeed from '../src/activity-feed/index.js';

// tummycrypt_tinyland_activity_feed was merged into this module. The
// ./activity-feed subpath keeps its exact API; the root facade re-exports the
// same functions, with the config helpers aliased.
describe('activity feed merge', () => {
  it('keeps the original API on the ./activity-feed subpath', () => {
    expect(Object.keys(activityFeed).sort()).toEqual([
      'configure',
      'getActivityByCategoryServer',
      'getActivityByTagServer',
      'getActivityByTypeServer',
      'getConfig',
      'getRecentActivityServer',
      'resetConfig',
      'searchActivityServer',
    ]);
  });

  it('re-exports the same functions on the root facade', () => {
    expect(content.getRecentActivityServer).toBe(activityFeed.getRecentActivityServer);
    expect(content.getActivityByTypeServer).toBe(activityFeed.getActivityByTypeServer);
    expect(content.getActivityByCategoryServer).toBe(activityFeed.getActivityByCategoryServer);
    expect(content.getActivityByTagServer).toBe(activityFeed.getActivityByTagServer);
    expect(content.searchActivityServer).toBe(activityFeed.searchActivityServer);
    expect(content.configureActivityFeed).toBe(activityFeed.configure);
    expect(content.getActivityFeedConfig).toBe(activityFeed.getConfig);
    expect(content.resetActivityFeedConfig).toBe(activityFeed.resetConfig);
  });

  it('shares one configuration between the facade and the subpath', () => {
    content.resetActivityFeedConfig();
    content.configureActivityFeed({
      loadBlogPosts: () => [{ title: 'Merged', slug: 'merged', date: '2026-10-08T00:00:00Z' }],
    });
    expect(activityFeed.getRecentActivityServer(5).map((item) => item.slug)).toEqual(['merged']);
    activityFeed.resetConfig();
    expect(content.getRecentActivityServer(5)).toEqual([]);
  });
});
