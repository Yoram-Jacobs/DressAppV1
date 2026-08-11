<<<<<<< HEAD
# Importa tu armario - Guía detallada

## Resumen

¿Ya tienes tu armario registrado en otra aplicación? ¡No hay problema!DressApp facilita importar tus datos de armario existentes para que no tengas que empezar desde cero.Apoyamos importaciones de una amplia gama de apps populares de manejo de armarios y planeación de outfits.

## Fuentes de importación soportadas

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## Guía de importación paso a paso

### Paso 1: Abre la página del armario
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### Paso 2: Accede a la función de importación
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### Paso 3: Selecciona la fuente de la aplicación
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### Paso 4: Exporta los datos desde la aplicación antigua
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### Paso 5: Sube a DressApp
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### Paso 6: Revisa y ajusta
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## Qué se importa

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## Solución de problemas

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

## ¿Necesitas ayuda?

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*Última actualización: julio de 2026*
=======
# Importar su armario desde otras aplicaciones (Migración de competidores)

## Resumen
Si ya tiene su ropa catalogada en otra aplicación de armario (como Whering, Acloset o Stylebook), no tiene que empezar de cero. DressApp cuenta con un **Desktop Wardrobe Migration Agent** inteligente (a través de un bookmarklet de navegador) que rastrea la página de su antiguo armario, captura las tarjetas de sus prendas y las sube automáticamente a DressApp. Luego, nuestra IA se ejecuta en segundo plano para identificar automáticamente los colores, marcas, telas y categorías de su ropa.

## Requisitos previos
- **Computadora de escritorio**: El bookmarklet de migración requiere capacidades de navegador de escritorio (Chrome, Edge o Safari). No es compatible con dispositivos móviles ni tabletas.
- **Cuentas activas**: Debe iniciar sesión tanto en su cuenta de DressApp como en su cuenta del armario competidor en el mismo navegador.
- **Barra de marcadores**: La barra de marcadores de su navegador debe estar visible (Ctrl+Shift+B en Windows, Cmd+Shift+B en macOS).

## Instrucciones paso a paso
1. Abra la página de su **Perfil** de DressApp en su computadora de escritorio y haga clic en **Import Wardrobe**.
2. Seleccione su aplicación anterior de la lista (Whering, Acloset, Stylebook, Smartli, BeautyAI, etc.) o escriba un nombre personalizado.
3. Arrastre el botón del bookmarklet **Share & Start Agent** desde la pantalla directamente a la barra de marcadores de su navegador.
4. Abra una nueva pestaña, navegue a la versión web de su antigua aplicación de armario e inicie sesión. Vaya a la página donde se muestran todas sus prendas en una cuadrícula.
5. Haga clic en el bookmarklet **Share & Start Agent** en su barra de marcadores.
6. El agente comenzará a desplazarse por la página, detectando las imágenes de las prendas y transmitiéndolas a DressApp en lotes de 15. No cierre la pestaña de DressApp durante este proceso.
7. Una vez que se complete la transmisión, revise su página de armario en DressApp. El AI Stylist procesará los elementos en segundo plano para completar los atributos de las prendas automáticamente.

## Resultados esperados
- Las tarjetas de prendas aparecerán inmediatamente en la cuadrícula de su armario de DressApp.
- Los fondos se eliminan automáticamente, dejando miniaturas limpias y transparentes.
- Los campos de etiquetas (categoría, color, ajuste, tela) se completarán automáticamente en unos pocos minutos tras la importación.

## Resolución de problemas
- **El bookmarklet no se instala**: Asegúrese de que la barra de marcadores de su navegador esté habilitada. Si la configuración de seguridad bloquea el arrastre, haga clic derecho en el botón, seleccione "Copiar dirección de enlace", cree un nuevo marcador manualmente y pegue el código en el campo de URL.
- **El agente deja de desplazarse**: Asegúrese de que la página del armario competidor esté activa y no minimizada. Si se detiene, actualice la página del competidor y vuelva a hacer clic en el bookmarklet.
- **Elementos duplicados**: El importador verifica las firmas de imagen (dHash) para filtrar las cargas duplicadas automáticamente.

## Limitaciones
- **Solo para computadoras de escritorio**: No se puede ejecutar en navegadores móviles debido a restricciones de la API.
- **Claridad visual**: Los diseños de ropa muy distorsionados, oscuros o superpuestos en la aplicación competidora pueden fallar en la extracción de recorte visual y requerir ajustes fotográficos manuales más adelante.
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad
