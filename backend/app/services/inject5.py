import os

path = r"C:\DressApp_AG\frontend\src\pages\AddItem.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Restore `if (isBatch) return handleBatchBackground(files, 0);`
content = content.replace(
    "if (isBatch) return continueInteractive(fingerprints, {});",
    "if (isBatch) return handleBatchBackground(fingerprints, 0);"
)
content = content.replace(
    "return continueInteractive(survivors.map(f => fingerprints.find(x => x.file === f)), {});",
    "return handleBatchBackground(survivors.map(f => fingerprints.find(x => x.file === f)), skipped);"
)

# Now redefine handleBatchBackground to use analyzeItemImage
# We need to find the existing handleBatchBackground and replace it.
# Wait, handleBatchBackground was NOT deleted by inject3.py! It was just bypassed.
# So I can just replace the whole handleBatchBackground function body!

import re

# We can match `const handleBatchBackground = async (files, skippedDuplicates = 0) => {`
# to `const analyzeCards = async (cardsList) => {` or `const continueInteractive = async (fingerprints, acks) => {`
# Actually, it's safer to find `const handleBatchBackground = async ` and replace until the end of its block.

new_handle_batch = """  const handleBatchBackground = async (fingerprints, skippedDuplicates = 0) => {
    setBgBatch({
      total: fingerprints.length,
      processed: 0,
      saved: 0,
      failed: 0,
      fallbackSaves: 0,
      skippedDuplicates,
      pendingDuplicates: 0,
      analyzeFailed: 0,
    });

    const requestLang = (i18n.language || '').split('-')[0] || 'en';
    const b64List = await Promise.all(fingerprints.map(fp => fileToBase64(fp.file)));
    
    let totalItemsExpected = 0;
    
    const handleDetect = (frame) => {
      // detect frame gives us total items across all images
      const metas = frame.items_meta || [];
      totalItemsExpected = metas.length;
      // We can bump processed to something to show it started
      setBgBatch(b => b ? { ...b, processed: 1 } : null);
    };

    const handleItem = async (frame) => {
      const idx = frame.image_index;
      const fp = fingerprints[idx];
      const sourceMeta = {
        sourceSha256: fp.sha256 || null,
        sourcePhash: fp.phash || null,
        sourceColorSig: fp.color_sig || null,
        sourceFilename: fp.file?.name || null,
        sourceSizeBytes: typeof fp.file?.size === 'number' ? fp.file.size : null,
      };
      
      const analysis = frame.analysis || {};
      const cropB64 = frame.crop_base64 || b64List[idx];
      const mime = frame.crop_mime || fp.file?.type || 'image/jpeg';
      
      const cardLike = {
        base64: cropB64,
        mime,
        file: null,
        fields: hydrate(analysis, user),
        useReconstructed: false,
        ...sourceMeta,
      };

      if (frame.potential_duplicate) {
        const dupCard = {
          id: `bgdup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file: null,
          mime,
          previewUrl: `data:${mime};base64,${cropB64}`,
          base64: cropB64,
          originalCropUrl: `data:${mime};base64,${cropB64}`,
          status: 'ready',
          progress: 100,
          fields: cardLike.fields,
          potentialDuplicate: frame.potential_duplicate,
          pendingBatchSave: true,
        };
        setCards((prev) => [...prev, dupCard]);
        setBgBatch((b) => b ? { ...b, pendingDuplicates: (b.pendingDuplicates || 0) + 1, processed: b.processed + 1 } : b);
        return;
      }

      try {
        const created = await api.createItem(buildCreatePayload(cardLike));
        if (created && created.id) {
          try {
            const { closetStore } = await import('@/lib/closetStore');
            closetStore.upsert(created);
          } catch { /* ignore */ }
        }
        setBgBatch(b => b ? { ...b, saved: b.saved + 1, processed: b.processed + 1 } : null);
      } catch (_) {
        setBgBatch(b => b ? { ...b, failed: b.failed + 1, processed: b.processed + 1 } : null);
      }
    };

    const handleItemSkip = (frame) => {
      setBgBatch(b => b ? { ...b, processed: b.processed + 1 } : null);
    };

    try {
      await api.analyzeItemImage(
        { images_base64: b64List, language: requestLang },
        { onDetect: handleDetect, onItem: handleItem, onItemSkip: handleItemSkip }
      );
    } catch (err) {
      // Stream failed. Try to save all remaining as fallbacks?
      // For now just error out gracefully
      setBgBatch(b => b ? { ...b, failed: b.failed + (b.total - b.processed) } : null);
    }

    // Final checks and navigation
    setBgBatch((b) => {
      const saved = b?.saved ?? 0;
      const failed = b?.failed ?? 0;
      const analyzeFailed = b?.analyzeFailed ?? 0;
      const pendingDuplicates = b?.pendingDuplicates ?? 0;
      const skippedDups = b?.skippedDuplicates ?? 0;
      
      const dupTrailer = skippedDups ? ' (skipped ' + skippedDups + ' already in closet)' : '';
      
      if (pendingDuplicates) {
        toast.message(`Saved ${saved} new items. ${pendingDuplicates} duplicates pending.` + dupTrailer);
      } else if (saved && !failed) {
        toast.success(`Saved ${saved} items.` + dupTrailer);
      } else if (saved && failed) {
        toast.message(`Saved ${saved} · ${failed} failed` + dupTrailer);
      } else if (!saved && !pendingDuplicates && !skippedDups) {
        toast.error('Could not save any items. Please try again.');
      }
      
      setTimeout(() => {
        if (saved && !pendingDuplicates) nav('/closet');
      }, 1200);
      return null;
    });
  };
"""

# Let's find handleBatchBackground and replace it.
start_idx = content.find("const handleBatchBackground = async (files, skippedDuplicates = 0) => {")
end_idx = content.find("const analyzeCards = async (cardsList) => {")
if start_idx == -1 or end_idx == -1:
    end_idx = content.find("const analyzeCard = async (card) => {")

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_handle_batch + "\n  " + content[end_idx:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Injected successfully")
else:
    print(f"Failed to find indices. start: {start_idx}, end: {end_idx}")

