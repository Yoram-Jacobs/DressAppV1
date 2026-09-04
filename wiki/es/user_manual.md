# Manual técnico completo del usuario de DressApp

Manual de usuario completo y guía de referencia técnica para el ecosistema de armario personal de DressApp, el motor de estilismo, el mercado circular y los paneles de administración.

---

## 1. Resumen general y pila tecnológica

DressApp es un gestor de armario personal, asesor de estilo y mercado circular impulsado por IA. Ayuda a los usuarios a gestionar prendas de vestir de forma digital, recortarlas y etiquetarlas automáticamente, recibir recomendaciones de conjuntos según el clima y el calendario, escanear pasaportes digitales de productos de la UE (DPP) e intercambiar prendas.

### Propuesta de valor principal
- **Ingreso de armario digital**: Procesamiento de fotos cargadas o capturadas con eliminación automatizada de fondo, categorización de ropa y generación de etiquetas de atributos.
- **AI Virtual Stylist**: Un agente de conversación que analiza de manera contextual su armario, eventos de Google Calendar y pronósticos meteorológicos locales para sugerir conjuntos diarios.
- **Mercado circular (Circular Marketplace)**: Compra, venta, intercambio y alquiler seguro de ropa entre pares para reducir el desperdicio de la moda rápida.
- **Análisis de costo por uso (CPW)**: Información sobre el valor de capitalización del armario, tasas de utilización y optimización del uso.

### Arquitectura tecnológica
- **Backend Edge**: Python 3.11 con FastAPI, utilizando controladores asíncronos de Motor conectados a un clúster de MongoDB Atlas.
- **Frontend SPA**: Aplicación de una sola página React 19 que utiliza almacenes personalizados de `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, primitivas de Shadcn/UI y `react-i18next` con soporte para 12 idiomas locales.
- **Optimización de red y estado**: Deduplicación de solicitudes activas, almacenamiento en caché de 15 minutos en el almacén y revalidación de pestañas al cambiar la visibilidad (`visibilitychange`), lo que genera cero solicitudes GET en segundo plano cuando la app está inactiva.
- **Aprendizaje automático y tallas locales**: Matizado de fondo local U2-Net (`rembg`) por CPU, análisis de ropa SegFormer-b2, incrustaciones de Fashion-CLIP y modelo de regresión de medidas corporales físicas ANSUR II (`body_predictor.py`). Opcionalmente se redirige a contenedores de GPU autohospedados (SegFormer-b3 + BiRefNet) para operaciones rápidas.
- **STT/TTS conversacional**: Reconocimiento de voz en el lado del cliente (Web Speech) como respaldo, modulaciones Gemini 2.5 Flash en el lado del servidor y motores Piper/Sherpa-ONNX sin conexión en el dispositivo.
- **Servicios de integración externa**: API de OpenWeatherMap para clima, Google Calendar OAuth para exportación de agendas diarias, OpenStreetMap (Nominatim) para autocompletar direcciones y API REST de PayPal Subscriptions/Checkout.

---

## 2. Requisitos previos

### Requisitos del entorno del servidor (Host)
- **Hardware**: Servidor VPS con un mínimo de 4 GB de RAM (p. ej., VPS de Hetzner que aloja la app en producción `dressapp.co`).
- **Dependencias**: Docker y Docker Compose (incluidos backend, frontend y terminación TLS de Caddy).
- **Variables de entorno**: Configuración de claves API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` y tokens de Google Calendar OAuth).

### Requisitos de la app de usuario
- **Navegador web**: Google Chrome o Apple Safari (necesario para la compatibilidad total de las funciones de voz).
- **Permisos**: Otorgar permisos de cámara (para fotos de ropa y escaneo de códigos QR) y de micrófono (para conversación de voz).
- **Red**: Conexión activa para el procesamiento de LLM, con almacenamiento en IndexedDB que permite la navegación sin conexión del catálogo.

---

## 3. Instrucciones paso a paso

