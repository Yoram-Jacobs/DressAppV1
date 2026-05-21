import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export function DuplicateConfirmDialog({ cards, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const active = cards.find(
    (c) => c.potentialDuplicate && !c.duplicateConfirmed
  );
  const open = !!active;
  const dup = active?.potentialDuplicate;
  const newTitle =
    active?.fields?.title ||
    active?.fields?.name ||
    active?.fields?.item_type ||
    t('addItem.duplicate.thisItem', { defaultValue: 'this item' });
  const existingTitle =
    dup?.title ||
    dup?.name ||
    dup?.item_type ||
    t('addItem.duplicate.thisItem', { defaultValue: 'this item' });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && active) onCancel(active.id);
      }}
    >
      <DialogContent
        className="sm:max-w-md rounded-[calc(var(--radius)+4px)]"
        data-testid="duplicate-confirm-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('addItem.duplicate.title', {
              defaultValue: 'Already in your closet',
            })}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t('addItem.duplicate.body', {
              defaultValue:
                'It looks like “{{existing}}” is already in your closet. Do you want to add this new “{{incoming}}” as a duplicate?',
              existing: existingTitle,
              incoming: newTitle,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 my-2">
          {dup?.thumbnail_data_url ? (
            <div className="flex-1 flex flex-col items-center gap-1">
              <img
                src={dup.thumbnail_data_url}
                alt={existingTitle}
                className="h-28 w-28 object-contain rounded-lg border border-border bg-secondary/30"
                data-testid="duplicate-existing-thumb"
              />
              <span className="caps-label text-muted-foreground">
                {t('addItem.duplicate.existing', { defaultValue: 'Existing' })}
              </span>
            </div>
          ) : null}
          {active?.previewUrl ? (
            <div className="flex-1 flex flex-col items-center gap-1">
              <img
                src={active.previewUrl}
                alt={newTitle}
                className="h-28 w-28 object-contain rounded-lg border border-border bg-secondary/30"
                data-testid="duplicate-incoming-thumb"
              />
              <span className="caps-label text-muted-foreground">
                {t('addItem.duplicate.incoming', { defaultValue: 'New upload' })}
              </span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => active && onCancel(active.id)}
            data-testid="duplicate-cancel-button"
          >
            <X className="h-4 w-4 me-2" />
            {t('addItem.duplicate.cancel', { defaultValue: 'Discard upload' })}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => active && onConfirm(active.id)}
            data-testid="duplicate-confirm-button"
          >
            <Plus className="h-4 w-4 me-2" />
            {t('addItem.duplicate.confirm', { defaultValue: 'Add anyway' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
