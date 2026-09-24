import json
from pathlib import Path

locales_dir = Path("packages/i18n/locales")

translations = {
    "en": {
        "outfitCompletion": {
            "tryOnAvatar": "Try on avatar",
            "saveOutfit": "Save the Outfit",
            "saveOutfitTitle": "Save Outfit",
            "saveOutfitDesc": "Save this recommended look with a descriptive name to access it anytime in your Outfit Canvas.",
            "includedPieces": "Included pieces",
            "savedSuccess": "Outfit \"{{name}}\" saved to your Outfit Canvas!",
            "alreadySaved": "Outfit already saved",
            "outfitName": "Outfit Name",
            "notes": "Stylist Notes / Occasion"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "Vibe search: \"Summer barbecue\", \"Mall shopping\", \"Business meeting\", \"Black T-shirt\", \"Stone-washed jeans\"...",
                "quickVibes": "Vibes:",
                "resultsCount": "Found {{count}} of {{total}} outfits",
                "noSearchMatches": "No outfits match this vibe",
                "noSearchMatchesDesc": "We couldn't find any saved outfits matching \"{{query}}\". Try another vibe, garment, or clear the search.",
                "clearSearch": "Clear search",
                "vibes": {
                    "black_t_shirt": "Black T-shirt",
                    "business_meeting": "Business meeting",
                    "summer_barbecue": "Summer barbecue",
                    "mall_shopping": "Mall shopping",
                    "rainy_day": "Rainy day",
                    "stone_washed_jeans": "Stone-washed jeans",
                    "colorful_summer": "Colorful summer",
                    "casual_chic": "Casual chic"
                }
            }
        }
    },
    "he": {
        "outfitCompletion": {
            "tryOnAvatar": "מדידה על דמות",
            "saveOutfit": "שמור את האאוטפיט",
            "saveOutfitTitle": "שמירת אאוטפיט",
            "saveOutfitDesc": "שמור מראה מומלץ זה עם שם תיאורי כדי לגשת אליו בכל עת בקנבס האאוטפיט שלך.",
            "includedPieces": "פריטים כלולים",
            "savedSuccess": "האאוטפיט \"{{name}}\" נשמר בקנבס האאוטפיט שלך!",
            "alreadySaved": "האאוטפיט כבר נשמר",
            "outfitName": "שם האאוטפיט",
            "notes": "הערות סטייליסט / אירוע"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "חיפוש וייב: \"ברביקיו בקיץ\", \"קניות בקניון\", \"פגישת עסקים\", \"חולצת טי שחורה\", \"ג'ינס משופשף\"...",
                "quickVibes": "וייבים:",
                "resultsCount": "נמצאו {{count}} מתוך {{total}} אאוטפיטים",
                "noSearchMatches": "אין אאוטפיטים התואמים לווייב זה",
                "noSearchMatchesDesc": "לא מצאנו אאוטפיטים שמורים התואמים ל-\"{{query}}\". נסה וייב אחר, פריט אחר, או נקה את החיפוש.",
                "clearSearch": "נקה חיפוש",
                "vibes": {
                    "black_t_shirt": "חולצת טי שחורה",
                    "business_meeting": "פגישת עסקים",
                    "summer_barbecue": "ברביקיו בקיץ",
                    "mall_shopping": "קניות בקניון",
                    "rainy_day": "יום גשום",
                    "stone_washed_jeans": "ג'ינס משופשף",
                    "colorful_summer": "קיץ צבעוני",
                    "casual_chic": "קז'ואל שיק"
                }
            }
        }
    },
    "ar": {
        "outfitCompletion": {
            "tryOnAvatar": "تجربة على الأفاتار",
            "saveOutfit": "حفظ الزي",
            "saveOutfitTitle": "حفظ الزي",
            "saveOutfitDesc": "احفظ هذا المظهر الموصى به باسم وصفي للوصول إليه في أي وقت في لوحة ملابسك.",
            "includedPieces": "القطع المتضمنة",
            "savedSuccess": "تم حفظ الزي \"{{name}}\" في لوحة أزيائك!",
            "alreadySaved": "تم حفظ الزي بالفعل",
            "outfitName": "اسم الزي",
            "notes": "ملاحظات المنسق / المناسبة"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "بحث عن الطابع: \"شواء صيفي\"، \"تسوق في المول\"، \"اجتماع عمل\"، \"تي شيرت أسود\"، \"جينز باهت\"...",
                "quickVibes": "الأجواء:",
                "resultsCount": "تم العثور على {{count}} من إجمالي {{total}} من الأزياء",
                "noSearchMatches": "لا توجد أزياء تطابق هذا الطابع",
                "noSearchMatchesDesc": "لم نتمكن من العثور على أي أزياء محفوظة تطابق \"{{query}}\". جرب طابعًا آخر، أو قطعة ملابس أخرى، أو امسح البحث.",
                "clearSearch": "مسح البحث",
                "vibes": {
                    "black_t_shirt": "تي شيرت أسود",
                    "business_meeting": "اجتماع عمل",
                    "summer_barbecue": "شواء صيفي",
                    "mall_shopping": "تسوق في المول",
                    "rainy_day": "يوم ممطر",
                    "stone_washed_jeans": "جينز باهت",
                    "colorful_summer": "صيف مفعم بالألوان",
                    "casual_chic": "كاجوال أنيق"
                }
            }
        }
    },
    "de": {
        "outfitCompletion": {
            "tryOnAvatar": "Auf Avatar anprobieren",
            "saveOutfit": "Outfit speichern",
            "saveOutfitTitle": "Outfit speichern",
            "saveOutfitDesc": "Speichere diesen empfohlenen Look mit einem aussagekräftigen Namen, um jederzeit im Outfit-Canvas darauf zuzugreifen.",
            "includedPieces": "Enthaltene Teile",
            "savedSuccess": "Outfit „{{name}}“ wurde in deinem Outfit-Canvas gespeichert!",
            "alreadySaved": "Outfit bereits gespeichert",
            "outfitName": "Outfit-Name",
            "notes": "Stylist-Notizen / Anlass"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "Vibe-Suche: „Sommer-Grillparty“, „Shopping in der Mall“, „Geschäftstreffen“, „Schwarzes T-Shirt“, „Stone-washed Jeans“...",
                "quickVibes": "Vibes:",
                "resultsCount": "{{count}} von {{total}} Outfits gefunden",
                "noSearchMatches": "Keine Outfits passen zu diesem Vibe",
                "noSearchMatchesDesc": "Wir konnten keine gespeicherten Outfits finden, die zu „{{query}}“ passen. Versuche einen anderen Vibe, ein anderes Kleidungsstück oder setze die Suche zurück.",
                "clearSearch": "Suche löschen",
                "vibes": {
                    "black_t_shirt": "Schwarzes T-Shirt",
                    "business_meeting": "Geschäftstreffen",
                    "summer_barbecue": "Sommer-Grillparty",
                    "mall_shopping": "Mall-Shopping",
                    "rainy_day": "Regnerischer Tag",
                    "stone_washed_jeans": "Stone-washed Jeans",
                    "colorful_summer": "Farbenfroher Sommer",
                    "casual_chic": "Casual Chic"
                }
            }
        }
    },
    "es": {
        "outfitCompletion": {
            "tryOnAvatar": "Probar en avatar",
            "saveOutfit": "Guardar el atuendo",
            "saveOutfitTitle": "Guardar atuendo",
            "saveOutfitDesc": "Guarda este look recomendado con un nombre descriptivo para acceder a él en cualquier momento en tu Lienzo de atuendos.",
            "includedPieces": "Piezas incluidas",
            "savedSuccess": "¡Atuendo \"{{name}}\" guardado en tu Lienzo de atuendos!",
            "alreadySaved": "Atuendo ya guardado",
            "outfitName": "Nombre del atuendo",
            "notes": "Notas del estilista / Ocasión"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "Búsqueda por estilo: \"Barbacoa de verano\", \"Compras en el centro comercial\", \"Reunión de negocios\", \"Camiseta negra\", \"Vaqueros lavados a la piedra\"...",
                "quickVibes": "Estilos:",
                "resultsCount": "{{count}} de {{total}} atuendos encontrados",
                "noSearchMatches": "Ningún atuendo coincide con este estilo",
                "noSearchMatchesDesc": "No pudimos encontrar atuendos guardados que coincidan con \"{{query}}\". Prueba con otro estilo, prenda o borra la búsqueda.",
                "clearSearch": "Borrar búsqueda",
                "vibes": {
                    "black_t_shirt": "Camiseta negra",
                    "business_meeting": "Reunión de negocios",
                    "summer_barbecue": "Barbacoa de verano",
                    "mall_shopping": "Compras en el centro comercial",
                    "rainy_day": "Día lluvioso",
                    "stone_washed_jeans": "Vaqueros desgastados",
                    "colorful_summer": "Verano colorido",
                    "casual_chic": "Casual chic"
                }
            }
        }
    },
    "fr": {
        "outfitCompletion": {
            "tryOnAvatar": "Essayer sur l'avatar",
            "saveOutfit": "Enregistrer la tenue",
            "saveOutfitTitle": "Enregistrer la tenue",
            "saveOutfitDesc": "Enregistrez ce look recommandé avec un nom descriptif pour y accéder à tout moment dans votre Canevas de tenues.",
            "includedPieces": "Pièces incluses",
            "savedSuccess": "Tenue « {{name}} » enregistrée dans votre Canevas de tenues !",
            "alreadySaved": "Tenue déjà enregistrée",
            "outfitName": "Nom de la tenue",
            "notes": "Notes du styliste / Occasion"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "Recherche d'ambiance : « Barbecue d'été », « Shopping au centre commercial », « Réunion professionnelle », « T-shirt noir », « Jean délavé »...",
                "quickVibes": "Ambiances :",
                "resultsCount": "{{count}} tenues trouvées sur {{total}}",
                "noSearchMatches": "Aucune tenue ne correspond à cette ambiance",
                "noSearchMatchesDesc": "Nous n'avons trouvé aucune tenue enregistrée correspondant à « {{query}} ». Essayez une autre ambiance, un autre vêtement ou effacez la recherche.",
                "clearSearch": "Effacer la recherche",
                "vibes": {
                    "black_t_shirt": "T-shirt noir",
                    "business_meeting": "Réunion pro",
                    "summer_barbecue": "Barbecue d'été",
                    "mall_shopping": "Shopping au centre commercial",
                    "rainy_day": "Jour de pluie",
                    "stone_washed_jeans": "Jean délavé",
                    "colorful_summer": "Été coloré",
                    "casual_chic": "Casual chic"
                }
            }
        }
    },
    "hi": {
        "outfitCompletion": {
            "tryOnAvatar": "अवतार पर आज़माएं",
            "saveOutfit": "पहनावा सहेजें",
            "saveOutfitTitle": "आउटफ़िट सहेजें",
            "saveOutfitDesc": "इस अनुशंसित लुक को एक वर्णनात्मक नाम के साथ सहेजें ताकि आप अपने आउटफ़िट कैनवास में कभी भी इसे देख सकें।",
            "includedPieces": "शामिल किए गए वस्त्र",
            "savedSuccess": "आउटफ़िट \"{{name}}\" आपके आउटफ़िट कैनवास में सहेज लिया गया!",
            "alreadySaved": "आउटफ़िट पहले ही सहेजा जा चुका है",
            "outfitName": "आउटफ़िट का नाम",
            "notes": "स्टाइलिस्ट नोट्स / अवसर"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "वाइब खोज: \"गर्मी का बारबेक्यू\", \"मॉल में खरीदारी\", \"बिजनेस मीटिंग\", \"काली टी-शर्ट\", \"स्टोन-वॉश जींस\"...",
                "quickVibes": "वाइब्स:",
                "resultsCount": "कुल {{total}} में से {{count}} आउटफ़िट मिले",
                "noSearchMatches": "इस वाइब से मेल खाता कोई आउटफ़िट नहीं मिला",
                "noSearchMatchesDesc": "हमें \"{{query}}\" से मेल खाने वाला कोई सहेजा गया आउटफ़िट नहीं मिला। कोई अन्य वाइब या वस्त्र आज़माएं, या खोज साफ़ करें।",
                "clearSearch": "खोज साफ़ करें",
                "vibes": {
                    "black_t_shirt": "काली टी-शर्ट",
                    "business_meeting": "बिजनेस मीटिंग",
                    "summer_barbecue": "गर्मी का बारबेक्यू",
                    "mall_shopping": "मॉल शॉपिंग",
                    "rainy_day": "बरसात का दिन",
                    "stone_washed_jeans": "स्टोन-वॉश जींस",
                    "colorful_summer": "रंग-बिरंगी गर्मी",
                    "casual_chic": "कैजुअल चिक"
                }
            }
        }
    },
    "it": {
        "outfitCompletion": {
            "tryOnAvatar": "Prova sull'avatar",
            "saveOutfit": "Salva l'outfit",
            "saveOutfitTitle": "Salva outfit",
            "saveOutfitDesc": "Salva questo look consigliato con un nome descrittivo per accedervi in qualsiasi momento nel tuo Canvas degli outfit.",
            "includedPieces": "Capi inclusi",
            "savedSuccess": "Outfit \"{{name}}\" salvato nel tuo Canvas degli outfit!",
            "alreadySaved": "Outfit già salvato",
            "outfitName": "Nome dell'outfit",
            "notes": "Note dello stylist / Occasione"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "Cerca stile: \"Barbecue estivo\", \"Shopping al centro commerciale\", \"Riunione di lavoro\", \"T-shirt nera\", \"Jeans stone-washed\"...",
                "quickVibes": "Vibes:",
                "resultsCount": "Trovati {{count}} di {{total}} outfit",
                "noSearchMatches": "Nessun outfit corrisponde a questo stile",
                "noSearchMatchesDesc": "Non abbiamo trovato outfit salvati corrispondenti a \"{{query}}\". Prova un altro stile, un altro capo o cancella la ricerca.",
                "clearSearch": "Cancella ricerca",
                "vibes": {
                    "black_t_shirt": "T-shirt nera",
                    "business_meeting": "Riunione di lavoro",
                    "summer_barbecue": "Barbecue estivo",
                    "mall_shopping": "Shopping al centro commerciale",
                    "rainy_day": "Giorno di pioggia",
                    "stone_washed_jeans": "Jeans stone-washed",
                    "colorful_summer": "Estate colorata",
                    "casual_chic": "Casual chic"
                }
            }
        }
    },
    "ja": {
        "outfitCompletion": {
            "tryOnAvatar": "アバターで試着",
            "saveOutfit": "コーデを保存",
            "saveOutfitTitle": "コーデの保存",
            "saveOutfitDesc": "このおすすめのコーディネートに分かりやすい名前を付けて保存し、いつでもコーデキャンバスで確認できます。",
            "includedPieces": "含まれるアイテム",
            "savedSuccess": "コーデ「{{name}}」がコーデキャンバスに保存されました！",
            "alreadySaved": "このコーデは既に保存されています",
            "outfitName": "コーデ名",
            "notes": "スタイリストのメモ / 場面"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "スタイル検索：「夏のバーベキュー」、「モールでお買い物」、「ビジネスミーティング」、「黒のTシャツ」、「ケミカルウォッシュジーンズ」など...",
                "quickVibes": "スタイル：",
                "resultsCount": "全{{total}}件中 {{count}}件のコーデが見つかりました",
                "noSearchMatches": "このスタイルに一致するコーデはありません",
                "noSearchMatchesDesc": "「{{query}}」に一致する保存済みコーデが見つかりませんでした。別のスタイルやアイテムを試すか、検索をクリアしてください。",
                "clearSearch": "検索をクリア",
                "vibes": {
                    "black_t_shirt": "黒Tシャツ",
                    "business_meeting": "ビジネスミーティング",
                    "summer_barbecue": "夏のバーベキュー",
                    "mall_shopping": "モールでお買い物",
                    "rainy_day": "雨の日",
                    "stone_washed_jeans": "ウォッシュドジーンズ",
                    "colorful_summer": "カラフルな夏",
                    "casual_chic": "カジュアルシック"
                }
            }
        }
    },
    "nl": {
        "outfitCompletion": {
            "tryOnAvatar": "Passen op avatar",
            "saveOutfit": "Outfit opslaan",
            "saveOutfitTitle": "Outfit opslaan",
            "saveOutfitDesc": "Sla deze aanbevolen look op met een beschrijvende naam om deze op elk gewenst moment in je Outfit Canvas te openen.",
            "includedPieces": "Inbegrepen kledingstukken",
            "savedSuccess": "Outfit \"{{name}}\" opgeslagen in je Outfit Canvas!",
            "alreadySaved": "Outfit al opgeslagen",
            "outfitName": "Outfitnaam",
            "notes": "Stylist-notities / Gelegenheid"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "Vibe-zoekopdracht: \"Zomerbarbecue\", \"Winkelen in het winkelcentrum\", \"Zakelijke bijeenkomst\", \"Zwart T-shirt\", \"Stone-washed jeans\"...",
                "quickVibes": "Vibes:",
                "resultsCount": "{{count}} van {{total}} outfits gevonden",
                "noSearchMatches": "Geen outfits gevonden voor deze vibe",
                "noSearchMatchesDesc": "We konden geen opgeslagen outfits vinden die overeenkomen met \"{{query}}\". Probeer een andere vibe, een ander kledingstuk of wis de zoekopdracht.",
                "clearSearch": "Zoekopdracht wissen",
                "vibes": {
                    "black_t_shirt": "Zwart T-shirt",
                    "business_meeting": "Zakelijke meeting",
                    "summer_barbecue": "Zomerbarbecue",
                    "mall_shopping": "Shoppen in winkelcentrum",
                    "rainy_day": "Regenachtige dag",
                    "stone_washed_jeans": "Stone-washed jeans",
                    "colorful_summer": "Kleurrijke zomer",
                    "casual_chic": "Casual chic"
                }
            }
        }
    },
    "pt": {
        "outfitCompletion": {
            "tryOnAvatar": "Experimentar no avatar",
            "saveOutfit": "Salvar look",
            "saveOutfitTitle": "Salvar look",
            "saveOutfitDesc": "Salve este visual recomendado com um nome descritivo para acessá-lo a qualquer momento no seu Canvas de Looks.",
            "includedPieces": "Peças inclusas",
            "savedSuccess": "Look \"{{name}}\" salvo no seu Canvas de Looks!",
            "alreadySaved": "Look já salvo",
            "outfitName": "Nome do look",
            "notes": "Notas do estilista / Ocasião"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "Busca de estilo: \"Churrasco de verão\", \"Compras no shopping\", \"Reunião de negócios\", \"Camiseta preta\", \"Jeans delavê\"...",
                "quickVibes": "Estilos:",
                "resultsCount": "{{count}} de {{total}} looks encontrados",
                "noSearchMatches": "Nenhum look combina com este estilo",
                "noSearchMatchesDesc": "Não encontramos nenhum look salvo correspondente a \"{{query}}\". Tente outro estilo, peça ou limpe a pesquisa.",
                "clearSearch": "Limpar pesquisa",
                "vibes": {
                    "black_t_shirt": "Camiseta preta",
                    "business_meeting": "Reunião de negócios",
                    "summer_barbecue": "Churrasco de verão",
                    "mall_shopping": "Compras no shopping",
                    "rainy_day": "Dia de chuva",
                    "stone_washed_jeans": "Jeans delavê",
                    "colorful_summer": "Verão colorido",
                    "casual_chic": "Casual chique"
                }
            }
        }
    },
    "ru": {
        "outfitCompletion": {
            "tryOnAvatar": "Примерить на аватаре",
            "saveOutfit": "Сохранить наряд",
            "saveOutfitTitle": "Сохранение наряда",
            "saveOutfitDesc": "Сохраните этот рекомендованный образ с понятным названием, чтобы в любой момент открыть его на холсте нарядов.",
            "includedPieces": "Входящие вещи",
            "savedSuccess": "Наряд «{{name}}» сохранён на холсте нарядов!",
            "alreadySaved": "Наряд уже сохранён",
            "outfitName": "Название наряда",
            "notes": "Заметки стилиста / Повод"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "Поиск по настроению: «Летнее барбекю», «Шопинг в ТЦ», «Деловая встреча», «Чёрная футболка», «Варёные джинсы»...",
                "quickVibes": "Стили:",
                "resultsCount": "Найдено {{count}} из {{total}} нарядов",
                "noSearchMatches": "Нет нарядов, подходящих под это настроение",
                "noSearchMatchesDesc": "Мы не нашли сохранённых нарядов, подходящих под «{{query}}». Попробуйте другое настроение, предмет одежды или сбросьте поиск.",
                "clearSearch": "Очистить поиск",
                "vibes": {
                    "black_t_shirt": "Чёрная футболка",
                    "business_meeting": "Деловая встреча",
                    "summer_barbecue": "Летнее барбекю",
                    "mall_shopping": "Шопинг в ТЦ",
                    "rainy_day": "Дождливый день",
                    "stone_washed_jeans": "Варёные джинсы",
                    "colorful_summer": "Яркое лето",
                    "casual_chic": "Кэжуал шик"
                }
            }
        }
    },
    "zh": {
        "outfitCompletion": {
            "tryOnAvatar": "在模特身上试穿",
            "saveOutfit": "保存穿搭",
            "saveOutfitTitle": "保存搭配",
            "saveOutfitDesc": "为这套推荐搭配保存一个生动的名称，以便随时在穿搭画布中查看。",
            "includedPieces": "包含的单品",
            "savedSuccess": "穿搭 “{{name}}” 已保存到您的穿搭画布！",
            "alreadySaved": "穿搭已保存",
            "outfitName": "穿搭名称",
            "notes": "造型师备注 / 场合"
        },
        "stylist": {
            "calendar": {
                "searchPlaceholder": "风格搜索：“夏日烧烤聚会”、“商场购物”、“商务会议”、“黑色T恤”、“磨白牛仔裤”...",
                "quickVibes": "风格标签：",
                "resultsCount": "找到 {{count}} / {{total}} 套搭配",
                "noSearchMatches": "没有符合该风格的搭配",
                "noSearchMatchesDesc": "未找到与 “{{query}}” 匹配的保存穿搭。请尝试其他风格、单品或清空搜索。",
                "clearSearch": "清空搜索",
                "vibes": {
                    "black_t_shirt": "黑色T恤",
                    "business_meeting": "商务会议",
                    "summer_barbecue": "夏日烧烤",
                    "mall_shopping": "商场购物",
                    "rainy_day": "雨天穿搭",
                    "stone_washed_jeans": "磨白牛仔裤",
                    "colorful_summer": "缤纷夏日",
                    "casual_chic": "休闲时髦"
                }
            }
        }
    }
}

for lang, data in translations.items():
    file_path = locales_dir / f"{lang}.json"
    if not file_path.exists():
        print(f"Skipping {lang}, file not found")
        continue

    with open(file_path, "r", encoding="utf-8") as f:
        loc = json.load(f)

    # 1. Update outfitCompletion
    if "outfitCompletion" not in loc:
        loc["outfitCompletion"] = {}
    for k, v in data["outfitCompletion"].items():
        loc["outfitCompletion"][k] = v

    # 2. Update stylist.calendar
    if "stylist" not in loc:
        loc["stylist"] = {}
    if "calendar" not in loc["stylist"]:
        loc["stylist"]["calendar"] = {}

    for k, v in data["stylist"]["calendar"].items():
        if k == "vibes":
            if "vibes" not in loc["stylist"]["calendar"]:
                loc["stylist"]["calendar"]["vibes"] = {}
            for vk, vv in v.items():
                loc["stylist"]["calendar"]["vibes"][vk] = vv
        else:
            loc["stylist"]["calendar"][k] = v

    # Also make sure common category names are preserved and formatted nicely
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(loc, f, ensure_ascii=False, indent=2)

    print(f"Updated {lang}.json successfully")