### 3.1 Carga de prendas (Agregar elementos)
MÉTODOS DE CARGA: Fotografía, Pasaporte Digital de Producto de la UE y Recibos de Comercio Digital.

#### A. Cámara interactiva y carga de archivos
1. Vaya a la pantalla **Agregar elemento** (Add Item).
2. Seleccione **Tomar foto** (lanza la cámara nativa) o haga clic en **Subir fotos** (abre el selector de archivos).
3. El cliente calcula la firma SHA-256 de la imagen y el dHash en el navegador (~100-180 ms) para verificar duplicados en el armario.
4. Si se encuentra un duplicado, se abre el **diálogo de verificación de duplicados**. Seleccione **Omitir** o **Agregar de todos modos**.
5. Una vez aceptado, el servidor inicia un flujo NDJSON. Se muestra una vista previa temporal en 5-7 segundos, lo que le permite editar los detalles del artículo de inmediato mientras el backend termina el etiquetado.
6. Verifique las etiquetas autodetectadas (color, tela, ajuste, patrón, ocasión). Si el recorte no es correcto, cambie el menú desplegable **Categoría**; esto activará SegFormer para recortar la prenda de nuevo.
7. Haga clic en **Guardar** para pintar de inmediato el elemento en la cuadrícula del armario (~16 ms) mientras concluye la generación del WebP en segundo plano.

#### B. Escaneo de Pasaportes Digitales de Productos de la UE (DPP)
1. Presione el botón **Escanear QR (DPP)** en la página de agregar elemento.
2. Otorgue permisos de cámara y alinee el código QR impreso en la etiqueta de la prenda, o suba una captura de pantalla de un código QR guardado.
3. El backend resuelve la URL y ejecuta comprobaciones de seguridad de SSRF (bloqueando rangos de IP privados).
4. El sistema analiza los esquemas JSON-LD para extraer marca, composición de materiales, trazabilidad de la cadena de suministro, huella de carbono y pautas de cuidado.
5. Revise los datos extraídos en el acordeón verde de **Datos DPP verificados** y haga clic en **Guardar**.

#### C. Importación de recibos de comercio digital
1. Abra la pestaña de **Importación digital** (Digital Import).
2. Elija un método: **Pegar texto**, **Subir imagen**, **Subir PDF** o ingrese un **Enlace web**.
3. El backend utiliza modelos de visión multimodales para extraer datos de la transacción (marca, precio, talla, categoría).
4. Los campos analizados se bloquean para protegerlos de futuros reanálisis visuales. Haga clic en **Guardar** para confirmar.

---

## 3.2 AI Virtual Stylist conversacional
Describa dilemas de estilo y reciba consejos de conjuntos hablados a manos libres.

1. Vaya a la pantalla **AI Stylist**.
2. Haga clic en el icono del micrófono `[Microphone]` en la barra de entrada del chat.
3. Hable su solicitud (p. ej., "¿Qué blusa combina con mis pantalones beige para un almuerzo al aire libre lluvioso?").
4. Si se admite Web Speech, su voz se transcribe en vivo en el cuadro de entrada. Si no, la app graba un archivo WebM y lo sube.
5. El backend dirige la consulta de voz al contenedor local Gemma4 (volviendo a la transcripción de Gemini 2.5 Flash si el servidor está sin conexión).
6. El estilista procesa su historial de armario, pronósticos del clima local y eventos del calendario para formular una propuesta de estilo.
7. El estilista habla la respuesta utilizando perfiles de voz preseleccionados (`puck`, `aoede` o `charon`).
8. Presione **Reproducir respuesta** (o **Replay** en modo hebreo) en la tarjeta para reproducir el audio de voz.

---

## 3.3 Perfil, preferencias y dependencias de subsistemas
La página de perfil sirve como el panel de control central de DressApp. Los campos de configuración afectan directamente el rendimiento y el comportamiento de los módulos derivados.

##### Dependencias y justificación de las secciones del acordeón

