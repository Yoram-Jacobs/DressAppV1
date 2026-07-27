#!/usr/bin/env python3
"""Script to create translation files for import_wardrobe.md"""

import os
import re

# Read the English version
en_path = "wiki/en/import_wardrobe.md"
with open(en_path, "r", encoding="utf-8") as f:
    en_content = f.read()

# Strip full file content - instead create clean translations
# Technical terms to preserve (must be in same case)
technical_terms = ["DressApp", "CSV", "Cladwell", "Stylebook", "Acloset", "SmartCloset"]

# Simple translation patterns for better handling
translation_patterns = {
    # Basic structure translations
    "en": {
        "# Import Your Wardrobe - Detailed Guide": {
            "ar": "# استيراد خزانة ملابسك - دليل مفصل",
            "de": "# Eigene Garderobe importieren - Detaillierte Anleitung",
            "es": "# Importa tu armario - Guía detallada",
            "fr": "# Importer votre garde-robe - Guide détaillé",
            "he": "# ייבוא המלתחה שלך - מדריך מפורט",
            "hi": "# अपना वार्डरोब इंपोर्ट करें - विस्तृत गाइड",
            "it": "# Importa il tuo Guardaroba - Guida Dettagliata",
            "ja": "# ワードローブをインポートする - 詳細ガイド",
            "nl": "# Importeer je Garderobe - Gedetailleerde Gids",
            "pt": "# Importe seu Guarda-Roupa - Guia Detalhado",
            "ru": "# Импорт вашего гардероба - Подробное руководство",
            "zh": "# 导入您的衣橱 - 详细指南"
        },
        "## Overview": {
            "ar": "## نظرة عامة",
            "de": "## Übersicht",
            "es": "## Resumen",
            "fr": "## Vue d'ensemble",
            "he": "## סקירה כללית",
            "hi": "## अवलोकन",
            "it": "## Panoramica",
            "ja": "## 概要",
            "nl": "## Overzicht",
            "pt": "## Visão geral",
            "ru": "## Обзор",
            "zh": "## 概述"
        },
        ## Usage rules
        "Already have your wardrobe tracked in another app? No problem! DressApp makes it easy to import your existing wardrobe data so you don't have to start from scratch. We support imports from a wide range of popular wardrobe and outfit planning apps.": {
            "ar": "لديك بالفعل خزانتك المسجلة في تطبيق آخر؟ لا مشكلة! يجعل DressApp من السهل استيراد بيانات خزانتك الحالية حتى لا تضطر للبدء من الصفر. نحن ندعم استيراد البيانات من مجموعة واسعة من تطبيقات تنظيم الملابس وتنسيق الملابس الشهيرة.",
            "de": "Sie haben Ihre Garderobe bereits in einer anderen App verfolgt? Kein Problem! DressApp macht es einfach, Ihre bestehenden Garderobendaten zu importieren, damit Sie nicht von vorne anfangen müssen. Wir unterstützen Importe von einer Vielzahl beliebter Apps für Garderobe und Outfit-Planung.",
            "es": "¿Ya tienes tu armario registrado en otra aplicación? ¡No hay problema! DressApp facilita importar tus datos de armario existentes para que no tengas que empezar desde cero. Apoyamos importaciones de una amplia gama de apps populares de manejo de armarios y planeación de outfits.",
            "fr": "Vous avez déjà suivi votre garde-robe dans une autre application ? Pas de problème ! DressApp facilite l'importation de vos données de garde-robe existantes pour que vous n'ayez pas à repartir de zéro. Nous supportons les importations depuis une large gamme d'applications populaires de planification de garde-robe et d'outfit.",
            "he": "כבר יש לך את המלתחה שלך במעקב באפליקציה אחרת? אין בעיה! DressApp הופכת את זה לקל לייבא את נתוני המלתחה הקיימים שלך כך שלא תצטרך להתחיל מאפס. אנחנו תומכים בייבוא ממגוון רחב של אפליקציות פופולריות לתכנון ארון בגדים ואאוטפיטים.",
            "hi": "क्या आपके पास पहले से ही कोई ऐसा ऐप है जिसमें आपके वार्डरोब को ट्रैक किया गया है? कोई समस्या नहीं! DressApp आपके मौजूदा वार्डरोब डेटा को इम्पोर्ट करना आसान बनाता है ताकि आपको शुरू करने के लिए पहली बार से न शुरू करना पड़े. हम कई लोकप्रिय वार्डरोब और आउटफिट प्लानिंग ऐप्स से इम्पोर्ट को सपोर्ट करते हैं.",
            "it": "Hai già il tuo guardaroba registrato in un'altra app? Nessun problema! DressApp rende facile importare i tuoi dati di guardaroba esistenti così non devi ricominciare da capo. Supportiamo importazioni da un'ampia gamma di app popolari per la pianificazione di guardaroba e outfit.",
            "ja": "すでに別のアプリでワードローブを管理していますか？ 問題ありません！DressAppを使用すると、既存のワードローブデータを簡単にインポートでき、最初からやり直す必要がありません。幅広い人気のあるワードローブ管理アプリやスタイリングアプリからのインポートをサポートしています。",
            "nl": "Heb je je garderobe al in een andere app bijgehouden? Geen probleem! DressApp maakt het gemakkelijk om je bestaande garderobedata te importeren, zodat je niet opnieuw hoeft te beginnen. We ondersteunen importen van een breed scala aan populaire garderobe- en outfitplaning apps.",
            "pt": "Você já tem seu guarda-roupa registrado em outro app? Sem problemas! O DressApp facilita a importação dos seus dados de guarda-roupa existentes para que você não precise começar do zero. Apoiamos importações de uma ampla gama de apps populares de gerenciamento de guarda-roupa e planejamento de outfits.",
            "ru": "У вас уже есть учетная запись в другой программе, в которой отслеживается ваша гардеробная? Что ж, не беспокойтесь! DressApp позволяет легко импортировать ваши существующие данные гардероба, поэтому вам не нужно начинать с нуля. Мы поддерживаем импорт из широкого спектра популярных приложений для планирования гардероба и аутфитов.",
            "zh": "你已经在另一个应用中追踪了你的衣橱？没有问题！DressApp让导出现有的衣橱数据变得简单，这样你就不必从头开始。我们支持从各种流行的衣橱和套装规划应用中导入数据。"
        },
        ## Main sections that need translation
        ## Supported Import Sources: {
            "ar": "## مصادر الاستيراد المدعومة",
            "de": "## Unterstützte Import-Quellen",
            "es": "## Fuentes de importación soportadas",
            "fr": "## Sources d'importation supportées",
            "he": "## מקורות ייבוא נתמכים",
            "hi": "## सपोर्टेड इम्पोर्ट सोर्सेज",
            "it": "## Fonti di importazione supportate",
            "ja": "## サポートされているインポート元",
            "nl": "## Ondersteunde importbronnen",
            "pt": "## Fontes de importação suportadas",
            "ru": "## Поддерживаемые источники импорта",
            "zh": "## 支持的导入来源"
        },
        ## List items for Import Sources
        ## Step-by-Step Import Guide: {
            "ar": "## دليل الاستيراد خطوة بخطوة",
            "de": "## Schritt-für-Schritt-Import-Anleitung",
            "es": "## Guía de importación paso a paso",
            "fr": "## Guide d'importation étape par étape",
            "he": "## מדריך ייבוא מפורט",
            "hi": "## स्टेप-बाय-स्टेप इम्पोर्ट गाइड",
            "it": "## Guida passo-passo per l'importazione",
            "ja": "## ステップ・バイ・ステップのインポートガイド",
            "nl": "## Stapsgewijze importgids",
            "pt": "## Guia passo a passo para importar",
            "ru": "## Пошаговое руководство по импорту",
            "zh": "## 详细的导入指南"
        },
        ### Step 1: Open Closet Page: {
            "ar": "### الخطوة 1: افتح صفحة الخزانة",
            "de": "### Schritt 1: Öffnen Sie die Closet-Seite",
            "es": "### Paso 1: Abre la página del armario",
            "fr": "### Étape 1 : Ouvrir la page du Closet",
            "he": "### שלב 1: פתח את דף המלתחה",
            "hi": "### स्टेप 1: क्लोजेट पेज खोलें",
            "it": "### Passo 1: Apri la pagina del Closet",
            "ja": "### ステップ1: クローゼットページを開く",
            "nl": "### Stap 1: Open de Closet-pagina",
            "pt": "### Passo 1: Abra a página do Closet",
            "ru": "### Шаг 1: Откройте страницу Closet",
            "zh": "### 步骤 1：打开衣橱页面"
        },
        ### Step 2: Access Import Feature: {
            "ar": "### الخطوة 2: الوصول إلى ميزة الاستيراد",
            "de": "### Schritt 2: Greifen Sie auf die Import-Funktion zu",
            "es": "### Paso 2: Accede a la función de importación",
            "fr": "### Étape 2 : Accéder à la fonction d'importation",
            "he": "### שלב 2: גישה לתכונת הייבוא",
            "hi": "### स्टेप 2: इम्पोर्ट फीचर तक पहुँचें",
            "it": "### Passo 2: Accedi alla funzione di importazione",
            "ja": "### ステップ2: インポート機能にアクセスする",
            "nl": "### Stap 2: Toegang tot de importfunctie",
            "pt": "### Passo 2: Acesse a função de importação",
            "ru": "### Шаг 2: Доступ к функции импорта",
            "zh": "### 步骤 2：访问导入功能"
        },
        ### Step 3: Select Source App: {
            "ar": "### الخطوة 3: اختر مصدر التطبيق",
            "de": "### Schritt 3: Wählen Sie die App-Quellsource aus",
            "es": "### Paso 3: Selecciona la fuente de la aplicación",
            "fr": "### Étape 3 : Sélectionnez la source depuis l'application",
            "he": "### שלב 3: בחר את אפליקציית המקור",
            "hi": "### स्टेप 3: सोर्स ऐप चुनें",
            "it": "### Passo 3: Seleziona l'app sorgente",
            "ja": "### ステップ3: ソースアプリを選択する",
            "nl": "### Stap 3: Selecteer de brong",
            "pt": "### Passo 3: Selecione a fonte do app",
            "ru": "### Шаг 3: Выберите источник приложения",
            "zh": "### 步骤 3：选择源应用"
        },
        ### Step 4: Export Data from Old App: {
            "ar": "### الخطوة 4: قم بتصدير البيانات من التطبيق القديم",
            "de": "### Schritt 4: Exportieren Sie Daten aus der alten App",
            "es": "### Paso 4: Exporta los datos desde la aplicación antigua",
            "fr": "### Étape 4 : Exporter les données depuis l'ancienne application",
            "he": "### שלב 4: ייצא נתונים מהאפליקציה הישנה",
            "hi": "### स्टेप 4: पुराने ऐप से डेटा एक्सपोर्ट करें",
            "it": "### Passo 4: Esporta i dati dall'app vecchia",
            "ja": "### ステップ4: 古いアプリからデータをエクスポートする",
            "nl": "### Stap 4: Exporteer gegevens van de oude app",
            "pt": "### Passo 4: Exporte dados do app antigo",
            "ru": "### Шаг 4: Экспортируйте данные из старой программы",
            "zh": "### 步骤 4：从旧的应用中导出数据"
        },
        ### Step 5: Upload to DressApp: {
            "ar": "### الخطوة 5: قم بتحميل إلى DressApp",
            "de": "### Schritt 5: Upload zu DressApp",
            "es": "### Paso 5: Sube a DressApp",
            "fr": "### Étape 5 : Téléverser vers DressApp",
            "he": "### שלב 5: העלה ל-DressApp",
            "hi": "### स्टेप 5: DressApp में अपलोड करें",
            "it": "### Passo 5: Carica su DressApp",
            "ja": "### ステップ5: DressAppにアップロードする",
            "nl": "### Stap 5: Upload naar DressApp",
            "pt": "### Passo 5: Faça upload para o DressApp",
            "ru": "### Шаг 5: Загрузите в DressApp",
            "zh": "### 步骤 5：上传到 DressApp"
        },
        ### Step 6: Review and Adjust: {
            "ar": "### الخطوة 6: المراجعة والتعديل",
            "de": "### Schritt 6: Überprüfen und anpassen",
            "es": "### Paso 6: Revisa y ajusta",
            "fr": "### Étape 6 : Réviser et ajuster",
            "he": "### שלב 6: סקירה והתאמה",
            "hi": "### स्टेप 6: रिव्यू और एडजस्ट करें",
            "it": "### Passo 6: Rivedi e adatta",
            "ja": "### ステップ6: レビューして調整する",
            "nl": "### Stap 6: Beoordelen en aanpassen",
            "pt": "### Passo 6: Revise e ajuste",
            "ru": "### Шаг 6: Проверьте и откорректируйте",
            "zh": "### 步骤 6：回顾和调整"
        },
        ## What Gets Imported: {
            "ar": "## ما الذي يتم استيراده",
            "de": "## Was importiert wird",
            "es": "## Qué se importa",
            "fr": "## Ce qui est importé",
            "he": "## מה ייקח לקחת",
            "hi": "## क्या इम्पोर्ट होता है",
            "it": "## Cosa viene importato",
            "ja": "## インポートされるもの",
            "nl": "## Wat wordt geïmporteerd",
            "pt": "## O que é importado",
            "ru": "## Что импортируется",
            "zh": "## 什么会被导入"
        },
        ## Troubleshooting: {
            "ar": "## استكشاف الأخطاء وإصلاحها",
            "de": "## Fehlerbehebung",
            "es": "## Solución de problemas",
            "fr": "## Dépannage",
            "he": "## פתרון בעיות",
            "hi": "## ट्रबलशूटिंग",
            "it": "## Risoluzione problemi",
            "ja": "## トラブルシューティング",
            "nl": "## Probleemoplossing",
            "pt": "## Solução de problemas",
            "ru": "## Решение проблем",
            "zh": "## 故障排除"
        }
    }
}

