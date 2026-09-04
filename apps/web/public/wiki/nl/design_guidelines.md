{
  "merk": {
    "name": "DressApp",
    "design_personality": [
      "redactioneel boetiekmagazine",
      "rust-luxe minimaal",
      "camera-eerste hulpprogramma verborgen achter poetsmiddel",
      "duurzaamheid vooruit (signalen uitwisselen/doneren)",
      "AI-stylist voelt als een mode-editor, geen chatbot"
    ],
    "north_star": "Laat elk scherm aanvoelen als een samengestelde spread: krachtige typografie, royale witruimte, voelbare kaarten en snelle, zelfverzekerde interacties, vooral op mobiel."
  },

"design_tokens": {
    "opmerkingen": [
      "Implementeer via CSS aangepaste eigenschappen in /app/frontend/src/index.css onder :root en .dark (shadcn-tokenstijl).",
      "Vermijd paars voor AI-oppervlakken; gebruik oceaanblauw + persimmon + inktneutrale kleuren.",
      "Geen transparante achtergronden achter tekstblokken; gebruik stevige kaartoppervlakken.",
      "Verlopen zijn alleen decoratief en moeten onder de 20% viewportdekking blijven."
    ],

"kleursysteem": {
      "modus": "licht + donker",
      "semantische_tokens_hsl": {
        "licht": {
          "--achtergrond": "36 33% 97%",
          "--voorgrond": "222 22% 12%",

"--kaart": "0 0% 100%",
          "--kaart-voorgrond": "222 22% 12%",

"--popover": "0 0% 100%",
          "--popover-voorgrond": "222 22% 12%",

"--primair": "222 22% 12%",
          "--primaire voorgrond": "36 33% 97%",

"--secundair": "36 20% 93%",
          "--secundaire voorgrond": "222 22% 12%",

"--gedempt": "36 18% 92%",
          "--gedempte voorgrond": "222 10% 42%",

"--accent": "174 44% 33%",
          "--accent-voorgrond": "0 0% 100%",

"--destructief": "0 72% 52%",
          "--destructieve-voorgrond": "0 0% 100%",

"--rand": "30 14% 86%",
          "--invoer": "30 14% 86%",
          "--ring": "174 44% 33%",

"--radius": "0,9rem",

"--grafiek-1": "174 44% 33%",
          "--grafiek-2": "18 78% 56%",
          "--grafiek-3": "222 22% 12%",
          "--grafiek-4": "36 18% 92%",
          "--grafiek-5": "30 14% 86%"
        },
        "donker": {
          "--achtergrond": "222 22% 8%",
          "--voorgrond": "36 33% 97%",

"--kaart": "222 22% 10%",
          "--kaart-voorgrond": "36 33% 97%",

"--popover": "222 22% 10%",
          "--popover-voorgrond": "36 33% 97%",

"--primair": "36 33% 97%",
          "--primaire voorgrond": "222 22% 10%",

"--secundair": "222 16% 14%",
          "--secundaire voorgrond": "36 33% 97%",

"--gedempt": "222 16% 14%",
          "--gedempte voorgrond": "36 10% 72%",

"--accent": "174 46% 38%",
          "--accent-voorgrond": "222 22% 8%",

"--destructief": "0 62% 42%",
          "--destructieve-voorgrond": "0 0% 100%",

"--rand": "222 14% 18%",
          "--invoer": "222 14% 18%",
          "--ring": "174 46% 38%"
        }
      },

"brand_extras_hex": {
        "inkt": "#14161B",
        "paper": "#FBF8F2",
        "ocean_teal": "#1F6F6B",
        "sea_glass": "#BFD8D2",
        "persimmon": "#E8603C",
        "zand": "#E9E1D6",
        "grafiet": "#2A2E36"
      },

"allowed_gradients": {
        "gebruik": [
          "Alleen achtergrondvervaging Hero/bovenkant scherm (max. 20% viewport)",
          "Decoratieve scheidingstekens achter sectietitels",
          "Nooit op kaarten met lange tekst"
        ],
        "css_voorbeelden": {
          "hero_wash_light": "radiaal verloop(900px cirkel op 20% 10%, rgba(31.111.107,0.14), transparant 55%), radiaal verloop(700px cirkel op 85% 0%, rgba(232,96,60,0.10), transparant 50%)",
          "hero_wash_dark": "radiaal verloop(900px cirkel op 20% 10%, rgba(31.111.107,0.22), transparant 55%), radiaal verloop(700px cirkel op 85% 0%, rgba(232,96,60,0.14), transparant 50%)"
        }
      }
    },

"typografie": {
      "font_pairing": {
        "weergeven": {
          "naam": "Gloock",
          "google_fonts": "https://fonts.google.com/specimen/Gloock",
          "usage": "H1/H2, titels van redactionele secties, Trend-Scout-koppen"
        },
        "lichaam": {
          "name": "Manrope",
          "google_fonts": "https://fonts.google.com/specimen/Manrope",
          "usage": "UI-labels, hoofdtekst, chat, tabellen, formulieren"
        }
      },
      "css_scaffold": {
        "notes": "Voeg toe aan /app/frontend/src/index.css (of importeer in index.html) en stel de body font-family in op Manrope; koppen gebruiken een hulpprogrammaklasse.",
        "google_import": "@import url('https://fonts.googleapis.com/css2?family=Gloock&family=Manrope:wght@400;500;600;700&display=swap');",
        "font_vars": {
          "--font-display": "Gloock, ui-serif, Georgië, serif",
          "--font-body": "Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        },
        "tailwind_usage": {
          "display_class": "font-[var(--font-display)] tracking-[-0.02em]",
          "body_class": "lettertype-[var(--lettertype-body)]"
        }
      },
      "type_scale_tailwind": {
        "h1": "tekst-4xl sm:tekst-5xl lg:tekst-6xl leidend-[1.02]",
        "h2": "text-base md:text-lg leading-relaxed",
        "section_title": "text-xl sm:text-2xl tracking-[-0.01em]",
        "body": "text-sm sm:text-base leading-relaxed",
        "klein": "tekst-xs sm:tekst-sm",
        "caps_label": "text-[11px] tracking in hoofdletters-[0.18em]"
      }
    },

"spacing_and_grid": {
      "afstand": {
        "base_unit": "4px",
        "recommended_steps_px": [4, 8, 12, 16, 20, 24, 32, 40, 56, 72],
        "rule": "Gebruik 2-3x meer witruimte dan de standaard shadcn-voorbeelden; geef de voorkeur aan 24/32 openingen tussen secties."
      },
      "indeling": {
        "mobiel": {
          "container": "px-4",
          "max_width": "max-w-[480px] voor dichte stromen; volledige breedte toestaan voor afbeeldingsrasters",
          "bottom_tab_safe_area": "pb-[calc(env(veilige-gebied-inset-bottom)+88px)]"
        },
        "bureaublad": {
          "container": "mx-auto max-w-6xl px-6",
          "grid": "raster van 12 kolommen voor beheerder + marktplaatsdetail; split van 2 kolommen voor stylist (geschiedenis + chat)"
        }
      }
    },

"straal_en_schaduw": {
      "straal": {
        "global": "--straal: 0,9rem",
        "card": "afgerond-[calc(var(--radius)+6px)]",
        "button": "afgerond-xl",
        "chip": "afgerond-vol",
        "drawer_sheet": "afgerond-t-[28px]"
      },
      "schaduw": {
        "philosophy": "Zachte redactionele accenten; geen harde slagschaduwen. Gebruik subtiele ambient + scherpe keyline.",
        "tokens": {
          "--shadow-sm": "0 1px 0 rgba(20,22,27,0.06), 0 8px 24px rgba(20,22,27,0.06)",
          "--shadow-md": "0 1px 0 rgba(20,22,27,0.08), 0 18px 50px rgba(20,22,27,0.10)",
          "--schaduwfocus": "0 0 0 4px rgba(31,111,107,0,22)"
        },
        "tailwind_usage": {
          "kaart": "schaduw-[var(--schaduw-sm)]",
          "modal": "schaduw-[var(--schaduw-md)]"
        }
      }
    },

"textuur": {
      "noise_overlay": {
        "goal": "Voeg subtiele afdrukachtige korrel toe om vlakheid te voorkomen.",
        "implementatie": {
          "css": ".noise::before{content:'';position:absolute;inset:0;background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulentietype=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect breedte=%22120%22 hoogte=%22120%22 filter=%22url(%23n)%22 opacity=%220.08%22/%3E%3C/svg%3E');mix-blend-mode:multiply;pointer-events:none;border-radius:inherit;}",
          "usage": "Pas `relatieve ruis` alleen toe op hero-wrappers en grote afbeeldingskaarten (niet op leesgebieden met veel tekst)."
        }
      }
    }
  },

"component_systeem": {
    "component_pad": {
      "shadcn_ui": "/app/frontend/src/components/ui/",
      "primaire_componenten_to_use": [
        "knop.jsx",
        "badge.jsx",
        "kaart.jsx",
        "tabs.jsx",
        "lade.jsx",
        "blad.jsx",
        "dialoog.jsx",
        "select.jsx",
        "dropdownmenu.jsx",
        "commando.jsx",
        "invoer.jsx",
        "textarea.jsx",
        "schakelaar.jsx",
        "slider.jsx",
        "vooruitgang.jsx",
        "skelet.jsx",
        "scroll-gebied.jsx",
        "carrousel.jsx",
        "kalender.jsx",
        "tabel.jsx",
        "sonner.jsx"
      ]
    },

"global_patterns": {
      "data_testid": {
        "rule": "Elk interactief + belangrijk informatief element MOET data-testid bevatten in de beschrijvende rol van kebab-case.",
        "voorbeelden": [
          "data-testid=\"onder-tab-kast\"",
          "data-testid=\"closet-filter-color-select\"",
          "data-testid=\"stylist-componist-send-button\"",
          "data-testid=\"marketplace-fee-preview\"",
          "data-testid=\"admin-omzet-kpi\""
        ]
      },

"knoppen": {
        "style": "Luxe / Elegant",
        "varianten": {
          "primair": {
            "use": "Primaire CTA (Vraag aan stylist, Advertentie publiceren, Item opslaan)",
            "classes": "rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-primary/92 focus-zichtbaar:outline-none focus-zichtbaar:shadow-[var(--shadow-focus)]",
            "motion": "hover: translateY(-1px) via framer-motion; actief: schaal(0,98)"
          },
          "secundair": {
            "use": "Secundaire acties (Bekijk kosten, Variant toevoegen)",
            "classes": "rounded-xl bg-secundaire tekst-secundaire-voorgrond hover:bg-secundair/80 border border-border",
            "motion": "hover: subtiele lift; actief: schaal (0,99)"
          },
          "geest": {
            "use": "Icon-only actions (mic, attach, more)",
            "classes": "rounded-xl hover:bg-accent/10 tekst-voorgrond",
            "motion": "hover: alleen achtergrondvervaging (geen transformatie tenzij verpakt in motion.button)"
          }
        }
      },

"badges_en_tags": {
        "brontags": {
          "privé": {
            "label": "Privé",
            "classes": "bg-[hsl(var(--secundair))] tekst-voorgrondrand grens-rand"
          },
          "gedeeld": {
            "label": "Gedeeld",
            "classes": "bg-[hsl(var(--accent))]/10 tekst-[hsl(var(--accent))] grensrand-[hsl(var(--accent))]/25"
          },
          "detailhandel": {
            "label": "Detailhandel",
            "classes": "bg-[rgba(232,96,60,0.10)] tekst-[rgb(232,96,60)] grens grens-[rgba(232,96,60,0.25)]"
          }
        },
        "season_badges": "Gebruik gedempte chips met caps_label-typografie; vertrouw nooit alleen op kleur: voeg een pictogram of tekst toe."
      },

"kaarten": {
        "editorial_card": {
          "classes": "rounded-[calc(var(--radius)+6px)] bg-card tekst-kaart-voorgrondrand border-border shadow-[var(--shadow-sm)]",
          "image_rule": "Houd de tekst altijd op een effen kaartgebied; de afbeelding kan bovenaan staan met AspectRatio; voeg alleen een verloopoverlay toe op het afbeeldingsgebied indien nodig voor de leesbaarheid."
        },
        "bento_grid": {
          "home": "Gebruik 2-col bento op mobiel (gestapeld), 3-4 col op desktop; mix 1x1 en 2x1 kaarten voor tijdschriftritme.",
          "closet": "Gebruik een dicht afbeeldingsraster met een plakkerige filterbalk; kaarten tonen slechts 1 à 2 metagegevensregels."
        }
      },

"formulieren": {
        "invoer": {
          "classes": "rounded-xl bg-card border border-input focus-zichtbaar:ring-2 focus-zichtbaar:ring-[hsl(var(--ring))]",
          "helper_text": "Gebruik kleine gedempte tekst; fouten in destructieve met beknopte tekst."
        },
        "selects": "Gebruik shadcn Select + Command voor doorzoekbare lijsten (merken, categorieën).",
        "calendar": "Gebruik shadcn Calendar voor het kiezen van datums (beschikbaarheid van lijsten, enz.)."
      },

"navigatie": {
        "mobile_bottom_tabs": {
          "pattern": "Vaste balk onderaan met 5 tabbladen (Home/Kast/Stylist/Markt/Ik)",
          "classes": "vaste bottom-0 inzet-x-0 bg-achtergrond/95 achtergrond-vervaging border-t border-border",
          "interaction": "Actieve tab gebruikt accentonderstreping + pictogramvulling; haptische schaal bij tikken via framer-beweging.",
          "a11y": "44px min. trefferdoelen; labels altijd zichtbaar."
        },
        "desktop_top_nav": {
          "pattern": "Bovennavigatie met broodkruimel + snelle acties; linkerrail optioneel voor beheerder.",
          "component": "navigatiemenu.jsx + broodkruimel.jsx"
        }
      }
    },

"pagina_blauwdrukken": {
      "thuis": {
        "layout": "Redactionele feed: heldenkop (kleine kleurverloop) + Trend-Scout-kaarten + CTA naar Stylist.",
        "componenten": ["kaart", "carrousel", "badge", "knop", "skelet"],
        "key_interactions": [
          "Trend-Scout-kaarten breiden uit naar lade met volledig overzicht + bronnen",
          "Pull-to-refresh op mobiel (optioneel) met subtiele spinner",
          "Weer- en kalenderchips zijn tapbare popovers met details"
        ],
        "testiden": [
          "home-trend-scout-feed",
          "thuis-vraag-stylist-cta",
          "thuis-weer-chip",
          "thuiskalender-chip"
        ]
      },

"kast": {
        "layout": "Kleverige filterrij + metselwerkachtig raster (gebruik CSS-kolommen of responsief raster). Als u op een item tikt, worden ladedetails geopend.",
        "componenten": ["badge", "lade", "tabbladen", "selecteren", "opdracht", "scrollgebied", "skelet"],
        "key_interactions": [
          "Lang indrukken (mobiel) of met de rechtermuisknop klikken (desktop) opent ContextMenu voor snelle acties (Delen, Lijst, Doneren)",
          "Filterchips animeren in/uit; toon actieve filtertelling",
          "FAB breidt uit naar minisheet met opties voor vastleggen/uploaden"
        ],
        "testiden": [
          "kastrooster",
          "kast-filterbalk",
          "kast-add-item-fab",
          "kast-item-kaart"
        ]
      },

"camera_add_item": {
        "layout": "Camera/upload op volledig scherm met gesegmenteerd voorbeeld; metadata-stepper.",
        "componenten": ["beeldverhouding", "voortgang", "tabbladen", "knop", "blad", "skelet"],
        "key_interactions": [
          "Voorbeeld live uitsnede: toon voor/na schakelen (Toggle-component)",
          "Randverfijningsschuifregelaar (Slider) met direct voorbeeld",
          "Opslaan activeert optimistische gebruikersinterface + toast (sonner)"
        ],
        "loading_states": [
          "SAM-2-segmentatie: toon skeletsilhouet + voortgangsbalk met kopie: 'Je stuk uitsnijden…'",
          "Als> 10s: secundaire regel weergeven 'Werkt nog steeds - randen met hoge resolutie duren even.'"
        ],
        "testiden": [
          "add-item-upload-knop",
          "item-segmentatie-preview toevoegen",
          "item-opslaan-knop toevoegen"
        ]
      },

"item_detail_varianten": {
        "layout": "Lade met afbeelding, metadata en variantcarrousel (origineel + bewerkingen)",
        "componenten": ["lade", "carrousel", "tabbladen", "knop", "badge"],
        "key_interactions": [
          "Variantgeneratie gebruikt SD-afbeelding-naar-afbeelding: toon wachtrijstatus + skelettegel",
          "Tik op de variant om te vergelijken met het origineel (wisselen van gesplitste weergave)",
          "'Maak mouwen lang' opent Sheet met prompt-presets"
        ],
        "testiden": [
          "item-detail-lade",
          "item-variant-carrousel",
          "item-genereer-variant-knop"
        ]
      },

"stylist_chat": {
        "layout": "Chat op volledig scherm; componist verankerd boven de onderste tabbladen; optionele gesplitste bureaubladweergave.",
        "components": ["scroll-gebied", "textarea", "knop", "popover", "tabbladen", "kaart", "sonner"],
        "key_interactions": [
          "Componist omvat: afbeelding bijvoegen, microfoon opnemen, verzenden; weer + kalenderchips inline",
          "AI-antwoord ondersteunt het afspelen van audio met golfvorm (aangepaste component) en transcriptieschakelaar",
          "Outfitkaarten in berichten: veeg horizontaal om door looks te bladeren"
        ],
        "prestatie": [
          "Gemini-latentie 15-25s: laat streaming placeholder-bubbels + skelet-outfitkaarten zien",
          "Knop Generatie annuleren toestaan"
        ],
        "testiden": [
          "stylist-chat-thread",
          "stylist-componist-tekstgebied",
          "stylist-componist-micro-knop",
          "stylist-componist-verzendknop",
          "stylist-antwoord-audiospeler"
        ]
      },

"marktplaats": {
        "layout": "Ontdekkingsraster met prijs- en kostenvoorbeeld; detailpagina met uitsplitsing; wizard voor vermelding.",
        "componenten": ["tabbladen", "kaart", "badge", "lade", "dialoogvenster", "voortgang", "tabel"],
        "fee_preview_pattern": {
          "rule": "Altijd weergeven: catalogusprijs, schatting van Stripe-kosten, platformcommissie van 7%, netto verkoper.",
          "ui": "Samengevouwen rij op kaart; wordt bij tikken uitgevouwen in lade."
        },
        "testiden": [
          "marktplaats-raster",
          "marktplaats-item-kaart",
          "marktplaatsvergoeding-uitsplitsing",
          "listing-wizard-volgende-knop",
          "lijst-publiceren-knop"
        ]
      },

"profiel_instellingen": {
        "layout": "Tijdschriftachtige instellingen: gegroepeerde kaarten met korte beschrijvingen; gevaarlijke acties gescheiden.",
        "componenten": ["kaart", "selecteren", "schakelaar", "knop", "scheidingsteken"],
        "integraties": [
          "Google Agenda connect CTA (OAuth) gebruikt knop + inline statusbadge",
          "Stripe Connect onboarding CTA gebruikt primaire knop + uitleg"
        ],
        "testiden": [
          "instellingen-stijl-profiel",
          "instellingen-kalender-connect-knop",
          "instellingen-stripe-connect-knop"
        ]
      },

"beheerder": {
        "layout": "Schone analyses: KPI-kaarten + grafieken + tabellen; rol-gated.",
        "componenten": ["kaart", "tabel", "tabbladen"],
        "bibliotheek": {
          "recommended": "opnieuw in kaart brengen",
          "install": "npm ik recharts",
          "usage": "Gebruik AreaChart voor omzettrend; Staafdiagram voor take-rate per dag; houd palet monochroom + accent groenblauw."
        },
        "testiden": [
          "admin-omzet-kpi",
          "admin-gebruikerstabel",
          "admin-inkomstengrafiek"
        ]
      }
    }
  },

"motion_taal": {
    "bibliotheek": {
      "recommended": "framer-motion",
      "install": "npm i framer-motion",
      "principes": [
        "Beweging moet aanvoelen als het omslaan van pagina's of het verschuiven van kaarten op een bureau.",
        "Gebruik korte duur; vermijd springerige overshoot.",
        "Respect geeft de voorkeur aan verminderde beweging."
      ]
    },
    "timings": {
      "snel": "120–160 ms",
      "basis": "180–240 ms",
      "slow": "320–420 ms (alleen laden/vellen)"
    },
    "versoepelingen": {
      "standaard": "[0,2, 0,8, 0,2, 1]",
      "exit": "[0.4, 0, 1, 1]"
    },
    "micro_interacties": [
      "Knoppen: zweeflift -1px (desktop), actieve schaal 0,98",
      "Kaarten: hover toont subtiele rand donkerder + schaduw vergroten (alleen desktop)",
      "Chips: geselecteerde staat animeert onderstreping in 160 ms",
      "Lade open: omhoog schuiven + vervagen; achtergrondonscherpte neemt toe",
      "Skeletglans: blijf subtiel; vermijd contrastrijke glans"
    ]
  },

"lege_en_error_states": {
    "tone": "Redactioneel, beknopt, ondersteunend. Geen grappen; geen emoji's.",
    "microcopy_examples": {
      "closet_empty": {
        "title": "Je kast begint hier",
        "body": "Voeg je eerste stuk toe: DressApp zal het taggen en het klaarhouden voor styling, delen of aanbieden.",
        "cta": "Een item toevoegen"
      },
      "marktplaats_leeg": {
        "title": "Nog niets overeenkomend",
        "body": "Probeer uw filters te verbreden of kom later terug na de Trend-Scout-update van vandaag.",
        "cta": "Filters wissen"
      },
      "stylist_latency": {
        "title": "Je look opstellen",
        "body": "Je kast-, weer- en kalendercontext opvragen. Dit kan even duren.",
        "cta": "Annuleren"
      },
      "netwerkfout": {
        "title": "We konden DressApp niet bereiken",
        "body": "Controleer uw verbinding en probeer het opnieuw.",
        "cta": "Opnieuw proberen"
      }
    }
  },

"toegankelijkheid": {
    "wcag": "AA-minimum",
    "regels": [
      "Minimale 44px aanraakdoelen voor onderste tabbladen, FAB, componistknoppen.",
      "Zichtbare focusring met --ring + --shadow-focus.",
      "Codeer de betekenis nooit alleen op basis van kleur (brontags bevatten tekst).",
      "Audiospeler: voorzien van afspeel-/pauzeknoplabels, voortgangsschuifregelaar met aria-waardetekst en transcriptieschakelaar.",
      "Respect geeft de voorkeur aan verminderde beweging: schakel parallax/lift-transformaties uit."
    ]
  },

"afbeelding_urls": {
    "held_en_redactie": [
      {
        "category": "thuisheld-achtergrond",
        "description": "Abstracte groenblauw papierachtige golven voor subtiele redactionele hero wash (alleen gebruiken als decoratieve achtergrond).",
        "url": "https://images.unsplash.com/photo-1660721858662-9ad9f37447f7?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ],
    "closet_and_flatlay": [
      {
        "categorie": "kast-lege-status",
        "description": "Minimale platliggende trui/portemonnee-afbeelding voor lege statusillustratie (klein houden, niet volledig uitlopend).",
        "url": "https://images.unsplash.com/photo-1654773125909-6d73f0c12407?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ],
    "marketplace_editorial": [
      {
        "category": "marketplace-featured-banner",
        "description": "Warme redactionele street-style afbeelding voor uitgelichte collectiebanner (gebruiken met effen tekstkaart-overlay).",
        "url": "https://images.unsplash.com/photo-1646105659698-1389145bf6a0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ]
  },

"instructions_to_main_agent": {
    "prioriteit_veranderingen": [
      "Vervang het standaard App.css-gebruik van CRA; centreer de app-container niet. Verwijder/negeer .App-header-stijlen.",
      "Update /app/frontend/src/index.css tokens zodat deze overeenkomen met de semantic_tokens_hsl hierboven (licht + donker).",
      "Voeg Google Fonts-import toe voor Glock + Manrope en stel het hoofdlettertype in op Manrope.",
      "Implementeer de mobiele onderste tabbalk + desktopnavigatie bovenaan; zorg voor opvulling van veilige gebieden.",
      "Gebruik Lade voor details in de kastitems en een overzicht van de aanbiedingskosten; Blad voor wizards en prompt-presets.",
      "Voeg skeletstatussen toe voor SAM-2-segmentatie en Gemini-reacties.",
      "Zorg ervoor dat elk interactief element en elke belangrijke informatie data-testid-attributen heeft (kebab-case)."
    ],
    "recommended_custom_components_js": [
      {
        "name": "WaveformAudioPlayer.jsx",
        "why": "Fase 3 gebruikt base64 MP3; biedt een gepolijste audio-gebruikersinterface voor antwoorden van stylisten.",
        "gedrag": "Afspelen/pauzeren, scrubber (schuifregelaar), tijdlabels, transcriptieschakelaar; toetsenbord toegankelijk.",
        "testiden": [
          "stylist-antwoord-audio-speler",
          "audiospeler-afspeelknop",
          "audiospeler-scrubber"
        ]
      },
      {
        "name": "BottomTabs.jsx",
        "why": "Primaire navigatie op mobiel.",
        "testiden": [
          "onderaan-tabblad-home",
          "onderste tabblad-kast",
          "onderste tabblad-stylist",
          "bottom-tab-markt",
          "onderste tabblad-ik"
        ]
      },
      {
        "name": "BronTagBadge.jsx",
        "why": "Consistente privé-/gedeelde/retail-badges in de kast en op de marktplaats.",
        "testids": ["brontag-badge"]
      }
    ],
    "bibliotheken": [
      {
        "name": "framer-beweging",
        "install": "npm i framer-motion",
        "use": "Micro-interacties met knoppen/kaarten, lade-overgangen, animaties voor toegang tot de lijst"
      },
      {
        "name": "recharts",
        "install": "npm ik recharts",
        "use": "Beheergrafieken (omzet, take-rate, gebruikers)"
      }
    ]
  }
}

---

<Algemene UI UX-ontwerprichtlijnen>  
    - U moet **niet** de universele transitie toepassen. Bijv.: `overgang: alles`. Dit resulteert in het breken van transformaties. Voeg altijd overgangen toe voor specifieke interactieve elementen zoals een knop, invoer exclusief transformaties
    - U moet de app-container **niet** centreren, dwz geen `.App { text-align: center; }` in het CSS-bestand. Dit verstoort de menselijke natuurlijke leesstroom van tekst
   - NOOIT: gebruik AI-assistent Emoji-tekens like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀 🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 enz. voor pictogrammen. Gebruik altijd de bibliotheek **FontAwesome cdn** of **lucid-react** die al in package.json is geïnstalleerd

**GRADIËNTBEPERKINGSREGEL**
Gebruik NOOIT donkere/verzadigde verloopcombinaties (bijvoorbeeld paars/roze) op enig UI-element.  Verboden kleurovergangen: blauw-500 tot paars 600, paars 500 tot roze-500, groen-500 tot blauw-500, rood tot roze enz.
Gebruik NOOIT donkere kleurverlopen voor logo, getuigenis, voettekst etc
Laat kleurovergangen NOOIT meer dan 20% van de viewport bedekken.
Pas NOOIT verlopen toe op inhoud met veel tekst of leesgebieden.
Gebruik NOOIT verlopen op kleine UI-elementen (<100px breedte).
Stapel NOOIT meerdere verlooplagen in hetzelfde venster.

**HANDHAVINGSREGEL:**
    • Het ID-gradiëntgebied overschrijdt 20% van de viewport OF heeft invloed op de leesbaarheid. **DEN** gebruik effen kleuren

**Hoe en waar te gebruiken:**
   • Sectieachtergronden (geen inhoudachtergronden)
   • Koptekst van de Hero-sectie. Bijv.: donker naar licht naar donker van kleur
   • Alleen decoratieve overlays en accentelementen
   • Hero-sectie met 2-3 milde kleuren
   • Verlopen kunnen voor elke hoek worden gemaakt, bijvoorbeeld horizontaal, verticaal of diagonaal

- Voor AI-chat en spraaktoepassing ** gebruik geen paarse kleur. Gebruik kleuren zoals lichtgroen, oceaanblauw, perzikoranje enz.**

</Lettertyperichtlijnen>

- Elke interactie heeft micro-animaties nodig: zweeftoestanden, overgangen, parallaxeffecten en ingangsanimaties. Statisch = dood. 
   
- Gebruik 2-3x meer afstand dan prettig voelt. Krappe ontwerpen zien er goedkoop uit.

- Subtiele korrelstructuren, ruisoverlays, aangepaste cursors, selectiestatussen en laadanimaties: onderscheidt goed van buitengewoon.
   
- Voordat u de gebruikersinterface genereert, moet u de visuele stijl afleiden uit de probleemstelling (palet, contrast, stemming, beweging) en deze onmiddellijk instantiëren door globale ontwerptokens in te stellen (primair, secundair/accent, achtergrond, voorgrond, ring, staatskleuren), in plaats van te vertrouwen op standaardbibliotheekinstellingen. Maak de achtergrond niet standaard donker, maar begrijp altijd eerst het probleem en definieer de kleuren dienovereenkomstig
    Bijvoorbeeld: - als het speels/energiek impliceert, kies dan voor een kleurrijk schema
           - als dit monochroom/minimaal impliceert, kies dan een zwart-wit/neutraal schema

**Hergebruik van componenten:**
	- Geef prioriteit aan het gebruik van reeds bestaande componenten uit src/components/ui, indien van toepassing
	- Creëer indien nodig nieuwe componenten die overeenkomen met de stijl en conventies van bestaande componenten
	- Onderzoek bestaande componenten om de componentpatronen van het project te begrijpen voordat u nieuwe maakt

**BELANGRIJK**: Gebruik geen HTML-gebaseerde componenten zoals dropdown, kalender, toast etc. U **MOET** altijd `/app/frontend/src/components/ui/ ` alleen als primaire componenten gebruiken, aangezien dit moderne en stijlvolle componenten zijn

**Beste praktijken:**
	- Gebruik Shadcn/UI als de primaire componentenbibliotheek voor consistentie en toegankelijkheid
	- Importpad: ./components/[componentnaam]

**Exportconventies:**
	- Componenten MOETEN benoemde exports gebruiken (export const ComponentName = ...)
	- Pagina's MOETEN standaardexports gebruiken (exporteer standaardfunctie PageName() {...})

**Toast:**
  - Gebruik `sonner` voor toast"
  - Sonner-componenten bevinden zich in `/app/src/components/ui/sonner.tsx`

Gebruik 2-4 kleurovergangen, subtiele texturen/ruisoverlays of op CSS gebaseerde ruis om platte beelden te voorkomen.
</Algemene UI UX-ontwerprichtlijnen>