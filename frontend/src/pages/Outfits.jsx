import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExploreBackButton } from '@/components/ExploreBackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Calendar, MapPin, Sparkles, Bell, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AvatarViewer from '@/components/AvatarViewer';
import { labelForRole, labelForDressCode } from '@/lib/taxonomy';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OutfitRecommendationCard } from '@/components/stylist/OutfitRecommendationCard';
import { ItemFloater } from '@/components/stylist/ItemFloater';

const getLocalizedNotification = (n, t) => {
  if (!n) return { title: '', body: '' };
  let title = n.title || '';
  let body = n.body || '';

  // 1. Check if Daily Proposal Title: "Tomorrow's Outfit Proposal is Ready! 👕"
  const dailyTitleRegex = /^Tomorrow's Outfit Proposal is Ready!\s*(.+)?$/i;
  const matchDailyTitle = title.match(dailyTitleRegex);
  if (matchDailyTitle) {
    const emoji = matchDailyTitle[1] || '👕';
    title = t('outfits.notification.dailyTitle', { emoji, defaultValue: title });
  }

  // 2. Check if Daily Proposal Body: "Your AI Stylist prepared 3 outfit options for your: <style>."
  const dailyBodyRegex = /^Your AI Stylist prepared(?:\s+\d+)?\s+outfit options for your:\s*(.+?)\.?$/i;
  const matchDailyBody = body.match(dailyBodyRegex);
  if (matchDailyBody) {
    const style = matchDailyBody[1] || 'day';
    const translatedStyle = labelForDressCode(style.toLowerCase().trim(), t);
    body = t('outfits.notification.dailyBody', { style: translatedStyle, defaultValue: body });
  }

  // 3. Check if multi-line proposals list format: "Proposals for <style>:\n• Outfit: ..."
  if (body.includes('\n')) {
    const lines = body.split('\n');
    const proposalsTitleRegex = /^Proposals for\s+(.+?)\s*:\s*$/i;
    const matchProposalsTitle = lines[0].match(proposalsTitleRegex);
    if (matchProposalsTitle) {
      const style = matchProposalsTitle[1] || '';
      const translatedStyle = labelForDressCode(style.toLowerCase().trim(), t);
      const headerText = t('outfits.notification.proposalsTitle', { style: translatedStyle, defaultValue: `Proposals for ${translatedStyle}:` });
      
      const translatedLines = lines.slice(1).map(line => {
        const outfitLineRegex = /^(\s*•\s*)(Outfit(?:\s+\d+)?)(\s*:\s*)(.+)$/i;
        const matchLine = line.match(outfitLineRegex);
        if (matchLine) {
          const bullet = matchLine[1];
          const outfitWord = matchLine[2]; // e.g. "Outfit" or "Outfit 1"
          const colon = matchLine[3];
          const details = matchLine[4];
          
          let translatedOutfitWord = outfitWord;
          if (outfitWord.toLowerCase().startsWith('outfit')) {
            const numPart = outfitWord.substring(6); // e.g. " 1" or ""
            const baseTranslated = t('outfits.outfit', { defaultValue: 'Outfit' });
            translatedOutfitWord = `${baseTranslated}${numPart}`;
          }
          return `${bullet}${translatedOutfitWord}${colon}${details}`;
        }
        return line;
      });
      body = [headerText, ...translatedLines].join('\n');
    }
  }

  // 4. Check if Event Title: "Time to get ready for <name>! 🌟"
  const eventTitleRegex = /^Time to get ready for\s*(.+?)\s*!\s*🌟\s*$/i;
  const matchEventTitle = title.match(eventTitleRegex);
  if (matchEventTitle) {
    const name = matchEventTitle[1] || '';
    title = t('outfits.notification.eventTitle', { name, defaultValue: title });
  }

  // 5. Check if Event Body: "Your chosen outfit is prepared. Have a wonderful time!"
  const eventBodyRegex = /^Your chosen outfit is prepared\.\s*Have a wonderful time!/i;
  if (eventBodyRegex.test(body)) {
    body = t('outfits.notification.eventBody', { defaultValue: body });
  }

  return { title, body };
};

