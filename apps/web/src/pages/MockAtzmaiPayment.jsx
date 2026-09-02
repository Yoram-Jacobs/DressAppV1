import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { client } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MockAtzmaiPayment() {
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);

  const paymentId = searchParams.get('payment_id');
  const redirectUrl = searchParams.get('redirect_url');
  const failRedirectUrl = searchParams.get('fail_redirect_url');
  const amount = searchParams.get('amount') || '0.00';
  const description = searchParams.get('description') || 'DressApp Purchase';
  const method = searchParams.get('method') || 'regular';

  const handleApprove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Simulate webhook event callback to the backend
      await client.post('/atzmai/webhook', {
        atzmai_payment_id: paymentId,
        status: 'completed',
        transaction_status: 'approved',
        sale_status: 'completed',
        price: amount,
        transaction_amount: amount
      });

      toast.success('Mock payment approved successfully! Redirecting...');
      setTimeout(() => {
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          window.location.href = '/me';
        }
      }, 1500);
    } catch (err) {
      console.error('Webhook trigger failed:', err);
      toast.error('Failed to trigger mock callback on backend.');
      setBusy(false);
    }
  };

  const handleCancel = () => {
    toast.info('Payment cancelled.');
    if (failRedirectUrl) {
      window.location.href = failRedirectUrl;
    } else {
      window.location.href = '/me';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background radial effects */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-10"
        style={{
          backgroundImage: `
            radial-gradient(800px circle at 50% 30%, rgba(31,111,107,0.15), transparent 60%)
          `
        }}
      />

      <Card className="relative w-full max-w-md p-6 border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2 border-b border-border/40 pb-5">
          <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-1 animate-pulse">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-display font-semibold text-primary">עצמאי שכיר</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
            Atzmai Sachir Gateway (Mock Mode)
          </p>
        </div>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between border-b border-border/40 pb-3">
            <span className="text-muted-foreground">Product/Description:</span>
            <span className="font-semibold text-foreground max-w-[200px] truncate text-right">
              {decodeURIComponent(description)}
            </span>
          </div>

          <div className="flex justify-between border-b border-border/40 pb-3">
            <span className="text-muted-foreground">Payment ID:</span>
            <span className="font-mono text-xs text-muted-foreground">{paymentId}</span>
          </div>

          <div className="flex justify-between border-b border-border/40 pb-3">
            <span className="text-muted-foreground">Payment Method:</span>
            <span className="font-semibold text-foreground capitalize flex items-center gap-1">
              {method === 'bit' ? (
                <>📱 Bit (Mock)</>
              ) : method === 'recurring' ? (
                <>🔄 Subscription (Mock)</>
              ) : (
                <>💳 Credit Card (Mock)</>
              )}
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-2">
            <span className="font-semibold text-foreground text-base">Total Amount:</span>
            <span className="text-2xl font-extrabold text-foreground">${amount}</span>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-border/40">
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 h-11 rounded-xl"
            onClick={handleApprove}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Simulate Successful Payment
          </Button>

          <Button 
            variant="outline" 
            className="w-full font-semibold flex items-center justify-center gap-2 h-11 border-border/80 hover:bg-destructive/10 hover:text-destructive rounded-xl"
            onClick={handleCancel}
            disabled={busy}
          >
            <AlertCircle className="h-4 w-4" />
            Cancel Payment
          </Button>
        </div>

        <div className="text-[10px] text-muted-foreground text-center leading-normal">
          This is a simulated transaction sandbox. No real funds will be charged.
        </div>
      </Card>
    </div>
  );
}
