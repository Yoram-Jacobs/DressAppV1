# Manual Técnico de Usuario Completo de DressApp

Manual de usuario exhaustivo y guía de referencia técnica para el ecosistema de armario personal DressApp, motor de estilismo, mercado circular y paneles de administración.

---

## 1. Descripción General y Arquitectura Tecnológica

DressApp es un gestor de armario personal impulsado por IA, asesor de imagen y mercado circular. Ayuda a los usuarios a gestionar prendas digitalmente, recortarlas y etiquetarlas automáticamente, recibir recomendaciones de prendas adaptadas al clima y al calendario, escanear Passports Digitales de Producto de la UE (DPP) y comerciar con ropa.

### Propuesta de Valor Principal
- **Ingesta de Armario Digital**: Procesamiento de fotos tomadas o subidas con eliminación automatizada del fondo, categorización de ropa y generación de etiquetas de atributos.
- **Estilista Virtual IA**: Un agente conversacional que revisa en contexto tu armario, eventos de Google Calendar y pronósticos meteorológicos locales para sugerir atuendos diarios.
- **Mercado Circular**: Compra, venta, intercambio y alquiler seguro de ropa entre particulares para reducir el desperdicio de la moda rápida.
- **Analítica de Coste por Uso (CPW)**: Información detallada sobre el valor de capitalización del armario, tasas de utilización y optimización de uso.

### Arquitectura Tecnológica
- **Backend Edge**: Python 3.11 con FastAPI, utilizando controladores asíncronos Motor conectados a un clúster MongoDB Atlas.
- **Frontend SPA**: Aplicación de una sola página en React 19 que utiliza almacenes personalizados `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, primitivas de Shadcn/UI y `react-i18next` con soporte para 12 idiomas.
- **Optimización de Estado y Red**: Deduplicación de peticiones en vuelo, almacenamiento en caché de almacenes durante 15 minutos y revalidación de pestaña al cambiar `visibilitychange`, generando cero peticiones GET en segundo plano en estado inactivo.
- **Machine Learning Local y Tallaje**: Extracción de fondo local en CPU con U2-Net (`rembg`), análisis de ropa con SegFormer-b2, embeddings de Fashion-CLIP y modelo de regresión de mediciones corporales ANSUR II (`body_predictor.py`). Opcionalmente enruta a contenedores GPU autohospedados (SegFormer-b3 + BiRefNet) para operaciones rápidas.
- **STT/TTS Conversacional**: Fallback de reconocimiento de voz Web Speech en el cliente en tiempo real, modulaciones multimodales Gemini 2.5 Flash en el servidor y motores locales offline Piper/Sherpa-ONNX en el dispositivo.
- **Servicios de Integración Externa**: API de OpenWeatherMap para la obtención del clima, OAuth de Google Calendar para la exportación de agendas diarias, autocompletado de direcciones OpenStreetMap (Nominatim) y APIs REST de suscripciones/pago de PayPal.

---

## 2. Requisitos Previos

### Requisitos del Entorno del Servidor
- **Hardware**: VPS con un mínimo de 4 GB de RAM (ej. VPS de Hetzner hospedando el sitio en producción `dressapp.co`).
- **Dependencias**: Stack de Docker & Docker Compose (incluyendo backend, frontend y terminación TLS con Caddy).
- **Variables de Entorno**: Configuración de claves API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` y tokens OAuth de Google Calendar).

### Requisitos de la Aplicación del Usuario
- **Navegador Web**: Google Chrome o Apple Safari (requerido para compatibilidad completa con funciones de voz).
- **Permisos**: Conceder permisos de Cámara (para capturas de prendas y escaneo de QR) y permisos de Micrófono (para conversación por voz).
- **Red**: Conexión activa para procesamiento LLM, con almacenamiento en caché de IndexedDB que permite la navegación del catálogo offline.

---

## 3. Instrucciones Paso a Paso

