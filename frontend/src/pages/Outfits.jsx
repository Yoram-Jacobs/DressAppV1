import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Calendar, MapPin, Sparkles, Bell, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AvatarViewer from '@/components/AvatarViewer';
import { labelForRole } from '@/lib/taxonomy';

export default function Outfits() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [outfits, setOutfits] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    loadData();
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

  return (
    <div className="container-px max-w-6xl mx-auto pt-6 md:pt-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <div className="caps-label text-muted-foreground">{t('outfitCanvas.outfit_canvas', 'My Wardrobe Diary')}</div>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">{t('outfitCanvas.outfit_canvas', 'Saved Outfits')}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {t('outfits.viewDescription', { defaultValue: 'View outfits you have composed and scheduled. Your AI Stylist ensures you utilize all closet assets and warns you of previous occasion repetitions.' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
          <RefreshCw className="h-4 w-4" /> {t('stylist.refreshScout', 'Refresh')}
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
                {t('common.clear', 'Clear logs')}
              </Button>
            )}
          </div>
          
          {notifLoading ? (
            <p className="text-xs text-muted-foreground animate-pulse">{t('common.loading', 'Loading mock push notifications...')}</p>
          ) : notifications.length === 0 ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2 p-3 bg-card/40 rounded-xl border border-dashed border-border/60">
              <AlertCircle className="h-4 w-4 opacity-75" />
              <span>{t('outfits.noNotifs', { defaultValue: 'No notifications triggered yet. Set your daily reminder in settings or schedule an event to test.' })}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[180px] overflow-y-auto pr-1">
              {notifications.map((n) => (
                <div key={n.id} className="p-3 bg-card rounded-xl border border-border flex items-start gap-2.5 shadow-sm text-xs">
                  <div className="p-1 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] rounded-lg shrink-0">
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{n.title}</div>
                    <div className="text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-1.5">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
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
            <h2 className="font-display text-xl">{t('common.noResults', 'No outfits saved yet')}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('outfits.noSavedOutfitsDesc', { defaultValue: 'Get outfit proposals in the AI Stylist tab, pick your favorite, and save it to start logging your outfits.' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outfits.map((o) => {
            const outfitItemsMap = {};
            o.garments.forEach((g) => {
              outfitItemsMap[g.role] = { image_url: g.image_url };
            });

            return (
              <Card key={o.id} className="rounded-2xl border border-border bg-card shadow-editorial overflow-hidden flex flex-col group hover:shadow-lg transition-shadow">
                <div className="relative w-full aspect-[4/5] bg-secondary/10 shrink-0">
                  <AvatarViewer shapeParams={user?.avatar_shape_params || {}} sex={user?.sex || 'female'} outfitItems={outfitItemsMap} />
                  <Badge className="absolute top-3 left-3 rounded-full caps-label bg-background/90 text-foreground border border-border backdrop-blur">
                    {o.source_workflow === 'scheduled' ? t('ads.schedule.title', 'Scheduled Preset') : t('stylist.occasion', 'Special Event')}
                  </Badge>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => deleteOutfit(o.id)}
                    className="absolute top-3 right-3 rounded-xl h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={t('common.delete', 'Delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-display text-lg font-semibold truncate text-foreground">{o.name}</h3>
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
                        {o.usage.date} · {o.usage.time}
                      </span>
                    </div>
                    {o.usage.location && (
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
                      {o.garments.map((g, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/50 border border-border/80 rounded-lg text-[10px] text-foreground/80 font-medium"
                        >
                          <span className="text-muted-foreground uppercase text-[8px] tracking-wider mr-1">{labelForRole(g.role, t)}</span>
                          <span>{g.title || t('addItem.preflight.untitled', 'Garment')}</span>
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
    </div>
  );
}
