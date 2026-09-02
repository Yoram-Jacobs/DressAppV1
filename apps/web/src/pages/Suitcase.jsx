import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Luggage, MapPin, Calendar, Compass, ShoppingBag,
  Store, HelpCircle, Send, Check, Trash2, ArrowLeft, RefreshCw,
  Archive, Bell, ShieldAlert, Sparkles, Wand2, X, Plus, AlertTriangle,
  Loader2, CheckSquare, Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useClosetStore } from '@/lib/useClosetStore';
import { useSuitcaseStore } from '@/lib/useSuitcaseStore';
import { bestImageUrl } from '@/lib/itemImage';
import { toast } from 'sonner';
import { labelForCategory, labelForRole } from '@/lib/taxonomy';
import { useAuth } from '@/lib/auth';
import { useModalBack } from '@/lib/useModalBack';
import AvatarViewer from '@/components/AvatarViewer';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { SuitcaseErrorBoundary } from '@/components/SuitcaseErrorBoundary';

// Helper to find a closet item matching an outfit item (by ID or fallback title match)
function findClosetMatch(item, closetItems) {
  if (!item) return null;
  
  if (closetItems && closetItems.length > 0) {
    // 1. Try matching by ID first
    if (item.closet_item_id) {
      const match = closetItems.find(i => i.id === item.closet_item_id);
      if (match) return match;
    }
    if (item.id) {
      const match = closetItems.find(i => i.id === item.id);
      if (match) return match;
    }
    
    // 2. Fallback: Try matching by description/title
    const desc = ((item.description || item.title || "")).toLowerCase().trim();
    if (desc) {
      const match = closetItems.find(i => {
        const title = (i.title || "").toLowerCase().trim();
        const name = (i.name || "").toLowerCase().trim();
        return (title && (desc.includes(title) || title.includes(desc))) || 
               (name && (desc.includes(name) || name.includes(desc)));
      });
      if (match) return match;
    }
  }
  
  // 3. Fallback: If the item itself carries image properties, return it as the match
  if (item.thumbnail_data_url || item.reconstructed_image_url || item.clean_image_url || item.segmented_image_url || item.original_image_url) {
    return item;
  }
  
  return null;
}

const CATEGORY_ORDER = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'other'];

function getGroupedCategory(category) {
  if (!category) return 'other';
  const cat = category.toLowerCase().trim();
  if (cat.includes('top')) return 'top';
  if (cat.includes('bottom')) return 'bottom';
  if (cat.includes('dress') || cat.includes('full body')) return 'dress';
  if (cat.includes('outerwear')) return 'outerwear';
  if (cat.includes('shoe') || cat.includes('footwear')) return 'shoes';
  if (cat.includes('access')) return 'accessory';
  return 'other';
}

// Outfit Canvas try-on Try-on Canvas builder
function OutfitCanvas({ outfit, className = "", onClick, t, excludeRoles = [] }) {
  const closet = useClosetStore({ prewarm: true });
  const { user } = useAuth();

  const outfitItemsMap = useMemo(() => {
    if (!outfit || !Array.isArray(outfit.items)) return {};
    const res = {};
    outfit.items.filter(Boolean).forEach(item => {
      if (item.role && !excludeRoles.includes(item.role)) {
        const match = findClosetMatch(item, closet.items);
        if (match) {
          res[item.role] = match;
        }
      }
    });
    return res;
  }, [outfit, closet.items, excludeRoles]);

  const hasImages = useMemo(() => {
    return Object.values(outfitItemsMap).some(item => bestImageUrl(item));
  }, [outfitItemsMap]);

  if (!hasImages) {
    return (
      <div 
        className={`relative aspect-[4/5] bg-muted/45 flex flex-col items-center justify-center border-b border-border text-muted-foreground ${className}`}
        onClick={onClick}
      >
        <ShoppingBag className="h-8 w-8 mb-2 opacity-40" />
        <span className="text-xs">{t('suitcase.noImages', { defaultValue: 'No images available' })}</span>
      </div>
    );
  }

  const handleClick = (e) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div 
      className={`relative aspect-[4/5] w-full bg-muted/20 border-b border-border overflow-hidden cursor-pointer hover:opacity-95 transition-opacity ${className}`}
      onClick={handleClick}
    >
      <div className="absolute inset-0 pointer-events-none z-10">
        <AvatarViewer 
          shapeParams={user?.avatar_shape_params || {}} 
          sex={user?.sex || 'female'} 
          outfitItems={outfitItemsMap} 
        />
      </div>
      <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-center justify-center opacity-0 hover:opacity-100 z-20">
        <div className="bg-white/95 text-xs text-foreground font-semibold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 pointer-events-auto">
          <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
          {t('suitcase.viewFullScreen', { defaultValue: 'View Try-On' })}
        </div>
      </div>
    </div>
  );
}