### 3.1 Ingesta de Prendas (Añadir Artículos)
PARADIGMAS DE INGESTA: Fotografía, Pasaportes Digitales de Producto de la UE y Recibos de Comercio Digital.

#### A. Cámara Interactiva y Subida de Archivos
1. Navega a la pantalla **Añadir Artículo**.
2. Selecciona **Tomar Foto** (inicia la cámara nativa del móvil) o haz clic en **Subir Fotos** (abre el selector de archivos del SO).
3. El cliente calcula el hash SHA-256 de la imagen y el hash de diferencia horizontal (dHash) en el navegador (~100-180 ms) para comprobarlo con tu armario existente.
4. Si se encuentra una coincidencia, se abre el diálogo de **Precomprobación de Duplicados** mostrando vistas previas coincidentes. Selecciona **Omitir** o **Añadir de todos modos**.
5. Una vez aceptado, el servidor inicia un flujo NDJSON. Se muestra un marco de vista previa con marcadores de posición en 5-7 segundos, lo que te permite editar los detalles del artículo de inmediato mientras el backend completa el etiquetado.
6. Verifica las etiquetas detectadas automáticamente (color, tejido, ajuste, estampado, ocasión). Si la forma del recorte es incorrecta, cambia el desplegable **Categoría**; esto activa SegFormer para volver a recortar la prenda automáticamente.
7. Haz clic en **Guardar** para pintar de forma optimista el artículo en la cuadrícula del armario de inmediato (~16 ms) mientras concluye la generación de miniaturas WebP en segundo plano.

#### B. Escaneo de Pasaportes Digitales de Producto (DPP) de la UE
1. Toca el botón **Escanear QR (DPP)** en la página Añadir Artículo.
2. Concede permisos de cámara y alinea el código QR impreso en la etiqueta comercial de la prenda, o sube una captura de pantalla guardada del código QR.
3. El backend resuelve la URL y ejecuta comprobaciones de seguridad SSRF (bloqueando rangos de IP privadas).
4. El sistema analiza los esquemas JSON-LD para extraer marca, composición de materiales, trazabilidad de la cadena de suministro, huella de carbono y pautas de cuidado.
5. Revisa los datos extraídos que se muestran en el panel desplegable verde **Datos DPP Verificados** y haz clic en **Guardar**.

#### C. Importación de Recibos de Comercio Digital
1. Abre la pestaña **Importación Digital**.
2. Elige un submodo: **Pegar Texto**, **Subir Imagen**, **Subir PDF** o ingresa un **Enlace Web**.
3. El backend utiliza modelos de visión multimodal para extraer datos de la transacción (marca, precio, talla, categoría).
4. Los campos analizados quedan bloqueados con respecto al recibo para protegerlos de futuros reanálisis visuales. Haz clic en **Guardar** para confirmar.

---

### 3.2 Estilista Virtual IA Conversacional
Describe dilemas de estilo y recibe consejos de vestuario hablados sin usar las manos.

1. Navega a la pantalla **Estilista IA**.
2. Haz clic en el icono de micrófono `[Microphone]` en la barra de entrada del chat.
3. Pronuncia tu petición (ej. "¿Qué parte de arriba combina con mis pantalones beige para un almuerzo al aire libre con lluvia?").
4. Si Web Speech es compatible, tu voz se transcribe en directo en la caja de entrada. Si no, la aplicación graba un archivo WebM y lo sube.
5. El backend enruta la consulta de voz al contenedor local Gemma4 (recurriendo a la transcripción de Gemini 2.5 Flash si está offline).
6. El estilista procesa tu historial de armario, pronósticos meteorológicos locales y eventos del calendario para formular una propuesta de estilo.
7. El estilista habla la respuesta utilizando perfiles de voz preseleccionados (`puck`, `aoede` o `charon`).
8. Toca **Reproducir respuesta** (o **Reiterar** en modo hebreo) en la tarjeta para volver a escuchar el audio.

---