1. **Fotos y escenario del avatar digital (`AvatarViewer2D` y `DynamicAvatar`)**
   - **Importancia**: Representa su identidad visual en todos los lienzos de prueba utilizando un escenario de doble modo (recorte de foto real versus maniquí de vector Bezier 2D SVG dinámico).
   - **Dependencias**: Los recortes de fotos se procesan mediante U2-Net (`rembg`) local y se reducen en el navegador a un máximo de 1280px con 82% de calidad para ajustarse al límite de 16MB de los documentos de MongoDB. El escenario aplica puntos de referencia posicionales calibrados (`top-[14.5%]` de cuello a escote, `top-[36.5%]` de pretina a cintura y `bottom-[2%]` para el calzado) y escala proporcional del pecho/cadera ($scaleX$). Haga clic en *Eliminar foto* para volver de inmediato al maniquí vectorial 2D SVG.

2. **Perfil de estilo (Reglas de recato, código de vestir)**
   - **Importancia**: Establece límites personales para los conjuntos recomendados, evitando que la IA genere sugerencias inapropiadas.
   - **Dependencias**: Los parámetros seleccionados (p. ej., restricciones de ropa recatada) se envían directamente a los prompts del estilista para Gemini 2.5 Flash, filtrando los elementos del armario antes de mostrarlos.

3. **Detalles personales (Nombre, teléfono, ocupación)**
   - **Importancia**: Personaliza el tono de la comunicación y dirige las alertas de notificaciones.
   - **Dependencias**: El nombre del usuario se analiza dinámicamente en correos electrónicos e informaciones de push del sistema. El número de teléfono sirve como canal de respaldo para alertas programadas. El parámetro de ocupación se introduce en el LLM del estilista y en el clasificador de Trend Scout para personalizar las propuestas.

4. **Medidas corporales y tallas (Modelo de regresión ANSUR II y predictor de tallas)**
   - **Importancia**: Elimina las dudas sobre las tallas, permitiendo el cálculo automático de tallas, la comparación externa de tallas y la superposición de capas virtual precisa.
   - **Dependencias**: El ingreso de 4 parámetros básicos (**Altura**, **Peso**, **Cintura**, **Longitud del pie**) activa el modelo de regresión ANSUR II de scikit-learn (`body_predictor.py`) para predecir automáticamente 6 dimensiones estructurales (*Hombros*, *Pecho*, *Cadera*, *Manga*, *Entrepierna*, *Costura exterior*).
     - **Traducción determinista de tallas**: Una vez predichas las medidas estructurales, el motor de tallas del backend las convierte en tallas comerciales: **Talla de camisa** (XS-XXL según el pecho), **Talla de pantalones** (Cintura en pulgadas), **Talla de zapatos** (Estándares de EE. UU. de hombres/mujeres y estándar europeo basado en longitud del pie y sexo), **Talla de vestido** (EE. UU. 0-14+ basado en pecho, cintura y caderas) y **Talla de sostén** (Banda + Copa basada en pecho y bajo busto estimado).
     - **Autocompletado**: Estas tallas recomendadas se rellenan automáticamente en los campos de *Detailed Edit Mode* dentro del perfil.
     - **Integraciones**: Las medidas son consultadas directamente por el Asistente de compras (extensión de Chrome) para leer tablas de tallas en sitios asociados (Zara, Asos) y sugerir la mejor opción.

5. **Estilo de vida (Estado civil, sexo)**
   - **Importancia**: Personaliza las recomendaciones predeterminadas y puntúa algoritmos de contenido.
   - **Dependencias**: La selección del sexo afecta directamente al algoritmo de clasificación de las tarjetas de Trend Scout diarias. Si la categoría de una tarjeta de noticias no coincide con el sexo del usuario, el algoritmo aplica una penalización de -2.0 puntos, retrasando su aparición en el feed.

6. **Configuración de IA (Claves SaaS, modo de borde (edge), créditos)**
   - **Importancia**: Determina la facturación, el rendimiento operativo y el estado de la conexión a la red.
   - **Dependencias**: Dirige consultas de generación de texto y voz. Las configuraciones estándar consumen créditos del sistema DressApp. El ingreso de claves API personales (Google AI Studio, Anthropic, OpenAI) redirige los cargos a las cuentas de desarrollador del usuario. La selección del modo de borde local dirige consultas al contenedor local de Gemma sin conexión a Internet.

