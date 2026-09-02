/**
 * apps/mobile/src/lib/helpTopics.ts
 *
 * Topic definitions, icons, and route mapping for the DressApp 2-Layer Help System.
 */

export interface HelpTopic {
  id: string;
  labelKey: string;
  defaultLabel: string;
  iconName: string;
  wiki: string;
  routeNames?: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
  { id: 'overview', labelKey: 'help.overview_title', defaultLabel: 'Overview', iconName: 'BookOpen', wiki: 'overview', routeNames: ['Home', 'Welcome'] },
  { id: 'prerequisites', labelKey: 'help.prereq_title', defaultLabel: 'Prerequisites', iconName: 'ClipboardList', wiki: 'prerequisites' },
  { id: 'adding-clothes', labelKey: 'help.add_clothes_title', defaultLabel: 'Adding Clothes', iconName: 'Camera', wiki: 'adding_clothes', routeNames: ['ClosetAdd', 'Scanner', 'DppScanner'] },
  { id: 'closet-page', labelKey: 'help.closet_page_title', defaultLabel: 'Your Closet', iconName: 'Grid', wiki: 'closet_management', routeNames: ['Closet', 'ClosetStudio', 'ItemDetail', 'ClosetTab'] },
  { id: 'ai-stylist', labelKey: 'help.stylist_title', defaultLabel: 'AI Stylist', iconName: 'Mic', wiki: 'ai_stylist', routeNames: ['Stylist', 'StylistTab', 'StylistChat'] },
  { id: 'scheduler-push', labelKey: 'help.scheduler_push_title', defaultLabel: 'Daily Suggestions', iconName: 'Bell', wiki: 'scheduler', routeNames: ['DailyLook', 'Scheduler'] },
  { id: 'profile-matters', labelKey: 'help.profile_title', defaultLabel: 'Your Profile', iconName: 'User', wiki: 'profile_management', routeNames: ['Profile', 'Me', 'MeTab', 'AvatarSettings'] },
  { id: 'wardrobe-stats', labelKey: 'help.stats_title', defaultLabel: 'Wardrobe Insights', iconName: 'BarChart4', wiki: 'wardrobe_insights', routeNames: ['WardrobeInsights', 'Stats'] },
  { id: 'dress-up', labelKey: 'help.planner_title', defaultLabel: 'Outfit Canvas & Planner', iconName: 'Layers', wiki: 'outfit_planner', routeNames: ['OutfitCanvas', 'Planner', 'TryOn'] },
  { id: 'suitcase', labelKey: 'help.suitcase_title', defaultLabel: 'Suitcase Packing', iconName: 'MapPin', wiki: 'suitcase_packing', routeNames: ['Suitcase', 'TripPlanner'] },
  { id: 'marketplace', labelKey: 'help.market_title', defaultLabel: 'Marketplace', iconName: 'ShoppingBag', wiki: 'marketplace_listing', routeNames: ['Market', 'MarketTab', 'CreateListing', 'SandboxRoom'] },
  { id: 'shopping-assistant', labelKey: 'help.shopping_assistant_title', defaultLabel: 'Shopping Assistant', iconName: 'Globe', wiki: 'chrome_extension' },
  { id: 'import-wardrobe', labelKey: 'help.import_wardrobe_title', defaultLabel: 'Import Wardrobe', iconName: 'Search', wiki: 'import_wardrobe' },
  { id: 'trend-scout', labelKey: 'help.trend_scout_title', defaultLabel: 'Trend Scout', iconName: 'TrendingUp', wiki: 'trend_scout', routeNames: ['TrendScout'] },
  { id: 'experts', labelKey: 'help.experts_title', defaultLabel: 'Stylists & Experts', iconName: 'UserRound', wiki: 'experts_registry', routeNames: ['Experts', 'Professionals'] },
  { id: 'campaigns', labelKey: 'help.campaigns_help_title', defaultLabel: 'Campaigns & Ads', iconName: 'Megaphone', wiki: 'campaigns' },
  { id: 'tiers', labelKey: 'help.tiers_title', defaultLabel: 'Subscription Tiers & Credits', iconName: 'Wallet', wiki: 'monetization', routeNames: ['Subscription', 'Pricing'] },
  { id: 'troubleshooting', labelKey: 'help.trouble_title', defaultLabel: 'Troubleshooting', iconName: 'HelpCircle', wiki: 'troubleshooting', routeNames: ['Troubleshooting', 'Admin'] },
];

/**
 * Maps an active screen or route name to the appropriate help topic ID.
 */
export function mapRouteToTopic(routeName?: string): string {
  if (!routeName) return 'overview';
  const clean = routeName.trim();
  
  for (const topic of HELP_TOPICS) {
    if (topic.routeNames && topic.routeNames.includes(clean)) {
      return topic.id;
    }
  }

  // Substring / fuzzy heuristic fallback
  const lower = clean.toLowerCase();
  if (lower.includes('closet') || lower.includes('item')) return 'closet-page';
  if (lower.includes('stylist') || lower.includes('daily')) return 'ai-stylist';
  if (lower.includes('scan') || lower.includes('add') || lower.includes('photo')) return 'adding-clothes';
  if (lower.includes('outfit') || lower.includes('canvas') || lower.includes('tryon')) return 'dress-up';
  if (lower.includes('suitcase') || lower.includes('trip') || lower.includes('pack')) return 'suitcase';
  if (lower.includes('market') || lower.includes('listing')) return 'marketplace';
  if (lower.includes('profile') || lower.includes('avatar') || lower.includes('me') || lower.includes('setting')) return 'profile-matters';
  if (lower.includes('stat') || lower.includes('insight')) return 'wardrobe-stats';
  if (lower.includes('trend')) return 'trend-scout';
  if (lower.includes('expert')) return 'experts';
  if (lower.includes('trouble') || lower.includes('admin')) return 'troubleshooting';

  return 'overview';
}
