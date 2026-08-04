import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CreditPackPurchase({ pricingData }) {
  const { t } = useTranslation();

  return (
    <section id="topup" data-testid="pricing-credit-packs-section">
      <h2 className="text-xl sm:text-2xl font-display tracking-tight text-primary mb-2 flex items-center gap-2">
        <Zap className="h-5 w-5 text-accent" />
        {t('pricing.topUpHeader', { defaultValue: 'Purchase Additional Credits' })}
      </h2>
      <p className="text-xs text-muted-foreground font-body mb-8">
        {t('pricing.topUpSub', { defaultValue: 'Paid credit packs never expire and are consumed after monthly credits are depleted.' })}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pricingData.credit_packs.map((pack) => (
          <motion.div
            key={pack.amount}
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            {/* Premium Swing Tag Design */}
            <div className="relative bg-card border border-border shadow-[var(--shadow-sm)] p-5 rounded-[calc(var(--radius)+6px)] flex flex-col items-center text-center group overflow-hidden">
              {/* Hanger loop simulator */}
              <div className="absolute top-0 inset-x-0 flex justify-center mt-[-6px]">
                <div className="h-3 w-3 rounded-full border border-border/80 bg-background" />
              </div>
              
              <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground mt-2 mb-3">
                {t('pricing.packCategory', { defaultValue: 'AI TOP-UP' })}
              </span>
              
              <h3 className="text-2xl font-bold font-body tracking-tight text-accent">
                {pack.amount}
              </h3>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-4">
                {t('pricing.creditsLabel', { defaultValue: 'Credits' })}
              </span>

              <div className="text-xl font-bold font-body text-primary mb-5">
                ${(pack.price_cents / 100).toFixed(2)}
              </div>

              <Link to={`/pricing/purchase?pack_size=${pack.amount}`} className="w-full">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full text-xs rounded-xl font-semibold border-accent/30 text-accent hover:bg-accent/5 focus-visible:shadow-[var(--shadow-focus)] active:scale-[0.98] transition-all"
                  data-testid={`buy-pack-${pack.amount}`}
                >
                  {t('pricing.buyNow', { defaultValue: 'Buy Now' })}
                </Button>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
