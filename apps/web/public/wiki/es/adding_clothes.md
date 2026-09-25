# Registro y adición de prendas

Digitaliza tu guardarropa físico en segundos con escaneo de IA multimodal, eliminación inteligente del fondo y reconstrucción automática de imágenes.

## Resumen
Registra prendas mediante fotos en directo con la cámara, subidas múltiples desde la galería, códigos QR del Pasaporte Digital de Producto (DPP) o recibos digitales (OCR de facturas). La IA integrada en el servidor recorta fondos automáticamente, etiqueta más de 20 atributos de moda y prepara fotos limpias de estudio sin necesidad de claves API.

## Requisitos previos
- Fotografías claras y bien iluminadas de las prendas (selfies frente al espejo, fotos de cuerpo entero o prendas extendidas).
- Permiso de cámara para escanear prendas y códigos QR.
- Recibos digitales o capturas de facturas (PDF / PNG / JPEG) para compras online.
- *(Opcional)* Una clave personal de Google Gemini API si deseas usar la reconstrucción fotográfica generativa de Nano Banana.

## Instrucciones paso a paso

1. **Subida y captura interactiva**:
   - Pulsa **Añadir prenda** &rarr; selecciona **Tomar foto** o sube una o más fotos desde tu dispositivo.
   - La detección de duplicados integrada comprueba al instante si ya habías subido la misma prenda.
2. **Segmentación por IA y detección múltiple**:
   - El modelo de visión aísla prendas individuales (chaquetas, camisetas, faldas, pantalones, calzado, accesorios) en un solo análisis.
3. **Recorte con IA y fotos limpias de estudio**:
   - El procesador visual integrado elimina automáticamente los fondos, generando imágenes PNG transparentes y nítidas para todas las cuentas.
4. **Etiquetado automático de metadatos**:
   - La IA local extrae más de 20 atributos de moda (colores, composición del tejido, subcategoría, código de vestimenta, marca y estado).
5. **Reparación generativa avanzada (Nano Banana)**:
   - Para usuarios con clave personal de Google Gemini API, Nano Banana detecta partes cortadas u ocultas (bolsos, manos) y reconstruye la tela faltante para crear fotos de estudio completas.
6. **Recibos digitales y etiquetas DPP**:
   - Accede a **Importación digital** para procesar facturas o confirmaciones de compra, guardando precio y tallas verificadas.
   - Pulsa **Escanear QR (DPP)** en la etiqueta para importar datos de sostenibilidad y consejos de cuidado del Pasaporte Digital Europeo.
7. **Guardar en el armario**:
   - Pulsa **Guardar**. Las prendas aparecerán de inmediato en la cuadrícula de tu armario.

## Resultados esperados
Cada prenda queda registrada como una fotografía de estudio limpia y centrada, con atributos de búsqueda completos y etiquetas taxonómicas detalladas.

## Solución de problemas
- **Prendas cortadas en la foto**: Centra bien la prenda sobre un fondo contrastado. Si tienes una clave API configurada, Nano Banana completará cuellos o dobladillos cortados automáticamente.
- **Iluminación y contraste**: Para prendas oscuras, toma la fotografía sobre fondos claros y con buen contraste.
- **Errores en la lectura de facturas**: Utiliza el selector interactivo sobre la imagen de la factura para marcar manualmente las líneas de producto.

## Limitaciones
- Las subidas masivas de alta resolución (>5 prendas) se procesan en segundo plano para garantizar una navegación fluida sin bloqueos.
- La reconstrucción fotorrealista de imágenes con Nano Banana requiere una clave personal de Google Gemini API.
