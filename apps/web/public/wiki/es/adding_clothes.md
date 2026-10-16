# Registro y Adición de Prendas

Digitaliza tu guardarropa físico en segundos con escaneo de IA multimodal, eliminación inteligente del fondo y reconstrucción automática de imágenes.

## Resumen
Registra prendas mediante fotos en directo con la cámara, subidas múltiples desde la galería, códigos QR del Pasaporte Digital de Producto (DPP) o recibos digitales (OCR de facturas). La IA integrada en servidores propios (on-premises) recorta los fondos automáticamente, etiqueta más de 20 atributos de moda y prepara fotografías limpias de estudio sin necesidad de claves de API.

## Requisitos previos
- Fotografías claras y bien iluminadas de las prendas (selfies frente al espejo, fotos de cuerpo entero o prendas extendidas).
- Permiso de cámara para escanear prendas físicas y códigos QR.
- Recibos digitales o capturas de facturas (PDF / PNG / JPEG) para compras de comercio electrónico.

## Instrucciones paso a paso

1. **Subida y captura interactiva**:
   - Pulsa **Añadir prenda** &rarr; selecciona **Tomar foto** o sube una o más fotos de atuendos desde tu dispositivo.
   - La detección de duplicados integrada comprueba al instante si ya habías subido la misma prenda anteriormente.
2. **Segmentación por IA y detección de múltiples prendas**:
   - El modelo de visión aísla distintas prendas (chaquetas, partes superiores, faldas, pantalones, calzado, accesorios) en una sola pasada.
3. **Recorte con IA y fotos limpias de estudio**:
   - El flujo de visión integrado elimina automáticamente los fondos, generando imágenes PNG transparentes y nítidas para todas las cuentas.
4. **Etiquetado automático de metadatos**:
   - Las cuentas del nivel gratuito (Free Tier) utilizan el motor **Eyes** en servidores propios de DressApp (actualmente un modelo `Qwen 2.5 VL 3B` ajustado), mientras que los usuarios de los planes **Manager** y **Professional** disfrutan del modelo rápido en la nube (`Google Gemini 3.5 Flash`) para extraer más de 20 atributos de moda (colores, composición del tejido, subcategoría, código de vestimenta, marca y estado).
5. **Reparación fotográfica generativa avanzada (Nano Banana)**:
   - Nano Banana inspecciona las prendas recortadas en busca de oclusiones (bolsos, manos) y bordes del encuadre, reconstruyendo y completando automáticamente el tejido faltante para crear fotografías de estudio completas sin requerir claves de API externas.
6. **Recibos digitales y etiquetas DPP**:
   - Cambia a **Importación digital** para analizar correos de confirmación de pedidos o facturas, fijando el precio de compra y las tallas verificadas.
   - Pulsa **Escanear QR (DPP)** en la etiqueta para importar datos de la cadena de suministro y pautas de cuidado del Pasaporte Digital de Producto de la UE.
7. **Guardar en el armario**:
   - Pulsa **Guardar**. Los artículos aparecen inmediatamente en la cuadrícula de tu armario.

## Resultados esperados
Cada prenda aparece en tu armario digital como una fotografía centrada y limpia con calidad de estudio, con atributos de búsqueda totalmente indexados y etiquetas taxonómicas detalladas.

## Solución de problemas
- **Prendas cortadas o parciales en las fotos**: Centra limpiamente la prenda sobre un fondo que contraste. Nano Banana puede reconstruir cuellos o dobladillos cortados de forma automática.
- **Iluminación y contraste**: Para obtener mejores resultados con prendas oscuras, fotografíalas sobre fondos claros que contrasten.
- **Errores en el OCR de recibos**: Utiliza el selector de recuadro interactivo sobre las imágenes de los recibos para señalar manualmente cada línea de producto.

## Limitaciones
- Las subidas por lotes en alta resolución (>5 artículos) se procesan mediante colas asíncronas en segundo plano para garantizar un rendimiento fluido sin tiempos de espera agotados en el navegador.