7. **Planificador y alertas (Frecuencia, alarma diaria, tema de estilo)**
   - **Importancia**: Gestiona el envío automático de alertas de estilo diarias.
   - **Dependencias**: Activa tareas de `APScheduler` en el backend FastAPI. Cada mañana, envía notificaciones push a través de `pywebpush` utilizando las claves VAPID del cliente, de acuerdo con los parámetros de estilo configurados.

8. **Google Calendar (Sincronización OAuth, reglas de exportación)**
   - **Importancia**: Vincula su armario directamente con sus eventos reales del calendario.
   - **Dependencias**: Requiere autenticación a través de Google OAuth. El planificador consulta su calendario para identificar eventos, generar conjuntos y exportarlos directamente a su agenda de Google Calendar.

9. **Servicios de ubicación (Seguimiento GPS, precisión del clima)**
   - **Importancia**: Coordina propuestas adaptadas al clima y filtros geográficos para transacciones locales.
   - **Dependencias**: Activa la geolocalización inversa `navigator.geolocation`. Las coordenadas se envían a la API de OpenWeatherMap para ajustar las recomendaciones del estilista (p. ej., ropa impermeable para lluvias). También calcula distancias para ofertas y expertos locales.

10. **Voz e idioma (Selección de voz del estilista virtual)**
    - **Importancia**: Determina el idioma de los textos y el perfil de voz.
    - **Dependencias**: Controla el idioma activo para las traducciones a través de `react-i18next`. La selección de voz asocia códigos de voz BCP-47 (p. ej., `he-IL` o `ar-JO`) a las voces de síntesis de voz en el navegador o modelos locales Piper TTS.

11. **Invitar amigos (API para compartir datos)**
    - **Importancia**: Proporciona un ciclo viral para la expansión gratuita de la capacidad del armario.
    - **Dependencias**: Adjunta el ID de MongoDB del remitente a la URL. Los nuevos registros leen este ID e incrementan el `closet_capacity_bonus` del remitente en +10 espacios automáticamente, actualizando los límites del armario en `closet.py`.

---

## 3.4 Panel de estadísticas de armario
Analice el valor total del armario, el seguimiento del uso de prendas y los parámetros CPW.

1. Vaya a **Wardrobe Insights**.
2. **Revisar métricas**:
   - *Valor del armario (Closet Worth)*: Suma dinámica de los precios de compra.
   - *Utilización del armario (Closet Utilization)*: Porcentaje de prendas en el armario usadas al menos una vez.
   - *Costo promedio por uso (CPW)*: Calculado como `Precio / Cantidad de usos`.
3. **Gráficos de distribución**: Cambie entre pestañas para ver visualizaciones de Recharts:
   - *Paleta de colores*: Distribución de los valores de color hexadecimales en el armario.
   - *Materiales*: Distribución porcentual de las telas.
   - *Subcategorías*: Distribución de las subcategorías.
4. **Tabla de clasificación de eficiencia**: Muestra las 5 prendas con los valores de CPW más bajos del armario.

---

## 3.5 Lienzo y planificador de conjuntos
Cree conjuntos, combine capas y revise propuestas en el lienzo interactivo del avatar 2D.

1. Abra el planificador **Outfit Canvas**.
2. **Capas de ropa exterior (Lienzo doble)**: Si su conjunto incluye ropa exterior (p. ej., una chaqueta) sobre una camisa, la página muestra dos lienzos de avatar verticales: "With Outerwear" (muestra la chaqueta en la capa exterior) y "Without Outerwear" (muestra la camisa debajo).
3. **Elementos 2D interactivos**: Haga clic directamente en una prenda en el cuerpo del avatar para ir de inmediato a la pantalla de detalles de ese artículo.
4. **Pestaña de métricas**: Haga clic en el botón de detalles y elija la pestaña **Metrics** para ver criterios de compatibilidad:
   - *Armonía de colores* (combinación armoniosa).
   - *Compatibilidad de patrones* (prevención de conflictos de estampados).
   - *Ajuste al cuerpo* (ajuste de tallas).
   - *Alineación climática* (adecuación a la temporada).
   - *Alineación de eventos* (adecuación al tipo de actividad).
   - *Alineación de ubicación* (comprobación del cumplimiento de reglas de recato).
