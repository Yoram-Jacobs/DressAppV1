# Импорт вашего гардероба - Подробное руководство

## Обзор

У вас уже есть учетная запись в другой программе, в которой отслеживается ваша гардеробная? Что ж, не беспокойтесь!DressApp позволяет легко импортировать ваши существующие данные гардероба, поэтому вам не нужно начинать с нуля.Мы поддерживаем импорт из широкого спектра популярных приложений для планирования гардероба и аутфитов.

## Поддерживаемые источники импорта

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## Пошаговое руководство по импорту

### Шаг 1: Откройте страницу Closet
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### Шаг 2: Доступ к функции импорта
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### Шаг 3: Выберите источник приложения
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### Шаг 4: Экспортируйте данные из старой программы
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### Шаг 5: Загрузите в DressApp
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### Шаг 6: Проверьте и откорректируйте
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## Что импортируется

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## Решение проблем

### Import Failed
- Check that the file format is correct (CSV, JSON, or app-specific format)
- Ensure the file isn't corrupted or too large
- Try exporting again from the source app

### Missing Items After Import
- Some fields may not have mapped correctly
- Check the import results page for warnings
- Manually add missing items if needed

### Images Not Imported
- Not all apps include images in their export files
- You can add images manually to imported items later
- Use the camera or upload function on the item detail page

## Нужна помощь?

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*Последнее обновление: июль 2026*
# Импорт гардероба из других приложений (миграция от конкурентов)

## Обзор
Если ваша одежда уже каталогизирована в другом приложении для гардероба (например, Whering, Acloset или Stylebook), вам не придется начинать все с нуля. В DressApp встроен умный агент миграции **Desktop Wardrobe Migration Agent** (работающий через браузерный букмарклет), который сканирует вашу старую страницу гардероба, захватывает карточки одежды и автоматически загружает их в DressApp. Затем в фоновом режиме запускается наш ИИ, который автоматически определяет цвета, бренды, ткани и категории вашей одежды.

## Предварительные требования
- **Настольный компьютер**: Букмарклет миграции требует возможностей десктопного браузера (Chrome, Edge или Safari). Он не поддерживается на мобильных устройствах или планшетах.
- **Активные учетные записи**: Вы должны быть вошедшими как в свою учетную запись DressApp, так и в учетную запись конкурента в одном и том же браузере.
- **Панель закладок**: Панель закладок вашего браузера должна быть видимой (Ctrl+Shift+B в Windows, Cmd+Shift+B в macOS).

## Пошаговая инструкция
1. Откройте страницу **Профиль** (Profile) в DressApp на своем настольном компьютере и нажмите **Import Wardrobe** (Импорт гардероба).
2. Выберите старое приложение из списка (Whering, Acloset, Stylebook, Smartli, BeautyAI и т. д.) или введите пользовательское имя.
3. Перетащите кнопку букмарклета **Share & Start Agent** (Поделиться и запустить агента) с экрана прямо на панель закладок вашего браузера.
4. Откройте новую вкладку, перейдите в веб-версию старого приложения для гардероба и войдите в систему. Перейдите на страницу, где все ваши вещи отображаются в виде сетки.
5. Нажмите букмарклет **Share & Start Agent** на панели закладок.
6. Агент начнет прокрутку страницы, распознавая изображения одежды и передавая их в DressApp пакетами по 15 штук. Не закрывайте вкладку DressApp во время этого процесса.
7. После завершения передачи проверьте страницу гардероба (Closet) в DressApp. Стилист ИИ (AI Stylist) будет обрабатывать вещи в фоновом режиме, чтобы автоматически заполнить характеристики одежды.

## Ожидаемые результаты
- Карточки одежды сразу же появятся в сетке вашего гардероба DressApp.
- Фоновые изображения удаляются автоматически, оставляя чистые прозрачные миниатюры.
- Поля тегов (категория, цвет, фасон, ткань) заполнятся автоматически в течение нескольких минут после импорта.

## Устранение неполадок
- **Букмарклет не устанавливается**: Убедитесь, что панель закладок вашего браузера включена. Если настройки безопасности блокируют перетаскивание, нажмите правой кнопкой мыши на кнопку, выберите «Копировать адрес ссылки», создайте новую закладку вручную и вставьте код в поле URL.
- **Агент перестает прокручивать**: Убедитесь, что страница гардероба конкурента активна и не свернута. Если она зависла, обновите страницу конкурента и снова нажмите букмарклет.
- **Дубликаты вещей**: Импортер проверяет цифровые отпечатки изображений (dHash) для автоматической фильтрации дубликатов при загрузке.

## Ограничения
- **Только для компьютеров**: Нельзя запустить в мобильных браузерах из-за ограничений API.
- **Визуальная четкость**: Сильно искаженные, темные или перекрывающие друг друга макеты одежды в приложении конкурента могут помешать визуальной обрезке и потребовать ручной настройки фотографий позже.
