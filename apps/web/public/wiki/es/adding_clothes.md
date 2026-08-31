# Digitalizar y Añadir Ropa

Digitaliza tu armario físico en segundos gracias al escaneo con IA multimodal, recorte inteligente de fondos y reconstrucción automática de imágenes.

## Descripción General
Añade ropa mediante fotos en vivo de la cámara, subidas múltiples desde la galería, etiquetas QR del Pasaporte Digital de Producto (DPP) o recibos digitales (OCR de facturas). La IA integrada recorta automáticamente los fondos, clasifica los atributos de moda, evalúa la integridad del recorte y reconstruye prendas cubiertas o cortadas.

## Requisitos Previos
- Fotos claras y bien iluminadas de las prendas (selfies en el espejo, fotos de conjunto de cuerpo entero o tomas planas / flat-lays).
- Acceso a la cámara para escanear artículos físicos y códigos QR.
- Recibos digitales o capturas de facturas (PDF / PNG / JPEG) para compras de comercio electrónico.

## Paso a Paso

1. **Subida y Captura Interactivas**:
   - Pulsa en **Añadir elemento** &rarr; selecciona **Tomar foto** o sube una o varias fotos de atuendos desde tu dispositivo.
   - La detección de duplicados integrada comprueba al instante si ya habías subido la misma prenda.
2. **Segmentación por IA y Detección de Múltiples Prendas**:
   - El modelo de visión aísla prendas individuales (chaquetas, partes superiores, faldas, pantalones, calzado, accesorios) en una sola pasada.
3. **Comprobador de Calidad por IA y Reparación Automática de Imágenes**:
   - El Comprobador de Calidad visual de Gemini inspecciona cada elemento recortado:
     - **Completo**: Las prendas intactas y despejadas se recortan directamente.
     - **Compleción de Imagen**: Si a una prenda le faltan contornos laterales, tiene partes cubiertas (por bolsos o brazos) o cuellos/dobladillos cortados, la IA realiza un outpainting automático para completar la tela faltante.
     - **Reconstrucción Completa de Estudio**: Las prendas fuertemente cortadas (como zapatos en los que solo se ve la punta) se reconstruyen íntegramente en fotos de catálogo con calidad de estudio.
4. **Etiquetado Automático de Metadatos**:
   - La IA extrae más de 20 atributos de moda (colores, composición textil, subcategoría, código de vestimenta, marca y estado).
5. **Recibos Digitales y Etiquetas DPP**:
   - Cambia a la pestaña **Importación Digital** para analizar correos de confirmación de pedido o facturas, registrando precios de compra y tallas verificadas.
   - Pulsa en **Escanear QR (DPP)** en la etiqueta para importar los datos de trazabilidad y pautas de cuidado del Pasaporte Digital de Producto de la UE.
6. **Guardar en el Armario**:
   - Pulsa en **Guardar**. Las prendas aparecerán de inmediato en la cuadrícula de tu armario, mientras que las compleciones generativas se finalizan en segundo plano de manera transparente.

## Resultados Esperados
Cada prenda aparece en tu armario digital como una fotografía centrada, limpia y con calidad de estudio, con atributos de búsqueda completamente indexados y etiquetas taxonómicas enriquecidas.

## Resolución de Problemas
- **Prendas Cortadas / Parciales en las Fotos**: La IA detecta automáticamente los límites recortados y los reconstruye; también puedes pulsar en **Reparar foto** en la tarjeta de detalle de cualquier prenda para solicitar una regeneración de estudio manual.
- **Iluminación y Contraste**: Para obtener mejores resultados con prendas oscuras, toma las fotografías sobre fondos contrastantes.
- **Discrepancias en el OCR del Recibo**: Utiliza el selector interactivo de cajas sobre la imagen del recibo para designar manualmente las líneas de productos correspondientes.

## Limitaciones
- Las subidas masivas de alta resolución (>5 prendas) se procesan a través de colas asíncronas en segundo plano para garantizar un rendimiento óptimo sin tiempo de espera excesivo en el navegador.