function Suitcase() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const closet = useClosetStore({ prewarm: true });

  const suitcaseStoreState = useSuitcaseStore({ prewarm: true });
  const {
    viewState,
    activeSuitcase,
    packingData,
    messages,
    archives,
    loading: storeLoading,
    archiveLoading,
    updateViewState: setViewState,
    updateActiveSuitcase: setActiveSuitcase,
    updatePackingData: setPackingData,
    updateMessages: setMessages,
    updateArchives: setArchives,
    setArchiveLoading,
    prewarm
  } = suitcaseStoreState;

  // Full screen view state
  const [fullscreenOutfit, setFullscreenOutfit] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(!suitcaseStoreState.lastFullSync);
  const isInitialLoad = useRef(true);
  const ignoreAutoSaveRef = useRef(false);
  const chatInputRef = useRef(null);
  
  // Archive selection state
  const [activeTab, setActiveTab] = useState('suitcase');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedArchives, setSelectedArchives] = useState([]);

  const handleDeleteArchives = async () => {
    if (selectedArchives.length === 0) return;
    try {
      setArchiveLoading(true);
      await api.deleteSuitcaseArchives(selectedArchives);
      const res = await api.getSuitcaseArchive();
      setArchives(res || []);
      setSelectedArchives([]);
      setIsSelectionMode(false);
      toast.success(t('suitcase.archivesDeleted', { defaultValue: 'Archives deleted successfully.' }));
    } catch (e) {
      toast.error(t('suitcase.archiveDeleteError', { defaultValue: 'Failed to delete archives.' }));
    } finally {
      setArchiveLoading(false);
    }
  };

  // Gathering form state
  const [destinations, setDestinations] = useState('');
  const [purpose, setPurpose] = useState('pleasure');
  const [preferredStyle, setPreferredStyle] = useState('casual');
  const [departureTime, setDepartureTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [notes, setNotes] = useState('');

  // Pre-fill form from activeSuitcase once loaded
  useEffect(() => {
    if (activeSuitcase) {
      setDestinations(activeSuitcase.destinations || '');
      setPurpose(activeSuitcase.purpose || 'pleasure');
      setPreferredStyle(activeSuitcase.preferred_style || 'casual');
      setDepartureTime(activeSuitcase.departure_time || '');
      setReturnTime(activeSuitcase.return_time || '');
      setNotes(activeSuitcase.notes || '');
    }
  }, [activeSuitcase]);

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Reviewing/Packing generation state
  const [packingLoading, setPackingLoading] = useState(false);
  const [refining, setRefining] = useState(false);

  // Closet item selectors for adding/replacing garments
  const [closetDialogOpen, setClosetDialogOpen] = useState(false);
  const [dialogFilterCategory, setDialogFilterCategory] = useState(null);
  const [deletedCategories, setDeletedCategories] = useState(new Set());

  const alreadyPackedIds = useMemo(() => {
    const list = viewState === 'active' ? activeSuitcase?.packing_list : packingData?.packing_list;
    if (!Array.isArray(list)) return new Set();
    return new Set(list.filter(Boolean).map(item => item.id));
  }, [viewState, activeSuitcase?.packing_list, packingData?.packing_list]);

  // Location simulator
  const [simLocation, setSimLocation] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);

  // Archives
  const [selectedArchive, setSelectedArchive] = useState(null);

  useModalBack(!!fullscreenOutfit, () => setFullscreenOutfit(null));
  useModalBack(showSimModal, () => setShowSimModal(false));
  useModalBack(!!selectedArchive, () => setSelectedArchive(null));
  useModalBack(closetDialogOpen, () => setClosetDialogOpen(false));

  const groupedReviewingList = useMemo(() => {
    if (!packingData || !Array.isArray(packingData.packing_list)) return {};
    const groups = {};
    packingData.packing_list.filter(Boolean).forEach(item => {
      if (item.category) {
        const cat = getGroupedCategory(item.category);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      }
    });
    return groups;
  }, [packingData]);

  const groupedActiveList = useMemo(() => {
    if (!activeSuitcase || !Array.isArray(activeSuitcase.packing_list)) return {};
    const groups = {};
    activeSuitcase.packing_list.filter(Boolean).forEach(item => {
      if (item.category) {
        const cat = getGroupedCategory(item.category);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      }
    });
    return groups;
  }, [activeSuitcase]);

  // Load active suitcase
  useEffect(() => {
    fetchActiveSuitcase();
    fetchArchives();
  }, []);

  const fetchActiveSuitcase = async () => {
    try {
      await prewarm({ force: true });
    } catch (e) {
      console.error('Failed to load active suitcase', e);
    } finally {
      setLoadingInitial(false);
    }
  };

  const fetchArchives = async () => {
    setArchiveLoading(true);
    try {
      const res = await api.getSuitcaseArchive();
      setArchives(res || []);
    } catch (e) {
      console.error('Failed to load archive', e);
    } finally {
      setArchiveLoading(false);
    }
  };

  // Debounced auto-save planning state handler
  const saveStateRef = useRef({
    viewState,
    destinations,
    purpose,
    preferredStyle,
    departureTime,
    returnTime,
    notes,
    messages,
    packingData,
    activeSuitcase
  });

  useEffect(() => {
    saveStateRef.current = {
      viewState,
      destinations,
      purpose,
      preferredStyle,
      departureTime,
      returnTime,
      notes,
      messages,
      packingData,
      activeSuitcase
    };
  }, [
    viewState, destinations, purpose, preferredStyle, 
    departureTime, returnTime, notes, messages, packingData, activeSuitcase
  ]);

  const autoSavePlanningState = async () => {
    if (ignoreAutoSaveRef.current) return;
    const state = saveStateRef.current;
    if (state.viewState === 'active') return;
    if (!state.destinations.trim() && !state.departureTime && !state.returnTime) return;

    const formattedDeparture = state.departureTime ? (state.departureTime.includes('T') ? state.departureTime : `${state.departureTime}T00:00:00`) : '';
    const formattedReturn = state.returnTime ? (state.returnTime.includes('T') ? state.returnTime : `${state.returnTime}T23:59:59`) : '';

    try {
      const res = await api.saveSuitcaseActive({
        id: state.activeSuitcase?.id || null,
        destinations: state.destinations,
        purpose: state.purpose,
        preferred_style: state.preferredStyle,
        departure_time: formattedDeparture,
        return_time: formattedReturn,
        notes: state.notes,
        status: state.viewState,
        messages: state.messages,
        packing_list: state.viewState === 'reviewing' ? (state.packingData?.packing_list || []) : [],
        outfits: state.viewState === 'reviewing' ? (state.packingData?.outfits || []) : [],
        missing_notes: state.viewState === 'reviewing' ? (state.packingData?.danger_zones_info || state.packingData?.cultural_guidelines || '') : '',
        local_fashion_stores: state.viewState === 'reviewing' ? (state.packingData?.local_fashion_stores || []) : []
      });
      if (res && res.status === 'success' && res.suitcase) {
        if (!state.activeSuitcase || !state.activeSuitcase.id) {
          setActiveSuitcase(res.suitcase);
        }
      }
    } catch (e) {
      console.error('Planning state auto-save failed', e);
    }
  };

  // Debounced effect trigger
  useEffect(() => {
    if (loadingInitial) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    const timer = setTimeout(() => {
      autoSavePlanningState();
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    viewState, destinations, purpose, preferredStyle, 
    departureTime, returnTime, notes, messages, packingData, loadingInitial
  ]);

  // Page hide / unmount / visibilitychange auto-save
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        autoSavePlanningState();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', autoSavePlanningState);
    
    return () => {
      autoSavePlanningState(); // save on unmount
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', autoSavePlanningState);
    };
  }, []);

  // Submit chat message to assistant
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.suitcaseChat({
        destinations,
        purpose,
        preferred_style: preferredStyle,
        departure_time: departureTime,
        return_time: returnTime,
        notes,
        message: userMsg
      });

      // Update fields if returned
      let updatedDest = destinations;
      let updatedPurpose = purpose;
      let updatedPref = preferredStyle;
      let updatedDep = departureTime;
      let updatedRet = returnTime;
      let updatedNotes = notes;

      if (res.destinations) { setDestinations(res.destinations); updatedDest = res.destinations; }
      if (res.purpose) { setPurpose(res.purpose); updatedPurpose = res.purpose; }
      if (res.preferred_style) { setPreferredStyle(res.preferred_style); updatedPref = res.preferred_style; }
      if (res.departure_time) { setDepartureTime(res.departure_time); updatedDep = res.departure_time; }
      if (res.return_time) { setReturnTime(res.return_time); updatedRet = res.return_time; }
      if (res.notes) { setNotes(res.notes); updatedNotes = res.notes; }

      setMessages(prev => [...prev, { role: 'assistant', text: res.reply }]);

      if (res.should_regenerate) {
        const overrides = {
          destinations: updatedDest,
          purpose: updatedPurpose,
          preferred_style: updatedPref,
          departure_time: updatedDep,
          return_time: updatedRet,
          notes: updatedNotes
        };

        if (viewState === 'gathering') {
          await handlePack(overrides);
        } else if (viewState === 'reviewing') {
          await handleRefine(userMsg, overrides);
        } else if (viewState === 'active') {
          // Regenerate the active suitcase
          setChatLoading(true);
          try {
            const formattedDeparture = overrides.departure_time ? (overrides.departure_time.includes('T') ? overrides.departure_time : `${overrides.departure_time}T00:00:00`) : '';
            const formattedReturn = overrides.return_time ? (overrides.return_time.includes('T') ? overrides.return_time : `${overrides.return_time}T23:59:59`) : '';
            
            const packed = await api.packSuitcase({
              destinations: overrides.destinations,
              purpose: overrides.purpose,
              preferred_style: overrides.preferred_style,
              departure_time: formattedDeparture,
              return_time: formattedReturn,
              notes: `${overrides.notes || ''}\nFeedback modification: ${userMsg}`,
              current_outfits: activeSuitcase?.outfits || [],
              current_packing_list: activeSuitcase?.packing_list || []
            });

            const saveRes = await api.approveSuitcase({
              destinations: overrides.destinations,
              purpose: overrides.purpose,
              preferred_style: overrides.preferred_style,
              departure_time: formattedDeparture,
              return_time: formattedReturn,
              notes: overrides.notes,
              outfits: packed.outfits || [],
              packing_list: packed.packing_list || [],
              missing_notes: packed.danger_zones_info || packed.cultural_guidelines || '',
              local_fashion_stores: packed.local_fashion_stores || [],
              missing_items: packed.missing_items || []
            });

            if (saveRes.status === 'success') {
              saveStateRef.current.viewState = 'active';
              saveStateRef.current.activeSuitcase = saveRes.suitcase;
              setActiveSuitcase(saveRes.suitcase);
              setPackingData(packed);
              toast.success(t('suitcase.activeRefined', { defaultValue: 'Suitcase outfits & packing list updated!' }));
            }
          } catch (err) {
            toast.error(t('suitcase.activeRefineError', { defaultValue: 'Failed to update outfits.' }));
          } finally {
            setChatLoading(false);
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: t('suitcase.chatError', { defaultValue: 'Sorry, I had trouble parsing that. Please try typing again!' }) }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Generate packing list
  const handlePack = async (overrides = {}) => {
    const dest = overrides.destinations !== undefined ? overrides.destinations : destinations;
    const purp = overrides.purpose !== undefined ? overrides.purpose : purpose;
    const pref = overrides.preferred_style !== undefined ? overrides.preferred_style : preferredStyle;
    const dep = overrides.departure_time !== undefined ? overrides.departure_time : departureTime;
    const ret = overrides.return_time !== undefined ? overrides.return_time : returnTime;
    const n = overrides.notes !== undefined ? overrides.notes : notes;

    if (!dest || !dest.trim()) {
      toast.error(t('suitcase.fillDestination', { defaultValue: 'Please fill in Destinations.' }));
      return;
    }
    if (!dep && !ret) {
      toast.error(t('suitcase.fillDates', { defaultValue: 'Please select both Departure and Return dates.' }));
      return;
    }
    if (!dep) {
      toast.error(t('suitcase.fillDeparture', { defaultValue: 'Please select a Departure date.' }));
      return;
    }
    if (!ret) {
      toast.error(t('suitcase.fillReturn', { defaultValue: 'Please select a Return date.' }));
      return;
    }

    const formattedDeparture = dep ? (dep.includes('T') ? dep : `${dep}T00:00:00`) : '';
    const formattedReturn = ret ? (ret.includes('T') ? ret : `${ret}T23:59:59`) : '';

    setPackingLoading(true);
    try {
      const res = await api.packSuitcase({
        destinations: dest,
        purpose: purp,
        preferred_style: pref,
        departure_time: formattedDeparture,
        return_time: formattedReturn,
        notes: n
      });
      setPackingData(res);
      setViewState('reviewing');
    } catch (e) {
      toast.error(t('suitcase.packError', { defaultValue: 'Stylist packing generator failed. Check your API configuration.' }));
    } finally {
      setPackingLoading(false);
    }
  };

  // Approve packing checklist
  const handleApprove = async () => {
    const isEditingActive = viewState === 'active';
    const currentOutfits = isEditingActive ? activeSuitcase?.outfits : packingData?.outfits;
    const currentPackingList = isEditingActive ? activeSuitcase?.packing_list : packingData?.packing_list;
    const currentMissingNotes = isEditingActive ? activeSuitcase?.missing_notes : (packingData?.danger_zones_info || packingData?.cultural_guidelines);
    const currentLocalStores = isEditingActive ? activeSuitcase?.local_fashion_stores : packingData?.local_fashion_stores;
    const currentMissingItems = isEditingActive ? activeSuitcase?.missing_items : packingData?.missing_items;

    if (!isEditingActive && !packingData) return;
    if (isEditingActive && !activeSuitcase) return;

    const formattedDeparture = departureTime ? (departureTime.includes('T') ? departureTime : `${departureTime}T00:00:00`) : '';
    const formattedReturn = returnTime ? (returnTime.includes('T') ? returnTime : `${returnTime}T23:59:59`) : '';
    
    ignoreAutoSaveRef.current = true;
    try {
      const res = await api.approveSuitcase({
        destinations,
        purpose,
        preferred_style: preferredStyle,
        departure_time: formattedDeparture,
        return_time: formattedReturn,
        notes,
        outfits: currentOutfits || [],
        packing_list: currentPackingList || [],
        missing_notes: currentMissingNotes || '',
        local_fashion_stores: currentLocalStores || [],
        missing_items: currentMissingItems || []
      });

      if (res.status === 'success') {
        toast.success(t('suitcase.approved', { defaultValue: 'Suitcase approved and packed!' }));
        
        // Update the ref synchronously to prevent any concurrent/cleanup autosave from overwriting the active suitcase
        saveStateRef.current.viewState = 'active';
        saveStateRef.current.activeSuitcase = res.suitcase;
        
        setActiveSuitcase(res.suitcase);
        setViewState('active');
        fetchArchives();
        closet.incrementalSync(); // sync changes in main closet
      }
    } catch (e) {
      ignoreAutoSaveRef.current = false;
      toast.error(t('suitcase.approveError', { defaultValue: 'Approve failed' }));
    }
  };

  // Refine packing checklist
  const handleRefine = async (feedbackOverride = null, overrides = {}) => {
    const guidance = typeof feedbackOverride === 'string' ? feedbackOverride : '';
    if (!guidance || !guidance.trim()) return;

    const dest = overrides.destinations !== undefined ? overrides.destinations : destinations;
    const purp = overrides.purpose !== undefined ? overrides.purpose : purpose;
    const pref = overrides.preferred_style !== undefined ? overrides.preferred_style : preferredStyle;
    const dep = overrides.departure_time !== undefined ? overrides.departure_time : departureTime;
    const ret = overrides.return_time !== undefined ? overrides.return_time : returnTime;
    const n = overrides.notes !== undefined ? overrides.notes : notes;

    setRefining(true);
    const formattedDeparture = dep ? (dep.includes('T') ? dep : `${dep}T00:00:00`) : '';
    const formattedReturn = ret ? (ret.includes('T') ? ret : `${ret}T23:59:59`) : '';
    const newNotes = `${n || ''}\nFeedback modification: ${guidance}`;
    try {
      // Re-run packing logic with additional user feedback
      const res = await api.packSuitcase({
        destinations: dest,
        purpose: purp,
        preferred_style: pref,
        departure_time: formattedDeparture,
        return_time: formattedReturn,
        notes: newNotes,
        current_outfits: packingData?.outfits || [],
        current_packing_list: packingData?.packing_list || []
      });
      setNotes(newNotes);
      setPackingData(res);
      setViewState('reviewing');
      toast.success(t('suitcase.refined', { defaultValue: 'Packing list refined with your updates!' }));
    } catch (e) {
      toast.error(t('suitcase.refineError', { defaultValue: 'Refinement failed.' }));
    } finally {
      setRefining(false);
    }
  };

  const handleRefineClick = () => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: t('suitcase.askRefineGuidance', { defaultValue: 'What would you like to refine in your packing list?' })
    }]);
    setTimeout(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focus();
      }
    }, 100);
  };

  // Edit / delete item from reviewed checklist
  const handleDeleteReviewedItem = (id) => {
    if (!packingData || !Array.isArray(packingData.packing_list)) return;
    const itemToDelete = packingData.packing_list.find(item => item.id === id);
    if (itemToDelete) {
      const catGroup = getGroupedCategory(itemToDelete.category);
      setDeletedCategories(prev => {
        const next = new Set(prev);
        next.add(catGroup);
        return next;
      });
    }
    const filteredList = packingData.packing_list.filter(Boolean).filter(item => item.id !== id);
    setPackingData({
      ...packingData,
      packing_list: filteredList
    });
  };

  const handleAddFromCloset = (item) => {
    const isEditingActive = viewState === 'active';
    if (isEditingActive) {
      handleAddClosetItemToActiveSuitcase(item);
      return;
    }

    if (!packingData || !Array.isArray(packingData.packing_list)) return;
    if (packingData.packing_list.some(p => p.id === item.id)) return;

    const newChecklistItem = {
      id: item.id,
      title: item.title || item.name || 'Closet item',
      category: item.category,
      checked: false,
      is_missing: false,
      recommendation_source: null,
      recommendation_url: null,
      thumbnail_data_url: item.thumbnail_data_url || null,
      reconstructed_image_url: item.reconstructed_image_url || null,
      clean_image_url: item.clean_image_url || null,
      segmented_image_url: item.segmented_image_url || null,
      original_image_url: item.original_image_url || null
    };

    setPackingData({
      ...packingData,
      packing_list: [...packingData.packing_list, newChecklistItem]
    });

    setClosetDialogOpen(false);
    toast.success(t('suitcase.itemAddedFromCloset', { defaultValue: 'Item added from Closet!' }));
  };

  const handleAddClosetItemToActiveSuitcase = async (item) => {
    if (!activeSuitcase) return;
    if ((activeSuitcase.packing_list || []).some(p => p.id === item.id)) return;
    
    const newChecklistItem = {
      id: item.id,
      title: item.title || item.name || 'Closet item',
      category: item.category,
      checked: true, // immediately packed
      is_missing: false,
      recommendation_source: null,
      recommendation_url: null,
      thumbnail_data_url: item.thumbnail_data_url || null,
      reconstructed_image_url: item.reconstructed_image_url || null,
      clean_image_url: item.clean_image_url || null,
      segmented_image_url: item.segmented_image_url || null,
      original_image_url: item.original_image_url || null
    };

    const updatedPackingList = [...(activeSuitcase.packing_list || []), newChecklistItem];
    setActiveSuitcase({ ...activeSuitcase, packing_list: updatedPackingList });

    // Sync in closetStore instantly
    const cItem = closet.items.find(it => it.id === item.id);
    if (cItem) closet.upsert({ ...cItem, in_suitcase: true });

    try {
      await api.updateSuitcaseItemPackStatus({
        packed_ids: [item.id],
        unpacked_ids: []
      });
      toast.success(t('suitcase.itemAddedFromCloset', { defaultValue: 'Item added from Closet!' }));
    } catch (e) {
      console.error('Failed to sync added closet item to active suitcase', e);
    }
    setClosetDialogOpen(false);
  };

  // Toggle item packed status in active suitcase
  const handleTogglePackItem = async (itemId, currentChecked) => {
    if (!activeSuitcase || !Array.isArray(activeSuitcase.packing_list)) return;

    // Optimistically update frontend UI
    const updatedPackingList = activeSuitcase.packing_list.filter(Boolean).map(p => {
      if (p.id === itemId) return { ...p, checked: !currentChecked };
      return p;
    });
    setActiveSuitcase({ ...activeSuitcase, packing_list: updatedPackingList });

    // Sync in closetStore instantly
    if (!currentChecked) {
      // Checked = moved to suitcase, so hide from closet
      const cItem = closet.items.find(it => it.id === itemId);
      if (cItem) closet.upsert({ ...cItem, in_suitcase: true });
    } else {
      // Unchecked = moved back to closet
      const cItem = closet.items.find(it => it.id === itemId);
      if (cItem) closet.upsert({ ...cItem, in_suitcase: false });
    }

    try {
      await api.updateSuitcaseItemPackStatus({
        packed_ids: !currentChecked ? [itemId] : [],
        unpacked_ids: currentChecked ? [itemId] : []
      });
    } catch (e) {
      console.error('Pack status sync failed', e);
    }
  };

  // Delete item from active suitcase
  const handleDeleteActiveItem = async (itemId) => {
    try {
      await api.deleteSuitcaseItem(itemId);
      toast.success(t('suitcase.itemDeleted', { defaultValue: 'Item removed from suitcase.' }));
      fetchActiveSuitcase();
      closet.incrementalSync();
    } catch (e) {
      toast.error(t('suitcase.deleteItemError', { defaultValue: 'Delete item failed.' }));
    }
  };

  // Unpack suitcase
  const handleUnpack = async () => {
    try {
      const res = await api.deleteSuitcaseActive({ is_unpack: viewState === 'active' });
      if (res.status === 'success') {
        toast.success(t('suitcase.unpackedSuccess', { defaultValue: 'Welcome back! Suitcase contents moved to Closet.' }));
        
        // Synchronously update the ref to allow auto-saving a new planning state
        ignoreAutoSaveRef.current = false;
        saveStateRef.current.viewState = 'gathering';
        saveStateRef.current.activeSuitcase = null;
        
        setActiveSuitcase(null);
        setViewState('gathering');
        
        // Reset inputs
        setDestinations('');
        setPurpose('pleasure');
        setPreferredStyle('casual');
        setDepartureTime('');
        setReturnTime('');
        setNotes('');
        setMessages([
          { role: 'assistant', text: t('suitcase.welcomeChat', { defaultValue: 'Hello! I am your Suitcase Assistant. Where are we traveling, and what is the plan? You can use the inputs above or simply chat with me.' }) }
        ]);
        setPackingData(null);
        
        closet.incrementalSync();
      }
    } catch (e) {
      toast.error(t('suitcase.unpackError', { defaultValue: 'Unpack failed.' }));
    }
  };

  // Simulate location entry
  const handleSimulateLocation = async () => {
    if (!simLocation) return;
    setSimulating(true);
    try {
      const res = await api.enterSuitcaseLocation({ location: simLocation });
      if (res.status === 'success') {
        toast.info(
          t('suitcase.locationEnteredMsg', {
            location: simLocation,
            isDanger: res.analysis.is_danger_zone ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' }),
            isHoly: res.analysis.is_holy_place ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' }),
            defaultValue: 'Location entered: {{location}}. Danger Zone: {{isDanger}}, Holy Place: {{isHoly}}'
          })
        );
        setShowSimModal(false);
        setSimLocation('');
      }
    } catch (e) {
      toast.error(t('suitcase.simulationError', { defaultValue: 'Simulation failed.' }));
    } finally {
      setSimulating(false);
    }
  };

  // Calculate TTL/Countdown
  const countdownText = useMemo(() => {
    if (!activeSuitcase) return '';
    try {
      const dep = new Date(activeSuitcase.departure_time);
      const ret = new Date(activeSuitcase.return_time);
      const now = new Date();

      if (now < dep) {
        const diff = Math.ceil((dep - now) / (1000 * 3600 * 24));
        return t('suitcase.departsIn', { count: diff, defaultValue: 'Departs in {{count}} days' });
      } else if (now >= dep && now <= ret) {
        const diff = Math.ceil((ret - now) / (1000 * 3600 * 24));
        return t('suitcase.travelingDays', { count: diff, defaultValue: 'Traveling: {{count}} days remaining' });
      } else {
        return t('suitcase.tripCompleted', { defaultValue: 'Trip completed. Unpacking ready.' });
      }
    } catch (e) {
      return '';
    }
  }, [activeSuitcase, t]);

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
        <p className="text-sm text-muted-foreground font-medium">
          {t('suitcase.loadingSuitcase', { defaultValue: 'Loading your suitcase...' })}
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto pt-6 pb-20 px-4 md:pt-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-display text-4xl flex items-center gap-3">
            <Luggage className="h-8 w-8 text-[hsl(var(--accent))]" />
            {t('suitcase.headerTitle', { defaultValue: "DressApp's Suitcase" })}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {t('suitcase.subtitleText', { defaultValue: 'Traveling AI modular planner and safety advisor.' })}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'suitcase' && viewState !== 'gathering' && (
            <Button
              variant="destructive"
              className="rounded-xl flex items-center gap-2"
              onClick={handleUnpack}
            >
              <RefreshCw className="h-4 w-4" />
              <span>{t('suitcase.resetTrip', { defaultValue: 'Reset' })}</span>
            </Button>
          )}
          {activeTab === 'archive' && archives && archives.length > 0 && (
            isSelectionMode ? (
              <>
                <Button
                  variant="ghost"
                  className="rounded-xl flex items-center gap-2"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedArchives([]);
                  }}
                >
                  <X className="h-4 w-4" />
                  <span>{t('common.cancel', { defaultValue: 'Cancel' })}</span>
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl flex items-center gap-2"
                  onClick={handleDeleteArchives}
                  disabled={selectedArchives.length === 0 || archiveLoading}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{t('common.delete', { defaultValue: 'Delete' })} {selectedArchives.length > 0 && `(${selectedArchives.length})`}</span>
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="rounded-xl flex items-center gap-2"
                onClick={() => setIsSelectionMode(true)}
              >
                <CheckSquare className="h-4 w-4" />
                <span>{t('common.select', { defaultValue: 'Select' })}</span>
              </Button>
            )
          )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        if (val !== 'archive') {
          setIsSelectionMode(false);
          setSelectedArchives([]);
        }
      }} className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-xl mb-6 bg-secondary/50 max-w-md">
          <TabsTrigger value="suitcase" className="rounded-lg">{t('suitcase.tabTrip', { defaultValue: 'Active Trip' })}</TabsTrigger>
          <TabsTrigger value="archive" className="rounded-lg">{t('suitcase.tabArchive', { defaultValue: 'Traveling Archive' })}</TabsTrigger>
        </TabsList>

        <TabsContent value="suitcase">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: View State conditionally */}
            <div className="lg:col-span-7 space-y-6">
              {/* GATHERING INFORMATION VIEW */}
              {viewState === 'gathering' && (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  <Card className="rounded-2xl border border-border shadow-editorial bg-card overflow-hidden">
                    <CardHeader className="bg-muted/30">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Compass className="h-5 w-5 text-primary" />
                        {t('suitcase.planNewTrip', { defaultValue: 'Plan a New Trip' })}
                      </CardTitle>
                      <CardDescription>{t('suitcase.planNewTripDesc', { defaultValue: 'Enter details to curate your custom travel outfit checklist.' })}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">{t('suitcase.destinationsLabel', { defaultValue: 'Destinations *' })}</label>
                          <Input
                            placeholder={t('suitcase.destinationsPlaceholder', { defaultValue: 'e.g. Rome, Vatican City, Tehran' })}
                            value={destinations}
                            onChange={(e) => setDestinations(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">{t('suitcase.purposeLabel', { defaultValue: 'Purpose *' })}</label>
                          <select
                            className="w-full flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                          >
                            <option value="business">{t('suitcase.purpose_business', { defaultValue: 'Business trip' })}</option>
                            <option value="pleasure">{t('suitcase.purpose_pleasure', { defaultValue: 'Hotel vacation / Pleasure' })}</option>
                            <option value="safari">{t('suitcase.purpose_safari', { defaultValue: 'Safari trip' })}</option>
                            <option value="camping">{t('suitcase.purpose_camping', { defaultValue: 'Outdoor camping' })}</option>
                            <option value="tracking">{t('suitcase.purpose_tracking', { defaultValue: 'Tracking / Outdoors' })}</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">{t('suitcase.departureTimeLabel', { defaultValue: 'Departure Date *' })}</label>
                          <Input
                            type="date"
                            value={departureTime && typeof departureTime === 'string' ? departureTime.split('T')[0] : ''}
                            onChange={(e) => setDepartureTime(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">{t('suitcase.returnTimeLabel', { defaultValue: 'Return Date *' })}</label>
                          <Input
                            type="date"
                            value={returnTime && typeof returnTime === 'string' ? returnTime.split('T')[0] : ''}
                            onChange={(e) => setReturnTime(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">{t('suitcase.preferredStyleLabel', { defaultValue: 'Preferred Style' })}</label>
                          <Input
                            placeholder={t('suitcase.stylePlaceholder', { defaultValue: 'e.g. casual modesty, smart-casual, chic' })}
                            value={preferredStyle}
                            onChange={(e) => setPreferredStyle(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">{t('suitcase.tripNotesLabel', { defaultValue: 'Trip Notes & Activity Guidelines' })}</label>
                        <Textarea
                          placeholder={t('suitcase.notesPlaceholder', { defaultValue: 'e.g. attending gala on day 2, beach activities, mosque visit planned' })}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="rounded-xl min-h-[80px]"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handlePack}
                    disabled={packingLoading}
                    className="w-full py-6 rounded-2xl text-base font-semibold shadow-md bg-[hsl(var(--accent))] text-white hover:opacity-90 flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
                  >
                    {packingLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {t('suitcase.packButtonLoading', { defaultValue: 'Generative packing model curating wardrobe...' })}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 text-yellow-300" />
                        {t('suitcase.packButton', { defaultValue: 'Pack Suitcase' })}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* PACKING REVIEW AND REFINEMENT VIEW */}
              {viewState === 'reviewing' && packingData && (
                <div className="space-y-8 animate-in fade-in-50 duration-300">
                  {/* Modesty or Danger alerts */}
                  {(packingData.danger_zones_info || packingData.cultural_guidelines) && (
                    <div className="rounded-2xl border border-red-200 dark:border-red-950/50 bg-red-50/55 dark:bg-red-950/10 p-5 flex flex-col md:flex-row gap-4 items-start">
                      <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h3 className="font-semibold text-red-900 dark:text-red-300 text-base">
                          {t('suitcase.alertTitle', { defaultValue: 'Modesty & Safety Constraints Detected' })}
                        </h3>
                        <p className="text-sm text-red-800 dark:text-red-400 leading-relaxed font-medium">
                          {packingData.danger_zones_info || packingData.cultural_guidelines}
                        </p>
                      </div>
                    </div>
                  )}

                  <Accordion type="multiple" className="w-full space-y-4">
                    {/* Proposed Daily Outfits */}
                    <AccordionItem value="outfits" className="border border-border rounded-2xl bg-card shadow-sm px-6 py-2">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-2">
                          <Wand2 className="h-5 w-5 text-[hsl(var(--accent))]" />
                          <span className="text-lg font-display font-semibold text-foreground">
                            {t('suitcase.proposedOutfits', { defaultValue: 'Proposed Daily Outfits' })}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-6 text-foreground">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {(Array.isArray(packingData?.outfits) ? packingData.outfits : []).filter(Boolean).map((outfit, idx) => (
                            <Card key={idx} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
                              <CardHeader className="bg-muted/20 pb-3 border-b border-border">
                                <div className="flex justify-between items-start">
                                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 rounded-lg">{outfit.time_to_wear}</Badge>
                                  <span className="text-xs font-semibold text-muted-foreground">{outfit.date}</span>
                                </div>
                                <CardTitle className="text-base mt-2 font-display">{outfit.outfit_name}</CardTitle>
                                <CardDescription className="text-xs flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  {outfit.location}
                                </CardDescription>
                              </CardHeader>
                              <OutfitCanvas outfit={outfit} onClick={() => setFullscreenOutfit(outfit)} t={t} />
                              <CardContent className="pt-4 flex-1 space-y-4">
                                <div className="space-y-2">
                                  {(Array.isArray(outfit?.items) ? outfit.items : []).filter(Boolean).map((item, itemIdx) => {
                                    const closetMatch = findClosetMatch(item, closet.items);
                                    return (
                                      <div key={itemIdx} className="flex items-center justify-between p-2 rounded-xl bg-secondary/30 border border-border/50">
                                        <div className="flex items-center gap-3">
                                          {bestImageUrl(closetMatch) ? (
                                            <img
                                              src={bestImageUrl(closetMatch)}
                                              alt={closetMatch.title}
                                              className="h-9 w-9 rounded-lg object-cover shrink-0"
                                            />
                                          ) : (
                                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                          )}
                                          <div>
                                            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{labelForRole(item.role, t)}</p>
                                            <p className="text-sm font-medium">{item.description}</p>
                                          </div>
                                        </div>
                                        <Badge
                                          className={
                                            "hidden md:inline-flex " + (item.status === 'closet'
                                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200')
                                          }
                                        >
                                          {item.status === 'closet' ? t('suitcase.inClosetBadge', { defaultValue: 'In Closet' }) : t('suitcase.missingBadge', { defaultValue: 'Missing' })}
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-xs italic text-muted-foreground mt-2 border-t border-border/40 pt-2">{outfit.reasoning}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Packing List Checklist */}
                    <AccordionItem value="checklist" className="border border-border rounded-2xl bg-card shadow-sm px-6 py-2">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center justify-between w-full pe-4">
                          <div className="flex items-center gap-2">
                            <Luggage className="h-5 w-5 text-[hsl(var(--accent))]" />
                            <span className="text-lg font-display font-semibold text-foreground">
                              {t('suitcase.packingListChecklist', { defaultValue: 'Packing List Checklist' })}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-muted/50 border-muted-foreground/30">
                            {t('suitcase.itemsCount', { count: packingData?.packing_list?.length || 0, defaultValue: '{{count}} Items' })}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-6 text-foreground">
                        <Card className="rounded-2xl border border-border shadow-sm">
                          <CardContent className="p-4 space-y-6">
                             {CATEGORY_ORDER.map((catCode) => {
                               const items = groupedReviewingList[catCode];
                               if (!items || items.length === 0) return null;
                               const showSuggestions = deletedCategories.has(catCode);
                               const suggestions = showSuggestions
                                 ? (closet.items || [])
                                     .filter(item => getGroupedCategory(item.category) === catCode && !alreadyPackedIds.has(item.id))
                                     .slice(0, 3)
                                 : [];
                               return (
                                 <div key={catCode} className="space-y-2">
                                   <div className="flex justify-between items-center pb-1 border-b border-border/40 mb-2">
                                     <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                       {labelForCategory(catCode, t)}
                                     </h3>
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => {
                                         setDialogFilterCategory(catCode);
                                         setClosetDialogOpen(true);
                                       }}
                                       className="h-6 px-1.5 text-[10px] text-primary rounded-lg flex items-center gap-1 hover:bg-primary/5 font-semibold"
                                     >
                                       <Plus className="h-3 w-3" />
                                       {t('suitcase.addFromClosetBtn', { defaultValue: 'Add from Closet' })}
                                     </Button>
                                   </div>
                                   <div className="divide-y divide-border/60">
                                     {items.map((item) => {
                                       const closetMatch = findClosetMatch(item, closet.items);
                                       return (
                                         <div key={item.id} className="flex items-center justify-between py-2.5">
                                           <div className="flex items-center gap-3">
                                             {bestImageUrl(closetMatch) ? (
                                               <img
                                                 src={bestImageUrl(closetMatch)}
                                                 alt={closetMatch.title}
                                                 className="h-9 w-9 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                 onClick={() => navigate(`/closet/${closetMatch.id}`)}
                                               />
                                             ) : (
                                               <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                 <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                               </div>
                                             )}
                                             <div className="flex flex-col">
                                               <div className="flex items-center gap-1.5">
                                                 <Badge variant="outline" className="text-[10px] uppercase">{labelForCategory(item.category, t)}</Badge>
                                                 {closetMatch && (
                                                   <Badge className="bg-emerald-100 text-emerald-800 text-[10px] hover:bg-emerald-200">
                                                     {t('suitcase.inClosetBadge', { defaultValue: 'In Closet' })}
                                                   </Badge>
                                                 )}
                                               </div>
                                               <div 
                                                 className={`mt-1 ${closetMatch ? "cursor-pointer hover:underline text-primary" : ""}`}
                                                 onClick={() => closetMatch && navigate(`/closet/${closetMatch.id}`)}
                                               >
                                                 <p className="text-sm font-medium">{item.title}</p>
                                               </div>
                                               {item.recommendation_source && (
                                                 <p className="text-xs text-amber-600 font-medium mt-0.5">
                                                   {t('suitcase.recommendedLabel', { source: item.recommendation_source, defaultValue: 'Recommended: {{source}}' })}
                                                 </p>
                                               )}
                                             </div>
                                           </div>
                                           <Button
                                             variant="ghost"
                                             size="icon"
                                             onClick={() => handleDeleteReviewedItem(item.id)}
                                             className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                                           >
                                             <Trash2 className="h-4 w-4" />
                                           </Button>
                                         </div>
                                       );
                                     })}
                                   </div>
                                   {suggestions.length > 0 && (
                                     <div className="mt-4 p-3 bg-muted/30 border border-dashed border-border rounded-xl">
                                       <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                         <Sparkles className="h-3 w-3 text-[hsl(var(--accent))]" />
                                         {t('suitcase.suggestedReplacements', { defaultValue: 'Suggested replacements from your closet:' })}
                                       </p>
                                       <div className="flex gap-3 overflow-x-auto pb-1">
                                         {suggestions.map(sugItem => (
                                           <div key={sugItem.id} className="flex items-center gap-2 p-2 bg-card border border-border rounded-xl shrink-0 max-w-[200px]">
                                             {bestImageUrl(sugItem) ? (
                                               <img 
                                                 src={bestImageUrl(sugItem)} 
                                                 alt={sugItem.title}
                                                 className="h-8 w-8 rounded-lg object-cover shrink-0"
                                               />
                                             ) : (
                                               <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                 <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                                               </div>
                                             )}
                                             <div className="min-w-0 flex-1">
                                               <p className="text-xs font-medium truncate text-foreground leading-tight">{sugItem.title}</p>
                                             </div>
                                             <Button 
                                               size="icon" 
                                               variant="ghost" 
                                               className="h-7 w-7 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                                               onClick={() => handleAddFromCloset(sugItem)}
                                             >
                                               <Plus className="h-4 w-4" />
                                             </Button>
                                           </div>
                                         ))}
                                       </div>
                                     </div>
                                   )}
                                 </div>
                               );
                             })}
                          </CardContent>
                        </Card>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Local Shopping Advisor */}
                    {Array.isArray(packingData?.local_fashion_stores) && packingData.local_fashion_stores.length > 0 && (
                      <AccordionItem value="advisor" className="border border-amber-200 dark:border-amber-950/50 rounded-2xl bg-amber-50/10 shadow-sm px-6 py-2">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-amber-600" />
                            <span className="text-lg font-display font-semibold text-amber-900 dark:text-amber-300">
                              {t('suitcase.localAdvisorHeader', { defaultValue: 'Local Shopping Advisor (Top 3)' })}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-6 text-foreground">
                          <div className="text-xs text-muted-foreground mb-4 font-medium">
                            {t('suitcase.localAdvisorDesc', { defaultValue: 'Missing items? Buy them locally in the destination area.' })}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(Array.isArray(packingData?.local_fashion_stores) ? packingData.local_fashion_stores : []).slice(0, 3).map((store, idx) => (
                              <a
                                key={idx}
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name + ' ' + store.address_or_area)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4 bg-card border border-border rounded-xl space-y-1 hover:border-amber-400 hover:shadow-md transition-all"
                              >
                                <h4 className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5">
                                  {store.name}
                                  <MapPin className="h-3 w-3 text-amber-600" />
                                </h4>
                                <p className="text-xs text-muted-foreground">{store.address_or_area}</p>
                                <p className="text-xs italic text-amber-700 mt-1">{store.why}</p>
                              </a>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {/* Gaps: Missing Clothing Items */}
                    {Array.isArray(packingData?.missing_items) && packingData.missing_items.length > 0 && (
                      <AccordionItem value="gaps" className="border border-border rounded-2xl bg-card shadow-sm px-6 py-2">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-red-500" />
                            <span className="text-lg font-display font-semibold text-foreground">
                              {t('suitcase.gapsHeader', { defaultValue: 'Gaps: Missing Clothing Items' })}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-6 text-foreground">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(Array.isArray(packingData?.missing_items) ? packingData.missing_items : []).map((m, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-red-50/20 border border-red-100">
                                <Badge variant="destructive" className="uppercase text-[9px] mt-0.5">{labelForRole(m.role, t)}</Badge>
                                <div>
                                  <p className="text-sm font-medium text-red-900 dark:text-red-300">{m.description}</p>
                                  <p className="text-xs text-muted-foreground">{m.reason_needed}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>

                  {/* Action buttons */}
                  <div className="flex gap-4 pt-4 border-t border-border">
                    <Button
                      onClick={handleApprove}
                      className="flex-1 py-6 rounded-2xl bg-emerald-600 text-white font-semibold text-base shadow hover:bg-emerald-700 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="h-5 w-5" />
                      {t('suitcase.approveButton', { defaultValue: 'Approve' })}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRefineClick}
                      className="flex-1 py-6 rounded-2xl border-primary/30 text-primary font-semibold text-base hover:bg-primary/5 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="h-5 w-5 text-primary" />
                      {t('suitcase.refineButton', { defaultValue: 'Refine' })}
                    </Button>
                  </div>
                </div>
              )}

              {/* ACTIVE TRIP WORKSPACE */}
              {viewState === 'active' && activeSuitcase && (
                <div className="space-y-8 animate-in fade-in-50 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="rounded-2xl border border-border shadow-sm bg-card">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-12 w-12 bg-[hsl(var(--accent))]/10 rounded-full flex items-center justify-center shrink-0">
                          <MapPin className="h-6 w-6 text-[hsl(var(--accent))]" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">{t('suitcase.destinationsCard', { defaultValue: 'Destinations' })}</p>
                          <p className="text-base font-semibold truncate max-w-[220px]">{activeSuitcase.destinations}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border border-border shadow-sm bg-card">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-12 w-12 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0">
                          <Calendar className="h-6 w-6 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">{t('suitcase.statusCard', { defaultValue: 'Status' })}</p>
                          <p className="text-base font-semibold">{countdownText}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border border-border shadow-sm bg-card">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-12 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                          <Briefcase className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">{t('suitcase.stylePurposeCard', { defaultValue: 'Style & Purpose' })}</p>
                          <p className="text-base font-semibold capitalize">{t(`suitcase.purpose_${activeSuitcase.purpose}`, { defaultValue: activeSuitcase.purpose })} · {activeSuitcase.preferred_style}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Danger alert if any */}
                  {activeSuitcase.missing_notes && (
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-950/50 bg-amber-50/55 dark:bg-amber-950/10 p-4 flex gap-3 items-start">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <h4 className="font-semibold text-amber-900 dark:text-amber-300 text-sm">{t('suitcase.safetyNotesHeader', { defaultValue: 'Travel Modesty / Safety Advisor Notes' })}</h4>
                        <p className="text-xs text-amber-800 dark:text-amber-400 font-medium leading-relaxed">{activeSuitcase.missing_notes}</p>
                      </div>
                    </div>
                  )}

                  <Accordion type="multiple" className="w-full space-y-4">
                    {/* Proposed Daily Outfits / My Travel Outfits */}
                    <AccordionItem value="outfits" className="border border-border rounded-2xl bg-card shadow-sm px-6 py-2">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-[hsl(var(--accent))]" />
                          <span className="text-lg font-display font-semibold text-foreground">
                            {t('suitcase.myTravelOutfits', { defaultValue: 'My Travel Outfits' })}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-6 text-foreground">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {(Array.isArray(activeSuitcase?.outfits) ? activeSuitcase.outfits : []).filter(Boolean).map((outfit, idx) => (
                            <Card key={idx} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
                              <CardHeader className="bg-muted/10 pb-2 border-b border-border">
                                <div className="flex justify-between items-center">
                                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 rounded-md py-0.5 text-[10px]">{outfit.time_to_wear}</Badge>
                                  <span className="text-[10px] font-semibold text-muted-foreground">{outfit.date}</span>
                                </div>
                                <CardTitle className="text-sm mt-1.5 font-display">{outfit.outfit_name}</CardTitle>
                                <CardDescription className="text-[10px] flex items-center gap-1">
                                  <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                                  {outfit.location}
                                </CardDescription>
                              </CardHeader>
                              <OutfitCanvas outfit={outfit} onClick={() => setFullscreenOutfit(outfit)} t={t} />
                              <CardContent className="pt-3 space-y-2 flex-1">
                                {(Array.isArray(outfit?.items) ? outfit.items : []).filter(Boolean).map((item, itemIdx) => {
                                  const matchItem = findClosetMatch(item, closet.items);
                                  return (
                                    <div key={itemIdx} className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary/20 border border-border/40">
                                      {bestImageUrl(matchItem) ? (
                                        <img
                                          src={bestImageUrl(matchItem)}
                                          alt={matchItem.title}
                                          className="h-7 w-7 rounded-md object-cover shrink-0"
                                        />
                                      ) : (
                                        <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                                          <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider leading-none">{labelForRole(item.role, t)}</p>
                                        <p className="text-xs font-medium truncate">{item.description}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Packing List Checklist */}
                    <AccordionItem value="checklist" className="border border-border rounded-2xl bg-card shadow-sm px-6 py-2">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center justify-between w-full pe-4">
                          <div className="flex items-center gap-2">
                            <Luggage className="h-5 w-5 text-[hsl(var(--accent))]" />
                            <span className="text-lg font-display font-semibold text-foreground">
                              {t('suitcase.packingListChecklist', { defaultValue: 'Packing List Checklist' })}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-muted/50 border-muted-foreground/30">
                            {t('suitcase.itemsCount', { count: activeSuitcase?.packing_list?.length || 0, defaultValue: '{{count}} Items' })}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-6 text-foreground">
                         <div className="flex justify-end mb-4">
                           <Button
                             size="sm"
                             onClick={() => navigate('/closet/add?from=suitcase')}
                             className="rounded-xl flex items-center gap-1 bg-[hsl(var(--accent))] text-white"
                           >
                             <Plus className="h-3 w-3" />
                             {t('suitcase.addPurchase', { defaultValue: 'Add Purchase' })}
                           </Button>
                         </div>
                         <Card className="rounded-2xl border border-border shadow-sm overflow-hidden">
                           <CardContent className="p-4 space-y-6">
                             {CATEGORY_ORDER.map((catCode) => {
                               const items = groupedActiveList[catCode];
                               if (!items || items.length === 0) return null;
                               return (
                                 <div key={catCode} className="space-y-2">
                                   <div className="flex justify-between items-center pb-1 border-b border-border/40 mb-2">
                                     <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                       {labelForCategory(catCode, t)}
                                     </h3>
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => {
                                         setDialogFilterCategory(catCode);
                                         setClosetDialogOpen(true);
                                       }}
                                       className="h-6 px-1.5 text-[10px] text-primary rounded-lg flex items-center gap-1 hover:bg-primary/5 font-semibold"
                                     >
                                       <Plus className="h-3 w-3" />
                                       {t('suitcase.addFromClosetBtn', { defaultValue: 'Add from Closet' })}
                                     </Button>
                                   </div>
                                  <div className="divide-y divide-border/60">
                                    {items.map((item) => {
                                      const closetMatch = findClosetMatch(item, closet.items);
                                      return (
                                        <div key={item.id} className="flex items-center justify-between py-2.5">
                                          <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <button
                                              onClick={() => handleTogglePackItem(item.id, item.checked)}
                                              className="text-[hsl(var(--accent))] focus:outline-none shrink-0"
                                            >
                                              {item.checked ? (
                                                <CheckSquare className="h-5 w-5 fill-[hsl(var(--accent))]/10" />
                                              ) : (
                                                <Square className="h-5 w-5 text-muted-foreground" />
                                              )}
                                            </button>
                                            
                                            {bestImageUrl(closetMatch) ? (
                                              <img
                                                src={bestImageUrl(closetMatch)}
                                                alt={closetMatch.title}
                                                className="h-9 w-9 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => navigate(`/closet/${closetMatch.id}`)}
                                              />
                                            ) : (
                                              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                              </div>
                                            )}
                                            
                                            <div className="min-w-0 flex-1">
                                              <div 
                                                className={`min-w-0 ${closetMatch ? "cursor-pointer hover:underline text-primary" : ""}`}
                                                onClick={() => closetMatch && navigate(`/closet/${closetMatch.id}`)}
                                              >
                                                <p className={`text-sm font-medium truncate ${item.checked ? 'line-through text-muted-foreground' : ''}`}>{item.title}</p>
                                              </div>
                                              {item.recommendation_source && (
                                                <p className="text-[10px] text-amber-600 font-medium truncate">{t('suitcase.recommendedLabel', { source: item.recommendation_source, defaultValue: 'Recommended: {{source}}' })}</p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {item.checked ? (
                                              <Badge className="hidden md:inline-flex bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-md shrink-0">{t('suitcase.packedBadge', { defaultValue: 'Packed' })}</Badge>
                                            ) : (
                                              <Badge variant="outline" className="hidden md:inline-flex text-muted-foreground rounded-md shrink-0">{t('suitcase.inClosetBadge', { defaultValue: 'In Closet' })}</Badge>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleDeleteActiveItem(item.id)}
                                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg h-8 w-8 shrink-0"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Local Shopping Advisor */}
                    {Array.isArray(activeSuitcase?.local_fashion_stores) && activeSuitcase.local_fashion_stores.length > 0 && (
                      <AccordionItem value="advisor" className="border border-amber-200 dark:border-amber-950/50 rounded-2xl bg-amber-50/10 shadow-sm px-6 py-2">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-amber-600" />
                            <span className="text-lg font-display font-semibold text-amber-900 dark:text-amber-300">
                              {t('suitcase.localAdvisorHeader', { defaultValue: 'Local Shopping Advisor (Top 3)' })}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-6 text-foreground">
                          <div className="text-xs text-muted-foreground mb-4 font-medium">
                            {t('suitcase.localAdvisorDesc', { defaultValue: 'Missing items? Buy them locally in the destination area.' })}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(Array.isArray(activeSuitcase?.local_fashion_stores) ? activeSuitcase.local_fashion_stores : []).slice(0, 3).map((store, idx) => (
                              <a
                                key={idx}
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name + ' ' + store.address_or_area)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4 bg-card border border-border rounded-xl space-y-1 hover:border-amber-400 hover:shadow-md transition-all"
                              >
                                <h4 className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5">
                                  {store.name}
                                  <MapPin className="h-3 w-3 text-amber-600" />
                                </h4>
                                <p className="text-xs text-muted-foreground">{store.address_or_area}</p>
                                <p className="text-xs italic text-amber-700 mt-1">{store.why}</p>
                              </a>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {/* Gaps: Missing Clothing Items */}
                    {Array.isArray(activeSuitcase?.missing_items) && activeSuitcase.missing_items.length > 0 && (
                      <AccordionItem value="gaps" className="border border-border rounded-2xl bg-card shadow-sm px-6 py-2">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-red-500" />
                            <span className="text-lg font-display font-semibold text-foreground">
                              {t('suitcase.gapsHeader', { defaultValue: 'Gaps: Missing Clothing Items' })}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-6 text-foreground">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(Array.isArray(activeSuitcase?.missing_items) ? activeSuitcase.missing_items : []).map((m, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-red-50/20 border border-red-100">
                                <Badge variant="destructive" className="uppercase text-[9px] mt-0.5">{labelForRole(m.role, t)}</Badge>
                                <div>
                                  <p className="text-sm font-medium text-red-900 dark:text-red-300">{m.description}</p>
                                  <p className="text-xs text-muted-foreground">{m.reason_needed}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>

                </div>
              )}
            </div>

            {/* Right Column: Chat modal interface */}
            <div className="lg:col-span-5">
              <Card className="rounded-2xl border border-border shadow-editorial bg-card flex flex-col h-[480px]">
                <CardHeader className="bg-muted/30 pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
                    {t('suitcase.chatHeader', { defaultValue: 'Suitcase Assistant Chat' })}
                  </CardTitle>
                  <CardDescription>{t('suitcase.chatDesc', { defaultValue: "Tell me updates about your trip and I'll adjust the fields." })}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {(Array.isArray(messages) ? messages : []).map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[hsl(var(--accent))] text-white rounded-tr-none'
                            : 'bg-secondary text-secondary-foreground rounded-tl-none'
                        }`}
                      >
                        {typeof msg.text === 'string' ? msg.text : (msg.text ? JSON.stringify(msg.text) : '')}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-tl-none p-3 text-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--accent))]" />
                        {t('suitcase.chatLoading', { defaultValue: 'Parsing travel requirements...' })}
                      </div>
                    </div>
                  )}
                </CardContent>
                <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-muted/20 flex gap-2">
                  <Input
                    ref={chatInputRef}
                    placeholder={t('suitcase.chatInputPlaceholder', { defaultValue: 'e.g. Change dates to June 20-25' })}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="rounded-xl flex-1 focus-visible:ring-1"
                    disabled={chatLoading}
                  />
                  <Button type="submit" size="icon" className="rounded-xl" disabled={chatLoading}>
                    <Send className="h-4 w-4 rtl:-scale-x-100" />
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="archive" className="space-y-6">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            {t('suitcase.tripPackingArchives', { defaultValue: 'Trip Packing Archives' })}
          </h2>

          {archiveLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
            </div>
          ) : (!archives || archives.length === 0) ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {t('suitcase.noArchives', { defaultValue: 'No archived travel packing lists found. Start a trip to archive it!' })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(Array.isArray(archives) ? archives : []).map((arch, idx) => {
                const isSelected = selectedArchives.includes(arch.id);
                return (
                  <Card
                    key={idx}
                    onClick={() => {
                      if (isSelectionMode) {
                        setSelectedArchives(prev =>
                          prev.includes(arch.id) ? prev.filter(id => id !== arch.id) : [...prev, arch.id]
                        );
                      } else {
                        setSelectedArchive(arch);
                      }
                    }}
                    className={`relative rounded-2xl border bg-card shadow-sm transition-all cursor-pointer overflow-hidden ${
                      isSelected ? 'border-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]' : 'border-border hover:scale-[1.01] hover:border-primary/30'
                    }`}
                  >
                    {isSelectionMode && (
                      <div className="absolute top-3 end-3 z-10 text-[hsl(var(--accent))]">
                        {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-muted-foreground/50" />}
                      </div>
                    )}
                    <CardHeader className="bg-muted/10 pb-3 border-b border-border">
                      <CardTitle className="text-base font-display flex items-center gap-2 pe-6">
                        <MapPin className="h-4 w-4 text-[hsl(var(--accent))]" />
                        {arch.destination}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t('suitcase.tripDates', {
                          dep: (arch?.departure_time && typeof arch.departure_time === 'string') ? arch.departure_time.split('T')[0] : '',
                          ret: (arch?.return_time && typeof arch.return_time === 'string') ? arch.return_time.split('T')[0] : '',
                          defaultValue: 'Trip dates: {{dep}} to {{ret}}'
                        })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <p className="text-xs text-muted-foreground font-medium capitalize">
                        {t('suitcase.purposeLabel', { defaultValue: 'Purpose' })}: {t(`suitcase.purpose_${arch.purpose}`, { defaultValue: arch.purpose })} · {t('suitcase.preferredStyleLabel', { defaultValue: 'Style' })}: {arch.preferred_style}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {arch.notes || t('suitcase.archiveNoNotes', { defaultValue: 'No notes.' })}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>




      {/* GPS SIMULATOR DIALOG */}
      <Dialog open={showSimModal} onOpenChange={setShowSimModal}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{t('suitcase.gpsSimulatorHeader', { defaultValue: 'Simulate entering danger zone or holy place' })}</DialogTitle>
            <DialogDescription>
              {t('suitcase.gpsSimulatorDesc', { defaultValue: 'Simulate your GPS coordinates entering a specific location to test instant safety push alerts (e.g. "Islamic Republic of Iran" or "Vatican City").' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder={t('suitcase.gpsPlaceholder', { defaultValue: "e.g. Islamic Republic of Iran, St. Peter's Basilica" })}
              value={simLocation}
              onChange={(e) => setSimLocation(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowSimModal(false)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button
              onClick={handleSimulateLocation}
              disabled={simulating}
              className="bg-[hsl(var(--accent))] text-white rounded-xl"
            >
              {simulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin me-1" />
                  {t('suitcase.simulating', { defaultValue: 'Simulating...' })}
                </>
              ) : (
                t('suitcase.simulateLocation', { defaultValue: 'Simulate Location Entry' })
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ARCHIVE DETAIL MODAL */}
      <Dialog open={!!selectedArchive} onOpenChange={(open) => { if (!open) setSelectedArchive(null); }}>
        {selectedArchive && (
          <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('suitcase.archiveDetailsHeader', { destination: selectedArchive.destination, defaultValue: 'Archive details: {{destination}}' })}</DialogTitle>
              <DialogDescription>
                {t('suitcase.tripDates', {
                  dep: (selectedArchive?.departure_time && typeof selectedArchive.departure_time === 'string') ? selectedArchive.departure_time.split('T')[0] : '',
                  ret: (selectedArchive?.return_time && typeof selectedArchive.return_time === 'string') ? selectedArchive.return_time.split('T')[0] : '',
                  defaultValue: 'Trip dates: {{dep}} to {{ret}}'
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-1">{t('suitcase.tripDetailsHeader', { defaultValue: 'Trip Details' })}</h4>
                <p className="text-sm">
                  {t('suitcase.purposeLabel', { defaultValue: 'Purpose' })}: <span className="font-semibold capitalize">{t(`suitcase.purpose_${selectedArchive.purpose}`, { defaultValue: selectedArchive.purpose })}</span> · {t('suitcase.preferredStyleLabel', { defaultValue: 'Preferred Style' })}: <span className="font-semibold capitalize">{selectedArchive.preferred_style}</span>
                </p>
                {selectedArchive.notes && <p className="text-xs text-muted-foreground mt-1 italic">{t('suitcase.archiveNotesLabel', { notes: selectedArchive.notes, defaultValue: 'Notes: {{notes}}' })}</p>}
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">{t('suitcase.savedOutfitsHeader', { defaultValue: 'Saved Outfits' })}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(Array.isArray(selectedArchive?.outfits) ? selectedArchive.outfits : []).filter(Boolean).map((outfit, idx) => (
                    <div key={idx} className="p-3 bg-secondary/35 rounded-xl border border-border space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="font-semibold">{outfit.date}</span>
                        <span>{outfit.time_to_wear}</span>
                      </div>
                      <h5 className="text-sm font-semibold">{outfit.outfit_name}</h5>
                      <ul className="text-xs space-y-0.5 text-muted-foreground mt-1.5 list-disc list-inside">
                        {(Array.isArray(outfit?.items) ? outfit.items : []).filter(Boolean).map((it, itIdx) => (
                          <li key={itIdx}>{labelForRole(it.role, t)}: {it.description}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">{t('suitcase.archivedChecklistHeader', { defaultValue: 'Archived Packing Checklist' })}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Array.isArray(selectedArchive?.packing_list) ? selectedArchive.packing_list : []).map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs p-1.5 bg-card border border-border rounded-lg">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">{it.title}</span>
                      <Badge variant="outline" className="text-[8px] uppercase ms-auto shrink-0">{labelForCategory(it.category, t)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedArchive(null)} className="rounded-xl">{t('common.close', { defaultValue: 'Close' })}</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Full screen outfit view */}
      <Dialog open={!!fullscreenOutfit} onOpenChange={() => setFullscreenOutfit(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 border border-border shadow-lg">
          {fullscreenOutfit && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 rounded-lg mb-1">{fullscreenOutfit.time_to_wear}</Badge>
                    <DialogTitle className="text-2xl font-display font-bold text-foreground mt-1">{fullscreenOutfit.outfit_name}</DialogTitle>
                    <DialogDescription className="text-sm flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {fullscreenOutfit.location} • {fullscreenOutfit.date}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Outfit Canvas(es) */}
                <div className="flex flex-col gap-4">
                  {(() => {
                    const items = Array.isArray(fullscreenOutfit?.items) ? fullscreenOutfit.items : [];
                    
                    const outerwearItem = items.find(i => i?.role === 'outerwear');
                    const hasTopOrDress = items.some(i => i?.role === 'top' || i?.role === 'dress');
                    
                    let hasValidOuterwearImage = false;
                    if (outerwearItem) {
                      const match = findClosetMatch(outerwearItem, closet.items);
                      hasValidOuterwearImage = !!(match && bestImageUrl(match));
                    }

                    if (hasValidOuterwearImage && hasTopOrDress) {
                      return (
                        <>
                          <div className="rounded-2xl border border-border overflow-hidden bg-muted/10 relative flex items-center justify-center shadow-sm w-full">
                            <OutfitCanvas outfit={fullscreenOutfit} excludeRoles={['top', 'dress']} className="border-none hover:opacity-100 cursor-default" t={t} />
                          </div>
                          <div className="rounded-2xl border border-border overflow-hidden bg-muted/10 relative flex items-center justify-center shadow-sm w-full">
                            <OutfitCanvas outfit={fullscreenOutfit} excludeRoles={['outerwear']} className="border-none hover:opacity-100 cursor-default" t={t} />
                          </div>
                        </>
                      );
                    }
                    
                    return (
                      <div className="rounded-2xl border border-border overflow-hidden bg-muted/10 relative flex items-center justify-center shadow-sm w-full">
                        <OutfitCanvas outfit={fullscreenOutfit} className="border-none hover:opacity-100 cursor-default" t={t} />
                      </div>
                    );
                  })()}
                </div>
                
                {/* Item List & Reasoning */}
                <div className="flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-4 flex-1">
                    <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">{t('suitcase.outfitPieces', { defaultValue: 'Outfit Pieces' })}</h4>
                    <div className="space-y-2.5">
                      {(Array.isArray(fullscreenOutfit?.items) ? fullscreenOutfit.items : []).map((item, idx) => {
                        const closetMatch = findClosetMatch(item, closet.items);
                        return (
                          <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/35 border border-border/50">
                            <div className="flex items-center gap-3">
                              {bestImageUrl(closetMatch) ? (
                                <img
                                  src={bestImageUrl(closetMatch)}
                                  alt={closetMatch.title}
                                  className="h-10 w-10 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-85"
                                  onClick={() => {
                                    setFullscreenOutfit(null);
                                    navigate(`/closet/${closetMatch.id}`);
                                  }}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <ShoppingBag className="h-4.5 w-4.5 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">{labelForRole(item.role, t)}</p>
                                <p className="text-sm font-medium">{item.description}</p>
                              </div>
                            </div>
                            <Badge
                              className={
                                "hidden md:inline-flex " + (item.status === 'closet'
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200')
                              }
                            >
                              {item.status === 'closet' ? t('suitcase.inClosetBadge', { defaultValue: 'In Closet' }) : t('suitcase.missingBadge', { defaultValue: 'Missing' })}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {fullscreenOutfit.reasoning && (
                    <div className="border-t border-border pt-3">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">{t('suitcase.stylistNotes', { defaultValue: 'Stylist Notes' })}</h4>
                      <p className="text-xs leading-relaxed text-muted-foreground italic">{fullscreenOutfit.reasoning}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter className="mt-4">
                <Button onClick={() => setFullscreenOutfit(null)} variant="outline" className="rounded-xl">
                  {t('suitcase.close', { defaultValue: 'Close' })}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD FROM CLOSET DIALOG */}
      <AddFromClosetDialog
        open={closetDialogOpen}
        onOpenChange={setClosetDialogOpen}
        initialCategory={dialogFilterCategory}
        onSelect={handleAddFromCloset}
        alreadyPackedIds={alreadyPackedIds}
      />
    </div>
  );
}

function AddFromClosetDialog({ open, onOpenChange, initialCategory, onSelect, alreadyPackedIds }) {
  const { t } = useTranslation();
  const closet = useClosetStore({ prewarm: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'all');

  // Synchronize category selection if initialCategory changes when opening
  useEffect(() => {
    if (open) {
      setSelectedCategory(initialCategory || 'all');
      setSearchQuery('');
    }
  }, [open, initialCategory]);

  const filteredItems = useMemo(() => {
    if (!closet.items) return [];
    return closet.items.filter(item => {
      // 1. Category filter
      if (selectedCategory !== 'all') {
        const itemCat = getGroupedCategory(item.category);
        if (itemCat !== selectedCategory) return false;
      }
      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const title = (item.title || item.name || '').toLowerCase();
        const color = (item.color || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        if (!title.includes(query) && !color.includes(query) && !brand.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [closet.items, selectedCategory, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-xl max-h-[80vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <Luggage className="h-5 w-5 text-primary" />
            {t('suitcase.addFromClosetHeader', { defaultValue: 'Add Garment from Closet' })}
          </DialogTitle>
          <DialogDescription>
            {t('suitcase.addFromClosetDesc', { defaultValue: 'Choose a garment from your closet to pack in your suitcase.' })}
          </DialogDescription>
        </DialogHeader>

        {/* Filters and search bar */}
        <div className="space-y-3 my-2">
          <Input
            placeholder={t('suitcase.searchClosetPlaceholder', { defaultValue: 'Search by title, color, brand...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl focus-visible:ring-1"
          />

          <div className="flex flex-wrap gap-1.5 pb-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className="h-8 rounded-lg text-xs"
            >
              {t('suitcase.allCategories', { defaultValue: 'All' })}
            </Button>
            {CATEGORY_ORDER.filter(cat => cat !== 'other').map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat)}
                className="h-8 rounded-lg text-xs"
              >
                {labelForCategory(cat, t)}
              </Button>
            ))}
          </div>
        </div>

        {/* Closet items grid */}
        <div className="flex-1 overflow-y-auto min-h-[300px] pe-1">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {t('suitcase.noClosetItemsFound', { defaultValue: 'No items match your filters.' })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={`group relative cursor-pointer border border-border bg-card rounded-xl overflow-hidden shadow-sm transition-all ${
                    alreadyPackedIds.has(item.id) ? 'opacity-55 pointer-events-none' : 'hover:border-primary/45'
                  }`}
                >
                  <div className="aspect-square bg-muted/30 relative flex items-center justify-center overflow-hidden">
                    {bestImageUrl(item) ? (
                      <img
                        src={bestImageUrl(item)}
                        alt={item.title}
                        className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-200"
                      />
                    ) : (
                      <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                    )}
                    {alreadyPackedIds.has(item.id) && (
                      <Badge className="absolute top-2 end-2 bg-primary/95 text-white">
                        {t('suitcase.packedBadge', { defaultValue: 'Packed' })}
                      </Badge>
                    )}
                  </div>
                  <div className="p-2 border-t border-border bg-card/60 backdrop-blur-sm">
                    <p className="text-xs font-semibold truncate text-foreground">{item.title || item.name || 'Untitled'}</p>
                    <p className="text-[10px] text-muted-foreground truncate uppercase">{labelForCategory(item.category, t)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {t('common.close', { defaultValue: 'Close' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SuitcaseWithBoundary() {
  return (
    <SuitcaseErrorBoundary>
      <Suitcase />
    </SuitcaseErrorBoundary>
  );
}