5. **Renombrar/Describir**: Haga clic en el icono del lápiz para editar nombres de conjuntos y descripciones.

---

## 3.6 Asistente de maleta y viajes
Organice su lista de equipaje para viajes de manera inteligente y evite el exceso de peso.

1. Vaya a la página **Suitcase** y complete el formulario de contexto del viaje (destino, fechas de inicio/finalización, categoría del viaje, eventos del calendario).
2. La IA genera una lista de equipaje personalizada y conjuntos diarios según la duración del viaje y los pronósticos del clima local.
3. Realice el seguimiento del empaque. Si falta un artículo importante (p. ej., paraguas para días lluviosos, traje de baño para la playa), el sistema le advertirá y le sugerirá artículos del mercado o de tiendas locales.
4. Utilice el chat integrado para ajustar las sugerencias (p. ej., "Cambia el día 2 a ropa de noche informal"). El asistente actualizará la maleta y mantendrá el resto de la lista.
5. Presione **Approve Suitcase** para la confirmación final de su plan de empaque.

---

## 3.7 Planificador y recordatorios diarios
Configure recordatorios de estilo diarios para recibir sugerencias de conjuntos de forma automática en su teléfono.

1. Abra **Profile** y vaya a **Scheduler & Push**.
2. Active las notificaciones, establezca la hora de alerta diaria, la frecuencia de los días de la semana y el tema del estilo.
3. Cada mañana, la tarea en segundo plano (`APScheduler`) verifica el pronóstico del clima y envía una alerta push.
4. Presione la alerta en su móvil (o entre al centro de notificaciones de la app web) para abrir una ventana con 3 conjuntos sugeridos.
5. Guarde la sugerencia seleccionada directamente en su diario de ropa **Wardrobe Diary**.

---

## 3.8 El mercado circular (Venta, Alquiler, Intercambio, Regalo)
Participe en el mercado circular de moda entre pares.

- **Crear un anuncio**: Abra la página de detalles de un elemento, seleccione **Edit Intent** y elija una opción pública:
  - *For Sale* (En venta): Ingrese precio de venta y moneda (detecta automáticamente su moneda predeterminada a través de la configuración regional).
  - *Rent* (Alquiler): Establezca la tarifa de alquiler diaria y las condiciones de préstamo.
  - *Swap* (Intercambio): Marque el artículo como disponible para intercambio.
  - *Donate* (Donación): Publique el artículo como regalo sin costo.
- **Sincronización de estado**: Los anuncios se publican en el feed del mercado de forma automática. El cliente utiliza `useSyncExternalStore` y caché de IndexedDB local para cargar resultados de búsqueda sin retrasos.
- **Prueba virtual en el sandbox**: Los compradores/arrendatarios pueden realizar una prueba virtual del artículo en venta en relación con las prendas en su propio armario antes de realizar la transacción.
- **Procesamiento de transacciones**:
  - *Compra/Alquiler*: Complete la transacción a través de los botones de PayPal integrados. Los webhooks entrantes notifican al vendedor, cambian el estado del anuncio a vendido/alquilado y registran la transacción en el libro contable de la plataforma descontando la comisión del 7%.
  - *Intercambio*: Los interesados proponen ofertas de intercambio. El propietario recibe correos electrónicos de confirmación para aceptar o rechazar.

---

## 3.9 Panel de administración (Admin Panel)
Verificación del funcionamiento del sistema, contabilidad financiera y gestión de cuentas de usuario.

