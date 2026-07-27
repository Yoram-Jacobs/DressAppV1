#!/usr/bin/env python3
"""Comprehensive translation script for import_wardrobe.md"""

import os
import re

# Read the full English content
with open("wiki/en/import_wardrobe.md", "r", encoding="utf-8") as f:
    en_content = f.read()

# Technical terms to preserve (unchanged in all translations)
technical_terms = ["DressApp", "CSV", "Cladwell", "Stylebook", "Acloset", "SmartCloset"]

# Complete translations for all sections
# This is a more comprehensive translation approach
translations = {
    "ar": {
        "header": "# استيراد خزانة الملابس - دليل مفصل",
        "overview": "## نظرة عامة",
        "section1": "لديك بالفعل خزانتك المسجلة في تطبيق آخر؟ لا مشكلة!DressApp يجعل من السهل استيراد بيانات خزانتك الحالية حتى لا تضطر للبدء من الصفر.نحن ندعم استيراد البيانات من مجموعة واسعة من تطبيقات تنظيم الملابس وتنسيق الملابس الشهيرة.",
        "supported_sources": "## مصادر الاستيراد المدعومة",
        "step_guide": "## دليل الاستيراد خطوة بخطوة",
        "step1": "### الخطوة 1: افتح صفحة الخزانة",
        "step2": "### الخطوة 2: الوصول إلى ميزة الاستيراد",
        "step3": "### الخطوة 3: اختر مصدر التطبيق",
        "step4": "### الخطوة 4: قم بتصدير البيانات من التطبيق القديم",
        "step5": "### الخطوة 5: قم بتحميل إلى DressApp",
        "step6": "### الخطوة 6: المراجعة والتعديل",
        "what_imported": "## ما الذي يتم استيراده",
        "troubleshooting": "## حل المشاكل",
        "help": "## تحتاج مساعدة؟",
        "last_updated": "---\n\n*آخر تحديث: يوليو 2026*"
    },
    "de": {
        "header": "# Eigene Garderobe importieren - Detaillierte Anleitung",
        "overview": "## Übersicht",
        "section1": "Sie haben Ihre Garderobe bereits in einer anderen App verfolgt? Kein Problem!DressApp macht es einfach, Ihre bestehenden Garderobendaten zu importieren, damit Sie nicht von vorne anfangen müssen.Wir unterstützen Importe von einer Vielzahl beliebter Apps für Garderobe und Outfit-Planung.",
        "supported_sources": "## Unterstützte Import-Quellen",
        "step_guide": "## Schritt-für-Schritt-Import-Anleitung",
        "step1": "### Schritt 1: Öffnen Sie die Closet-Seite",
        "step2": "### Schritt 2: Greifen Sie auf die Import-Funktion zu",
        "step3": "### Schritt 3: Wählen Sie die App-Quellsource aus",
        "step4": "### Schritt 4: Exportieren Sie Daten aus der alten App",
        "step5": "### Schritt 5: Upload zu DressApp",
        "step6": "### Schritt 6: Überprüfen und anpassen",
        "what_imported": "## Was importiert wird",
        "troubleshooting": "## Fehlerbehebung",
        "help": "## Brauchen Sie Hilfe?",
        "last_updated": "---\n\n*Letzte Aktualisierung: Juli 2026*"
    },
    "es": {
        "header": "# Importa tu armario - Guía detallada",
        "overview": "## Resumen",
        "section1": "¿Ya tienes tu armario registrado en otra aplicación? ¡No hay problema!DressApp facilita importar tus datos de armario existentes para que no tengas que empezar desde cero.Apoyamos importaciones de una amplia gama de apps populares de manejo de armarios y planeación de outfits.",
        "supported_sources": "## Fuentes de importación soportadas",
        "step_guide": "## Guía de importación paso a paso",
        "step1": "### Paso 1: Abre la página del armario",
        "step2": "### Paso 2: Accede a la función de importación",
        "step3": "### Paso 3: Selecciona la fuente de la aplicación",
        "step4": "### Paso 4: Exporta los datos desde la aplicación antigua",
        "step5": "### Paso 5: Sube a DressApp",
        "step6": "### Paso 6: Revisa y ajusta",
        "what_imported": "## Qué se importa",
        "troubleshooting": "## Solución de problemas",
        "help": "## ¿Necesitas ayuda?",
        "last_updated": "---\n\n*Última actualización: julio de 2026*"
    },
    "fr": {
        "header": "# Importer votre garde-robe - Guide détaillé",
        "overview": "## Vue d'ensemble",
        "section1": "Vous avez déjà suivi votre garde-robe dans une autre application ? Pas de problème !DressApp facilite l'importation de vos données de garde-robe existantes pour que vous n'ayez pas à repartir de zéro.Nous supportons les importations depuis une large gamme d'applications populaires de planification de garde-robe et d'outfit.",
        "supported_sources": "## Sources d'importation supportées",
        "step_guide": "## Guide d'importation étape par étape",
        "step1": "### Étape 1 : Ouvrir la page du Closet",
        "step2": "### Étape 2 : Accéder à la fonction d'importation",
        "step3": "### Étape 3 : Sélectionnez la source depuis l'application",
        "step4": "### Étape 4 : Exporter les données depuis l'ancienne application",
        "step5": "### Étape 5 : Téléverser vers DressApp",
        "step6": "### Étape 6 : Réviser et ajuster",
        "what_imported": "## Ce qui est importé",
        "troubleshooting": "## Dépannage",
        "help": "## Besoin d'aide ?",
        "last_updated": "---\n\n*Dernière mise à jour : juillet 2026*"
    },
    "he": {
        "header": "# ייבוא המלתחה שלך - מדריך מפורט",
        "overview": "## סקירה כללית",
        "section1": "כבר יש לך את המלתחה שלך במעקב באפליקציה אחרת? אין בעיה!DressApp הופכת את זה לקל לייבא את נתוני המלתחה הקיימים שלך כך שלא תצטרך להתחיל מאפס.אנחנו תומכים בייבוא ממגוון רחב של אפליקציות פופולריות לתכנון ארון בגדים ואאוטפיטים.",
        "supported_sources": "## מקורות ייבוא נתמכים",
        "step_guide": "## מדריך ייבוא מפורט",
        "step1": "### שלב 1: פתח את דף המלתחה",
        "step2": "### שלב 2: גישה לתכונת הייבוא",
        "step3": "### שלב 3: בחר את אפליקציית המקור",
        "step4": "### שלב 4: ייצא נתונים מהאפליקציה הישנה",
        "step5": "### שלב 5: העלה ל-DressApp",
        "step6": "### שלב 6: סקירה והתאמה",
        "what_imported": "## מה ייקח לקחת",
        "troubleshooting": "## פתרון בעיות",
        "help": "## זקוק לעזרה?",
        "last_updated": "---\n\n*עודכן לאחרונה: יולי 2026*"
    },
    "hi": {
        "header": "# अपना वार्डरोब इंपोर्ट करें - विस्तृत गाइड",
        "overview": "## अवलोकन",
        "section1": "क्या आपके पास पहले से ही कोई ऐसा ऐप है जिसमें आपके वार्डरोब को ट्रैक किया गया है? कोई समस्या नहीं!DressApp आपके मौजूदा वार्डरोब डेटा को इम्पोर्ट करना आसान बनाता है ताकि आपको शुरू करने के लिए पहली बार से न शुरू करना पड़े.हम कई लोकप्रिय वार्डरोब और आउटफिट प्लानिंग ऐप्स से इम्पोर्ट को सपोर्ट करते हैं.",
        "supported_sources": "## सपोर्टेड इम्पोर्ट सोर्सेज",
        "step_guide": "## स्टेप-बाय-स्टेप इम्पोर्ट गाइड",
        "step1": "### स्टेप 1: क्लोजेट पेज खोलें",
        "step2": "### स्टेप 2: इम्पोर्ट फीचर तक पहुँचें",
        "step3": "### स्टेप 3: सोर्स ऐप चुनें",
        "step4": "### स्टेप 4: पुराने ऐप से डेटा एक्सपोर्ट करें",
        "step5": "### स्टेप 5: DressApp में अपलोड करें",
        "step6": "### स्टेप 6: रिव्यू और एडजस्ट करें",
        "what_imported": "## क्या इंपोर्ट होता है",
        "troubleshooting": "## ट्रबलशूटिंग",
        "help": "## मदद चाहिए?",
        "last_updated": "---\n\n*अंतिम अपडेट: जुलाई 2026*"
    },
    "it": {
        "header": "# Importa il tuo Guardaroba - Guida Dettagliata",
        "overview": "## Panoramica",
        "section1": "Hai già il tuo guardaroba registrato in un'altra app? Nessun problema!DressApp rende facile importare i tuoi dati di guardaroba esistenti così non devi ricominciare da capo.Supportiamo importazioni da un'ampia gamma di app popolari per la pianificazione di guardaroba e outfit.",
        "supported_sources": "## Fonti di importazione supportate",
        "step_guide": "## Guida passo-passo per l'importazione",
        "step1": "### Passo 1: Apri la pagina del Closet",
        "step2": "### Passo 2: Accedi alla funzione di importazione",
        "step3": "### Passo 3: Seleziona l'app sorgente",
        "step4": "### Passo 4: Esporta i dati dall'app vecchia",
        "step5": "### Passo 5: Carica su DressApp",
        "step6": "### Passo 6: Rivedi e adatta",
        "what_imported": "## Cosa viene importato",
        "troubleshooting": "## Risoluzione problemi",
        "help": "## Hai bisogno di aiuto?",
        "last_updated": "---\n\n*Ultima aggiornamento: luglio 2026*"
    },
    "ja": {
        "header": "# ワードローブをインポートする - 詳細ガイド",
        "overview": "## 概要",
        "section1": "すでに別のアプリでワードローブを管理していますか？問題ありません！DressAppを使用すると、既存のワードローブデータを簡単にインポートでき、最初からやり直す必要がありません。幅広い人気のあるワードローブ管理アプリやスタイリングアプリからのインポートをサポートしています.",
        "supported_sources": "## サポートされているインポート元",
        "step_guide": "## ステップ・バイ・ステップのインポートガイド",
        "step1": "### ステップ1: クローゼットページを開く",
        "step2": "### ステップ2: インポート機能にアクセスする",
        "step3": "### ステップ3: ソースアプリを選択する",
        "step4": "### ステップ4: 古いアプリからデータをエクスポートする",
        "step5": "### ステップ5: DressAppにアップロードする",
        "step6": "### ステップ6: レビューして調整する",
        "what_imported": "## インポートされるもの",
        "troubleshooting": "## トラブルシューティング",
        "help": "## 助けが必要ですか？",
        "last_updated": "---\n\n*最終更新日: 2026年7月*"
    },
    "nl": {
        "header": "# Importeer je Garderobe - Gedetailleerde Gids",
        "overview": "## Overzicht",
        "section1": "Heb je je garderobe al in een andere app bijgehouden? Geen probleem!DressApp maakt het gemakkelijk om je bestaande garderobedata te importeren, zodat je niet opnieuw hoeft te beginnen.We ondersteunen importen van een breed scala aan populaire garderobe- en outfitplaning apps.",
        "supported_sources": "## Ondersteunde importbronnen",
        "step_guide": "## Stapsgewijze importgids",
        "step1": "### Stap 1: Open de Closet-pagina",
        "step2": "### Stap 2: Toegang tot de importfunctie",
        "step3": "### Stap 3: Selecteer de brong",
        "step4": "### Stap 4: Exporteer gegevens van de oude app",
        "step5": "### Stap 5: Upload naar DressApp",
        "step6": "### Stap 6: Beoordelen en aanpassen",
        "what_imported": "## Wat wordt geïmporteerd",
        "troubleshooting": "## Probleemoplossing",
        "help": "## Heb je hulp nodig?",
        "last_updated": "---\n\n*Laatste update: juli 2026*"
    },
    "pt": {
        "header": "# Importe seu Guarda-Roupa - Guia Detalhado",
        "overview": "## Visão geral",
        "section1": "Você já tem seu guarda-roupa registrado em outro app? Sem problemas!O DressApp facilita a importação dos seus dados de guarda-roupa existentes para que você não precise começar do zero.Apoiámos importações de uma ampla gama de apps populares de gerenciamento de guarda-roupa e planejamento de outfits.",
        "supported_sources": "## Fontes de importação suportadas",
        "step_guide": "## Guia passo a passo para importar",
        "step1": "### Passo 1: Abra a página do Closet",
        "step2": "### Passo 2: Acesse a função de importação",
        "step3": "### Passo 3: Selecione a fonte do app",
        "step4": "### Passo 4: Exporte dados do app antigo",
        "step5": "### Passo 5: Faça upload para o DressApp",
        "step6": "### Passo 6: Revise e ajuste",
        "what_imported": "## O que é importado",
        "troubleshooting": "## Solução de problemas",
        "help": "## Precisa de ajuda?",
        "last_updated": "---\n\n*Última atualização: julho de 2026*"
    },
    "ru": {
        "header": "# Импорт вашего гардероба - Подробное руководство",
        "overview": "## Обзор",
        "section1": "У вас уже есть учетная запись в другой программе, в которой отслеживается ваша гардеробная? Что ж, не беспокойтесь!DressApp позволяет легко импортировать ваши существующие данные гардероба, поэтому вам не нужно начинать с нуля.Мы поддерживаем импорт из широкого спектра популярных приложений для планирования гардероба и аутфитов.",
        "supported_sources": "## Поддерживаемые источники импорта",
        "step_guide": "## Пошаговое руководство по импорту",
        "step1": "### Шаг 1: Откройте страницу Closet",
        "step2": "### Шаг 2: Доступ к функции импорта",
        "step3": "### Шаг 3: Выберите источник приложения",
        "step4": "### Шаг 4: Экспортируйте данные из старой программы",
        "step5": "### Шаг 5: Загрузите в DressApp",
        "step6": "### Шаг 6: Проверьте и откорректируйте",
        "what_imported": "## Что импортируется",
        "troubleshooting": "## Решение проблем",
        "help": "## Нужна помощь?",
        "last_updated": "---\n\n*Последнее обновление: июль 2026*"
    },
    "zh": {
        "header": "# 导入您的衣橱 - 详细指南",
        "overview": "## 概述",
        "section1": "你已经在另一个应用中追踪了你的衣橱？没有问题！DressApp让导出现有的衣橱数据变得简单，这样你就不必从头开始。我们支持从各种流行的衣橱和套装规划应用中导入数据.",
        "supported_sources": "## 支持的导入来源",
        "step_guide": "## 详细的导入指南",
        "step1": "### 步骤 1：打开衣橱页面",
        "step2": "### 步骤 2：访问导入功能",
        "step3": "### 步骤 3：选择源应用",
        "step4": "### 步骤 4：从旧的应用中导出数据",
        "step5": "### 步骤 5：上传到 DressApp",
        "step6": "### 步骤 6：回顾和调整",
        "what_imported": "## 什么会被导入",
        "troubleshooting": "## 故障排除",
        "help": "## 需要帮助？",
        "last_updated": "---\n\n*最后更新: 2026 年 7 月*"
    }
}