### 3.3 Perfil, Preferencias y Dependencias de Subsistemas
La página de Perfil sirve como el panel de control principal de DressApp. Los campos de configuración impactan directamente en el rendimiento, enrutamiento y comportamiento de los módulos derivados.

##### Dependencias y Justificación de las Secciones Desplegables

1. **Escenario de Fotos y Avatar Digital (`AvatarViewer2D` y `DynamicAvatar`)**
   - **¿Por qué importa?**: Renderiza tu identidad visual en todos los lienzos de prueba mediante un escenario de doble modo (recorte de foto de cuerpo real segmentado frente a maniquí vectorial SVG Bezier 2D dinámico).
   - **Dependencias de Subsistemas**: Los recortes de fotos se separan del fondo mediante U2-Net (`rembg`) local y se reducen en el navegador a un máximo de 1280px con un 82% de calidad para mantenerse dentro del límite de 16 MB por documento de MongoDB. El escenario aplica puntos de referencia calibrados (`top-[14.5%]` de cuello a escote, `top-[36.5%]` de cinturilla a cintura, `bottom-[2%]` plano de calzado) y escalado proporcional de pecho/cadera ($scaleX$). Haz clic en *Eliminar foto* para volver de inmediato al maniquí vectorial 2D SVG.

2. **Perfil de Estilo (Reglas de recato, Código de vestimenta)**
   - **¿Por qué importa?**: Establece límites personales para los atuendos recomendados, evitando que la IA genere sugerencias de estilo inadecuadas.
   - **Dependencias de Subsistemas**: Los parámetros seleccionados (ej. restricciones de ropa modesta) se introducen directamente en los prompts de estilismo para Gemini 2.5 Flash, filtrando los resultados coincidentes del armario antes de mostrarse.

3. **Detalles (Nombre, Teléfono, Ocupación)**
   - **¿Por qué importa?**: Personaliza el tono de comunicación y enruta las alertas de notificación.
   - **Dependencias de Subsistemas**: El nombre del usuario se incluye dinámicamente en correos electrónicos y notificaciones push del sistema. El número de teléfono sirve como registro de respaldo para alertas programadas. El parámetro de ocupación se pasa al LLM del estilista y al clasificador de personalización Trend Scout para ajustar las propuestas.

4. **Medidas Corporales y Tallaje (Modelo de Regresion ANSUR II)**
   - **¿Por qué importa?**: Elimina las dudas sobre el tallaje, permitiendo la comparación de tallas en comercios externos y una superposición virtual precisa.
   - **Dependencias de Subsistemas**: Introducir 4 parámetros básicos (**Altura**, **Peso**, **Cintura**, **Largo del pie**) activa el modelo de regresión ANSUR II de scikit-learn (`body_predictor.py`) para predecir automáticamente 6 dimensiones estructurales (*Hombros*, *Pecho*, *Cadera*, *Manga*, *Entrepierna*, *Largo exterior*). Las medidas son consultadas directamente por los scripts de contenido de la extensión de Chrome **Asistente de Compras** para leer tablas de tallas en sitios web asociados (Zara, Asos) y recomendar tallas.

5. **Estilo de Vida (Estado, Sexo)**
   - **¿Por qué importa?**: Adapta las recomendaciones predeterminadas y puntúa los algoritmos de contenido.
   - **Dependencias de Subsistemas**: La selección de sexo afecta directamente a la lógica de clasificación de las tarjetas diarias de Trend Scout. Si la categoría de una tarjeta de noticias no coincide con el sexo del usuario, el algoritmo aplica una penalización de -2.0 puntos, relegándola en el feed.

6. **Configuración de IA (Claves SaaS, modo edge, créditos)**
   - **¿Por qué importa?**: Determina el enrutamiento de facturación, el rendimiento operativo y el estado offline de la red.
   - **Dependencias de Subsistemas**: Enruta las peticiones de generación de texto/audio. Las configuraciones estándar consumen créditos del sistema DressApp. Introducir claves API personales (Google AI Studio, Anthropic, OpenAI) redirige los cargos a las cuentas de facturación de desarrollador del usuario. Seleccionar el modo local edge redirige las peticiones al contenedor offline Gemma.