1. Vaya a `/admin` (disponible para usuarios con rol de administrador).
2. **Resumen general**: Revise el volumen de transacciones y los ingresos por comisiones de la plataforma. Analice la tabla **Provider Activity Table** para supervisar tiempos de respuesta y tasas de error de servicios externos (API de Gemini, API del clima).
3. **Proveedores (Providers)**: Haga clic en **Verify Key** para enviar una prueba a la API de Gemini. Cambie el interruptor **Eyes Vision Override** para redirigir el análisis de imágenes entre el endpoint de Gemini predeterminado y un contenedor local de Gemma.
4. **Usuarios**: Vea el saldo de créditos activos, roles y pagos totales. Utilice acciones directas para promover o degradar usuarios.
5. **Anuncios (Listings)**: Vea el estado de los anuncios y desactive artículos en caso de fraude.

---

## 4. Resultados esperados

- **Carga de elementos**: Los elementos aparecen de inmediato en la cuadrícula del armario (~16 ms). La eliminación del fondo se realiza limpiamente y genera archivos PNG transparentes.
- **Verificación DPP**: El escaneo de pasaportes de productos válidos muestra una tarjeta de información verde con detalles de sostenibilidad.
- **Capas de avatar**: La ropa exterior se representa correctamente sobre las camisas en el lienzo del avatar 2D sin interferir con calzado o sombreros.
- **Respuesta de voz**: Los textos de respuesta del AI Stylist se leen automáticamente y se acompañan de un indicador de onda de sonido visual.
- **Suscripciones**: La actualización a un plan Manager o Professional elimina inmediatamente el mensaje de advertencia del límite de capacidad del armario.

---

## 5. Resolución de problemas

### HTTP 402 Payment Required
- **Problema**: Carga de elementos bloqueada. Ha alcanzado el límite base del armario de 50 elementos (o hasta 200 elementos con bonos de recomendación).
- **Solución**: Vaya a la **página de precios** (`/pricing`) y suscríbase al plan Manager o Professional, o comparta su enlace de recomendación para obtener +10 espacios por registro (hasta un máximo de 200 elementos).

### SSRF Blocked / DNS Error en DPP
- **Problema**: Error al analizar la URL del código QR del pasaporte de producto escaneado.
- **Solución**: El analizador bloquea direcciones IP privadas (como `127.0.0.1` y `192.168.x.x`) para proteger los servidores internos de la plataforma. Asegúrese de que los códigos QR apunten a dominios públicos.

### Permiso de cámara / micrófono denegado
- **Problema**: La ventana de captura/escaneo muestra una pantalla de error con una 'X', o la entrada de voz falla.
- **Solución**: Abra la configuración de permisos del navegador, permita el acceso a la cámara y al micrófono para el dominio y vuelva a cargar la página.

### Chat de estilista fallido / Límites de velocidad alcanzados
- **Problema**: El chat se congela o muestra errores.
- **Solución**: El servidor maneja los errores de límite de velocidad `429` de Gemini y recurre a un algoritmo de selección basado en reglas preestablecidas. Verifique su conexión a Internet.

### Exceso de memoria (OOM) en servidores VPS
- **Problema**: Carga alta en el procesador/memoria del servidor durante los procesos de subida de archivos.
- **Solución**: El proceso de carga utiliza una cola secuencial para subidas de más de 5 elementos a la vez. Asegúrese de que el servidor tenga al menos 4 GB de RAM disponibles.

---

## 6. Limitaciones

- **API de voz en el navegador**: La transcripción de voz a texto integrada está limitada a los navegadores Chrome y Safari; otros navegadores volverán al teclado de texto estándar.
- **Salida de voz sin conexión**: El motor local Piper ONNX en dispositivos móviles utiliza menos perfiles de voz en comparación con el modelo de audio Gemini del servidor.
- **Límites de tamaño de imagen**: Las imágenes subidas para el perfil o el avatar se comprimen localmente en el navegador a un 82% de calidad para cumplir con el límite de 16MB de los documentos de MongoDB.
- **Precisión de análisis de recibos**: En recibos muy borrosos, distorsionados o escritos a mano, la extracción de datos de la transacción puede fallar.
