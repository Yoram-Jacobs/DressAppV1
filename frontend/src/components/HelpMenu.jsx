import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, Info, ShieldAlert, Sparkles, User, BarChart4, 
  MapPin, Phone, HelpCircle, AlertTriangle, Layers, Wallet, 
  ShoppingBag, Search, ClipboardList, Camera, Mic, Grid, TrendingUp, UserRound
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HelpMenu() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');

  const isRtl = i18n.language === 'he' || i18n.language === 'ar';

  const SECTIONS = [
    { id: 'overview', label: t('help.overview_title'), icon: BookOpen, wiki: 'overview' },
    { id: 'prerequisites', label: t('help.prereq_title'), icon: ClipboardList, wiki: 'prerequisites' },
    { id: 'adding-clothes', label: t('help.add_clothes_title'), icon: Camera, wiki: 'adding_clothes' },
    { id: 'closet-page', label: t('help.closet_page_title'), icon: Grid, wiki: 'closet_management' },
    { id: 'ai-stylist', label: t('help.stylist_title'), icon: Mic, wiki: 'ai_stylist' },
    { id: 'profile-matters', label: t('help.profile_title'), icon: User, wiki: 'profile_management' },
    { id: 'wardrobe-stats', label: t('help.stats_title'), icon: BarChart4, wiki: 'wardrobe_insights' },
    { id: 'dress-up', label: t('help.planner_title'), icon: Layers, wiki: 'outfit_planner' },
    { id: 'suitcase', label: t('help.suitcase_title'), icon: MapPin, wiki: 'suitcase_packing' },
    { id: 'marketplace', label: t('help.market_title'), icon: ShoppingBag, wiki: 'marketplace_listing' },
    { id: 'trend-scout', label: t('help.trend_scout_title'), icon: TrendingUp, wiki: 'trend_scout' },
    { id: 'experts', label: t('help.experts_title'), icon: UserRound, wiki: 'experts_registry' },
    { id: 'troubleshooting', label: t('help.trouble_title'), icon: HelpCircle, wiki: 'troubleshooting' },
  ];

  const activeSection = SECTIONS.find(s => s.id === activeTab);

  return (
    <div 
      dir={isRtl ? 'rtl' : 'ltr'}
      className={cn(
        "flex h-full w-full overflow-hidden bg-background rounded-lg text-foreground",
        isRtl ? "text-right" : "text-left"
      )}
    >
      {/* Sidebar Navigation */}
      <aside 
        className={cn(
          "w-64 bg-secondary/10 flex flex-col shrink-0 hidden md:flex",
          isRtl ? "border-l border-border" : "border-r border-border"
        )}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>{isRtl ? (i18n.language === 'he' ? 'תוכן העניינים' : 'جدول المحتويات') : 'Table of Contents'}</span>
          </div>
        </div>
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveTab(sec.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors font-medium",
                    isRtl ? "text-right" : "text-left",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{sec.label}</span>
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile quick tabs selection dropdown */}
        <div className="md:hidden p-3 border-b border-border bg-secondary/15">
          <select 
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SECTIONS.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.label}
              </option>
            ))}
          </select>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <BookOpen className="h-6 w-6" /> {t('help.overview_title')}
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground">{t('help.overview_p1')}</p>
                <p className="text-base leading-relaxed text-muted-foreground">{t('help.overview_p2')}</p>
                <p className="text-base leading-relaxed text-muted-foreground">{t('help.overview_p3')}</p>
              </div>
            )}

            {activeTab === 'prerequisites' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <ClipboardList className="h-6 w-6" /> {t('help.prereq_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.prereq_p1')}</p>
                <ul className="space-y-3 pl-1 pr-1">
                  {[
                    t('help.prereq_item1'),
                    t('help.prereq_item2'),
                    t('help.prereq_item3')
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">{idx + 1}</span>
                      <span className="text-muted-foreground pt-0.5">{item}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">4</span>
                    <span className="text-muted-foreground pt-0.5">
                      {i18n.language === 'he' ? (
                        <>מפתח Gemini API. ניתן להשיגו בחינם ב-<a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Google AI Studio</a>.</>
                      ) : i18n.language === 'ar' ? (
                        <>مفتاح Gemini API المجاني. احصل عليه من <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Google AI Studio</a>.</>
                      ) : (
                        <>A Gemini API Key. Get it for free on <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Google AI Studio</a>.</>
                      )}
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {activeTab === 'adding-clothes' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <Camera className="h-6 w-6" /> {t('help.add_clothes_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.add_clothes_p1')}</p>
                <div className="space-y-3">
                  {[
                    t('help.add_clothes_step1'),
                    t('help.add_clothes_step2'),
                    t('help.add_clothes_step3'),
                    t('help.add_clothes_step4'),
                    t('help.add_clothes_step5'),
                    t('help.add_clothes_step6')
                  ].map((text, idx) => (
                    <div key={idx} className="flex gap-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <span className="font-bold text-primary text-lg shrink-0">{idx + 1}</span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        {text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{part}</strong> : part)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'closet-page' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <Grid className="h-6 w-6" /> {t('help.closet_page_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.closet_page_p1')}</p>
                <div className="space-y-3">
                  {[
                    { title: t('help.closet_view_title'), desc: t('help.closet_view_desc') },
                    { title: t('help.closet_select_title'), desc: t('help.closet_select_desc') },
                    { title: t('help.closet_group_title'), desc: t('help.closet_group_desc') },
                    { title: t('help.closet_edit_title'), desc: t('help.closet_edit_desc') }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                      <h4 className="font-semibold text-sm">{item.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'ai-stylist' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <Mic className="h-6 w-6" /> {t('help.stylist_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.stylist_p1')}</p>
                <div className="space-y-3">
                  {[
                    t('help.stylist_step1'),
                    t('help.stylist_step2'),
                    t('help.stylist_step3'),
                    t('help.stylist_step4'),
                    t('help.stylist_step5'),
                    t('help.stylist_step6'),
                    t('help.stylist_step7')
                  ].map((text, idx) => (
                    <div key={idx} className="flex gap-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <span className="font-bold text-primary text-lg shrink-0">{idx + 1}</span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        {text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{part}</strong> : part)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'profile-matters' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <User className="h-6 w-6" /> {t('help.profile_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.profile_p1')}</p>
                <div className="space-y-4">
                  {[
                    { title: t('help.profile_item1_title'), desc: t('help.profile_item1_desc') },
                    { title: t('help.profile_item2_title'), desc: t('help.profile_item2_desc') },
                    { title: t('help.profile_item3_title'), desc: t('help.profile_item3_desc') },
                    { title: t('help.profile_item4_title'), desc: t('help.profile_item4_desc') },
                    { title: t('help.profile_item5_title'), desc: t('help.profile_item5_desc') },
                    { title: t('help.profile_item6_title'), desc: t('help.profile_item6_desc') },
                    { title: t('help.profile_item7_title'), desc: t('help.profile_item7_desc') },
                    { title: t('help.profile_item8_title'), desc: t('help.profile_item8_desc') },
                    { title: t('help.profile_item9_title'), desc: t('help.profile_item9_desc') },
                    { title: t('help.profile_item10_title'), desc: t('help.profile_item10_desc') },
                    { title: t('help.profile_item11_title'), desc: t('help.profile_item11_desc') }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-secondary/5 space-y-2">
                      <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary shrink-0" />
                        {item.title}
                      </h4>
                      <p className={cn("text-xs text-muted-foreground leading-relaxed", isRtl ? "pr-6" : "pl-6")}>
                        <strong className="text-primary/90 font-medium">
                          {isRtl ? (i18n.language === 'he' ? 'למה זה משנה:' : 'لماذا يهم:') : 'Why it matters:'}
                        </strong>{' '}
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'wardrobe-stats' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <BarChart4 className="h-6 w-6" /> {t('help.stats_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.stats_p1')}</p>
                <ul className="space-y-3 pl-1 pr-1">
                  {[
                    t('help.stats_worth'),
                    t('help.stats_util'),
                    t('help.stats_cpw'),
                    t('help.stats_palette')
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2"></span>
                      <span className="text-muted-foreground leading-relaxed">
                        {item.split(':').map((part, i) => i === 0 ? <strong key={i} className="text-foreground">{part}:</strong> : part)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'dress-up' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <Layers className="h-6 w-6" /> {t('help.planner_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.planner_p1')}</p>
                <div className="space-y-3">
                  {[
                    { title: t('help.planner_item1_title'), desc: t('help.planner_item1_desc') },
                    { title: t('help.planner_item2_title'), desc: t('help.planner_item2_desc') },
                    { title: t('help.planner_item3_title'), desc: t('help.planner_item3_desc') },
                    { title: t('help.planner_item4_title'), desc: t('help.planner_item4_desc') }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                      <h4 className="font-semibold text-sm">{item.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'suitcase' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <MapPin className="h-6 w-6" /> {t('help.suitcase_title')}
                </h2>
                <div className="space-y-3">
                  {[
                    t('help.suitcase_step1'),
                    t('help.suitcase_step2'),
                    t('help.suitcase_step3'),
                    t('help.suitcase_step4'),
                    t('help.suitcase_step5')
                  ].map((text, idx) => (
                    <div key={idx} className="flex gap-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <span className="font-bold text-primary text-lg shrink-0">{idx + 1}</span>
                      <p className="text-sm text-muted-foreground pt-0.5">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'marketplace' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <ShoppingBag className="h-6 w-6" /> {t('help.market_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.market_p1')}</p>
                <div className="space-y-3">
                  {[
                    t('help.market_step1'),
                    t('help.market_step2')
                  ].map((text, idx) => (
                    <div key={idx} className="flex gap-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <span className="font-bold text-primary text-lg shrink-0">{idx + 1}</span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        {text.split(':').map((part, i) => i === 0 ? <strong key={i} className="text-foreground font-semibold">{part}:</strong> : part)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'trend-scout' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <TrendingUp className="h-6 w-6" /> {t('help.trend_scout_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.trend_scout_p1')}</p>
                <div className="space-y-3">
                  {[
                    { title: t('help.trend_feed_title'), desc: t('help.trend_feed_desc') },
                    { title: t('help.trend_buckets_title'), desc: t('help.trend_buckets_desc') }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                      <h4 className="font-semibold text-sm">{item.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'experts' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <UserRound className="h-6 w-6" /> {t('help.experts_title')}
                </h2>
                <p className="text-muted-foreground">{t('help.experts_p1')}</p>
                <div className="space-y-3">
                  {[
                    { title: t('help.experts_dir_title'), desc: t('help.experts_dir_desc') },
                    { title: t('help.experts_search_title'), desc: t('help.experts_search_desc') },
                    { title: t('help.experts_contact_title'), desc: t('help.experts_contact_desc') }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                      <h4 className="font-semibold text-sm">{item.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'troubleshooting' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <AlertTriangle className="h-6 w-6" /> {t('help.trouble_title')}
                </h2>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      {t('help.trouble_full_q')}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t('help.trouble_full_why')}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t('help.trouble_full_fix')}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                      {t('help.trouble_cam_q')}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t('help.trouble_cam_why')}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t('help.trouble_cam_fix')}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                      {t('help.trouble_slow_q')}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t('help.trouble_slow_why')}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t('help.trouble_slow_fix')}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-3">
                  <h3 className="font-semibold text-base text-foreground">{t('help.limit_title')}</h3>
                  <ul className="space-y-2 pl-1 pr-1">
                    <li className="flex items-start gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 shrink-0"></span>
                      <span className="text-xs text-muted-foreground leading-relaxed">{t('help.limit_item1')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 shrink-0"></span>
                      <span className="text-xs text-muted-foreground leading-relaxed">{t('help.limit_item2')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Wiki Link Footer */}
            {activeSection && (
              <div className={cn("pt-4 mt-6 border-t border-border flex", isRtl ? "justify-start" : "justify-end")}>
                <a 
                  href={`https://github.com/Yoram-Jacobs/DressAppV1/blob/main/wiki/${i18n.language || 'en'}/${activeSection.wiki}.md`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  {t('help.learnMore', { defaultValue: 'Learn more' })} &rarr;
                </a>
              </div>
            )}

          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
