import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useClosetStore } from '@/lib/useClosetStore';
import { DollarSign, Percent, TrendingUp, Shirt, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WardrobeStats() {
  const { t } = useTranslation();
  const store = useClosetStore();
  const items = store.items || [];

  // Sync closet items if store is empty or needs refresh
  useEffect(() => {
    if (store.fetchItems) {
      store.fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalValue = items.reduce((acc, it) => acc + (it.price_cents || 0), 0) / 100;
  const wornItems = items.filter(it => (it.wear_count || 0) > 0).length;
  const utilization = items.length > 0 ? Math.round((wornItems / items.length) * 100) : 0;

  // Calculate Color Distribution
  const colorMap = {};
  items.forEach(it => {
    const col = it.color || it.colors?.[0] || t('common.unknownColor', 'Other');
    colorMap[col] = (colorMap[col] || 0) + 1;
  });
  const colorData = Object.entries(colorMap).map(([name, value]) => ({ name, value }));

  // Cost-per-Wear calculations
  const sortedByEfficiency = [...items]
    .filter(it => it.price_cents > 0)
    .map(it => ({
      ...it,
      cpw: (it.price_cents / 100) / (it.wear_count || 1)
    }))
    .sort((a, b) => a.cpw - b.cpw);

  const topEfficient = sortedByEfficiency.slice(0, 3);
  const bottomEfficient = [...sortedByEfficiency].reverse().slice(0, 3);

  // Curated Tailwind HSL colors for Pie chart
  const CHART_COLORS = [
    'hsl(var(--brand))',
    'hsl(var(--accent-green))',
    '#f97316', // orange
    '#0ea5e9', // sky blue
    '#eab308', // yellow
    '#ec4899', // pink
    '#10b981', // emerald
    '#8b5cf6'  // violet
  ];

  return (
    <div className="container-px max-w-4xl mx-auto pt-6 pb-16 space-y-8" data-testid="wardrobe-stats-page">
      {/* Header */}
      <div className="flex flex-col">
        <span className="caps-label text-brand font-bold tracking-wider text-xs">{t('stats.category', 'DressApp Unpacked')}</span>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1 text-foreground">{t('stats.title', 'Wardrobe Insights')}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          {t('stats.description', 'Analyze your wardrobe value, wear metrics, and dominant style palettes to cultivate conscious wear habits.')}
        </p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Value Card */}
        <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-accent-lilac/30 text-brand flex items-center justify-center shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">{t('stats.totalValue', 'Closet Worth')}</span>
              <span className="text-2xl font-bold font-display text-foreground" data-testid="stats-total-value">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Utilization Card */}
        <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0">
              <Percent className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">{t('stats.utilization', 'Closet Utilization')}</span>
              <span className="text-2xl font-bold font-display text-foreground" data-testid="stats-utilization">
                {utilization}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Active Items Worn */}
        <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-950/20 text-orange-500 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">{t('stats.wornRatio', 'Items Worn')}</span>
              <span className="text-2xl font-bold font-display text-foreground" data-testid="stats-items-ratio">
                {wornItems} / {items.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts & Leaderboard Section */}
      {items.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-border py-16 text-center">
          <CardContent className="space-y-4">
            <Shirt className="h-12 w-12 text-muted-foreground/60 mx-auto" />
            <h2 className="font-display text-xl font-bold">{t('stats.emptyStateTitle', 'No Garments to Analyze')}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('stats.emptyStateDesc', 'Add items to your wardrobe and record wears with your stylist or calendar to see insights.')}
            </p>
            <div className="pt-2">
              <Link to="/closet/add">
                <Button className="rounded-2xl bg-brand text-brand-foreground hover:bg-brand/90 px-6 font-semibold shadow-sm">
                  {t('closet.addNewItem', 'Add First Item')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Color Breakdown Card */}
          <Card className="rounded-3xl border border-border bg-card shadow-sm p-6 flex flex-col justify-between">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-base font-semibold font-display text-foreground">{t('stats.colorPalette', 'Color Palette Breakdown')}</CardTitle>
            </CardHeader>
            <div className="h-64 w-full flex items-center justify-center">
              {colorData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={colorData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {colorData.map((entry, index) => {
                        let fillHex = CHART_COLORS[index % CHART_COLORS.length];
                        const lowerName = entry.name.toLowerCase();
                        if (lowerName === 'black') fillHex = '#18181b';
                        else if (lowerName === 'white') fillHex = '#f4f4f5';
                        else if (lowerName === 'gray' || lowerName === 'grey') fillHex = '#71717a';
                        return <Cell key={`cell-${index}`} fill={fillHex} className="stroke-background stroke-2" />;
                      })}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-xs text-muted-foreground">{t('stats.noColorData', 'No color tags specified.')}</span>
              )}
            </div>
          </Card>

          {/* Cost-per-Wear Card */}
          <Card className="rounded-3xl border border-border bg-card shadow-sm p-6 flex flex-col justify-between space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-semibold font-display text-foreground">{t('stats.costPerWear', 'Cost-per-Wear Leaderboard')}</CardTitle>
            </CardHeader>

            <div className="space-y-6 flex-1 justify-center flex flex-col">
              {sortedByEfficiency.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-accent-green caps-label block tracking-wider">{t('stats.mostEfficient', 'Most Wear-Efficient')}:</span>
                    {topEfficient.map(it => (
                      <div key={it.id} className="flex justify-between items-center text-xs py-2 border-b border-border/40 hover:bg-muted/30 px-1 rounded-lg transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          {it.image_url && (
                            <img src={it.segmented_image_url || it.image_url} alt="" className="h-6 w-6 rounded object-contain shrink-0 bg-secondary/50" />
                          )}
                          <span className="truncate font-medium text-foreground">{it.name || it.title || 'Untitled'}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0">${it.cpw.toFixed(2)}/wear</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-destructive caps-label block tracking-wider">{t('stats.leastEfficient', 'Least Wear-Efficient')}:</span>
                    {bottomEfficient.map(it => (
                      <div key={it.id} className="flex justify-between items-center text-xs py-2 border-b border-border/40 hover:bg-muted/30 px-1 rounded-lg transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          {it.image_url && (
                            <img src={it.segmented_image_url || it.image_url} alt="" className="h-6 w-6 rounded object-contain shrink-0 bg-secondary/50" />
                          )}
                          <span className="truncate font-medium text-foreground">{it.name || it.title || 'Untitled'}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0">${it.cpw.toFixed(2)}/wear</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center p-6 text-muted-foreground text-xs bg-secondary/30 rounded-2xl border border-dashed border-border/50">
                  <Award className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <span>{t('stats.noCPWData', 'Purchase price is required to calculate cost-per-wear stats.')}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