7. **Programador y Push (Frecuencia, alarma diaria, enfoque de estilo)**
   - **¿Por qué importa?**: Gestiona los avisos diarios automáticos de estilo.
   - **Dependencias de Subsistemas**: Activa tareas cron de `APScheduler` en el backend de FastAPI. Cada mañana, dispara notificaciones push mediante `pywebpush` usando las claves VAPID del cliente, coincidiendo con los parámetros de enfoque de estilo seleccionados.

8. **Google Calendar (Sincronización OAuth, reglas de exportación)**
   - **¿Por qué importa?**: Conecta tu armario directamente con tus eventos reales del calendario.
   - **Dependencias de Subsistemas**: Autentica a través de Google OAuth. El programador consulta tu calendario para identificar eventos, dar formato a los atuendos y enviar los eventos directamente a tu agenda de Google Calendar.

9. **Servicios de Ubicación (Seguimiento GPS, precisión meteorológica)**
   - **¿Por qué importa?**: Coordina sugerencias apropiadas para el clima y filtros de radio de transacción local.
   - **Dependencias de Subsistemas**: Dispara la geocodificación inversa `navigator.geolocation`. Las coordenadas se envían a la API de OpenWeatherMap para ajustar las recomendaciones del estilista (ej. ropa de lluvia ante chubascos). También calcula distancias para publicaciones del Mercado local y expertos (ej. comprobaciones de radio en Lisboa).

10. **Voz e Idioma (Selección de voz del estilista virtual)**
    - **¿Por qué importa?**: Establece los diccionarios de texto locales y las modulaciones de voz.
    - **Dependencias de Subsistemas**: Controla el idioma activo para traducciones mediante `react-i18next`. La selección de voz asigna códigos de voz BCP-47 (ej. `he-IL` o `ar-JO`) a voces de síntesis Web Speech del cliente o modelos Piper TTS offline.

11. **Invitar a Amigos (API de payload para compartir)**
    - **¿Por qué importa?**: Proporciona un bucle viral para la expansión gratuita del armario.
    - **Dependencias de Subsistemas**: Añade el ID de MongoDB del referente a la URL. Los nuevos registros consultan dinámicamente este ID e incrementan de forma atómica el `closet_capacity_bonus` del referente en +10 espacios, modificando los límites de protección en `closet.py`.

---

## 3.4 Panel de Análisis del Armario
Analiza el valor de capitalización del armario, el seguimiento de la utilización de prendas y los parámetros de coste por uso.

1. Navega a **Análisis del Armario**.
2. **Revisar Métricas**:
   - *Valor del Armario*: Suma dinámica de los precios de compra.
   - *Utilización del Armario*: Porcentaje de prendas del armario usadas al menos una vez.
   - *Coste Medio por Uso (CPW)*: Calculado como `Price / Wear Count`.
3. **Gráficos de Distribución**: Cambia de pestaña para ver visualizaciones de Recharts:
   - *Paleta de Colores*: Distribución de códigos hexadecimales asignados.
   - *Materiales*: Distribución de porcentajes de tejidos.
   - *Subcategorías*: Subcategorías asignadas.
4. **Tabla de Clasificación de Eficiencia**: Muestra las 5 mejores prendas con la puntuación más baja de Coste por Uso.

---

## 3.5 Lienzo de Atuendos y Planificador
Construye, superpone prendas y revisa propuestas de atuendos en un lienzo interactivo de avatar 2D.

