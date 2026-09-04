import json
import os

locales = ["en", "de", "he", "ar", "es", "fr", "it", "nl", "pt", "ru", "zh", "ja", "hi"]

# Base translations dictionary for all 13 languages
translations = {
    "addItem.intent_own": {
        "en": "Keep",
        "de": "Behalten",
        "he": "שמירה",
        "ar": "احتفاظ",
        "es": "Conservar",
        "fr": "Garder",
        "it": "Tieni",
        "nl": "Bewaren",
        "pt": "Guardar",
        "ru": "Оставить",
        "zh": "保留",
        "ja": "保管",
        "hi": "रखें"
    },
    "taxonomy.intent.own": {
        "en": "Keep",
        "de": "Behalten",
        "he": "שמירה",
        "ar": "احتفاظ",
        "es": "Conservar",
        "fr": "Garder",
        "it": "Tieni",
        "nl": "Bewaren",
        "pt": "Guardar",
        "ru": "Оставить",
        "zh": "保留",
        "ja": "保管",
        "hi": "रखें"
    },
    "taxonomy.intent.keep": {
        "en": "Keep",
        "de": "Behalten",
        "he": "שמירה",
        "ar": "احتفاظ",
        "es": "Conservar",
        "fr": "Garder",
        "it": "Tieni",
        "nl": "Bewaren",
        "pt": "Guardar",
        "ru": "Оставить",
        "zh": "保留",
        "ja": "保管",
        "hi": "रखें"
    },
    "closet.noItemsFound": {
        "en": "No items in this view",
        "de": "Keine Artikel in dieser Ansicht",
        "he": "אין פריטים בתצוגה זו",
        "ar": "لا توجد عناصر في هذا العرض",
        "es": "No hay prendas en esta vista",
        "fr": "Aucun vêtement dans cette vue",
        "it": "Nessun capo in questa vista",
        "nl": "Geen kledingstukken in deze weergave",
        "pt": "Nenhum item nesta visualização",
        "ru": "В этом виде нет предметов гардероба",
        "zh": "此视图中没有衣物",
        "ja": "この表示にはアイテムがありません",
        "hi": "इस दृश्य में कोई वस्त्र नहीं हैं"
    },
    "closet.noItemsSub": {
        "en": "Try changing filters or tap + to add clothes.",
        "de": "Filter anpassen oder auf + tippen, um Kleidung hinzuzufügen.",
        "he": "נסה לשנות מסננים או לחץ על + להוספת בגדים.",
        "ar": "جرب تغيير الفلاتر أو اضغط على + لإضافة ملابس.",
        "es": "Prueba a cambiar los filtros o toca + para añadir ropa.",
        "fr": "Essayez de modifier les filtres ou appuyez sur + pour ajouter des vêtements.",
        "it": "Prova a modificare i filtri o tocca + per aggiungere vestiti.",
        "nl": "Pas de filters aan of tik op + om kleding toe te voegen.",
        "pt": "Tente alterar os filtros ou toque em + para adicionar roupas.",
        "ru": "Попробуйте изменить фильтры или нажмите +, чтобы добавить одежду.",
        "zh": "尝试更改筛选条件或点击 + 添加衣物。",
        "ja": "フィルターを変更するか、+をタップして服を追加してください。",
        "hi": "फ़िल्टर बदलें या कपड़े जोड़ने के लिए + पर टैप करें।"
    },
    "closet.superTitle": {
        "en": "DIGITAL WARDROBE",
        "de": "DIGITALE GARDEROBE",
        "he": "ארון דיגיטלי",
        "ar": "خزانة الملابس الرقمية",
        "es": "ARMARIO DIGITAL",
        "fr": "GARDE-ROBE DIGITALE",
        "it": "GUARDAROBA DIGITALE",
        "nl": "DIGITALE GARDEROBE",
        "pt": "GUARDA-ROUPA DIGITAL",
        "ru": "ЦИФРОВОЙ ГАРДЕРОБ",
        "zh": "数字衣橱",
        "ja": "デジタルワードローブ",
        "hi": "डिजिटल अलमारी"
    },
    "closet.allSources": {
        "en": "All Sources",
        "de": "Alle Quellen",
        "he": "כל המקורות",
        "ar": "جميع المصادر",
        "es": "Todas las fuentes",
        "fr": "Toutes les sources",
        "it": "Tutte le fonti",
        "nl": "Alle bronnen",
        "pt": "Todas as fontes",
        "ru": "Все источники",
        "zh": "全部来源",
        "ja": "すべてのソース",
        "hi": "सभी स्रोत"
    },
    "closet.searchingSemantic": {
        "en": "FashionCLIP semantic searching…",
        "de": "Semantische FashionCLIP-Suche…",
        "he": "חיפוש סמנטי FashionCLIP…",
        "ar": "البحث الدلالي FashionCLIP…",
        "es": "Búsqueda semántica FashionCLIP…",
        "fr": "Recherche sémantique FashionCLIP…",
        "it": "Ricerca semantica FashionCLIP…",
        "nl": "Semantisch zoeken met FashionCLIP…",
        "pt": "Pesquisa semântica FashionCLIP…",
        "ru": "Семантический поиск FashionCLIP…",
        "zh": "FashionCLIP 语义搜索中…",
        "ja": "FashionCLIP セマンティック検索中…",
        "hi": "FashionCLIP सिमेंटिक खोज जारी है…"
    },
    "closet.searchMeaningPlaceholder": {
        "en": "Search by style, vibe, mood…",
        "de": "Nach Stil, Vibe, Stimmung suchen…",
        "he": "חיפוש לפי סגנון, וייב, מצב רוח…",
        "ar": "ابحث حسب الأسلوب أو الطابع أو المزاج…",
        "es": "Buscar por estilo, vibra, estado de ánimo…",
        "fr": "Rechercher par style, ambiance, humeur…",
        "it": "Cerca per stile, vibe, atmosfera…",
        "nl": "Zoek op stijl, sfeer, stemming…",
        "pt": "Pesquise por estilo, vibe, clima…",
        "ru": "Искать по стилю, настроению, вайбу…",
        "zh": "按风格、氛围、心情搜索…",
        "ja": "スタイル、雰囲気、ムードで検索…",
        "hi": "शैली, वाइब, मूड द्वारा खोजें…"
    },
    "closet.selected": {
        "en": "selected",
        "de": "ausgewählt",
        "he": "נבחרו",
        "ar": "محدد",
        "es": "seleccionados",
        "fr": "sélectionnés",
        "it": "selezionati",
        "nl": "geselecteerd",
        "pt": "selecionados",
        "ru": "выбрано",
        "zh": "已选择",
        "ja": "選択済み",
        "hi": "चयनित"
    },
    "closet.completeLook": {
        "en": "Outfit",
        "de": "Outfit",
        "he": "אאוטפיט",
        "ar": "إطلالة",
        "es": "Conjunto",
        "fr": "Tenue",
        "it": "Outfit",
        "nl": "Outfit",
        "pt": "Visual",
        "ru": "Образ",
        "zh": "穿搭",
        "ja": "コーディネート",
        "hi": "आउटफ़िट"
    },
    "closet.completeOutfit": {
        "en": "Complete Outfit",
        "de": "Outfit vervollständigen",
        "he": "השלם אאוטפיט",
        "ar": "إكمال الإطلالة",
        "es": "Completar conjunto",
        "fr": "Compléter la tenue",
        "it": "Completa outfit",
        "nl": "Outfit voltooien",
        "pt": "Completar visual",
        "ru": "Завершить образ",
        "zh": "搭配整套造型",
        "ja": "コーディネートを完成",
        "hi": "पूरा आउटफ़िट बनाएं"
    },
    "closet.deleteSelectedTitle": {
        "en": "Delete Items",
        "de": "Artikel löschen",
        "he": "מחיקת פריטים",
        "ar": "حذف العناصر",
        "es": "Eliminar prendas",
        "fr": "Supprimer les vêtements",
        "it": "Elimina capi",
        "nl": "Kledingstukken verwijderen",
        "pt": "Excluir itens",
        "ru": "Удалить предметы",
        "zh": "删除物品",
        "ja": "アイテムを削除",
        "hi": "वस्त्र हटाएं"
    },
    "closet.deleteSelectedConfirm": {
        "en": "Are you sure you want to delete {{count}} item(s)?",
        "de": "Möchten Sie {{count}} Artikel wirklich löschen?",
        "he": "האם אתה בטוח שברצונך למחוק {{count}} פריטים?",
        "ar": "هل أنت متأكد من رغبتك في حذف {{count}} عنصر؟",
        "es": "¿Seguro que quieres eliminar {{count}} prenda(s)?",
        "fr": "Voulez-vous vraiment supprimer {{count}} vêtement(s) ?",
        "it": "Sei sicuro di voler eliminare {{count}} capo/i?",
        "nl": "Weet u zeker dat u {{count}} kledingstuk(ken) wilt verwijderen?",
        "pt": "Tem certeza de que deseja excluir {{count}} item(ns)?",
        "ru": "Вы уверены, что хотите удалить {{count}} предмет(ов)?",
        "zh": "确定要删除 {{count}} 件物品吗？",
        "ja": "{{count}} 件のアイテムを削除してもよろしいですか？",
        "hi": "क्या आप वाकई {{count}} आइटम हटाना चाहते हैं?"
    },
    "closet.batchDeleteFailed": {
        "en": "Some items could not be deleted. Please try again.",
        "de": "Einige Artikel konnten nicht gelöscht werden. Bitte erneut versuchen.",
        "he": "לא ניתן היה למחוק חלק מהפריטים. אנא נסה שוב.",
        "ar": "تعذر حذف بعض العناصر. يرجى المحاولة مرة أخرى.",
        "es": "No se pudieron eliminar algunas prendas. Inténtalo de nuevo.",
        "fr": "Certains vêtements n'ont pas pu être supprimés. Veuillez réessayer.",
        "it": "Alcuni capi non sono stati eliminati. Riprova.",
        "nl": "Sommige kledingstukken konden niet worden verwijderd. Probeer het opnieuw.",
        "pt": "Alguns itens não puderam ser excluídos. Tente novamente.",
        "ru": "Некоторые предметы не удалось удалить. Попробуйте снова.",
        "zh": "部分物品无法删除，请重试。",
        "ja": "一部のアイテムを削除できませんでした。もう一度お試しください。",
        "hi": "कुछ वस्त्र हटाए नहीं जा सके। कृपया पुनः प्रयास करें।"
    },
    "closet.anchorItems": {
        "en": "Selected Anchor Pieces",
        "de": "Ausgewählte Basisstücke",
        "he": "פריטי בסיס נבחרים",
        "ar": "قطع الأساس المختارة",
        "es": "Prendas base seleccionadas",
        "fr": "Pièces maîtresses sélectionnées",
        "it": "Capi base selezionati",
        "nl": "Geselecteerde basisstukken",
        "pt": "Peças base selecionadas",
        "ru": "Выбранные базовые вещи",
        "zh": "已选基础单品",
        "ja": "選択されたベースアイテム",
        "hi": "चयनित मुख्य वस्त्र"
    },
    "addItem.colors": {
        "en": "Colors & Distribution",
        "de": "Farben & Verteilung",
        "he": "צבעים והתפלגות",
        "ar": "الألوان والتوزيع",
        "es": "Colores y distribución",
        "fr": "Couleurs et répartition",
        "it": "Colori e distribuzione",
        "nl": "Kleuren en verdeling",
        "pt": "Cores e distribuição",
        "ru": "Цвета и пропорции",
        "zh": "颜色及比例",
        "ja": "カラーと配分",
        "hi": "रंग और वितरण"
    },
    "addItem.colorPlaceholder": {
        "en": "e.g. Black",
        "de": "z.B. Schwarz",
        "he": "לדוגמה: שחור",
        "ar": "مثال: أسود",
        "es": "ej. Negro",
        "fr": "ex. Noir",
        "it": "es. Nero",
        "nl": "bijv. Zwart",
        "pt": "ex. Preto",
        "ru": "например, Чёрный",
        "zh": "例如：黑色",
        "ja": "例：ブラック",
        "hi": "उदा. काला"
    },
    "addItem.sections.style": {
        "en": "Style & Occasion",
        "de": "Stil & Anlass",
        "he": "סגנון ואירוע",
        "ar": "الأسلوب والمناسبة",
        "es": "Estilo y ocasión",
        "fr": "Style et occasion",
        "it": "Stile e occasione",
        "nl": "Stijl en gelegenheid",
        "pt": "Estilo e ocasião",
        "ru": "Стиль и повод",
        "zh": "风格与场合",
        "ja": "スタイルと着用シーン",
        "hi": "शैली और अवसर"
    },
    "addItem.sections.fabric": {
        "en": "Fabric & Composition",
        "de": "Stoff & Zusammensetzung",
        "he": "בד והרכב חומרים",
        "ar": "القماش والتركيب",
        "es": "Tejido y composición",
        "fr": "Tissu et composition",
        "it": "Tessuto e composizione",
        "nl": "Stof en samenstelling",
        "pt": "Tecido e composição",
        "ru": "Ткань и состав",
        "zh": "面料与成分",
        "ja": "生地と構成比",
        "hi": "कपड़ा और संरचना"
    },
    "addItem.sections.market": {
        "en": "Wardrobe Intent & Pricing",
        "de": "Verwendungsabsicht & Preisgestaltung",
        "he": "כוונת שימוש ותמחור",
        "ar": "الغرض والتسعير",
        "es": "Intención de uso y precio",
        "fr": "Intention et tarification",
        "it": "Uso previsto e prezzo",
        "nl": "Gebruiksdoel en prijs",
        "pt": "Intenção e preço",
        "ru": "Намерение и стоимость",
        "zh": "衣橱用途与定价",
        "ja": "用途と価格設定",
        "hi": "उपयोग का इरादा और मूल्य निर्धारण"
    },
    "addItem.noReadyCards": {
        "en": "No completed cards to save.",
        "de": "Keine fertigen Karten zum Speichern vorhanden.",
        "he": "אין כרטיסים מוכנים לשמירה.",
        "ar": "لا توجد بطاقات جاهزة للحفظ.",
        "es": "No hay tarjetas listas para guardar.",
        "fr": "Aucune carte prête à être enregistrée.",
        "it": "Nessuna scheda pronta da salvare.",
        "nl": "Geen voltooide kaarten om op te slaan.",
        "pt": "Nenhum cartão pronto para salvar.",
        "ru": "Нет готовых карточек для сохранения.",
        "zh": "没有可保存的已完成卡片。",
        "ja": "保存可能な完了カードがありません。",
        "hi": "सहेजने के लिए कोई तैयार कार्ड नहीं है।"
    },
    "itemDetail.tabDetails": {
        "en": "Details",
        "de": "Details",
        "he": "פרטים",
        "ar": "التفاصيل",
        "es": "Detalles",
        "fr": "Détails",
        "it": "Dettagli",
        "nl": "Details",
        "pt": "Detalhes",
        "ru": "Детали",
        "zh": "详细信息",
        "ja": "詳細",
        "hi": "विवरण"
    },
    "itemDetail.tabAI": {
        "en": "AI Insights",
        "de": "KI-Erkenntnisse",
        "he": "תובנות AI",
        "ar": "رؤى الذكاء الاصطناعي",
        "es": "Análisis IA",
        "fr": "Analyses IA",
        "it": "Analisi IA",
        "nl": "AI-inzichten",
        "pt": "Insights de IA",
        "ru": "ИИ-аналитика",
        "zh": "AI 洞察",
        "ja": "AIインサイト",
        "hi": "एआई अंतर्दृष्टि"
    },
    "itemDetail.tabPairings": {
        "en": "Pairings",
        "de": "Kombinationen",
        "he": "שילובים",
        "ar": "التنسيقات",
        "es": "Combinaciones",
        "fr": "Associations",
        "it": "Abbinamenti",
        "nl": "Combinaties",
        "pt": "Combinações",
        "ru": "Сочетания",
        "zh": "搭配推荐",
        "ja": "着回し提案",
        "hi": "संयोजन"
    },
    "itemDetail.tabDPP": {
        "en": "Passport",
        "de": "Produktpass",
        "he": "דרכון מוצר",
        "ar": "جواز المنتج",
        "es": "Pasaporte",
        "fr": "Passeport",
        "it": "Passaporto",
        "nl": "Paspoort",
        "pt": "Passaporte",
        "ru": "Паспорт",
        "zh": "数字护照",
        "ja": "パスポート",
        "hi": "उत्पाद पासपोर्ट"
    },
    "itemDetail.suggestionsApplied": {
        "en": "AI suggestions applied to form.",
        "de": "KI-Vorschläge auf das Formular angewendet.",
        "he": "הצעות ה-AI הוחלו על הטופס.",
        "ar": "تم تطبيق اقتراحات الذكاء الاصطناعي على النموذج.",
        "es": "Sugerencias de IA aplicadas al formulario.",
        "fr": "Suggestions de l'IA appliquées au formulaire.",
        "it": "Suggerimenti IA applicati al modulo.",
        "nl": "AI-suggesties toegepast op het formulier.",
        "pt": "Sugestões de IA aplicadas ao formulário.",
        "ru": "Предложения ИИ применены к форме.",
        "zh": "已应用 AI 建议至表单。",
        "ja": "AIの提案がフォームに適用されました。",
        "hi": "एआई सुझाव फॉर्म पर लागू किए गए।"
    },
    "itemDetail.original": {
        "en": "Original",
        "de": "Original",
        "he": "מקורי",
        "ar": "الأصل",
        "es": "Original",
        "fr": "Original",
        "it": "Originale",
        "nl": "Origineel",
        "pt": "Original",
        "ru": "Оригинал",
        "zh": "原始图",
        "ja": "オリジナル",
        "hi": "मूल"
    },
    "common.name": {
        "en": "Name",
        "de": "Name",
        "he": "שם",
        "ar": "الاسم",
        "es": "Nombre",
        "fr": "Nom",
        "it": "Nome",
        "nl": "Naam",
        "pt": "Nome",
        "ru": "Имя",
        "zh": "名称",
        "ja": "名前",
        "hi": "नाम"
    },
    "common.import": {
        "en": "Import",
        "de": "Importieren",
        "he": "ייבוא",
        "ar": "استيراد",
        "es": "Importar",
        "fr": "Importer",
        "it": "Importa",
        "nl": "Importeren",
        "pt": "Importar",
        "ru": "Импорт",
        "zh": "导入",
        "ja": "インポート",
        "hi": "आयात"
    },
    "common.ok": {
        "en": "OK",
        "de": "OK",
        "he": "אישור",
        "ar": "موافق",
        "es": "Aceptar",
        "fr": "OK",
        "it": "OK",
        "nl": "OK",
        "pt": "OK",
        "ru": "ОК",
        "zh": "好的",
        "ja": "OK",
        "hi": "ठीक है"
    }
}

target_dirs = [
    r"C:\DressApp_AG\packages\i18n\locales",
    r"C:\DressApp_AG\apps\web\src\locales"
]

def set_nested(data, key, value):
    parts = key.split(".")
    curr = data
    for i, p in enumerate(parts[:-1]):
        if p not in curr or not isinstance(curr[p], dict):
            curr[p] = {}
        curr = curr[p]
    curr[parts[-1]] = value

for d in target_dirs:
    if not os.path.exists(d):
        continue
    for loc in locales:
        file_path = os.path.join(d, f"{loc}.json")
        if not os.path.exists(file_path):
            continue
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        for key, trans_map in translations.items():
            val = trans_map.get(loc, trans_map["en"])
            set_nested(data, key, val)
        
        with open(file_path, "w", encoding="utf-8", newline="\r\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

print("Successfully injected translations across all 13 languages.")
