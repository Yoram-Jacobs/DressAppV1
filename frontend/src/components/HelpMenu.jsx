import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, Info, ShieldAlert, Sparkles, User, BarChart4, 
  MapPin, Phone, HelpCircle, AlertTriangle, Layers, Wallet, 
  ShoppingBag, Search, ClipboardList, Camera, Mic, Grid, TrendingUp, UserRound
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HelpMenu() {
  const [activeTab, setActiveTab] = useState('overview');

  const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'prerequisites', label: 'What You Need', icon: ClipboardList },
    { id: 'adding-clothes', label: 'Adding Clothes', icon: Camera },
    { id: 'closet-page', label: 'Your Closet', icon: Grid },
    { id: 'ai-stylist', label: 'AI Fashion Stylist', icon: Mic },
    { id: 'profile-matters', label: 'Profile Options', icon: User },
    { id: 'wardrobe-stats', label: 'Wardrobe Stats', icon: BarChart4 },
    { id: 'dress-up', label: 'Outfit Planner', icon: Layers },
    { id: 'suitcase', label: 'Suitcase Assistant', icon: MapPin },
    { id: 'marketplace', label: 'Swap & Sell Shop', icon: ShoppingBag },
    { id: 'trend-scout', label: 'Trend Scout', icon: TrendingUp },
    { id: 'experts', label: 'Ask a Professional', icon: UserRound },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: HelpCircle },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden text-foreground bg-background rounded-lg">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-secondary/10 flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Table of Contents</span>
          </div>
        </div>
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveTab(sec.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left font-medium",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {sec.label}
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile quick tabs selection dropdown */}
        <div className="md:hidden p-3 border-b border-border bg-secondary/15">
          <select 
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SECTIONS.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.label}
              </option>
            ))}
          </select>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <BookOpen className="h-6 w-6" /> Overview
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Welcome to <strong>DressApp</strong>! This is a cutting-edge app that lets you build your very own digital clothes closet.
                </p>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Imagine taking pictures of all your shirts, pants, skirts, and shoes, and putting them into a magical book. 
                  Once they are inside, a professional and experienced stylist looks at your clothes, checks the weather outside, and helps you pick what to wear for any occasion!
                </p>
                <p className="text-base leading-relaxed text-muted-foreground">
                  You can also dress up your own character (avatar), trade or share clothes with friends, and see how much your closet is worth.
                </p>
              </div>
            )}

            {activeTab === 'prerequisites' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <ClipboardList className="h-6 w-6" /> What You Need
                </h2>
                <p className="text-muted-foreground">To start working with DressApp, you will need:</p>
                <ul className="space-y-3 pl-1">
                  <li className="flex items-start gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">1</span>
                    <span className="text-muted-foreground pt-0.5">A computer, tablet, or phone with a web browser.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">2</span>
                    <span className="text-muted-foreground pt-0.5">A camera on your device to snap photos of your clothes.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">3</span>
                    <span className="text-muted-foreground pt-0.5">A microphone on your device so you can talk to your professional AI Stylist.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground flex-col gap-1">4</span>
                    <span className="text-muted-foreground pt-0.5">
                      A Gemini API Key. Get it for free on <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Google AI Studio</a>.
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {activeTab === 'adding-clothes' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <Camera className="h-6 w-6" /> Adding Clothes to Your Closet
                </h2>
                <p className="text-muted-foreground">Let's put your physical clothes into your digital closet!</p>
                <div className="space-y-3">
                  {[
                    "Open DressApp and click the **Add Item** button.",
                    "Click **Take Photo** to take a picture of your garment, click **Upload Photos** if you already have a picture saved, click **Import URL** to grab a garment from an online shop link, or click **Upload Receipt** to parse a PDF or image receipt from your purchases.",
                    "The app checks if you already added this item before. If you did, a pop-up window will ask if you want to skip it.",
                    "If it's a new item, wait 5 seconds. The app will magically remove the background, crop the clothing item, and extract its attributes.",
                    "Check the results! You can choose the type of clothing (like shirt or pants). If the cutout shape looks wrong, changing the clothing type category will fix it.",
                    "Click the **Save** button. Now the item is saved in your closet grid!"
                  ].map((text, idx) => (
                    <div key={idx} className="flex gap-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <span className="font-bold text-primary text-lg">{idx + 1}</span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        {text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{part}</strong> : part)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'closet-page' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <Grid className="h-6 w-6" /> Your Closet
                </h2>
                <p className="text-muted-foreground">The Closet page lets you view, search, and manage your digitized garments:</p>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">View & Filter</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Browse all your registered shirts, pants, skirts, shoes, and outerwear in a grid. Filter by color, category, season, or material.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Multi-Select & Delete</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Enable select mode to checkmark multiple clothing items and bulk delete them from your wardrobe database in a single action.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Item Grouping (Single vs. Set)</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Combine individual garments into a synchronized Set (like a suit or matching dress sets) to ensure they are suggested together. You can ungroup sets back into single items anytime.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Edit Pane (itemDetails)</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Fine-tune parsed parameters. Manually edit season compatibility, formality tags, primary/secondary colors, fabrics, and custom annotations inside the item's detail editor.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai-stylist' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <Mic className="h-6 w-6" /> Talking to Your professional AI Stylist
                </h2>
                <p className="text-muted-foreground">You have a professional AI stylist who gives you advice on what to wear. You can talk to it just like a friend!</p>
                <div className="space-y-3">
                  {[
                    "Go to the **AI Stylist** screen.",
                    "Tap the **Microphone** button.",
                    "Ask a question out loud, like: \"What matches my blue jeans for a rainy school day?\"",
                    "You will see your words appear on the screen as you talk.",
                    "If the voice typing doesn't work, the app will record your voice and send it to the Stylist.",
                    "The Stylist will read the weather, check what clothes are in your closet, and suggest an outfit.",
                    "The Stylist will speak back to you! Click **Play Reply** to hear the advice again."
                  ].map((text, idx) => (
                    <div key={idx} className="flex gap-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <span className="font-bold text-primary text-lg">{idx + 1}</span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        {text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{part}</strong> : part)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'profile-matters' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <User className="h-6 w-6" /> Managing Your Profile (Why it matters!)
                </h2>
                <p className="text-muted-foreground">Your Profile page has different settings sections. Here is why each section is important:</p>
                
                <div className="space-y-4">
                  {[
                    {
                      title: "1. Photos & Avatar",
                      desc: "This is where you put your profile photo. It lets DressApp draw your character avatar. You will see the outfits on your character avatar."
                    },
                    {
                      title: "2. Style Profile (Your Preferences)",
                      desc: "It tells the Stylist what kind of clothes you like to wear. If you prefer modest clothes, you can toggle that option. The Stylist will only suggest outfits that make you feel comfortable."
                    },
                    {
                      title: "3. Details (Name & Phone)",
                      desc: "This lets DressApp know who you are so it can greet you by name. The app uses your name in greeting alerts and emails. Your phone number is used to send push alerts."
                    },
                    {
                      title: "4. Body & Measurements (Your Sizes)",
                      desc: "It helps DressApp find clothes that fit you when you are looking at online shops. The Shopping assistant reads size tables on websites and tells you which size fits best."
                    },
                    {
                      title: "5. Lifestyle",
                      desc: "It helps the Stylist understand what you do every day (like a student, office worker, lawyer, or party) and customizes trend suggestions that suit you best."
                    },
                    {
                      title: "6. AI Configuration (The Smart Brain)",
                      desc: "it's crucial to have a Gemini (or other model of your choice) API key. Without it, DressApp cannot perform its magic. You have to select a multi-modal AI model."
                    },
                    {
                      title: "7. Scheduler & Push (Morning Alerts)",
                      desc: "It will give you the perfect outfit for the next day based on your calendar, the weather, and your style. The Stylist will rotate your closet for a perfect outfit every day! Saving the frustration of standing in front of the closet and trying to figure out what to wear. It will help you use all of the items in your closet."
                    },
                    {
                      title: "8. Google Calendar",
                      desc: "It matches your outfits to your daily activities, checking if you have soccer practice, a date, or an important meeting."
                    },
                    {
                      title: "9. Location Services (Where You Are)",
                      desc: "It makes sure the Stylist knows the weather where you live, so it won't suggest a thick coat on a hot summer day."
                    },
                    {
                      title: "10. Voice & Language",
                      desc: "It lets you pick how the Stylist speaks to you and changes the language."
                    },
                    {
                      title: "11. Invite Friends",
                      desc: "It lets you share the app with friends. For every friend who signs up using your link, you get +10 extra slots in your closet."
                    }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-secondary/5 space-y-2">
                      <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary shrink-0" />
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                        <strong className="text-primary/90 font-medium">Why it matters:</strong> {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'wardrobe-stats' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <BarChart4 className="h-6 w-6" /> Checking Your Wardrobe Stats
                </h2>
                <p className="text-muted-foreground">See how much your closet is worth and which items are your favorites!</p>
                <ul className="space-y-3 pl-1">
                  <li className="flex items-start gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2"></span>
                    <span className="text-muted-foreground leading-relaxed">
                      <strong>Closet Worth:</strong> How much money all your clothes cost together.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2"></span>
                    <span className="text-muted-foreground leading-relaxed">
                      <strong>Closet Utilization:</strong> The percentage of clothes you have worn at least once.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2"></span>
                    <span className="text-muted-foreground leading-relaxed">
                      <strong>Cost-per-Wear:</strong> How cheap or expensive a garment is based on how many times you wore it.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2"></span>
                    <span className="text-muted-foreground leading-relaxed">
                      <strong>Color Palette Breakdown:</strong> Stats showing your wardrobe's colors, materials, and categories breakdown.
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {activeTab === 'dress-up' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <Layers className="h-6 w-6" /> Outfit Planner
                </h2>
                <p className="text-muted-foreground">The Outfit Planner helps you layer, arrange, and evaluate your styling selections:</p>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Outfit Canvas</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Layer and combine clothes dynamically on your custom character avatar to build your outfit layout.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Dual Canvas (Layering)</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      If you are wearing a jacket or outerwear over a shirt, the interface renders a side-by-side view (one avatar showing the outerwear, one without) so you can review both layers simultaneously.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Interactive Body-Mapping</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Click directly on any clothing item on your avatar's body to open its dedicated details pane.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Grading & Metrics</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Displays progress bars grading how well your outfit matches current weather alerts, formality rules, and color palette guidelines.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'suitcase' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <MapPin className="h-6 w-6" /> Travel Suitcase Assistant
                </h2>
                <p className="text-muted-foreground">Pack your bags for trips without forgetting your favorite things!</p>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Intelligent Curation</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Generates daily outfits and packing lists based on trip setup dates, duration, local weather, and calendar events.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Refinement Chat</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Chat with the AI stylist to tweak the suitcase while preserving the rest of the curated list.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'marketplace' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <ShoppingBag className="h-6 w-6" /> The Swap & Sell Shop (Marketplace)
                </h2>
                <p className="text-muted-foreground">Share, donate, rent, or trade clothes with other users in your area!</p>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Create a Listing</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Open an item's detail page, select **Edit Intent**, and choose For Sale (input price/currency), Rent (input daily rate), Swap (mark open for trade), or Donate (publish free).
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Try-On Sandbox</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Buyers can test-fit your listing against their own clothes on their avatar before deciding to swap or buy.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trend-scout' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <TrendingUp className="h-6 w-6" /> Trend Scout
                </h2>
                <p className="text-muted-foreground">Keep your fashion style ahead of the curve with our daily curated feed:</p>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Daily Fashion Feed</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Receives style suggestions, fashion trends, and articles tailored specifically to match your profile preferences.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Trend Buckets</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Explore four curated categories: **SS26 Runway** (latest high-fashion), **News Flash** (breaking style reports), **Recycling** (sustainable fashion), and **Influencers** (social trendsetters).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'experts' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <UserRound className="h-6 w-6" /> Ask a Professional
                </h2>
                <p className="text-muted-foreground">Connect with real-world fashion experts directly inside DressApp:</p>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Fashion Expert Directory</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Browse a registry of certified professional stylists, fashion advisors, and wardrobe consultants.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Style Speciality Search</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Filter experts by region, country, or specific fashion specialties (e.g. corporate wear, sustainable style, formal event consults).
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-1">
                    <h4 className="font-semibold text-sm">Direct Contacts</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Reach out directly via phone, send direct emails, or visit their professional portfolios and websites.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'troubleshooting' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-b pb-2 text-primary">
                  <AlertTriangle className="h-6 w-6" /> Troubleshooting & Solutions
                </h2>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      Help! My closet is full and I can't add more clothes!
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Why it happens:</strong> Free accounts are limited to 150 items.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Easy fix:</strong>
                      <ol className="list-decimal pl-5 space-y-1 mt-1">
                        <li>Subscribe to the Pro plan, or share your invite link with a friend to get +10 extra spots.</li>
                        <li>Get a free Gemini API key by logging into Google AI Studio with your Google account. Go to the "Get API key" section on the left sidebar, click Create API key, and copy your unique string. No credit card is required for the free tier.</li>
                      </ol>
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                      My camera won't turn on!
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Why it happens:</strong> Your web browser doesn't have permission to use the camera.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Easy fix:</strong> Go to browser settings, allow camera access, and refresh the page.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-secondary/10 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                      The app is running slow when I upload multiple pictures!
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Why it happens:</strong> Processing pictures takes a lot of computer work.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Easy fix:</strong> The app automatically processes them one by one. Just wait a minute!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