1. Abre el planificador **Lienzo de Atuendos**.
2. **Superposición de Ropa Exterior (Lienzo Doble)**: Si tu atuendo incluye ropa exterior (ej. una chaqueta) sobre una prenda superior, la página renderiza dos módulos de lienzo verticales: "Con Ropa Exterior" (mostrando la chaqueta superpuesta) y "Sin Ropa Exterior" (revelando la prenda inferior).
3. **Elementos 2D Interactivos**: Toca directamente cualquier prenda sobre el cuerpo del avatar. La aplicación te redirigirá directamente a la pantalla de detalles de esa prenda.
4. **Pestaña de Revisión de Métricas**: Haz clic en el botón de detalles y elige la pestaña **Métricas** para ver barras de progreso de los criterios de compatibilidad:
   - *Armonía de Color* (armonía neutra)
   - *Compatibilidad de Estampados* (prevención de choque de estampados)
   - *Ajuste Corporal* (coincidencia de talla)
   - *Adaptación al Clima* (idoneidad según la estación)
   - *Adaptación al Evento* (idoneidad según la actividad)
   - *Adaptación a la Ubicación* (comprobaciones de reglas de recato)
5. **Renombrar/Describir**: Haz clic en el icono de Lápiz para editar los nombres y descripciones de los atuendos.

---

## 3.6 Asistente de Maleta
Organiza tus necesidades de equipaje para los viajes sin empacar en exceso.

1. Ve a la página **Maleta** y completa el formulario Contexto del Viaje (destino, fechas de inicio/fin, categoría del viaje, eventos de agenda).
2. La IA genera una lista de equipaje personalizada y atuendos diarios basados en la duración del viaje y las previsiones meteorológicas.
3. Revisa el progreso del equipaje. Si falta un artículo importante (ej. paraguas para la lluvia, traje de baño para la playa), el sistema te alerta y sugiere coincidencias del mercado o tiendas locales.
4. Usa la caja de chat integrada para ajustar las sugerencias (ej. "Cambia el día 2 a ropa informal de noche"). El asistente edita la maleta manteniendo el resto de la lista.
5. Toca **Aprobar Maleta** para finalizar tu plan.

---

## 3.7 Programador y Recordatorios Push
Configura alertas de estilo diarias para recibir recomendaciones de atuendos automáticamente.

1. Abre **Perfil** y ve a **Programador y Push**.
2. Activa las notificaciones, establece una hora diaria de notificación, la frecuencia de días de la semana y el tema del enfoque de estilo.
3. Cada mañana, la tarea cron en segundo plano (`APScheduler`) comprueba la previsión del tiempo y envía una notificación push.
4. Toca la notificación en tu dispositivo (o abre el Centro de Notificaciones de la aplicación web) para abrir un diálogo con 3 sugerencias estilizadas.
5. Guarda una sugerencia directamente en tu **Diario de Armario**.

---

## 3.8 Mercado (Reventa, Alquiler, Intercambio, Donación)
Participa en el mercado de moda circular entre particulares.

- **Crear una Publicación**: Abre la página de detalles de un artículo, selecciona **Editar Intención** y elige una intención no privada:
  - *En venta*: Introduce el precio de lista y la moneda (detecta tu moneda predeterminada según la configuración regional).
  - *Alquiler*: Establece la tarifa diaria de alquiler y las condiciones de préstamo.
  - *Intercambio*: Marca el artículo abierto para trueque.
  - *Donar*: Publica el artículo gratis.
- **Sincronización de Estado**: Las publicaciones se propagan al feed automáticamente. El cliente utiliza `useSyncExternalStore` y almacenamiento en caché IndexedDB para cargar parámetros de búsqueda sin latencia.
- **Sandbox de Prueba**: Los arrendatarios/compradores pueden probar cómo combina una publicación con prendas de su armario privado antes de pagar.
- **Proceso de Pago**:
  - *Compra/Alquiler*: Completa la transacción mediante botones integrados de PayPal. Los webhooks capturados notifican al vendedor, cambian el estado del anuncio a vendido/alquilado y registran transacciones en el libro mayor restando la comisión de plataforma del 7%.
  - *Trueque (Intercambio)*: Los interesados proponen intercambios. El anunciante recibe correos electrónicos de confirmación para aceptar o rechazar.

---

## 3.9 Panel de Administración
Validación del estado del sistema, contabilidad financiera y gestión de cuentas de usuario.

