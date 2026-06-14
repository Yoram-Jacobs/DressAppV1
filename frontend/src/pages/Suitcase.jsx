import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useClosetStore } from '@/lib/useClosetStore';
import { bestImageUrl } from '@/lib/itemImage';
import { toast } from 'sonner';

export default function Suitcase() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const closet = useClosetStore();

  // Active view: 'gathering' | 'reviewing' | 'active'
  const [viewState, setViewState] = useState('gathering');
  const [activeSuitcase, setActiveSuitcase] = useState(null);
  
  // Gathering form state
  const [destinations, setDestinations] = useState('');
  const [purpose, setPurpose] = useState('pleasure');
  const [preferredStyle, setPreferredStyle] = useState('casual');
  const [departureTime, setDepartureTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [notes, setNotes] = useState('');

  // Chat window state
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am your Suitcase Assistant. Where are we traveling, and what is the plan? You can use the inputs above or simply chat with me.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Reviewing/Packing generation state
  const [packingLoading, setPackingLoading] = useState(false);
  const [packingData, setPackingData] = useState(null); // generated review data
  const [disapproveGuidance, setDisapproveGuidance] = useState('');
  const [showDisapproveModal, setShowDisapproveModal] = useState(false);
  const [refining, setRefining] = useState(false);

  // Active suitcase additions/purchases
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Top');
  const [newItemColor, setNewItemColor] = useState('');
  const [newItemBrand, setNewItemBrand] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [newItemSize, setNewItemSize] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Location simulator
  const [simLocation, setSimLocation] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);

  // Archives
  const [archives, setArchives] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState(null);

  // Load active suitcase
  useEffect(() => {
    fetchActiveSuitcase();
    fetchArchives();
  }, []);

  const fetchActiveSuitcase = async () => {
    try {
      const res = await api.getSuitcaseActive();
      if (res.active) {
        setActiveSuitcase(res.suitcase);
        setViewState('active');
        // Pre-fill form if needed
        setDestinations(res.suitcase.destinations);
        setPurpose(res.suitcase.purpose);
        setPreferredStyle(res.suitcase.preferred_style);
        setDepartureTime(res.suitcase.departure_time);
        setReturnTime(res.suitcase.return_time);
        setNotes(res.suitcase.notes || '');
      } else {
        setViewState('gathering');
      }
    } catch (e) {
      console.error('Failed to load active suitcase', e);
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
      if (res.destinations) setDestinations(res.destinations);
      if (res.purpose) setPurpose(res.purpose);
      if (res.preferred_style) setPreferredStyle(res.preferred_style);
      if (res.departure_time) setDepartureTime(res.departure_time);
      if (res.return_time) setReturnTime(res.return_time);
      if (res.notes) setNotes(res.notes);

      setMessages(prev => [...prev, { role: 'assistant', text: res.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I had trouble parsing that. Please try typing again!' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Generate packing list
  const handlePack = async () => {
    if (!destinations || !departureTime || !returnTime) {
      toast.error(t('suitcase.fillRequired', { defaultValue: 'Please fill in Destinations, Departure, and Return dates.' }));
      return;
    }

    setPackingLoading(true);
    try {
      const res = await api.packSuitcase({
        destinations,
        purpose,
        preferred_style: preferredStyle,
        departure_time: departureTime,
        return_time: returnTime,
        notes
      });
      setPackingData(res);
      setViewState('reviewing');
    } catch (e) {
      toast.error('Stylist packing generator failed. Check your API configuration.');
    } finally {
      setPackingLoading(false);
    }
  };

  // Approve packing checklist
  const handleApprove = async () => {
    if (!packingData) return;
    try {
      const res = await api.approveSuitcase({
        destinations,
        purpose,
        preferred_style: preferredStyle,
        departure_time: departureTime,
        return_time: returnTime,
        notes,
        outfits: packingData.outfits,
        packing_list: packingData.packing_list,
        missing_notes: packingData.danger_zones_info || packingData.cultural_guidelines
      });

      if (res.status === 'success') {
        toast.success(t('suitcase.approved', { defaultValue: 'Suitcase approved and packed!' }));
        setActiveSuitcase(res.suitcase);
        setViewState('active');
        fetchArchives();
        closet.incrementalSync(); // sync changes in main closet
      }
    } catch (e) {
      toast.error('Approve failed');
    }
  };

  // Refine / Disapprove packing checklist
  const handleRefine = async () => {
    if (!disapproveGuidance.trim()) return;
    setRefining(true);
    try {
      // Re-run packing logic with additional user feedback
      const res = await api.packSuitcase({
        destinations,
        purpose,
        preferred_style: preferredStyle,
        departure_time: departureTime,
        return_time: returnTime,
        notes: `${notes || ''}\nFeedback modification: ${disapproveGuidance}`
      });
      setPackingData(res);
      setShowDisapproveModal(false);
      setDisapproveGuidance('');
      toast.success(t('suitcase.refined', { defaultValue: 'Packing list refined with your updates!' }));
    } catch (e) {
      toast.error('Refinement failed.');
    } finally {
      setRefining(false);
    }
  };

  // Edit / delete item from reviewed checklist
  const handleDeleteReviewedItem = (id) => {
    if (!packingData) return;
    const filteredList = packingData.packing_list.filter(item => item.id !== id);
    setPackingData({
      ...packingData,
      packing_list: filteredList
    });
  };

  // Toggle item packed status in active suitcase
  const handleTogglePackItem = async (itemId, currentChecked) => {
    if (!activeSuitcase) return;

    // Optimistically update frontend UI
    const updatedPackingList = activeSuitcase.packing_list.map(p => {
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

  // Add purchased item during travel
  const handleAddTravelPurchase = async () => {
    if (!newItemTitle) return;
    setAddingItem(true);
    try {
      const res = await api.addSuitcaseItem({
        title: newItemTitle,
        category: newItemCategory,
        color: newItemColor || undefined,
        brand: newItemBrand || undefined,
        price_cents: newItemPrice ? newItemPrice * 100 : undefined,
        size: newItemSize || undefined
      });

      if (res.status === 'success') {
        toast.success(t('suitcase.purchaseAdded', { defaultValue: 'Travel purchase saved!' }));
        setShowAddItemDialog(false);
        setNewItemTitle('');
        setNewItemColor('');
        setNewItemBrand('');
        setNewItemPrice(0);
        setNewItemSize('');
        
        // Refresh active suitcase to get updated checklist
        fetchActiveSuitcase();
        closet.incrementalSync();
      }
    } catch (e) {
      toast.error('Add purchase failed.');
    } finally {
      setAddingItem(false);
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
      toast.error('Delete item failed.');
    }
  };

  // Unpack suitcase
  const handleUnpack = async () => {
    try {
      const res = await api.deleteSuitcaseActive();
      if (res.status === 'success') {
        toast.success(t('suitcase.unpackedSuccess', { defaultValue: 'Welcome back! Suitcase contents moved to Closet.' }));
        setActiveSuitcase(null);
        setViewState('gathering');
        closet.incrementalSync();
      }
    } catch (e) {
      toast.error('Unpack failed.');
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
          `Location entered: ${simLocation}. Danger Zone: ${res.analysis.is_danger_zone ? 'YES' : 'NO'}, Holy Place: ${res.analysis.is_holy_place ? 'YES' : 'NO'}`
        );
        setShowSimModal(false);
        setSimLocation('');
      }
    } catch (e) {
      toast.error('Simulation failed.');
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
        return `Departs in ${diff} day${diff === 1 ? '' : 's'}`;
      } else if (now >= dep && now <= ret) {
        const diff = Math.ceil((ret - now) / (1000 * 3600 * 24));
        return `Traveling: ${diff} day${diff === 1 ? '' : 's'} remaining`;
      } else {
        return 'Trip completed. Unpacking ready.';
      }
    } catch (e) {
      return '';
    }
  }, [activeSuitcase]);

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
          {viewState === 'active' && (
            <>
              <Button
                variant="outline"
                className="rounded-xl flex items-center gap-2 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                onClick={() => setShowSimModal(true)}
              >
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>Simulate GPS Location</span>
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl flex items-center gap-2"
                onClick={handleUnpack}
              >
                <RefreshCw className="h-4 w-4" />
                <span>Unpack Suitcase</span>
              </Button>
            </>
          )}
        </div>
      </header>

      <Tabs defaultValue="suitcase" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-xl mb-6 bg-secondary/50 max-w-md">
          <TabsTrigger value="suitcase" className="rounded-lg">{t('suitcase.tabTrip', { defaultValue: 'Active Trip' })}</TabsTrigger>
          <TabsTrigger value="archive" className="rounded-lg">{t('suitcase.tabArchive', { defaultValue: 'Traveling Archive' })}</TabsTrigger>
        </TabsList>

        <TabsContent value="suitcase">
          {/* GATHERING INFORMATION VIEW */}
          {viewState === 'gathering' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form inputs */}
              <div className="lg:col-span-7 space-y-6">
                <Card className="rounded-2xl border border-border shadow-editorial bg-card overflow-hidden">
                  <CardHeader className="bg-muted/30">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Compass className="h-5 w-5 text-primary" />
                      Plan a New Trip
                    </CardTitle>
                    <CardDescription>Enter details to curate your custom travel outfit checklist.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Destinations *</label>
                        <Input
                          placeholder="e.g. Rome, Vatican City, Tehran"
                          value={destinations}
                          onChange={(e) => setDestinations(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Purpose *</label>
                        <select
                          className="w-full flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={purpose}
                          onChange={(e) => setPurpose(e.target.value)}
                        >
                          <option value="business">Business trip</option>
                          <option value="pleasure">Hotel vacation / Pleasure</option>
                          <option value="safari">Safari trip</option>
                          <option value="camping">Outdoor camping</option>
                          <option value="tracking">Tracking / Outdoors</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Departure Time *</label>
                        <Input
                          type="datetime-local"
                          value={departureTime}
                          onChange={(e) => setDepartureTime(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Return Time *</label>
                        <Input
                          type="datetime-local"
                          value={returnTime}
                          onChange={(e) => setReturnTime(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Preferred Style</label>
                        <Input
                          placeholder="e.g. casual modesty, smart-casual, chic"
                          value={preferredStyle}
                          onChange={(e) => setPreferredStyle(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Trip Notes & Activity Guidelines</label>
                      <Textarea
                        placeholder="e.g. attending gala on day 2, beach activities, mosque visit planned"
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
                      Generative packing model curating wardrobe...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 text-yellow-300" />
                      Pack Suitcase
                    </>
                  )}
                </Button>
              </div>

              {/* Chat modal interface */}
              <div className="lg:col-span-5">
                <Card className="rounded-2xl border border-border shadow-editorial bg-card flex flex-col h-[480px]">
                  <CardHeader className="bg-muted/30 pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
                      Suitcase Assistant Chat
                    </CardTitle>
                    <CardDescription>Tell me updates about your trip and I'll adjust the fields.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, index) => (
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
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-tl-none p-3 text-sm flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--accent))]" />
                          Parsing travel requirements...
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-muted/20 flex gap-2">
                    <Input
                      placeholder="e.g. Change dates to June 20-25"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="rounded-xl flex-1 focus-visible:ring-1"
                      disabled={chatLoading}
                    />
                    <Button type="submit" size="icon" className="rounded-xl" disabled={chatLoading}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </Card>
              </div>
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
                      Modesty & Safety Constraints Detected
                    </h3>
                    <p className="text-sm text-red-800 dark:text-red-400 leading-relaxed font-medium">
                      {packingData.danger_zones_info || packingData.cultural_guidelines}
                    </p>
                  </div>
                </div>
              )}

              {/* Outfit Canvas display */}
              <div>
                <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-[hsl(var(--accent))]" />
                  Proposed Daily Outfits
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {packingData.outfits.map((outfit, idx) => (
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
                      <CardContent className="pt-4 flex-1 space-y-4">
                        <div className="space-y-2">
                          {outfit.items.map((item, itemIdx) => {
                            const closetMatch = closet.items.find(i => i.id === item.closet_item_id);
                            return (
                              <div key={itemIdx} className="flex items-center justify-between p-2 rounded-xl bg-secondary/30 border border-border/50">
                                <div className="flex items-center gap-3">
                                  {closetMatch?.original_image_url ? (
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
                                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{item.role}</p>
                                    <p className="text-sm font-medium">{item.description}</p>
                                  </div>
                                </div>
                                <Badge
                                  className={
                                    item.status === 'closet'
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  }
                                >
                                  {item.status}
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
              </div>

              {/* Shopping suggestions & Packing checklist */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Packing Checklist */}
                <div className="lg:col-span-7 space-y-4">
                  <h2 className="text-xl font-display font-semibold flex items-center justify-between">
                    <span>Packing List Checklist</span>
                    <Badge variant="outline" className="text-xs">{packingData.packing_list.length} Items</Badge>
                  </h2>
                  <Card className="rounded-2xl border border-border shadow-sm">
                    <CardContent className="p-4 divide-y divide-border">
                      {packingData.packing_list.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-[10px] uppercase">{item.category}</Badge>
                            <div>
                              <p className="text-sm font-medium">{item.title}</p>
                              {item.recommendation_source && (
                                <p className="text-xs text-amber-600 font-medium">Recomended: {item.recommendation_source}</p>
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
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Local Stores & Missing Items */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Shopping Advisor */}
                  {packingData.local_fashion_stores && packingData.local_fashion_stores.length > 0 && (
                    <Card className="rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm overflow-hidden">
                      <CardHeader className="bg-amber-100/30">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Store className="h-4 w-4 text-amber-600" />
                          Local Shopping Advisor (Top 3)
                        </CardTitle>
                        <CardDescription>Missing items? Buy them locally in the destination area.</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-3">
                        {packingData.local_fashion_stores.slice(0, 3).map((store, idx) => (
                          <div key={idx} className="p-3 bg-card border border-border rounded-xl space-y-1">
                            <h4 className="text-sm font-semibold text-primary">{store.name}</h4>
                            <p className="text-xs text-muted-foreground">{store.address_or_area}</p>
                            <p className="text-xs italic text-amber-700 mt-1">{store.why}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Missing items overview */}
                  {packingData.missing_items && packingData.missing_items.length > 0 && (
                    <Card className="rounded-2xl border border-border shadow-sm">
                      <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-red-500" />
                          Gaps: Missing Clothing Items
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-3">
                        {packingData.missing_items.map((m, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-2 rounded-xl bg-red-50/20 border border-red-100">
                            <Badge variant="destructive" className="uppercase text-[9px] mt-0.5">{m.role}</Badge>
                            <div>
                              <p className="text-sm font-medium text-red-900 dark:text-red-300">{m.description}</p>
                              <p className="text-xs text-muted-foreground">{m.reason_needed}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 pt-4 border-t border-border">
                <Button
                  onClick={handleApprove}
                  className="flex-1 py-6 rounded-2xl bg-emerald-600 text-white font-semibold text-base shadow hover:bg-emerald-700 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="h-5 w-5" />
                  Approve and Save Packing List
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDisapproveModal(true)}
                  className="flex-1 py-6 rounded-2xl border-red-300 text-red-600 font-semibold text-base hover:bg-red-50 dark:hover:bg-red-950/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <X className="h-5 w-5" />
                  Disapprove / Refine List
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Destinations</p>
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Status</p>
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Style & Purpose</p>
                      <p className="text-base font-semibold capitalize">{activeSuitcase.purpose} · {activeSuitcase.preferred_style}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Danger alert if any */}
              {activeSuitcase.missing_notes && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-950/50 bg-amber-50/55 dark:bg-amber-950/10 p-4 flex gap-3 items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-300 text-sm">Travel Modesty / Safety Advisor Notes</h4>
                    <p className="text-xs text-amber-800 dark:text-amber-400 font-medium leading-relaxed">{activeSuitcase.missing_notes}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Outfits canvas */}
                <div className="lg:col-span-7 space-y-6">
                  <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[hsl(var(--accent))]" />
                    My Travel Outfits
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeSuitcase.outfits.map((outfit, idx) => (
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
                        <CardContent className="pt-3 space-y-2 flex-1">
                          {outfit.items.map((item, itemIdx) => {
                            const matchItem = closet.items.find(i => i.id === item.closet_item_id);
                            return (
                              <div key={itemIdx} className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary/20 border border-border/40">
                                {matchItem?.original_image_url ? (
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
                                  <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider leading-none">{item.role}</p>
                                  <p className="text-xs font-medium truncate">{item.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Packing Checklist */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                      <Luggage className="h-5 w-5 text-[hsl(var(--accent))]" />
                      Suitcase Packing Checklist
                    </h2>
                    <Button
                      size="sm"
                      onClick={() => setShowAddItemDialog(true)}
                      className="rounded-xl flex items-center gap-1 bg-[hsl(var(--accent))] text-white"
                    >
                      <Plus className="h-3 w-3" />
                      Add Purchase
                    </Button>
                  </div>

                  <Card className="rounded-2xl border border-border shadow-sm overflow-hidden">
                    <CardContent className="p-4 divide-y divide-border space-y-3 pt-4">
                      {activeSuitcase.packing_list.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-2 pt-2">
                          <div className="flex items-center gap-3">
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
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${item.checked ? 'line-through text-muted-foreground' : ''}`}>{item.title}</p>
                              {item.recommendation_source && (
                                <p className="text-[10px] text-amber-600 font-medium">Recomended: {item.recommendation_source}</p>
                              )}
                            </div>
                          </div>
                          {item.checked ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-md">Packed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground rounded-md">In Closet</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteActiveItem(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg h-8 w-8"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="archive" className="space-y-6">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            Trip Packing Archives
          </h2>

          {archiveLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
            </div>
          ) : archives.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No archived travel packing lists found. Start a trip to archive it!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {archives.map((arch, idx) => (
                <Card
                  key={idx}
                  onClick={() => setSelectedArchive(arch)}
                  className="rounded-2xl border border-border bg-card shadow-sm hover:scale-[1.01] hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
                >
                  <CardHeader className="bg-muted/10 pb-3 border-b border-border">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[hsl(var(--accent))]" />
                      {arch.destination}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {arch.departure_time.split('T')[0]} to {arch.return_time.split('T')[0]}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <p className="text-xs text-muted-foreground font-medium capitalize">
                      Purpose: {arch.purpose} · Style: {arch.preferred_style}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 truncate">
                      {arch.notes || 'No notes.'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* DISAPPROVE / REFINE DIALOG */}
      <Dialog open={showDisapproveModal} onOpenChange={setShowDisapproveModal}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Refine Packing Plan</DialogTitle>
            <DialogDescription>
              Explain what you would like to change (e.g. "it is colder than expected, replace short sleeves with long sleeves").
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Type your guidance here..."
              value={disapproveGuidance}
              onChange={(e) => setDisapproveGuidance(e.target.value)}
              className="rounded-xl min-h-[100px]"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowDisapproveModal(false)}>Cancel</Button>
            <Button
              onClick={handleRefine}
              disabled={refining}
              className="bg-[hsl(var(--accent))] text-white rounded-xl"
            >
              {refining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Refining...
                </>
              ) : (
                'Submit Guidance'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD ITEM DIALOG (TRAVEL PURCHASES) */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Travel Purchase</DialogTitle>
            <DialogDescription>Add fashion details bought while traveling directly to your suitcase.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Title *</label>
              <Input
                placeholder="e.g. Leather Jacket, Cotton Tee"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Category *</label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="outerwear">Outerwear</option>
                  <option value="shoes">Shoes</option>
                  <option value="accessory">Accessory</option>
                  <option value="dress">Dress</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Size</label>
                <Input
                  placeholder="e.g. M, 38, L"
                  value={newItemSize}
                  onChange={(e) => setNewItemSize(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Color</label>
                <Input
                  placeholder="e.g. Black, Navy"
                  value={newItemColor}
                  onChange={(e) => setNewItemColor(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Brand</label>
                <Input
                  placeholder="e.g. Zara, Nike"
                  value={newItemBrand}
                  onChange={(e) => setNewItemBrand(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Price (USD)</label>
              <Input
                type="number"
                placeholder="0"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(Number(e.target.value))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowAddItemDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAddTravelPurchase}
              disabled={addingItem}
              className="bg-[hsl(var(--accent))] text-white rounded-xl"
            >
              {addingItem ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                'Save to Suitcase'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GPS SIMULATOR DIALOG */}
      <Dialog open={showSimModal} onOpenChange={setShowSimModal}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Simulate entering danger zone or holy place</DialogTitle>
            <DialogDescription>
              Simulate your GPS coordinates entering a specific location to test instant safety push alerts (e.g. "Islamic Republic of Iran" or "Vatican City").
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="e.g. Islamic Republic of Iran, St. Peter's Basilica"
              value={simLocation}
              onChange={(e) => setSimLocation(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowSimModal(false)}>Cancel</Button>
            <Button
              onClick={handleSimulateLocation}
              disabled={simulating}
              className="bg-[hsl(var(--accent))] text-white rounded-xl"
            >
              {simulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Simulating...
                </>
              ) : (
                'Simulate Location Entry'
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
              <DialogTitle>Archive details: {selectedArchive.destination}</DialogTitle>
              <DialogDescription>
                Trip dates: {selectedArchive.departure_time.split('T')[0]} to {selectedArchive.return_time.split('T')[0]}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-1">Trip Details</h4>
                <p className="text-sm">Purpose: <span className="font-semibold capitalize">{selectedArchive.purpose}</span> · Preferred Style: <span className="font-semibold capitalize">{selectedArchive.preferred_style}</span></p>
                {selectedArchive.notes && <p className="text-xs text-muted-foreground mt-1 italic">Notes: {selectedArchive.notes}</p>}
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Saved Outfits</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedArchive.outfits.map((outfit, idx) => (
                    <div key={idx} className="p-3 bg-secondary/35 rounded-xl border border-border space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="font-semibold">{outfit.date}</span>
                        <span>{outfit.time_to_wear}</span>
                      </div>
                      <h5 className="text-sm font-semibold">{outfit.outfit_name}</h5>
                      <ul className="text-xs space-y-0.5 text-muted-foreground mt-1.5 list-disc list-inside">
                        {outfit.items.map((it, itIdx) => (
                          <li key={itIdx}>{it.role}: {it.description}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Archived Packing Checklist</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedArchive.packing_list.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs p-1.5 bg-card border border-border rounded-lg">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">{it.title}</span>
                      <Badge variant="outline" className="text-[8px] uppercase ms-auto shrink-0">{it.category}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedArchive(null)} className="rounded-xl">Close</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
