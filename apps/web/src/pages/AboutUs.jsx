import React from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { 
  Sparkles, 
  Layers, 
  Calendar, 
  ShoppingBag, 
  Mail, 
  UserCheck, 
  RefreshCw, 
  Compass, 
  Camera, 
  TrendingUp, 
  Briefcase, 
  Volume2, 
  Sliders, 
  CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default function AboutUs() {
  const { t } = useTranslation();

  const ecosystemFeatures = [
    {
      id: 'eyes',
      icon: Camera,
      title: t('about.feature1_title', { defaultValue: 'Zero-Friction Digitization ("The Eyes")' }),
      desc: t('about.feature1_desc', { defaultValue: 'Snapshot clothes on your bed or rack. Our neural vision engine segments items, creates clean transparent cutouts, and extracts 20+ fine-grained attributes automatically.' }),
      tag: t('about.feature1_tag', { defaultValue: 'Computer Vision' })
    },
    {
      id: 'migration',
      icon: RefreshCw,
      title: t('about.feature2_title', { defaultValue: 'One-Click Wardrobe Migration' }),
      desc: t('about.feature2_desc', { defaultValue: 'Liberate your closet from competitor app silos in 30 seconds. Our screen-harvesting bookmarklet streams your existing wardrobe into DressApp with zero manual re-entry.' }),
      tag: t('about.feature2_tag', { defaultValue: 'Zero Lock-In' })
    },
    {
      id: 'avatar',
      icon: Layers,
      title: t('about.feature3_title', { defaultValue: 'Dynamic Avatar & Virtual Try-On' }),
      desc: t('about.feature3_desc', { defaultValue: 'Preview outfits layered on an adaptive 2D vector mannequin calibrated to your exact physical metrics—or directly on a segmented cutout of your real-body photo.' }),
      tag: t('about.feature3_tag', { defaultValue: 'Anatomical Precision' })
    },
    {
      id: 'stylist',
      icon: Sparkles,
      title: t('about.feature4_title', { defaultValue: 'Context-Aware AI Stylist' }),
      desc: t('about.feature4_desc', { defaultValue: 'Conversational styling via voice or text grounded in your actual physical wardrobe, real-time local weather forecasts, and Google Calendar appointments.' }),
      tag: t('about.feature4_tag', { defaultValue: 'Daily Confidant' })
    },
    {
      id: 'scheduler',
      icon: Calendar,
      title: t('about.feature5_title', { defaultValue: 'Scheduled Outfits & Wardrobe Diary' }),
      desc: t('about.feature5_desc', { defaultValue: 'Plan looks days or weeks in advance. Receive tailored morning push notifications with your scheduled look while rotating unworn items to prevent repeat wear.' }),
      tag: t('about.feature5_tag', { defaultValue: 'Zero Morning Fatigue' })
    },
    {
      id: 'shopping',
      icon: ShoppingBag,
      title: t('about.feature6_title', { defaultValue: 'Smart Shopping Assistant' }),
      desc: t('about.feature6_desc', { defaultValue: 'Desktop extension and mobile bookmarklet that scans product size charts across e-commerce storefronts, delivering instant personalized size confidence before you buy.' }),
      tag: t('about.feature6_tag', { defaultValue: 'Browser Intelligence' })
    },
    {
      id: 'insights',
      icon: TrendingUp,
      title: t('about.feature7_title', { defaultValue: 'Wardrobe Insights & Cost-Per-Wear' }),
      desc: t('about.feature7_desc', { defaultValue: 'Illuminate hidden capital in your closet. Track wear frequency, garment capitalization, and true cost-per-wear to make conscious, sustainable fashion decisions.' }),
      tag: t('about.feature7_tag', { defaultValue: 'Wardrobe Analytics' })
    },
    {
      id: 'suitcase',
      icon: Briefcase,
      title: t('about.feature8_title', { defaultValue: 'Intelligent Suitcase Packing' }),
      desc: t('about.feature8_desc', { defaultValue: 'AI-curated travel capsules mapped to your destination weather and itinerary. Never overpack or forget critical pieces on your trips again.' }),
      tag: t('about.feature8_tag', { defaultValue: 'Travel Companion' })
    },
    {
      id: 'marketplace',
      icon: Compass,
      title: t('about.feature9_title', { defaultValue: 'Circular Marketplace: Swap, Sell, Donate' }),
      desc: t('about.feature9_desc', { defaultValue: 'Extend garment lifespans through community swapping, resale, and donation workflows designed to divert pre-loved textiles from landfills.' }),
      tag: t('about.feature9_tag', { defaultValue: 'Circular Economy' })
    },
    {
      id: 'experts',
      icon: UserCheck,
      title: t('about.feature10_title', { defaultValue: 'Certified Experts Registry' }),
      desc: t('about.feature10_desc', { defaultValue: 'Seamlessly connect with vetted human fashion stylists, bespoke tailors, repair artisans, and custom patternmakers to preserve and elevate your clothes.' }),
      tag: t('about.feature10_tag', { defaultValue: 'Human Craftsmanship' })
    }
  ];

  const values = [
    {
      title: t('about.val1_title', { defaultValue: 'Shop Your Closet First' }),
      desc: t('about.val1_desc', { defaultValue: 'The most sustainable and stylish garment in the world is the one already hanging in your closet. We maximize what you own before suggesting anything new.' })
    },
    {
      title: t('about.val2_title', { defaultValue: 'Zero Lock-In & Open Ecosystem' }),
      desc: t('about.val2_desc', { defaultValue: 'You own your wardrobe data. Liberate your closet from competitor silos in 30 seconds and bring your sizing intelligence across the open web.' })
    },
    {
      title: t('about.val3_title', { defaultValue: 'Editorial Boutique & Quiet Luxury' }),
      desc: t('about.val3_desc', { defaultValue: 'Clean typography, generous whitespace, tactile surfaces, and zero digital clutter. An experience that feels like an art-directed luxury magazine.' })
    },
    {
      title: t('about.val4_title', { defaultValue: 'Sovereign Privacy by Design' }),
      desc: t('about.val4_desc', { defaultValue: 'Your wardrobe is deeply personal. We never sell your photos or styling history to advertisers. Built with private sovereign AI architecture.' })
    },
    {
      title: t('about.val5_title', { defaultValue: 'Circular by Design' }),
      desc: t('about.val5_desc', { defaultValue: 'Fashion should never be disposable. We champion the EU Digital Product Passport (DPP), repairability, mindful reuse, and community garment exchange.' })
    },
    {
      title: t('about.val6_title', { defaultValue: 'Universal Inclusivity' }),
      desc: t('about.val6_desc', { defaultValue: 'True style belongs to everyone. DressApp supports 13 localized languages (including full native RTL for Hebrew and Arabic) and universal body sizing without bias.' })
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent/20">
      <Helmet>
        <title>{t('about.meta_title', { defaultValue: 'About Us — The DressApp Story & Vision' })}</title>
        <meta 
          name="description" 
          content={t('about.meta_desc', { defaultValue: 'The story behind DressApp: how a sound engineer’s New Year’s wardrobe crisis sparked an intelligent, sovereign, and circular fashion operating system.' })} 
        />
      </Helmet>

      {/* Decorative Ambient Hero Wash (<20% viewport, no text directly over gradient) */}
      <div 
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-70"
        style={{
          backgroundImage: 'radial-gradient(900px circle at 20% 10%, rgba(31,111,107,0.14), transparent 55%), radial-gradient(700px circle at 85% 0%, rgba(232,96,60,0.10), transparent 50%)'
        }}
      />

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-20 space-y-20 md:space-y-28">
        
        {/* HERO HEADER */}
        <section data-testid="about-hero-section" className="text-center max-w-3xl mx-auto space-y-6">
          <Badge 
            variant="outline" 
            className="caps-label px-3 py-1 bg-secondary/80 border-border text-foreground font-semibold"
          >
            {t('about.hero_badge', { defaultValue: 'The DressApp Story' })}
          </Badge>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.05]">
            {t('about.hero_title_prefix', { defaultValue: 'Engineering Confidence' })}{' '}
            <span className="text-accent underline decoration-accent/30 underline-offset-8">
              {t('about.hero_title_highlight', { defaultValue: 'From the Inside Out' })}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('about.hero_subtitle', { defaultValue: 'How an arena sound engineer and lighting designer turned a New Year’s wardrobe crisis into an intelligent, circular fashion ecosystem.' })}
          </p>

          {/* Opening Pull-Quote */}
          <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-card border border-border/80 shadow-[var(--shadow-sm)] text-start relative overflow-hidden">
            <div className="absolute top-0 start-0 w-1.5 h-full bg-accent" />
            <p className="font-display italic text-base sm:text-lg text-foreground/90 leading-relaxed">
              &ldquo;{t('about.hero_quote', { defaultValue: 'I can tune an arena sound system by ear and paint an entire stage with light. But on New Year’s Eve 2019, standing in front of my own wardrobe, I was completely lost.' })}&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-foreground block">Yoram Jacobs</span>
                <span className="text-xs text-muted-foreground block">{t('about.founder_title', { defaultValue: 'Founder & Chief Architect, DressApp' })}</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: THE GENESIS & PORTRAIT */}
        <section data-testid="about-genesis-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-start">
            <span className="caps-label text-accent font-semibold block">
              {t('about.genesis_label', { defaultValue: 'December 31, 2019' })}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              {t('about.genesis_title', { defaultValue: 'The Night That Started It All' })}
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <p>
                {t('about.genesis_p1', { defaultValue: 'The world was getting ready to welcome 2020, and Yoram Jacobs was standing paralyzed in front of an open closet. Like millions of people every single morning, he was gripped by that quiet, exasperating dilemma: a wardrobe full of clothes, and absolutely nothing to wear.' })}
              </p>
              <p>
                {t('about.genesis_p2', { defaultValue: 'He pulled out his phone searching for an app that could look at what he already owned, consider the party dress code, and tell him what worked. Nothing existed—only fast-fashion stores trying to sell more throwaway clothes, and runway moodboards of garments he didn\'t own.' })}
              </p>
              <p>
                {t('about.genesis_p3', { defaultValue: 'With time running out, he threw on the safest default he knew: a basic t-shirt, jeans, and sneakers. Walking into the party, the realization was instant. Everyone was dressed with elegance and intention. Yoram felt noticeably out of place, uncomfortable in his own skin.' })}
              </p>
              <p className="font-medium text-foreground">
                {t('about.genesis_p4', { defaultValue: 'For most people, that night would be forgotten as an awkward social memory. For Yoram, it became an obsession.' })}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group max-w-sm w-full">
              <div className="absolute -inset-2 bg-gradient-to-tr from-accent/20 to-persimmon/20 rounded-[calc(var(--radius)+8px)] blur-md opacity-60 group-hover:opacity-100 transition-smooth" />
              <Card className="relative overflow-hidden rounded-[calc(var(--radius)+6px)] border border-border shadow-[var(--shadow-sm)] bg-card">
                <img 
                  src="/assets/about/yoram-portrait.jpg" 
                  alt="Yoram Jacobs — Founder of DressApp" 
                  className="w-full aspect-[3/4] object-cover object-top"
                  loading="lazy"
                />
                <div className="p-4 bg-card/95 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Yoram Jacobs</h4>
                      <p className="text-xs text-muted-foreground">{t('about.portrait_sub', { defaultValue: 'Founder & Chief Architect (Age 59)' })}</p>
                    </div>
                    <Badge variant="secondary" className="caps-label text-[10px] bg-secondary text-foreground">
                      {t('about.founder_badge', { defaultValue: 'Creator' })}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* SECTION 2: THE FOUNDER'S PARADOX & AUDIO CONSOLE */}
        <section data-testid="about-paradox-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center">
            <div className="relative group w-full">
              <Card className="overflow-hidden rounded-[calc(var(--radius)+6px)] border border-border shadow-[var(--shadow-sm)] bg-card">
                <img 
                  src="/assets/about/yoram-sound-console.jpg" 
                  alt="Yoram Jacobs at the sound mixing console" 
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
                <div className="p-4 bg-card/95 border-t border-border flex items-center gap-3">
                  <Volume2 className="h-5 w-5 text-accent shrink-0" />
                  <p className="text-xs text-muted-foreground leading-normal">
                    {t('about.sound_caption', { defaultValue: 'Yoram behind the live faders: decades of engineering acoustics, room frequencies, and stage luminescence.' })}
                  </p>
                </div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-7 order-1 lg:order-2 space-y-6 text-start">
            <span className="caps-label text-accent font-semibold block">
              {t('about.paradox_label', { defaultValue: 'Acoustics, Light & Fabric' })}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              {t('about.paradox_title', { defaultValue: 'The Founder’s Paradox' })}
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <p>
                {t('about.paradox_p1', { defaultValue: 'Yoram is not a fashion house insider. At 59, he brings decades of rigorous technical mastery as an acoustic sound engineer, multimedia specialist, and lighting designer. He spent his career working with invisible physical frequencies—sculpting room reverberation, synchronizing signals, and shaping atmospheres with stage luminescence.' })}
              </p>
              <p>
                {t('about.paradox_p2', { defaultValue: 'Yet when it came to fabrics, garment drape, color pairings, and silhouette matching, he experienced total sartorial friction. That contradiction triggered a foundational realization:' })}
              </p>
              <blockquote className="p-4 rounded-xl bg-secondary/50 border-s-4 border-accent text-foreground font-medium text-sm sm:text-base italic">
                {t('about.paradox_quote', { defaultValue: 'Style is not a secret genetic gift reserved for the elite—it is a harmony problem. Just like frequencies in an acoustic hall, an outfit is an interplay of texture, contrast, geometry, and context. You simply need the right instrument.' })}
              </blockquote>
            </div>
          </div>
        </section>

        {/* SECTION 3: THE SIX-YEAR WAIT & STUDIO CONVERGENCE */}
        <section data-testid="about-wait-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-start">
            <span className="caps-label text-accent font-semibold block">
              {t('about.wait_label', { defaultValue: '2019 to 2026' })}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              {t('about.wait_title', { defaultValue: 'Why 2020 Had to Wait for 2026' })}
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <p>
                {t('about.wait_p1', { defaultValue: 'The vision was crystal clear in early 2020, but the technology was not ready. Early computer vision could not handle folded garments, natural language models were rigid rule-trees, and mobile hardware could not process real-time matting. Yoram refused to build a superficial gimmick.' })}
              </p>
              <p>
                {t('about.wait_p2', { defaultValue: 'For six years, he experimented, tested emerging vision models, and refined the mathematics of wardrobe organization. Finally, in 2026, the breakthrough arrived: ultra-responsive multimodal artificial intelligence, real-time semantic garment segmentation, and sovereign private AI pipelines.' })}
              </p>
              <p>
                {t('about.wait_p3', { defaultValue: 'In April 2026, Yoram sat down at his desk inside the studio and began building. Every line of code—from the neural vision pipelines to the fluid responsive web experience and mobile app—was crafted directly by his own hands as a one-man enterprise.' })}
              </p>
              <div className="pt-2 flex items-center gap-3">
                <Badge className="bg-primary text-primary-foreground font-medium px-3 py-1">
                  {t('about.v1_release', { defaultValue: 'Version 1.0 Launched: September 2026' })}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t('about.solo_note', { defaultValue: '100% Sovereign & Independent' })}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group w-full">
              <Card className="overflow-hidden rounded-[calc(var(--radius)+6px)] border border-border shadow-[var(--shadow-sm)] bg-card">
                <img 
                  src="/assets/about/yoram-studio-code.jpg" 
                  alt="Yoram coding DressApp at the studio console" 
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
                <div className="p-4 bg-card/95 border-t border-border flex items-center gap-3">
                  <Sliders className="h-5 w-5 text-accent shrink-0" />
                  <p className="text-xs text-muted-foreground leading-normal">
                    {t('about.studio_caption', { defaultValue: 'The studio workstation: mixing board behind, code in front. Where acoustic precision converged with modern AI.' })}
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* SECTION 4: THE COMPLETE GARMENT LIFECYCLE ECOSYSTEM (10 PILLARS) */}
        <section data-testid="about-ecosystem-section" className="space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="caps-label text-accent font-semibold block">
              {t('about.ecosystem_label', { defaultValue: 'The Architecture' })}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {t('about.ecosystem_title', { defaultValue: 'A Complete Garment Lifecycle Ecosystem' })}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('about.ecosystem_subtitle', { defaultValue: 'DressApp is not another fast-fashion store. It is an intelligent operating system designed to elevate the clothes you already own.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-start">
            {ecosystemFeatures.map((feat) => {
              const IconComp = feat.icon;
              return (
                <Card 
                  key={feat.id} 
                  data-testid={`feature-card-${feat.id}`}
                  className="p-6 rounded-[calc(var(--radius)+6px)] border border-border bg-card shadow-[var(--shadow-sm)] hover:border-accent/40 transition-smooth flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        <IconComp className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="caps-label text-[10px] bg-secondary text-muted-foreground">
                        {feat.tag}
                      </Badge>
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground tracking-tight">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* SECTION 5: OUR CORE VALUES */}
        <section data-testid="about-values-section" className="space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="caps-label text-accent font-semibold block">
              {t('about.values_label', { defaultValue: 'Our Manifesto' })}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {t('about.values_title', { defaultValue: 'Principles We Live By' })}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('about.values_subtitle', { defaultValue: 'Every feature and line of code is held accountable to six core human and environmental commitments.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-start">
            {values.map((val, idx) => (
              <Card 
                key={idx}
                className="p-6 rounded-[calc(var(--radius)+6px)] border border-border bg-card shadow-[var(--shadow-sm)] space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                  <h4 className="font-display text-base font-bold text-foreground">
                    {val.title}
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed ps-7">
                  {val.desc}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* SECTION 6: A PERSONAL NOTE FROM YORAM */}
        <section data-testid="about-letter-section" className="max-w-3xl mx-auto">
          <Card className="p-8 sm:p-12 rounded-[calc(var(--radius)+8px)] border border-border shadow-[var(--shadow-sm)] bg-card text-start space-y-6 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-accent via-primary to-persimmon" />
            <span className="caps-label text-accent font-semibold block">
              {t('about.letter_label', { defaultValue: 'From Yoram\'s Desk' })}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              {t('about.letter_title', { defaultValue: 'A Personal Note to You' })}
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-foreground/90 leading-relaxed italic font-display">
              <p>
                &ldquo;{t('about.letter_p1', { defaultValue: 'To anyone who has ever stood in front of their closet feeling inadequate, stressed, or unsure:' })}&rdquo;
              </p>
              <p>
                &ldquo;{t('about.letter_p2', { defaultValue: 'I built DressApp for you, because I was you. For years, I believed having great personal style was a genetic lottery I simply didn\'t win. I was wrong. Style isn\'t about chasing frantic trends or buying an endless stream of cheap clothes—it\'s about knowing what you have, understanding how it harmonizes with who you are, and walking out the door every morning feeling calm, composed, and undeniably confident.' })}&rdquo;
              </p>
              <p>
                &ldquo;{t('about.letter_p3', { defaultValue: 'DressApp is my life\'s technical and creative synthesis: merging the rigor of acoustic and lighting design with the quiet genius of modern AI. I hope it brings ease and delight to your mornings, just as it has to mine.' })}&rdquo;
              </p>
            </div>
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div>
                <span className="font-display font-bold text-base text-foreground block">Yoram Jacobs</span>
                <span className="text-xs text-muted-foreground block">{t('about.letter_sign_role', { defaultValue: 'Founder & Chief Architect, DressApp' })}</span>
              </div>
              <Badge variant="outline" className="caps-label text-[10px] bg-secondary text-foreground">
                {t('about.verified_founder', { defaultValue: 'Verified Founder' })}
              </Badge>
            </div>
          </Card>
        </section>

        {/* SECTION 7: COMPANY FACTS & OUTREACH */}
        <section data-testid="about-facts-section" className="p-8 sm:p-10 rounded-2xl bg-secondary/40 border border-border text-start space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="caps-label text-accent font-semibold block">
                {t('about.facts_label', { defaultValue: 'Company & Operations' })}
              </span>
              <h3 className="font-display text-2xl font-bold text-foreground">
                {t('about.facts_title', { defaultValue: 'Direct Founder Channel' })}
              </h3>
              <p className="text-sm text-muted-foreground max-w-lg">
                {t('about.facts_subtitle', { defaultValue: 'DressApp is a sovereign, one-man enterprise headquartered in the global cloud. Have a technical question, press inquiry, or feedback?' })}
              </p>
            </div>

            <Button 
              asChild 
              data-testid="contact-founder-btn"
              className="rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 shadow-[var(--shadow-sm)] hover:bg-primary/92 hover:-translate-y-[1px] active:scale-[0.98] transition-smooth self-start md:self-auto"
            >
              <a href="mailto:dev@dressapp.co" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>dev@dressapp.co</span>
              </a>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-border/80 text-xs sm:text-sm">
            <div>
              <span className="text-muted-foreground block">{t('about.fact1_label', { defaultValue: 'Origin' })}</span>
              <span className="font-semibold text-foreground mt-1 block">December 2019</span>
            </div>
            <div>
              <span className="text-muted-foreground block">{t('about.fact2_label', { defaultValue: 'Inception' })}</span>
              <span className="font-semibold text-foreground mt-1 block">April 2026</span>
            </div>
            <div>
              <span className="text-muted-foreground block">{t('about.fact3_label', { defaultValue: 'Version 1.0' })}</span>
              <span className="font-semibold text-foreground mt-1 block">September 2026</span>
            </div>
            <div>
              <span className="text-muted-foreground block">{t('about.fact4_label', { defaultValue: 'Ecosystem' })}</span>
              <span className="font-semibold text-foreground mt-1 block">Web • Mobile • Extension</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
