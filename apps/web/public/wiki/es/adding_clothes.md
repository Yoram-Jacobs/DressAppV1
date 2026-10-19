# Ingesta y Adición de Ropa

Digitaliza tu armario físico en segundos con enrutamiento automático de 3 flujos de visión, eliminación inteligente de fondo y completado generativo de imágenes.

## Descripción General
Añade ropa mediante fotos con la cámara en vivo, cargas múltiples desde la galería (incluyendo lotes mixtos de prendas sueltas, conjuntos puestos y montones de ropa), códigos QR de Pasaportes Digitales de Productos (DPP) o recibos digitales (OCR de facturas). La IA local integrada detecta automáticamente las características de cada foto, recorta el fondo, etiqueta más de 20 atributos de moda (incluyendo sudaderas/hoodies y más de 60 prendas tradicionales y culturales) y prepara recortes de estudio sin necesidad de claves API.

## Requisitos Previos
- Fotos claras y bien iluminadas de las prendas (prendas individuales, selfies de cuerpo entero en el espejo, maniquíes o composiciones planas de varias prendas).
- Acceso a la cámara para escanear prendas físicas y códigos QR.
- Recibos digitales o capturas de pantalla de facturas (PDF / PNG / JPEG) de compras online.

## Instrucciones Paso a Paso

1. **Carga Interactiva y Lotes Mixtos**:
   - Toca **Añadir Prenda** → selecciona **Tomar Foto** o **Subir Fotos** para elegir una o varias fotos de tu dispositivo. ¡Puedes mezclar libremente fotos de una sola prenda, conjuntos completos en una persona y pilas/grupos de ropa en el mismo lote sin seleccionar pestañas de modo!
   - La detección integrada de duplicados comprueba al instante si ya subiste la misma prenda anteriormente.
2. **Enrutamiento Automático de 3 Flujos (`GarmentVision`)**:
   - **GarmentVision** inspecciona automáticamente cada foto y la dirige al flujo adecuado:
     - **Prenda Única (`Single`)**: Aísla una sola prenda con recorte alfa de estudio.
     - **Conjunto Múltiple (`Multi-Garment`)**: Divide conjuntos de pies a cabeza en una persona o maniquí en tarjetas separadas de parte superior, inferior, abrigo, calzado y accesorios.
     - **Grupo Masivo (`Mass Cluster`)**: Separa grupos de ropa no vestida dispuesta una al lado de otra o colgada en percheros en artículos individuales.
3. **Recorte con IA y Fotos Limpias de Estudio**:
   - El flujo de visión integrado elimina automáticamente los fondos generando imágenes PNG transparentes y nítidas para todas las cuentas.
4. **Etiquetado Automático de Metadatos, Hoodies y Ropa Tradicional**:
   - Las cuentas del Plan Gratuito utilizan el motor local **Eyes** de DressApp (`Qwen 2.5 VL 3B` optimizado), mientras que los usuarios de los planes **Manager** ($10/mes) y **Professional** ($15/mes) disfrutan del modelo rápido en la nube (`Google Gemini 3.5 Flash`) para extraer más de 20 atributos de moda, distinguiendo con precisión **Sudaderas y Hoodies** de **Camisetas** y reconociendo más de 60 **prendas tradicionales y culturales** (Sari, Kimono, Thobe, Kaftan, Hanbok, Cheongsam, Ao Dai, Dirndl, Kilt y más) en los 13 idiomas.
5. **Reparación Generativa Avanzada de Fotos (Nano Banana)**:
   - Nano Banana inspecciona las prendas recortadas en busca de oclusiones (bolsos, manos) y bordes cortados, reconstruyendo automáticamente la tela faltante en fotografías de estudio completas sin requerir claves API externas.
6. **Recibos Digitales y Etiquetas DPP**:
   - Cambia a **Importación Digital** para analizar correos de confirmación de pedidos o facturas, bloqueando el precio de compra y las tallas verificadas.
   - Toca **Escanear QR (DPP)** en la etiqueta para importar datos de la cadena de suministro e instrucciones de cuidado del Pasaporte Digital de Producto de la UE.
7. **Guardar en el Armario**:
   - Toca **Guardar**. Los artículos aparecen inmediatamente en la cuadrícula de tu Armario.

## Resultados Esperados
Cada prenda aparece en tu armario digital como una fotografía de estudio limpia y centrada, con categorías/subcategorías precisas, etiquetas de herencia cultural y atributos de búsqueda indexados.

## Solución de Problemas
- **Prendas Cortadas o Parciales**: Centra bien la prenda sobre un fondo contrastado. Nano Banana puede reconstruir cuellos o dobladillos cortados automáticamente.
- **Iluminación y Contraste**: Para obtener mejores resultados con prendas oscuras, fotografíalas sobre fondos claros y contrastados.
- **Errores de OCR en Recibos**: Usa el selector de cuadros interactivo sobre las imágenes de recibos para señalar manualmente las líneas de producto individuales.

## Limitaciones
- Las cargas por lotes de alta resolución (>5 artículos) se procesan mediante colas asíncronas en segundo plano para garantizar un rendimiento fluido sin tiempos de espera en el navegador.