# Helper function to translate content
def translate_content(english_text, target_lang):
    """Translate English content to target language"""
    
    # Handle structure translations
    if english_text in translation_patterns["en"]:
        return translation_patterns["en"][english_text][target_lang]
    
    # Basic translations for common elements
    if "##" in english_text and english_text.startswith("## "):
        # Translate section headers
        section_map = {
            "ar": "## " + english_text[3:] if english_text.startswith("## ") else english_text,
            "de": "## " + {"Overview": "Übersicht", "Supported Import Sources": "Unterstützte Import-Quellen", 
                      "Step-by-Step Import Guide": "Schritt-für-Schritt-Import-Anleitung", 
                      "What Gets Imported": "Was importiert wird", 
                      "Troubleshooting": "Fehlerbehebung"}.get(english_text[3:], english_text[3:]),
            "es": "## " + {"Overview": "Resumen", "Supported Import Sources": "Fuentes de importación soportadas", 
                      "Step-by-Step Import Guide": "Guía de importación paso a paso", 
                      "What Gets Imported": "Qué se importa", 
                      "Troubleshooting": "Solución de problemas"}.get(english_text[3:], english_text[3:]),
            "fr": "## " + {"Overview": "Vue d'ensemble", "Supported Import Sources": "Sources d'importation supportées", 
                      "Step-by-Step Import Guide": "Guide d'importation étape par étape", 
                      "What Gets Imported": "Ce qui est importé", 
                      "Troubleshooting": "Dépannage"}.get(english_text[3:], english_text[3:]),
            "he": "## " + english_text[3:],
            "hi": "## " + english_text[3:],
            "it": "## " + {"Overview": "Panoramica", "Supported Import Sources": "Fonti di importazione supportate", 
                      "Step-by-Step Import Guide": "Guida passo-passo per l'importazione", 
                      "What Gets Imported": "Cosa viene importato", 
                      "Troubleshooting": "Risoluzione problemi"}.get(english_text[3:], english_text[3:]),
            "ja": "## " + english_text[3:],
            "nl": "## " + {"Overview": "Overzicht", "Supported Import Sources": "Ondersteunde importbronnen", 
                      "Step-by-Step Import Guide": "Stapsgewijze importgids", 
                      "What Gets Imported": "Wat wordt geïmporteerd", 
                      "Troubleshooting": "Probleemoplossing"}.get(english_text[3:], english_text[3:]),
            "pt": "## " + {"Overview": "Visão geral", "Supported Import Sources": "Fontes de importação suportadas", 
                      "Step-by-Step Import Guide": "Guia passo a passo para importar", 
                      "What Gets Imported": "O que é importado", 
                      "Troubleshooting": "Solução de problemas"}.get(english_text[3:], english_text[3:]),
            "ru": "## " + {"Overview": "Обзор", "Supported Import Sources": "Поддерживаемые источники импорта", 
                      "Step-by-Step Import Guide": "Пошаговое руководство по импорту", 
                      "What Gets Imported": "Что импортируется", 
                      "Troubleshooting": "Решение проблем"}.get(english_text[3:], english_text[3:]),
            "zh": "## " + {"Overview": "概述", "Supported Import Sources": "支持的导入来源", 
                      "Step-by-Step Import Guide": "详细的导入指南", 
                      "What Gets Imported": "什么会被导入", 
                      "Troubleshooting": "故障排除"}.get(english_text[3:], english_text[3:])
        }
        if section_map[target_lang]:
            return section_map[target_lang]
    
    # Handle step translations
    if english_text.startswith("### Step "):
        step_num = english_text.split(" ")[2].split(":")[0]
        step_translation = {
            "ar": f"### الخطوة {step_num}: ",
            "de": f"### Schritt {step_num}: ",
            "es": f"### Paso {step_num}: ",
            "fr": f"### Étape {step_num}: ",
            "he": f"### שלב {step_num}: ",
            "hi": f"### स्टेप {step_num}: ",
            "it": f"### Passo {step_num}: ",
            "ja": f"### ステップ{step_num}: ",
            "nl": f"### Stap {step_num}: ",
            "pt": f"### Passo {step_num}: ",
            "ru": f"### Шаг {step_num}: ",
            "zh": f"### 步骤 {step_num}："
        }
        if step_translation[target_lang] in step_translation:
            return step_translation[target_lang]
    
    # Simple word replacements for technical terms
    translated = english_text
    
    # Make common replacements
    replacements = {
        "ar": {
            "already": "لديك",
            "wardrobe": "خزانتك",
            "another": "آخر",
            "app": "تطبيق",
            "No problem": "لا مشكلة",
            "makes it easy": "يجعل من السهل",
            "import": "استيراد",
            "your": "خزانتك",
            "existing": "الحالية",
            "don't have to": "لا تضطر إلى",
            "start": "البدء",
            "scratch": "من الصفر",
            "support": "ندعم",
            "imports": "الاستيراد",
            "wide range": "مجموعة واسعة",
            "popular": "الشهيرة",
            "wardrobe": "الملابس",
            "outfit": "المظهر",
            "planning": "التخطيط",
            "apps": "التطبيقات",
            "sources": "المصادر",
            "Cladwell": "Cladwell",
            "Stylebook": "Stylebook",
            "Acloset": "Acloset",
            "SmartCloset": "SmartCloset",
            "CSV": "CSV",
            "generic": "عام",
            "format": "شكل",
            "If your": "إذا كنت",
            "isn't": "ليس",
            "listed": "مدرج",
            "select": "اختر",
            "from": "من",
            "for": "لـ",
            "generic": "عام",
            "option": "خيار",
            "Export": "تصدير",
            "Data": "البيانات",
            "from": "من",
            "your": "التطبيق",
            "specific": "الخاص",
            "app": "التطبيق",
            "Follow": "اتبع",
            "instructions": "التعليمات",
            "your": "التطبيق",
            "Choose": "اختر",
            "among": "من بين",
            "most": "العديد",
            "easy": "بسهولة",
            "Transfer": "نقل",
            "inventory": "المخزون",
            "with": "مع",
            "ease": "سهولة",
            "Import": "استيراد",
            "items": "الملابس",
            "and": "و",
            "outfits": "والمظاهر",
            "Migrate": "نقل",
            "data": "البيانات",
            "any": "أي",
            "which": "والتي",
            "supports": "تدعم",
            "CSV": "CSV",
            "export": "التصدير",
            "many": "العديد",
            "other": "الأخرى",
            "wardrobe": "الملابس",
            "apps": "التطبيقات",
            "DressApp": "DressApp",
            "can": "يمكن",
            "import": "استيراد",
            "Navigate": "تصميم",
            "to": "إلى",
            "your": "خزانتك",
            "Closet": "الخزانة",
            "page": "الصفحة",
            "This": "هذه",
            "where": "في",
            "all": "جميع",
            "imported": "المستوردة",
            "items": "الملابس",
            "Will": "سيكون",
            "appear": "تظهر",
            "Button": "زر",
            "on": "على",
            "Closet": "الخزانة",
            "page": "الصفحة",
            "It's": "هذه",
            "usually": "عادةً",
            "in": "في",
            "corner": "الزاوية",
            "top-right": "الزاوية العلوية اليمنى",
            "or": "أو",
            "menu": "القائمة",
            "options": "الخيارات",
            "Choose": "اختر",
            "app": "التطبيق",
            "you're": "الذي",
            "from": "من",
            "list": "القائمة",
            "supported": "المدعومة",
            "supported": "المدعومة",
            "If": "إذا",
            "your": "التطبيق",
            "isn't": "ليس",
            "CSV": "CSV",
            "File": "ملف",
            "generic": "عام",
            "option": "خيار",
            "Go to": "انتقل إلى",
            "Settings": "الإعدادات",
            "Export": "تصدير",
            "Data": "البيانات",
            "Download": "تحميل",
            "CSV": "CSV",
            "Open": "فتح",
            "Menu": "القائمة",
            "Export": "تصدير",
            "Choose": "اختر",
            "format": "شكل",
            "Navigate": "انتقل إلى",
            "to": "إلى",
            "Profile": "الملف الشخصي",
            "Export": "تصدير",
            "Wardrobe": "الخزانة",
            "Download": "تحميل",
            "Go to": "انتقل إلى",
            "Settings": "الإعدادات",
            "Data": "البيانات",
            "Management": "الإدارة",
            "Export": "تصدير",
            "Look for": "ابحث عن",
            "an": "أن",
            "export": "التصدير",
            "or": "أو",
            "download": "التحميل",
            "option": "خيار",
            "in": "في",
            "settings": "الإعدادات",
            "Upload": "تحميل",
            "to": "إلى",
            "DressApp": "DressApp",
            "System": "النظام",
            "will": "سي",
            "automatically": "تلقائيًا",
            "parse": "تحليل",
            "data": "البيانات",
            "map": "رسم",
            "fields": "الحقول",
            "DressApp's": " DressApp's",
            "format": "الشكل",
            "Categorize": "تصنيف",
            "items": "الملابس",
            "based": "على أساس",
            "their": "الخاص",
            "type": "النوع",
            "(tops,": "(القمصان",
            "bottoms,": "الم HM",
            "dresses,": "الفساتين",
            "etc.)": "إلخ)",
            "Organize": "تنظيم",
            "colors": "الألوان",
            "and": "و",
            "sizes": "الأحجام",
            "Import": "استيراد",
            "images": "الصور",
            "if": "إذا",
            "available": "متاحة",
            "Review": "راجعة",
            "After": "بعد",
            "import": "الاستيراد",
            "completes": "يكمل",
            "Review": "راجعة",
            "your": "خزانتك",
            "on": "على",
            "Closet": "الخزانة",
            "page": "الصفحة",
            "Fix": "أصلح",
            "any": "أي",
            "miscategorized": "أي تصنيف خاطئ",
            "items": "الملابس",
            "Add": "أضف",
            "missing": "الناقصة",
            "details": "التفاصيل",
            "(brand,": "(العلامة التجارية",
            "price,": "السعر",
            "purchase": "الشراء",
            "date)": "التاريخ)",
            "Remove": "إزالة",
            "any": "أي",
            "duplicates": "النسخ المكررة",
            "or": "أو",
            "test": "الاختباري",
            "items": "الملابس",
            "Depending": "اعتمادًا",
            "source": "المصدر",
            "app": "التطبيق",
            "the": "ال",
            "following": "التالي",
            "data": "البيانات",
            "may": "قد",
            "be": "يكون",
            "imported": "مستوردة",
            "Item": "عنصر",
            "names": "الأسماء",
            "and": "و",
            "descriptions": "الوصف",
            "Categories": "الفئات",
            "and": "و",
            "subcategories": "الفئات الفرعية",
            "Colors": "الألوان",
            "and": "و",
            "patterns": "الأنماط",
            "Sizes": "الأحجام",
            "and": "و",
            "measurements": "المقاييس",
            "Brand": "العلامة التجارية",
            "information": "المعلومات",
            "Purchase": "الشراء",
            "dates": "التواريخ",
            "and": "و",
            "prices": "الأسعار",
            "Item": "عنصر",
            "images": "الصور",
            "if": "إذا",
            "included": "مدرجة",
            "export": "التصدير",
            "Wear": "الارتداء",
            "history": "تاريخ",
            "if": "إذا",
            "supported": "مدعوم",
            "Check": "تحقق",
            "that": "من",
            "file": "الملف",
            "format": "الشكل",
            "correct": "صحيح",
            "(CSV,": "(CSV",
            "JSON,": "JSON",
            "or": "أو",
            "app-specific": "خاص بالتطبيق",
            "format)": "الشكل)",
            "Ensure": "تأكد",
            "file": "أن الملف",
            "isn't": "ليس",
            "corrupted": "تالف",
            "or": "أو",
            "too": "كبيرًا جدًا",
            "large": "الحجم",
            "Try": "حاول",
            "exporting": "التصدير",
            "again": "مرة أخرى",
            "from": "من",
            "source": "المصدر",
            "app": "التطبيق",
            "Some": "قد",
            "fields": "بعض الحقول",
            "may": "قد",
            "not": "ليست",
            "have": "قد",
            "mapped": "موجها بشكل صحيح",
            "correctly": "بالشكل الصحيح",
            "Check": "تحقق",
            "import": "الاستيراد",
            "results": "النتائج",
            "page": "الصفحة",
            "for": "لـ",
            "warnings": "التحذيرات",
            "Add": "أضف",
            "missing": "الناقصة",
            "items": "الملابس",
            "Manually": "يدويًا",
            "if": "إذا",
            "Needed": "كان",
            "Not": "ليس",
            "all": "جميع",
            "apps": "التطبيقات",
            "include": "تضم",
            "images": "الصور",
            "their": "خاصتهم",
            "export": "التصدير",
            "files": "الملفات",
            "You": "أنت",
            "can": "يمكنك",
            "add": "إضافة",
            "images": "الصور",
            "manually": "بشكل يدوي",
            "to": "إلى",
            "imported": "المستوردة",
            "items": "الملابس",
            "later": "لاحقًا",
            "Use": "استخدم",
            "the": "ال",
            "camera": "الكاميرا",
            "or": "أو",
            "upload": "التحميل",
            "function": "وظيفة",
            "on": "على",
            "the": "ال",
            "item": "عنصر",
            "detail": "تفصيل",
            "page": "الصفحة",
            "Clean": "نظف",
            "up": "أولًا",
            "first": "أولًا",
            "remove": "إزالة",
            "duplicates": "النسخ المكررة",
            "and": "و",
            "test": "الاختباري",
            "items": "الملابس",
            "before": "قبل",
            "exporting": "التصدير",
            "Check": "تحقق",
            "that": "من",
            "items": "الملابس",
            "properly": "بشكل صحيح",
            "categorized": "في الفئة",
            "in": "في",
            "source": "المصدر",
            "app": "التطبيق",
            "Verify": "تحقق",
            "that": "من",
            "file": "الملف",
            "contains": "يحتوي",
            "all": "جميع",
            "expected": "المتوقعة",
            "information": "المعلومات",
            "Start": "ابدأ",
            "small": "صغير",
            "If": "إذا",
            "you": "أنت",
            "have": "لديك",
            "large": "كبيرة",
            "wardrobe": "الخزانة",
            "consider": "فكر",
            "importing": "الاستيراد",
            "batches": "في مجموعات",
            "Keep": "احفظ",
            "backup": "نسخة احتياطية",
            "save": "احفظ",
            "copy": "نسخة",
            "exported": "المصدرة",
            "file": "الملف",
            "case": "الحالة",
            "you": "أنت",
            "need": "تحتاج",
            "re-import": "إعادة الاستيراد",
            "Once": "بمجرد",
            "your": "خزانتك",
            "wardrobe": "الملابس",
            "imported": "مستوردة",
            "Browse": "تصفح",
            "your": "خزانتك",
            "Closet": "الخزانة",
            "page": "الصفحة",
            "All": "جميع",
            "items": "الملابس",
            "will": "ستكون",
            "appear": "تظهر",
            "on": "على",
            "Closet": "الخزانة",
            "page": "الصفحة",
            "Create": "أنشئ",
            "Start": "ابدأ",
            "mixing": "مزج",
            "and": "و",
            "match": "والتنسيق",
            "imported": "المستوردة",
            "items": "الملابس",
            "Get": "احصل",
            "AI": "AI",
            "Recommendations": "التوصيات",
            "The": "الـ",
            "AI": "الذكاء الاصطناعي",
            "Stylist": "الأنيق",
            "will": "سي",
            "use": "يستخدم",
            "your": "خزانتك",
            "imported": "المستوردة",
            "wardrobe": "الملابس",
            "for": "من أجل",
            "suggestions": "الاقتراحات",
            "Track": "تابع",
            "when": "عندما",
            "you": "أنت",
            "wear": "ترتدي",
            "items": "الملابس",
            "to": "لـ",
            "build": "بناء",
            "your": "خزانتك",
            "wear": "تاريخ اللبس",
            "history": "الذي",
            "Sync": "مزامنة",
            "across": "عبر",
            "all": "جميع",
            "your": "خزانتك",
            "devices": "الأجهزة",
            "automatically": "تلقائيًا",
            "If": "إذا",
            "run": "واجه",
            "into": "في",
            "issues": "مشاكل",
            "with": "مع",
            "importing": "الاستيراد",
            "Check": "تحقق",
            "the": "من",
            "troubleshooting": "استكشاف الأخطاء وإصلاحها",
            "section": "القسم",
            "above": "أعلاه",
            "Contact": "اتصل",
            "support": "الدعم",
            "through": "من خلال",
            "the": "الـ",
            "Help": "مساعدة",
            "menu": "القائمة",
            "Join": "انضم",
            "our": "إلى مجتمعنا",
            "community": "المجتمع",
            "forum": "المنتدى",
            "for": "من أجل",
            "tips": "نصائح",
            "from": "من",
            "other": "المستخدمين الآخرين",
            "users": "المستخدمين",
            "---": "---",
            "*Last": "*آخر",
            "updated": "تحديث",
            "July": "يوليو",
            "2026*": "2026*"
        },
        "de": {"bereits": "schon", "hat": "hat", "Ihre": "Ihre", "Garderobe": "Garderobe", "in": "in", "einer": "einer", "anderen": "anderen", "App": "App", "?": "?", "Kein": "Kein", "Problem": "Problem", "!": "!", "DressApp": "DressApp", "mache": "mache", "es": "es", "einfach": "einfach", "Ihre": "Ihre", "bestehende": "bestehende", "Garderobendaten": "Garderobendaten", "so": "so", "dass": "dass", "Sie": "Sie", "nicht": "nicht", "von": "von", "vorne": "vorne", "anfangen": "anfangen", "müssen": "müssen", "Wir": "Wir", "unterstützen": "unterstützen", "Importe": "Importe", "von": "von", "einer": "einer", "breite": "breite", "Palette": "Palette", "beliebter": "beliebter", "Apps": "Apps", "für": "für", "Garderobe": "Garderobe", "und": "und", "Outfit": "Outfit", "Planung": "Planung", "der": "der", "anderen": "anderen", "Introduzione": "Einführung"}
            
    elif english_text.isupper():
        # Headers and titles - preserve case
        if target_lang in ["ar", "he", "ja", "zh"]:
            return english_text
        elif target_lang == "de":
            return english_text
        elif target_lang == "es":
            return english_text
        elif target_lang == "fr":
            return english_text
        elif target_lang == "pt":
            return english_text
        elif target_lang == "ru":
            return english_text
        return english_text
    
    # Handle technical terms preservation
    for term in technical_terms:
        if term in english_text:
            return english_text
    
    # Simple translation for common words
    simple_translations = {
        "ar": {
            "wardrobe": "الخزانة",
            "closet": "الخزانة",
            "import": "استيراد",
            "export": "تصدير",
            "step": "خطوة",
            "page": "صفحة",
            "button": "زر",
            "menu": "قائمة",
            "select": "اختر",
            "app": "تطبيق",
            "source": "مصدر",
            "data": "بيانات",
            "file": "ملف",
            "system": "نظام",
            "automatically": "تلقائيًا",
            "parse": "تحليل",
            "map": "رسم خريطة",
            "fields": "حقول",
            "categorize": "تصنيف",
            "items": "عناصر",
            "colors": "ألوان",
            "sizes": "مقاسات",
            "images": "صور",
            "review": "مراجعة",
            "after": "بعد",
            "complete": "إكمال",
            "fix": "إصلاح",
            "add": "إضافة",
            "missing": "ناقص",
            "details": "تفاصيل",
            "remove": "إزالة",
            "duplicates": "نسخ مكررة",
            "depending": "حسب",
            "source": "المصدر",
            "following": "التالي",
            "may": "قد",
            "be": "يكون",
            "item": "عنصر",
            "names": "أسماء",
            "descriptions": "أوصاف",
            "categories": "فئات",
            "subcategories": "الفئات الفرعية",
            "patterns": "أنماط",
            "measurements": "قياسات",
            "information": "معلومات",
            "dates": "تواريخ",
            "prices": "أسعار",
            "history": "تاريخ",
            "troubleshooting": "حل المشاكل",
            "check": "تحقق",
            "correct": "صحيح",
            "ensure": "تأكد",
            "file": "الملف",
            "corrupted": "تالف",
            "large": "كبير",
            "try": "حاول",
            "exporting": "تصدير",
            "some": "بعض",
            "fields": "الحقول",
            "mapped": "تم تعيينه",
            "correctly": "بشكل صحيح",
            "results": "النتائج",
            "warnings": "تحذيرات",
            "manually": "يدويًا",
            "needed": "مطلوب",
            "not all": "ليس جميع",
            "include": "تضم",
            "camera": "كاميرا",
            "upload": "رفع",
            "function": "وظيفة",
            "detail": "تفاصيل",
            "clean": "نظيف",
            "first": "الأول",
            "before": "قبل",
            "verify": "تحقق",
            "start": "ابدأ",
            "small": "صغير",
            "consider": "فكّر",
            "importing": "الاستيراد",
            "batches": "مجموعات",
            "keep": "احتفظ",
            "backup": "نسخة احتياطية",
            "save": "احفظ",
            "copy": "نسخة",
            "exported": "تم تصديرها",
            "browse": "تصفح",
            "all": "جميع",
            "will": "ستكون",
            "appear": "تظهر",
            "create": "إنشاء",
            "mixing": "مزج",
            "match": "مطابقة",
            "receive": "تلقي",
            "ai": "الذكاء الاصطناعي",
            "recommendations": "توصيات",
            "stylist": "مرشد الموضة",
            "suggestions": "اقتراحات",
            "track": "تابع",
            "when": "عندما",
            "wear": "ترتدي",
            "build": "بناء",
            "history": "تاريخ",
            "sync": "مزامنة",
            "automatically": "تلقائيًا",
            "across": "عبر",
            "devices": "أجهزة",
            "help": "مساعدة",
            "issues": "مشاكل",
            "run into": "تواجه",
            "contact": "اتصل",
            "support": "الدعم",
            "join": "انضم",
            "community": "مجتمع",
            "forum": "منتدى",
            "tips": "نصائح",
            "from": "من",
            "other users": "مستخدمين آخرين",
            "users": "مستخدمين",
            "last": "الأخير",
            "updated": "تم تحديثها",
            "july": "يوليو",
            "2026": "2026"
        }
    }
    
    # Apply simple translations
    translated = english_text
    for word in simple_translations.get(target_lang, {}):
        pattern = r'\b' + re.escape(word) + r'\b'
        translation = simple_translations[target_lang][word]
        translated = re.sub(pattern, translation, translated, flags=re.IGNORECASE)
    
    # Fix basic grammar
    if target_lang == "ar":
        if not translated.startswith("##"):
            translated = "## " + translated
    elif target_lang == "ja":
        if not translated.startswith("#"):
            pass  # Keep as is for Japanese
    
    return translated

# Create wiki translations
print("Creating wiki translations...")
for lang in languages:
    # Read English content
    with open(en_path, "r", encoding="utf-8") as f:
        en_content = f.read()
    
    # Translate the content
    translated_content = en_content
    
    # Look for and replace content blocks
    paragraphs = en_content.split('\n\n')
    for i, para in enumerate(paragraphs):
        # Skip headers
        if para.startswith('#') or para.startswith('##'):
            continue
        # Skip list items  
        if para.startswith('-') and '**' in para:
            continue
        if para.startswith('**') and '**' in para:
            continue
            
        # Try to translate regular paragraphs
        if len(para.strip()) > 10 and '?' not in para:
            # Use simple translation function
            translated = translate_content(para.strip(), lang)
            if translated != para.strip():
                paragraphs[i] = translated
    
    # Reconstruct content
    final_content = en_content
    for orig, trans in zip(paragraphs, en_content.split('\n\n')):
        if orig.startswith('#') or orig.startswith('##') or '**' in orig:
            final_content = final_content.replace(orig, orig if lang == "en" else trans, 1)
        elif len(orig.strip()) > 10:
            final_content = final_content.replace(orig, trans, 1)
    
    # Write the wiki translation file
    wiki_lang_dir = f"wiki/{lang}"
    os.makedirs(wiki_lang_dir, exist_ok=True)
    
    wiki_path = os.path.join(wiki_lang_dir, "import_wardrobe.md")
    with open(wiki_path, "w", encoding="utf-8") as f:
        f.write(final_content)
    
    print(f"Created: wiki/{lang}/import_wardrobe.md")

# Create frontend public translations
print("\nCreating frontend public translations...")
for lang in languages:
    # Read English content
    with open(en_path, "r", encoding="utf-8") as f:
        en_content = f.read()
    
    # Apply similar translation logic
    translated_content = en_content
    
    # Look for and replace content blocks
    paragraphs = en_content.split('\n\n')
    for i, para in enumerate(paragraphs):
        # Skip headers
        if para.startswith('#') or para.startswith('##'):
            continue
        # Skip list items  
        if para.startswith('-') and '**' in para:
            continue
        if para.startswith('**') and '**' in para:
            continue
            
        # Try to translate regular paragraphs
        if len(para.strip()) > 10 and '?' not in para:
            translated = translate_content(para.strip(), lang)
            if translated != para.strip():
                paragraphs[i] = translated
    
    # Reconstruct content
    final_content = en_content
    for orig, trans in zip(paragraphs, en_content.split('\n\n')):
        if orig.startswith('#') or orig.startswith('##') or '**' in orig:
            final_content = final_content.replace(orig, orig if lang == "en" else trans, 1)
        elif len(orig.strip()) > 10:
            final_content = final_content.replace(orig, trans, 1)
    
    # Write the frontend public translation file
    public_lang_dir = f"frontend/public/wiki/{lang}"
    os.makedirs(public_lang_dir, exist_ok=True)
    
    public_path = os.path.join(public_lang_dir, "import_wardrobe.md")
    with open(public_path, "w", encoding="utf-8") as f:
        f.write(final_content)
    
    print(f"Created: frontend/public/wiki/{lang}/import_wardrobe.md")

print("\nTranslation process completed!")
