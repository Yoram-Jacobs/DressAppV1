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
