import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArchiveX,
  Ban,
  Eye,
  Pencil,
  SendHorizonal,
  Trash2,
  Settings,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { campaignApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CampaignSettingsSheet } from '@/components/CampaignSettingsSheet';

const STATUS_CONFIG = {
  draft: {
    label: 'campaigns.status.draft',
    className: 'bg-secondary text-muted-foreground',
    Icon: Pencil,
  },
  pending_approval: {
    label: 'campaigns.status.pendingApproval',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Icon: Clock,
  },
  approved: {
    label: 'campaigns.status.approved',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Icon: CheckCircle2,
  },
  active: {
    label: 'campaigns.status.active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'campaigns.status.rejected',
    className: 'bg-destructive/10 text-destructive',
    Icon: XCircle,
  },
  paused: {
    label: 'campaigns.status.paused',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Icon: PauseCircle,
  },
  expired: {
    label: 'campaigns.status.expired',
    className: 'bg-secondary text-muted-foreground',
    Icon: ArchiveX,
  },
  cancelled: {
    label: 'campaigns.status.cancelled',
    className: 'bg-secondary text-muted-foreground',
    Icon: Ban,
  },
};

export default function MyCampaigns() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCampaign, setSettingsCampaign] = useState(null);

  const isExpert = user?.professional?.is_professional;

  useEffect(() => {
    if (!isExpert) return;
    campaignApi
      .listMyCampaigns({ limit: 50 })
      .then((res) => setCampaigns(res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isExpert]);

  const handleSubmit = async (id) => {
    setActionId(id);
    try {
      await campaignApi.submitCampaign(id);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'pending_approval' } : c))
      );
      toast.success(t('campaigns.mine.submitSuccess'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.mine.submitError'));
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id) => {
    setActionId(id);
    try {
      await campaignApi.cancelCampaign(id);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'cancelled' } : c))
      );
      toast.success(t('campaigns.mine.cancelSuccess'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.mine.cancelError'));
    } finally {
      setActionId(null);
    }
  };

  const handleCampaignUpdated = useCallback((updated) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    );
  }, []);

  if (!isExpert) {
    return (
      <div className="container-px max-w-xl mx-auto pt-16 text-center">
        <h1 className="font-display text-2xl">{t('campaigns.create.notExpert')}</h1>
        <Button className="mt-6" onClick={() => navigate('/me')}>
          {t('campaigns.create.goToProfile')}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="container-px max-w-4xl mx-auto pt-6 pb-24">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="caps-label text-muted-foreground">{t('nav.experts')}</div>
            <h1 className="font-display text-3xl mt-1" data-testid="my-campaigns-title">
              {t('campaigns.mine.title')}
            </h1>
          </div>
          <Button
            asChild
            className="rounded-xl"
            data-testid="my-campaigns-create-btn"
          >
            <Link to="/campaigns/create">
              <Plus className="h-4 w-4 me-1" />
              {t('campaigns.mine.createNew')}
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="rounded-2xl shadow-editorial" data-testid="my-campaigns-empty">
            <CardContent className="p-12 text-center">
              <Tag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display text-xl">{t('campaigns.mine.empty.title')}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {t('campaigns.mine.empty.body')}
              </p>
              <Button asChild className="mt-6 rounded-xl">
                <Link to="/campaigns/create">{t('campaigns.mine.createFirst')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
              const Icon = cfg.Icon;
              const busy = actionId === c.id;

              return (
                <Card
                  key={c.id}
                  className="rounded-2xl shadow-editorial"
                  data-testid={`my-campaign-${c.id}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-lg truncate">{c.title}</h3>
                          <Badge
                            className={cn(
                              'rounded-full text-[10px] border-0 flex items-center gap-1',
                              cfg.className
                            )}
                          >
                            <Icon className="h-2.5 w-2.5" />
                            {t(cfg.label)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {c.business_name} · {c.category}
                        </p>
                        {c.rejection_reason && (
                          <div className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{c.rejection_reason}</span>
                          </div>
                        )}
                        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                          {c.discount_pct > 0 && <span>{c.discount_pct}% OFF</span>}
                          {c.end_date && (
                            <span>
                              {t('campaigns.detail.until')}: {c.end_date}
                            </span>
                          )}
                          <span>
                            {t('campaigns.detail.views')}: {c.analytics?.views || 0}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => { setSettingsCampaign(c); setSettingsOpen(true); }}
                          data-testid={`my-campaign-settings-${c.id}`}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          asChild
                          data-testid={`my-campaign-view-${c.id}`}
                        >
                          <Link to={`/campaigns/${c.id}`}>
                            <Eye className="h-3.5 w-3.5 me-1" />
                            {t('common.open')}
                          </Link>
                        </Button>

                        {['draft', 'rejected'].includes(c.status) && (
                          <Button
                            size="sm"
                            className="rounded-xl"
                            onClick={() => handleSubmit(c.id)}
                            disabled={busy}
                            data-testid={`my-campaign-submit-${c.id}`}
                          >
                            <SendHorizonal className="h-3.5 w-3.5 me-1" />
                            {t('campaigns.mine.submit')}
                          </Button>
                        )}

                        {['draft', 'rejected'].includes(c.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => handleCancel(c.id)}
                            disabled={busy}
                            data-testid={`my-campaign-cancel-${c.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 me-1" />
                            {t('campaigns.mine.cancel')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <CampaignSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        campaign={settingsCampaign}
        onUpdated={handleCampaignUpdated}
      />
    </div>
  );
}