1. Navega a `/admin` (disponible para roles de administrador).
2. **Descripción General**: Audita los Volúmenes Brutos y resúmenes de ingresos por Tarifas de Plataforma. Inspecciona la **Tabla de Actividad de Proveedores** para ver estadísticas de estado (API de Gemini, latencia del servicio meteorológico y tasas de error).
3. **Proveedores**: Haz clic en **Verificar Clave** para enviar un ping directo a la API de Gemini. Activa el conmutador **Eyes Vision Override** para enrutar el análisis de imagen entre el endpoint predeterminado de Gemini y un contenedor local de Gemma.
4. **Usuarios**: Consulta créditos activos, roles y pagos acumulados. Utiliza acciones directas para Promocionar o Degradar usuarios.
5. **Publicaciones**: Revisa el estado de los anuncios y conmuta banderas activas para suspender artículos fraudulentos.

---

## 4. Resultados Esperados

- **Ingesta**: Los artículos pueblan de inmediato la cuadrícula del armario (~16 ms). El recorte en segundo plano genera resultados PNG limpios y transparentes.
- **Insignia DPP Verificada**: Al escanear pasaportes válidos se muestra la tarjeta de información verde con detalles de sostenibilidad.
- **Ropa Exterior en Avatar**: La ropa exterior se muestra correctamente superpuesta sobre la parte superior en el lienzo del avatar 2D sin ocultar sombreros o calzado.
- **Respuesta de Voz**: Las salidas de texto del Estilista Virtual reproducen el audio hablado automáticamente con un indicador de forma de onda visible.
- **Suscripciones**: Activar Pro elimina de inmediato la advertencia del límite de 150 artículos.

---

## 5. Resolución de Problemas

### HTTP 402 Payment Required
- **Problema**: Ingesta bloqueada. Has alcanzado el límite máximo básico de 150 artículos en el armario.
- **Solución**: Ve a Perfil -> Suscripción y actualiza a Pro, o comparte tu enlace de invitación para obtener +10 espacios por registro.

### SSRF Bloqueado / Error de DNS en DPP
- **Problema**: La URL del pasaporte QR escaneado no se puede analizar.
- **Solución**: El analizador bloquea direcciones IP privadas (ej. `127.0.0.1`, `192.168.x.x`) para proteger servidores internos. Asegúrate de que los códigos QR apunten a dominios públicos.

### Permiso de Cámara / Micrófono Denegado
- **Problema**: La vista de captura/escaneo muestra una pantalla de error 'X' o la escritura por voz falla.
- **Solución**: Abre los permisos del navegador, habilita el acceso a la Cámara y el Micrófono para el dominio y recarga la página.

### Fallo en Chat del Estilista / Límite de Peticiones
- **Problema**: El chat muestra errores o se congela.
- **Solución**: El servidor captura los límites de tasa `429` de Gemini y recurre a un algoritmo de selección de armario basado en reglas. Verifica tu conexión a internet.

### Picos de Memoria (OOM) en VPS
- **Problema**: Picos de CPU/RAM durante procesos de subida.
- **Solución**: La ingesta utiliza bloqueos de cola secuenciales para lotes de >5 artículos. Asegúrate de que el servidor tenga al menos 4 GB de RAM.

---

## 6. Limitaciones

- **APIs de Web Speech del Navegador**: La traducción nativa de Voz a Texto está restringida a Chrome y Safari; otros navegadores recurren a la entrada de texto estándar.
- **Modulaciones Offline del Cliente**: La síntesis de voz Piper ONNX offline en móviles utiliza menos perfiles de voz que el modelo modal de audio Gemini del servidor.
- **Restricciones de Tamaño de Imagen**: Las subidas de avatar y perfil se comprimen localmente en el navegador al 82% de calidad para no superar el límite de 16 MB de los documentos MongoDB.
- **Alcance del Análisis de Recibos**: Los recibos muy borrosos, distorsionados o manuscritos pueden fallar en la extracción de datos.