const parseNotificationBodyToPayload = (body) => {
  if (!body || !body.includes('\n')) return null;
  const lines = body.split('\n');
  const outfitLines = lines.filter(line => line.trim().startsWith('•'));
  if (outfitLines.length === 0) return null;

  const outfit_recommendations = outfitLines.map((line, index) => {
    const parts = line.replace(/^\s*•\s*/, '').split(':');
    const name = parts[0]?.trim() || `Outfit ${index + 1}`;
    const itemsText = parts.slice(1).join(':').trim();
    const items = itemsText.split(',').map(item => {
      const desc = item.trim();
      let role = 'top';
      const dLower = desc.toLowerCase();
      if (dLower.includes('shoe') || dLower.includes('sneaker') || dLower.includes('boot') || dLower.includes('heel') || dLower.includes('loafer') || dLower.includes('sandal')) {
        role = 'shoes';
      } else if (dLower.includes('pant') || dLower.includes('trouser') || dLower.includes('jean') || dLower.includes('short') || dLower.includes('skirt')) {
        role = 'bottom';
      } else if (dLower.includes('dress') || dLower.includes('gown')) {
        role = 'dress';
      } else if (dLower.includes('jacket') || dLower.includes('coat') || dLower.includes('blazer') || dLower.includes('sweater') || dLower.includes('hoodie')) {
        role = 'outerwear';
      } else if (dLower.includes('bag') || dLower.includes('backpack') || dLower.includes('purse')) {
        role = 'bag';
      } else if (dLower.includes('hat') || dLower.includes('cap') || dLower.includes('beanie')) {
        role = 'headwear';
      }
      return {
        role,
        description: desc,
        closet_item_id: null
      };
    });

    return {
      name,
      items,
      why: 'Scheduled recommendation from your AI Stylist.',
      confidence: 0.8
    };
  });

  return {
    reasoning_summary: lines[0] || 'Your scheduled proposals.',
    outfit_recommendations
  };
};

