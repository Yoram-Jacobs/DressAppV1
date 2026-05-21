import os
import re

target_path = r'C:\DressApp_AG\frontend\src\pages\AddItem.jsx'
content = open(target_path, 'r', encoding='utf-8').read()

# 1. Update `continueInteractive` to call `analyzeCards`
content = content.replace(
    """    setCards((prev) => [...prev, ...drafts]);
    drafts.forEach((d) => analyzeCard(d));
  };""",
    """    setCards((prev) => [...prev, ...drafts]);
    analyzeCards(drafts);
  };"""
)

# 2. In `handleFiles`, remove `handleBatchBackground` calls and just call `continueInteractive`
content = content.replace(
    "if (isBatch) return handleBatchBackground(files, 0);",
    "if (isBatch) return continueInteractive(fingerprints, {});"
)
content = content.replace(
    "return handleBatchBackground(survivors, skipped);",
    "return continueInteractive(survivors.map(f => fingerprints.find(x => x.file === f)), {});"
)

# 3. Replace `analyzeCard` with `analyzeCards`
# We'll just define `analyzeCards` right before `analyzeCard` and keep `analyzeCard` as a fallback or delete it.

analyze_cards_code = """
  const analyzeCards = async (cardsList) => {
    const cardsToProcess = cardsList.filter((card) => {
      if (analyzeInFlight.current.has(card.id)) {
        console.warn(`[analyzeCards] skipped duplicate analyze for card ${card.id} — already in flight`);
        return false;
      }
      analyzeInFlight.current.add(card.id);
      workStore.registerAnalyze(card.id, card.sourceFilename || card.file?.name || null);
      return true;
    });

    if (cardsToProcess.length === 0) return;

    const startedAt = Date.now();
    const tick = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const target = Math.min(92, 4 + elapsed * 5);
      setCards((prev) =>
        prev.map((c) =>
          cardsToProcess.some(cp => cp.id === c.id) && c.status === 'scanning'
            ? { ...c, progress: target }
            : c
        )
      );
    }, 250);

    let perCardIds = {};
    cardsToProcess.forEach(c => { perCardIds[c.id] = []; });
    let flatSlotIds = [];

    try {
      const requestLang = (i18n.language || '').split('-')[0] || 'en';

      const buildBaseCard = (meta, cardId, originalCard) => ({
        id: cardId,
        file: null,
        mime: meta.crop_mime || 'image/jpeg',
        previewUrl: meta.crop_base64
          ? `data:${meta.crop_mime || 'image/jpeg'};base64,${meta.crop_base64}`
          : originalCard.previewUrl,
        base64: originalCard.base64,
        cropBase64: meta.crop_base64 || undefined,
        originalCropUrl: meta.crop_base64
          ? `data:${meta.crop_mime || 'image/jpeg'};base64,${meta.crop_base64}`
          : null,
        reconstructedUrl: null,
        reconstructedB64: null,
        reconstructionMeta: null,
        useReconstructed: false,
        status: 'scanning',
        progress: 60,
        fields: hydrate({}, user),
        error: null,
        label: meta.label || null,
        potentialDuplicate: null,
        fromOnePass: false,
        reconstructionAdvised: false,
        deferMatte: !!meta.defer_matte,
        _streamSlot: meta._slot,
      });

      const handleDetect = (frame) => {
        const metas = (frame.items_meta || []).map((m, i) => ({ ...m, _slot: i }));
        if (metas.length === 0) return;

        const counts = {};
        metas.forEach(m => { counts[m.image_index] = (counts[m.image_index] || 0) + 1; });

        const newCards = [];
        metas.forEach((m) => {
           const origCard = cardsToProcess[m.image_index];
           if (!origCard) {
               flatSlotIds.push(null);
               return;
           }
           const newId = `${origCard.id}-${perCardIds[origCard.id].length}`;
           perCardIds[origCard.id].push(newId);
           flatSlotIds.push({ id: newId, origCard });
           newCards.push(buildBaseCard(m, newId, origCard));
        });

        cardsToProcess.forEach((origCard, idx) => {
           const count = counts[idx] || 0;
           if (count > 0) {
               workStore.updateAnalyze(origCard.id, { items: 0, total: count });
           } else {
               // No items detected for this card. We should probably mark it as error later, but for now we skip.
               // We don't remove it from DOM yet, we just leave it.
           }
        });

        setCards((prev) => {
          const idsToRemove = new Set(cardsToProcess.map(c => c.id));
          const filtered = prev.filter(c => !idsToRemove.has(c.id));
          return [...filtered, ...newCards];
        });

        cardsToProcess.forEach(c => {
           if (c.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(c.previewUrl);
        });
      };

      const handleItem = (frame) => {
        const slot = flatSlotIds[frame.index];
        if (!slot) return;
        const { id: slotId, origCard } = slot;

        const job = workStore.getSnapshot().analyzeJobs[origCard.id];
        if (job) {
          workStore.updateAnalyze(origCard.id, {
            items: Math.min((job.items || 0) + 1, job.total || (job.items + 1)),
          });
        }

        const rec = frame.reconstruction;
        const recValidated = !!(rec && rec.validated && rec.image_b64);
        const reconstructedUrl = recValidated
          ? `data:${rec.mime_type || 'image/png'};base64,${rec.image_b64}`
          : null;

        setCards((prev) =>
          prev.map((c) =>
            c.id === slotId
              ? {
                  ...c,
                  status: 'ready',
                  progress: 100,
                  fields: hydrate(frame.analysis || {}, user),
                  label: frame.label || c.label,
                  potentialDuplicate: frame.potential_duplicate || null,
                  fromOnePass: !!frame.one_pass,
                  reconstructionAdvised: !!frame.reconstruction_advised,
                  deferMatte: !!frame.defer_matte,
                  needsReconstruction: !!frame.needs_reconstruction,
                  reconstructionReasons: frame.reconstruction_reasons || [],
                  reconstructedUrl,
                  reconstructedB64: recValidated ? rec.image_b64 : null,
                  reconstructionMeta: recValidated
                    ? {
                        reasons: rec.reasons || [],
                        prompt: rec.prompt,
                        model: rec.model,
                        mime_type: rec.mime_type,
                      }
                    : null,
                  useReconstructed: recValidated,
                  previewUrl: recValidated ? reconstructedUrl : c.previewUrl,
                }
              : c
          )
        );
      };

      const handleItemSkip = (frame) => {
        const slot = flatSlotIds[frame.index];
        if (!slot) return;
        setCards((prev) => prev.filter((c) => c.id !== slot.id));
      };

      const images_base64 = cardsToProcess.map(c => c.base64);
      const resp = await api.analyzeItemImage(
        { images_base64, language: requestLang },
        {
          onDetect: handleDetect,
          onItem: handleItem,
          onItemSkip: handleItemSkip,
        }
      );
      clearInterval(tick);

      const finalCount = resp?.count || (resp?.items || []).length;
      if (finalCount === 0) {
        setCards((prev) =>
          prev.map((c) =>
            cardsToProcess.some(cp => cp.id === c.id)
              ? {
                  ...c,
                  status: 'error',
                  progress: 0,
                  error: t('addItem.analyzeFailed'),
                }
              : c
          )
        );
        toast.error(t('addItem.analyzeFailed'));
        return;
      }

      toast.success(t('addItem.detected', { count: finalCount }));
    } catch (err) {
      clearInterval(tick);
      const msg = err?.response?.data?.detail || err?.message || t('addItem.analyzeFailed');

      const erroredIds = new Set();
      cardsToProcess.forEach(origCard => {
         const children = perCardIds[origCard.id] || [];
         if (children.length > 0) {
             children.forEach(cid => erroredIds.add(cid));
         } else {
             erroredIds.add(origCard.id);
         }
      });

      setCards((prev) =>
        prev.map((c) =>
          erroredIds.has(c.id)
            ? { ...c, status: 'error', progress: 0, error: msg }
            : c
        )
      );
      toast.error(msg);
    } finally {
      cardsToProcess.forEach(origCard => {
         analyzeInFlight.current.delete(origCard.id);
         workStore.completeAnalyze(origCard.id);
      });
    }
  };

  const analyzeCard = (card) => analyzeCards([card]);
"""

content = content.replace("  const analyzeCard = async (card) => {", analyze_cards_code + "\n  const _analyzeCard = async (card) => {")

# 4. Remove `handleBatchBackground` loop (it's huge, but let's just make it do nothing or remove the UI state).
# The UI code renders `bgBatch` instead of `cards` when bgBatch is not null. Since we removed calls to it, `bgBatch` will stay null.
# So we don't strictly need to delete the `handleBatchBackground` code right now, just skipping its invocation is enough!

open(target_path, 'w', encoding='utf-8').write(content)
print("Done")