# Create directories
def ensure_directories():
    for lang in translations.keys():
        os.makedirs(f"wiki/{lang}", exist_ok=True)
        os.makedirs(f"frontend/public/wiki/{lang}", exist_ok=True)

def create_translations():
    for lang, trans in translations.items():
        # Build translated content
        translated_content = (
            f"{trans['header']}\n\n"
            f"{trans['overview']}\n\n"
            f"{trans['section1']}\n\n"
            f"{trans['supported_sources']}\n\n"
            f"- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp\n"
            f"- **Stylebook** - Transfer your Stylebook inventory with ease\n"
            f"- **Acloset** - Import your Acloset items and outfits\n"
            f"- **SmartCloset** - Migrate your SmartCloset wardrobe data\n"
            f"- **CSV Files** - Import from any app that supports CSV export (generic format)\n"
            f"- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import\n\n"
            f"{trans['step_guide']}\n\n"
            f"{trans['step1']}\n"
            f"Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.\n\n"
            f"{trans['step2']}\n"
            f"Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.\n\n"
            f"{trans['step3']}\n"
            f"Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.\n\n"
            f"{trans['step4']}\n"
            f"Follow the instructions for your specific app:\n"
            f"- **Cladwell**: Go to Settings > Export Data > Download CSV\n"
            f"- **Stylebook**: Open Menu > Export > Choose CSV format\n"
            f"- **Acloset**: Navigate to Profile > Export Wardrobe > Download\n"
            f"- **SmartCloset**: Go to Settings > Data Management > Export\n"
            f"- **CSV Export**: Look for an export or download option in your app's settings\n\n"
            f"{trans['step5']}\n"
            f"Upload the exported file to DressApp. The system will automatically:\n"
            f"- Parse the data and map fields to DressApp's format\n"
            f"- Categorize items based on their type (tops, bottoms, dresses, etc.)\n"
            f"- Organize colors and sizes\n"
            f"- Import images if available in the export\n\n"
            f"{trans['step6']}\n"
            f"After import completes:\n"
            f"- Review your items on the Closet page\n"
            f"- Fix any miscategorized items\n"
            f"- Add missing details (brand, price, purchase date)\n"
            f"- Remove any duplicates or test items\n\n"
            f"{trans['what_imported']}\n\n"
            f"Depending on the source app, the following data may be imported:\n"
            f"- Item names and descriptions\n"
            f"- Categories and subcategories\n"
            f"- Colors and patterns\n"
            f"- Sizes and measurements\n"
            f"- Brand information\n"
            f"- Purchase dates and prices\n"
            f"- Item images (if included in export)\n"
            f"- Wear history (if supported)\n\n"
            f"{trans['troubleshooting']}\n\n"
            f"### Import Failed\n"
            f"- Check that the file format is correct (CSV, JSON, or app-specific format)\n"
            f"- Ensure the file isn't corrupted or too large\n"
            f"- Try exporting again from the source app\n\n"
            f"### Missing Items After Import\n"
            f"- Some fields may not have mapped correctly\n"
            f"- Check the import results page for warnings\n"
            f"- Manually add missing items if needed\n\n"
            f"### Images Not Imported\n"
            f"- Not all apps include images in their export files\n"
            f"- You can add images manually to imported items later\n"
            f"- Use the camera or upload function on the item detail page\n\n"
            f"{trans['help']}\n\n"
            f"If you run into issues with importing:\n"
            f"- Check the troubleshooting section above\n"
            f"- Contact support through the Help menu\n"
            f"- Join our community forum for tips from other users\n\n"
            f"{trans['last_updated']}"
        )
        
        # Write wiki translation
        with open(f"wiki/{lang}/import_wardrobe.md", "w", encoding="utf-8") as f:
            f.write(translated_content)
        
        # Write frontend public translation
        with open(f"frontend/public/wiki/{lang}/import_wardrobe.md", "w", encoding="utf-8") as f:
            f.write(translated_content)
        
        print(f"Created translations for {lang}")

if __name__ == "__main__":
    ensure_directories()
    create_translations()
    print("\nAll translations completed!")