export default function Outfits() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [outfits, setOutfits] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [floaterItemId, setFloaterItemId] = useState(null);
  const [notifModalLoading, setNotifModalLoading] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.listSavedOutfits();
      setOutfits(res.outfits || []);
      await loadNotifications();
    } catch (err) {
      toast.error(t('outfits.failedLoadOutfits', { defaultValue: 'Failed to load saved outfits.' }));
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await api.listSimulatedNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      console.debug("Failed to load notifications:", err);
    } finally {
      setNotifLoading(false);
    }
  };

  const deleteOutfit = async (id) => {
    try {
      await api.deleteSavedOutfit(id);
      setOutfits((prev) => prev.filter((o) => o.id !== id));
      toast.success(t('outfits.removedSuccess', { defaultValue: 'Outfit removed from your diary.' }));
    } catch (err) {
      toast.error(t('outfits.failedDelete', { defaultValue: 'Failed to delete outfit.' }));
    }
  };

  const clearNotifications = async () => {
    try {
      await api.clearSimulatedNotifications();
      setNotifications([]);
      toast.success(t('outfits.logsCleared', { defaultValue: 'Notification logs cleared.' }));
    } catch (err) {
      toast.error(t('outfits.failedClearLogs', { defaultValue: 'Failed to clear logs.' }));
    }
  };

  const handleSaveOutfit = async (rec, notification) => {
    const isEvent = (notification?.title || '').toLowerCase().includes('get ready');
    
    const body = {
      name: rec.name,
      source_workflow: isEvent ? 'event' : 'scheduled',
      prompt: isEvent ? 'Event' : (user?.scheduler_settings?.style_dress_for || 'casual'),
      garments: (rec.items || []).map((it) => ({
        closet_item_id: it.closet_item_id,
        role: it.role,
        title: it.description,
      })),
      usage: {
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: user?.scheduler_settings?.time || '08:00',
        location: null,
        event_name: null,
      },
    };

    try {
      await api.saveOutfit(body);
      toast.success(t('stylist.outfitSaved', { defaultValue: 'Outfit saved to your diary!' }));
      const res = await api.listSavedOutfits();
      setOutfits(res.outfits || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Failed to save outfit.' }));
    }
  };

  const handleNotificationClick = async (n) => {
    let payload = n.payload || parseNotificationBodyToPayload(n.body);
    
    // Check if we need to generate proposals dynamically on-demand
    if (!payload && (n.title || '').toLowerCase().includes('proposal is ready')) {
      setSelectedNotification({ ...n, payload: { outfit_recommendations: [] } }); // Open with temporary empty payload
      setNotifModalLoading(true);
      try {
        const res = await api.triggerScheduledProposal();
        const updatedPayload = res.advice;
        setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, payload: updatedPayload } : item)));
        setSelectedNotification((current) => current && current.id === n.id ? { ...current, payload: updatedPayload } : current);
      } catch (err) {
        toast.error(t('outfits.failedGenerateProposals', { defaultValue: 'Failed to generate recommendations.' }));
        setSelectedNotification(null);
      } finally {
        setNotifModalLoading(false);
      }
      return;
    }
    
    if (payload) {
      setSelectedNotification({ ...n, payload });
    } else {
      toast.error(t('outfits.noProposalsAvailable', { defaultValue: 'No outfit recommendations available for this notification.' }));
    }
  };

  return (
    <div className="container-px max-w-6xl mx-auto pt-6 md:pt-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <div className="caps-label text-muted-foreground">{t('components.outfitCanvas.outfit_canvas', { defaultValue: 'My Wardrobe Diary' })}</div>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">{t('components.outfitCanvas.outfit_canvas', { defaultValue: 'Saved Outfits' })}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {t('outfits.viewDescription', { defaultValue: 'View outfits you have composed and scheduled. Your AI Stylist ensures you utilize all closet assets and warns you of previous occasion repetitions.' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
          <RefreshCw className="h-4 w-4" /> {t('stylist.refreshScout', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {/* Simulated Notification Logs Box */}
      <Card className="border border-border/80 rounded-2xl shadow-editorial mb-8 overflow-hidden bg-[hsl(var(--accent))]/5">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[hsl(var(--accent))]" />
              <h3 className="font-display text-lg font-medium">{t('outfits.notificationCenter', { defaultValue: 'Notification Center (Simulated)' })}</h3>
            </div>
            {notifications.length > 0 && (
              <Button size="xs" variant="ghost" className="text-rose-700 text-xs h-7 px-2" onClick={clearNotifications}>
                {t('common.clear', { defaultValue: 'Clear logs' })}
              </Button>
            )}
          </div>
          
          {notifLoading ? (
            <p className="text-xs text-muted-foreground animate-pulse">{t('common.loading', { defaultValue: 'Loading mock push notifications...' })}</p>
          ) : notifications.length === 0 ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2 p-3 bg-card/40 rounded-xl border border-dashed border-border/60">
              <AlertCircle className="h-4 w-4 opacity-75" />
              <span>{t('outfits.noNotifs', { defaultValue: 'No notifications triggered yet. Set your daily reminder in settings or schedule an event to test.' })}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[180px] overflow-y-auto pr-1">
              {notifications.map((n) => {
                const { title, body } = getLocalizedNotification(n, t);
                return (
                  <div
                    key={n.id}
                    className="p-3 bg-card rounded-xl border border-border flex items-start gap-2.5 shadow-sm text-xs transition-colors cursor-pointer hover:bg-muted/30"
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="p-1 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] rounded-lg shrink-0">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate">{title}</div>
                      <div className="text-muted-foreground mt-0.5 leading-relaxed">{body}</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-1.5">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outfits Gallery Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[600px] rounded-2xl shimmer border border-border" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border py-16 text-center">
          <CardContent className="space-y-4">
            <Sparkles className="h-12 w-12 text-muted-foreground/60 mx-auto" />
            <h2 className="font-display text-xl">{t('common.noResults', { defaultValue: 'No outfits saved yet' })}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('outfits.noSavedOutfitsDesc', { defaultValue: 'Get outfit proposals in the AI Stylist tab, pick your favorite, and save it to start logging your outfits.' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outfits.map((o) => {
            const outfitItemsMap = {};
            if (Array.isArray(o?.garments)) {
              o.garments.forEach((g) => {
                if (g && g.role) {
                  outfitItemsMap[g.role] = { image_url: g.image_url };
                }
              });
            }

            const hasOuterwear = outfitItemsMap['outerwear'] && !!outfitItemsMap['outerwear'].image_url;
            const hasTopOrDress = outfitItemsMap['top'] || outfitItemsMap['dress'];

            let canvasContent;

            if (hasOuterwear && hasTopOrDress) {
              const withOuterwearMap = { ...outfitItemsMap };
              delete withOuterwearMap['top'];
              delete withOuterwearMap['dress'];

              const withoutOuterwearMap = { ...outfitItemsMap };
              delete withoutOuterwearMap['outerwear'];

              canvasContent = (
                <div className="flex flex-col w-full">
                  <div className="relative w-full aspect-[4/5] bg-secondary/10 shrink-0 border-b border-border/50">
                    <AvatarViewer shapeParams={user?.avatar_shape_params || {}} sex={user?.sex || 'female'} outfitItems={withOuterwearMap} />
                    <Badge className="absolute top-3 left-3 rounded-full caps-label bg-background/90 text-foreground border border-border backdrop-blur">
                      {o.source_workflow === 'scheduled' ? t('ads.schedule.title', { defaultValue: 'Scheduled Preset' }) : t('stylist.occasion', { defaultValue: 'Special Event' })}
                    </Badge>
                    <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur px-2.5 py-1 rounded-md text-[10px] font-medium text-foreground shadow-sm pointer-events-none border border-border/50">
                      {t('suitcase.withOuterwear', { defaultValue: 'With Outerwear' })}
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => deleteOutfit(o.id)}
                      className="absolute top-3 right-3 rounded-xl h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={t('common.delete', { defaultValue: 'Delete' })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="relative w-full aspect-[4/5] bg-secondary/10 shrink-0">
                    <AvatarViewer shapeParams={user?.avatar_shape_params || {}} sex={user?.sex || 'female'} outfitItems={withoutOuterwearMap} />
                    <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur px-2.5 py-1 rounded-md text-[10px] font-medium text-foreground shadow-sm pointer-events-none border border-border/50">
                      {t('suitcase.withoutOuterwear', { defaultValue: 'Without Outerwear' })}
                    </div>
                  </div>
                </div>
              );
            } else {
              canvasContent = (
                <div className="relative w-full aspect-[4/5] bg-secondary/10 shrink-0">
                  <AvatarViewer shapeParams={user?.avatar_shape_params || {}} sex={user?.sex || 'female'} outfitItems={outfitItemsMap} />
                  <Badge className="absolute top-3 left-3 rounded-full caps-label bg-background/90 text-foreground border border-border backdrop-blur">
                    {o.source_workflow === 'scheduled' ? t('ads.schedule.title', { defaultValue: 'Scheduled Preset' }) : t('stylist.occasion', { defaultValue: 'Special Event' })}
                  </Badge>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => deleteOutfit(o.id)}
                    className="absolute top-3 right-3 rounded-xl h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={t('common.delete', { defaultValue: 'Delete' })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            }

            return (
              <Card key={o.id} className="rounded-2xl border border-border bg-card shadow-editorial overflow-hidden flex flex-col group hover:shadow-lg transition-shadow">
                {canvasContent}

                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-display text-lg font-semibold truncate text-foreground">
                      {(o.name || '').toLowerCase() === 'the look' ? t('components.outfitCanvas.the_look', { defaultValue: o.name }) : o.name}
                    </h3>
                    {o.prompt && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        "{o.prompt}"
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                      <span>
                        {o?.usage?.date || ''} · {o?.usage?.time || ''}
                      </span>
                    </div>
                    {o?.usage?.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                        <span className="truncate">{o.usage.location}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <div className="caps-label text-[10px] text-muted-foreground">{t('outfits.outfitPieces', { defaultValue: 'Outfit Pieces' })}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(o?.garments) && o.garments.map((g, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/50 border border-border/80 rounded-lg text-[10px] text-foreground/80 font-medium"
                        >
                          <span className="text-muted-foreground uppercase text-[8px] tracking-wider mr-1">{labelForRole(g.role, t)}</span>
                          <span>{g.title || g.description || t('addItem.preflight.untitled', { defaultValue: 'Garment' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ExploreBackButton />

      {/* Outfit Recommendations Modal */}
      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent 
          className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl"
          onInteractOutside={(e) => {
            if (floaterItemId || e.target.closest('#item-floater-panel')) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (floaterItemId) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {selectedNotification && getLocalizedNotification(selectedNotification, t).title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {selectedNotification && getLocalizedNotification(selectedNotification, t).body.split('\n')[0]}
            </p>
            {notifModalLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
                <p className="text-xs text-muted-foreground animate-pulse">
                  {t('outfits.generatingProposals', { defaultValue: 'Generating outfit recommendations from your closet...' })}
                </p>
              </div>
            ) : (selectedNotification?.payload?.outfit_recommendations && Array.isArray(selectedNotification.payload.outfit_recommendations) && selectedNotification.payload.outfit_recommendations.filter(Boolean).length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedNotification.payload.outfit_recommendations.filter(Boolean).map((rec, i) => (
                  <OutfitRecommendationCard
                    key={i}
                    rec={rec}
                    index={i}
                    sessionId={null}
                    onItemClick={(itemId) => setFloaterItemId(itemId)}
                    onSave={(r) => handleSaveOutfit(r, selectedNotification)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {t('outfits.noRecommendationsPayload', { defaultValue: 'No structured recommendations available for this notification.' })}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Closet Item Detail Side Sheet */}
      <ItemFloater
        itemId={floaterItemId}
        onClose={() => setFloaterItemId(null)}
        fromOutfits
      />
    </div>
  );
}
