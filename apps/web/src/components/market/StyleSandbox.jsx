import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClosetStore } from '@/lib/useClosetStore';
import { ImageOff, Sparkles, Check } from 'lucide-react';
import { bestImageUrl } from '@/lib/itemImage';

export default function StyleSandbox({ isOpen, onClose, listingItem }) {
  const { t } = useTranslation();
  const store = useClosetStore();
  const items = store.items || [];

  // Categorize local wardrobe items
  const localTops = items.filter(it => it.category === 'Top' || it.category === 'Outerwear' || it.category === 'Full Body');
  const localBottoms = items.filter(it => it.category === 'Bottom');
  const localShoes = items.filter(it => it.category === 'Footwear');

  // Selected sandbox styling combination
  const [selectedTop, setSelectedTop] = useState(null);
  const [selectedBottom, setSelectedBottom] = useState(null);
  const [selectedShoe, setSelectedShoe] = useState(null);

  // Auto-fill listing item if category matches
  const listingCategory = listingItem?.category;
  const isListingTop = listingCategory === 'Top' || listingCategory === 'Outerwear' || listingCategory === 'Full Body';
  const isListingBottom = listingCategory === 'Bottom';
  const isListingShoe = listingCategory === 'Footwear';

  // Helper to render local item items
  const renderItemSelectorGrid = (list, selected, setSelected) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-8 text-text-brand text-xs border border-dashed border-border rounded-[12px] bg-secondary/10">
          <ImageOff className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
          <span>{t('sandbox.noItemsInCategory', { defaultValue: 'No items in this category.' })}</span>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pe-1">
        {list.map(it => {
          const isSelected = selected?.id === it.id;
          const imgUrl = bestImageUrl(it);
          return (
            <div
              key={it.id}
              onClick={() => setSelected(isSelected ? null : it)}
              className={`p-2 rounded-[12px] border cursor-pointer flex items-center gap-2 transition-all select-none ${isSelected
                ? 'border-primary-brand bg-primary-shadow'
                : 'border-border bg-white'
                }`}
            >
              <div className="h-10 w-10 shrink-0 bg-accent-beige rounded-full overflow-hidden flex items-center justify-center border border-border">
                {imgUrl ? (
                  <img src={imgUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImageOff className="h-4 w-4 text-text-brand" />
                )}
              </div>
              <span className="text-[12px] truncate font-semibold text-dark-brand">{it.name || it.title || 'Garment'}</span>
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-xl rounded-[20px] bg-white border border-border overflow-hidden">
        <DialogTitle>{t('sandbox.title', { defaultValue: 'Style Sandbox' })}</DialogTitle>
        <DialogDescription>{t('sandbox.description', { defaultValue: 'Mix & match this listing with your closet items to verify style compatibility before buying.' })}</DialogDescription>
        <div className="">
          {/* Closet Selection Panel */}
          <div className="flex flex-col justify-between">
            <Tabs defaultValue={isListingTop ? 'bottoms' : 'tops'} className="w-full flex-1">
              <TabsList className="grid grid-cols-3 w-full bg-accent-beige p-0.5 h-10 rounded-[12px] mb-3 text-dark-brand">
                <TabsTrigger value="tops" disabled={isListingTop} className="text-[10px] font-semibold">{t('taxonomy.role.top', { defaultValue: 'Tops' })}</TabsTrigger>
                <TabsTrigger value="bottoms" disabled={isListingBottom} className="text-[10px] font-semibold">{t('taxonomy.role.bottom', { defaultValue: 'Bottoms' })}</TabsTrigger>
                <TabsTrigger value="shoes" disabled={isListingShoe} className="text-[10px] font-semibold">{t('taxonomy.role.shoes', { defaultValue: 'Shoes' })}</TabsTrigger>
              </TabsList>
              <TabsContent value="tops" className="focus-visible:outline-none">
                {renderItemSelectorGrid(localTops, selectedTop, setSelectedTop)}
              </TabsContent>
              <TabsContent value="bottoms" className="focus-visible:outline-none">
                {renderItemSelectorGrid(localBottoms, selectedBottom, setSelectedBottom)}
              </TabsContent>
              <TabsContent value="shoes" className="focus-visible:outline-none">
                {renderItemSelectorGrid(localShoes, selectedShoe, setSelectedShoe)}
              </TabsContent>
            </Tabs>
          </div>
          {/* Canvas Outfit Preview Area */}
          <div className="flex flex-col items-center justify-center p-3 bg-primary-shadow rounded-[12px] border border-border relative mt-3">
            <span className="text-[12px] font-bold text-text-brand">{t('sandbox.canvas', { defaultValue: 'Outfit Canvas' })}</span>
            <div className="flex items-center gap-2 relative w-full justify-center mt-3">
              {/* Top Layer */}
              <div className="relative">
                {isListingTop ? (
                  <div className="h-24 w-24 bg-card rounded-[12px] border border-primary-brand p-1 flex flex-col items-center justify-center shadow-md relative">
                    <span className="absolute top-0.5 end-1.5 text-[8px] font-bold text-primary-brand uppercase tracking-wider">{t('sandbox.listing', { defaultValue: 'Buy' })}</span>
                    <img src={bestImageUrl(listingItem)} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-24 w-24 bg-card rounded-[12px] border border-border p-1 flex items-center justify-center shadow-sm relative">
                    {selectedTop ? (
                      <img src={bestImageUrl(selectedTop)} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[9px] text-text-brand text-center">{t('sandbox.noTop', { defaultValue: 'Select Top' })}</span>
                    )}
                  </div>
                )}
              </div>
              {/* Bottom Layer */}
              <div className="relative">
                {isListingBottom ? (
                  <div className="h-24 w-24 bg-card rounded-[12px] border border-primary-brand p-1 flex flex-col items-center justify-center shadow-md relative">
                    <span className="absolute top-0.5 end-1.5 text-[8px] font-bold text-primary-brand uppercase tracking-wider">{t('sandbox.listing', { defaultValue: 'Buy' })}</span>
                    <img src={bestImageUrl(listingItem)} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-24 w-24 bg-card rounded-[12px] border border-border p-1 flex items-center justify-center shadow-sm relative">
                    {selectedBottom ? (
                      <img src={bestImageUrl(selectedBottom)} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[9px] text-text-brand text-center">{t('sandbox.noBottom', { defaultValue: 'Select Bottom' })}</span>
                    )}
                  </div>
                )}
              </div>
              {/* Footwear Layer */}
              <div className="relative">
                {isListingShoe ? (
                  <div className="h-24 w-24 bg-card rounded-[12px] border border-primary-brand p-1 flex flex-col items-center justify-center shadow-md relative">
                    <span className="absolute top-0.5 end-1.5 text-[8px] font-bold text-primary-brand uppercase tracking-wider">{t('sandbox.listing', { defaultValue: 'Buy' })}</span>
                    <img src={bestImageUrl(listingItem)} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-24 w-24 bg-card rounded-[12px] border border-border p-1 flex items-center justify-center shadow-sm relative">
                    {selectedShoe ? (
                      <img src={bestImageUrl(selectedShoe)} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[9px] text-text-brand text-center">{t('sandbox.noShoes', { defaultValue: 'Select Shoes' })}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              onClick={onClose}
            >
              <Check className="h-4 w-4" />
              {t('sandbox.looksGood', { defaultValue: 'Looks Great!' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
