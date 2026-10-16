# Manual Técnico Completo del Usuario de DressApp

Manual de usuario completo y guía de referencia técnica para el ecosistema de armario personal de DressApp, su motor de estilismo, el mercado circular y los paneles de administración.

---

## 1. Descripción General y Pila Tecnológica

DressApp es un gestor de armario personal, asesor de estilismo y mercado circular impulsado por IA. Ayuda a los usuarios a gestionar sus prendas de vestir de forma digital, recortarlas y etiquetarlas automáticamente, recibir recomendaciones de atuendos adaptadas al clima y a su calendario, escanear Pasaportes Digitales de Productos de la UE (DPP) y comercializar o intercambiar prendas.

### Propuesta de Valor Principal
- **Digitalización del Armario**: Procesamiento de fotos capturadas o subidas con eliminación automatizada del fondo, categorización de ropa y generación de etiquetas de atributos.
- **Estilista Virtual con IA (AI Virtual Stylist)**: Un agente conversacional que revisa contextualmente tu armario, eventos de Google Calendar y pronósticos meteorológicos locales para sugerir atuendos diarios.
- **Mercado Circular (Circular Marketplace)**: Compra, venta, intercambio y alquiler seguro de ropa entre pares (peer-to-peer) para reducir los residuos de la moda rápida.
- **Analítica de Costo por Uso (CPW)**: Información detallada sobre el valor de capitalización del armario, tasas de utilización y optimización del uso.

### Arquitectura Tecnológica
- **Backend Edge**: Python 3.11 con FastAPI, utilizando controladores asíncronos Motor conectados a una base de datos dedicada MongoDB 7.0 en servidores propios (on-premises) sobre almacenamiento NVMe.
- **Frontend SPA**: Aplicación de página única (SPA) en React 19 que utiliza almacenes personalizados basados en `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, primitivas de Shadcn/UI y `react-i18next` con soporte para 13 idiomas locales.
- **Optimización de Estado y Red**: Deduplicación de solicitudes en curso, almacenamiento en caché de 15 minutos en los stores y revalidación de pestañas mediante `visibilitychange`, logrando cero solicitudes GET en segundo plano cuando la aplicación está inactiva.
- **Aprendizaje Automático Local y Cálculo de Tallas**: Recorte de fondo local en CPU con U2-Net (`rembg`), segmentación de prendas con SegFormer-b2, incrustaciones (embeddings) con Fashion-CLIP y modelo de regresión de medidas corporales físicas ANSUR II (`body_predictor.py`). Incluye el contenedor dedicado en servidores propios `dressapp-eyes` que ejecuta un modelo ajustado `Qwen 2.5 VL 3B` (`Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj`) en el puerto 7860 para los usuarios del nivel gratuito (Free Tier) y como respaldo automático de cuotas.
- **STT/TTS Conversacional**: Reconocimiento de voz Web Speech en tiempo real del lado del cliente como respaldo, modulaciones multimodales de Gemini del lado del servidor y motores sin conexión Piper/Sherpa-ONNX en el dispositivo.
- **Servicios de Integración Externa**: API de OpenWeatherMap para consultas meteorológicas, Google Calendar OAuth para exportación de agendas diarias, autocompletado de direcciones con OpenStreetMap (Nominatim) y APIs REST de PayPal Subscriptions/Checkout.

---

## 2. Requisitos Previos

### Requisitos del Entorno de Servidor (Host)
- **Hardware**: VPS con un mínimo de 8 GB de RAM (por ejemplo, VPS Hetzner CPX32 que aloja `dressapp.co` en producción).
- **Dependencias**: Pila de Docker y Docker Compose (incluyendo MongoDB 7.0 en servidores propios, backend, servidor de inferencia eyes, frontend y terminación TLS con Caddy).
- **Variables de Entorno**: Configuración de claves de API (`GEMINI_API_KEY`, `EYES_API_TOKEN`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` y tokens OAuth de Google Calendar).

### Requisitos de la Aplicación para el Usuario
- **Navegador Web**: Google Chrome o Apple Safari (necesarios para la compatibilidad completa con las funciones de voz).
- **Permisos**: Conceder permiso de Cámara (para fotografías de prendas y escaneo de códigos QR) y permiso de Micrófono (para conversaciones de voz).
- **IA por Niveles sin Claves Propias (Zero-BYOK)**: Los usuarios gratuitos utilizan el modelo Eyes en servidores propios (`Qwen 2.5 VL 3B`) de DressApp; los usuarios de los planes Manager y Professional disfrutan del modelo rápido en la nube (`Gemini 3.5 Flash`). No se necesitan claves de API proporcionadas por el usuario.
- **Red**: Conexión activa para el procesamiento de LLM, con almacenamiento en caché IndexedDB que permite explorar el catálogo sin conexión.

---

## 3. Instrucciones Paso a Paso

### 3.1 Registro de Prendas (Añadir Artículos)
PARADIGMAS DE REGISTRO: Fotografía, Pasaportes Digitales de Producto de la UE y Recibos de Comercio Digital.

#### A. Cámara Interactiva y Subida de Archivos
1. Navega hasta la pantalla **Añadir artículo** (*Add Item*).
2. Selecciona **Tomar foto** (abre la cámara nativa del móvil) o haz clic en **Subir fotos** (abre el selector de archivos del sistema operativo).
3. El cliente calcula el hash SHA-256 y el hash de diferencia horizontal (dHash) de la imagen en el navegador (~100-180 ms) para compararla con tu armario actual.
4. Si se encuentra una coincidencia, se abre el **Diálogo de verificación previa de duplicados** mostrando vistas previas coincidentes. Selecciona **Omitir** o **Añadir de todos modos**.
5. Una vez aceptada, el servidor inicia un flujo NDJSON. En un plazo de 5 a 7 segundos se muestra un marco de vista previa provisional que te permite editar los detalles del artículo de inmediato mientras el backend completa el etiquetado.
6. Verifica las etiquetas detectadas automáticamente (color, tejido, ajuste, estampado, ocasión). Si la forma del recorte es incorrecta, cambia el menú desplegable **Categoría**; esto hace que SegFormer vuelva a recortar la prenda automáticamente.
7. Haz clic en **Guardar** para mostrar de forma optimista el artículo en la cuadrícula del armario de inmediato (~16 ms) mientras concluye en segundo plano la generación de miniaturas WebP.

#### B. Escaneo de Pasaportes Digitales de Producto de la UE (DPP)
1. Toca el botón **Escanear QR (DPP)** en la página Añadir artículo.
2. Concede permisos de cámara y alinea el código QR impreso en la etiqueta comercial de la prenda, o sube una captura de pantalla guardada del código QR.
3. El backend resuelve la URL y ejecuta comprobaciones de seguridad contra SSRF (bloqueando rangos de direcciones IP privadas).
4. El sistema extrae los esquemas JSON-LD para obtener la marca, composición de materiales, trazabilidad de la cadena de suministro, huella de carbono y pautas de cuidado.
5. Revisa los datos extraídos que se muestran en el panel acordeón verde **Datos DPP verificados** y haz clic en **Guardar**.

#### C. Importación de Recibos de Comercio Digital
1. Abre la pestaña **Importación digital** (*Digital Import*).
2. Elige un submodo: **Pegar texto**, **Subir imagen**, **Subir PDF** o introducir un **Enlace web**.
3. El backend utiliza modelos de visión multimodal para extraer los datos de la transacción (marca, precio, talla, categoría).
4. Los campos analizados quedan bloqueados por recibo para protegerlos frente a futuros reanálisis visuales. Haz clic en **Guardar** para confirmar.

---

### 3.2 Estilista Virtual Conversacional con IA
Describe tus dudas de estilo y recibe consejos hablados sobre atuendos con manos libres.

1. Navega hasta la pantalla **AI Stylist**.
2. Haz clic en el icono del micrófono `[Microphone]` en la barra de entrada del chat.
3. Di tu consulta en voz alta (por ejemplo, "¿Qué prenda superior combina con mis pantalones beige para un almuerzo al aire libre en un día lluvioso?").
4. Si Web Speech es compatible, tu voz se transcribe en vivo en el cuadro de entrada. Si no lo es, la aplicación graba un archivo WebM y lo sube.
5. El backend enruta las consultas de los usuarios gratuitos al contenedor Eyes en servidores propios (`Qwen 2.5 VL 3B` ajustado) y enruta a los usuarios de los planes Manager y Professional al modelo rápido en la nube (`Google Gemini 3.5 Flash`), con conmutación automática al motor Eyes en servidores propios en caso de alcanzarse límites de velocidad en la nube.
6. El estilista procesa el historial de tu armario, los pronósticos meteorológicos locales y los eventos del calendario para formular una propuesta de estilismo.
7. El estilista pronuncia la respuesta utilizando perfiles de voz preseleccionados (`puck`, `aoede` o `charon`).
8. Toca **Reproducir respuesta** (o **Replay** en modo hebreo) en la tarjeta para volver a escuchar el audio de voz.

---

### 3.3 Perfil, Preferencias y Dependencias de Subsistemas
La página de Perfil sirve como panel de control principal de DressApp. Los campos de configuración influyen directamente en el rendimiento, el enrutamiento y el comportamiento de los módulos posteriores.

##### Dependencias y Justificación de las Secciones del Acordeón

1. **Fotos y Escenario del Avatar Digital (`AvatarViewer2D` y `DynamicAvatar`)**
   - **¿Por qué es importante?**: Renderiza tu identidad visual en todos los lienzos de prueba utilizando un escenario de modo dual (recorte de foto de cuerpo real segmentado frente a maniquí vectorial SVG Bézier 2D dinámico).
   - **Dependencias del subsistema**: Los recortes de fotos se procesan sin fondo mediante U2-Net (`rembg`) local y se reducen de escala en el navegador a un máximo de 1280px al 82 % de calidad para mantenerse dentro del límite de documento de 16 MB de MongoDB. El escenario aplica puntos de referencia posicionales calibrados (`top-[14.5%]` del cuello al escote, `top-[36.5%]` de la pretina a la cintura, `bottom-[2%]` para el plano del calzado) y escalado proporcional de pecho/cadera ($scaleX$). Haz clic en *Eliminar foto* para volver al instante al maniquí vectorial SVG 2D.

2. **Perfil de Estilo (Reglas de modestia, Código de vestimenta)**
   - **¿Por qué es importante?**: Establece límites personales para los atuendos recomendados, evitando que la IA genere sugerencias de estilo inapropiadas.
   - **Dependencias del subsistema**: Los parámetros seleccionados (por ejemplo, restricciones de vestimenta recatada) se incorporan directamente en los prompts de estilismo para Gemini 2.5 Flash, filtrando los resultados compatibles del armario antes de mostrarlos.

3. **Datos Personales (Nombre, Teléfono, Ocupación)**
   - **¿Por qué es importante?**: Personaliza el tono de comunicación y enruta las alertas de notificación.
   - **Dependencias del subsistema**: El nombre del usuario se inserta dinámicamente en los correos electrónicos y notificaciones push del sistema. El número de teléfono sirve como registro de respaldo para alertas programadas. El parámetro de ocupación se envía al LLM del estilista y al clasificador de personalización de Trend Scout para adaptar las propuestas.

4. **Medidas Corporales y Tallas (Modelo de Regresión ANSUR II y Predictor de Tallas)**
   - **¿Por qué es importante?**: Elimina las conjeturas sobre las tallas, permitiendo el cálculo automático de tallas comerciales, la comparación de tallas en tiendas externas y la superposición virtual precisa de capas.
   - **Dependencias del subsistema**: Al introducir 4 parámetros básicos (**Estatura**, **Peso**, **Cintura**, **Longitud del pie**), se activa el modelo de regresión ANSUR II de scikit-learn (`body_predictor.py`) para predecir automáticamente 6 dimensiones estructurales (*Hombros*, *Pecho*, *Cadera*, *Manga*, *Tiro interno*, *Costura exterior*).
     - **Traducción determinista de tallas**: Una vez predichas las medidas continuas, el motor de tallas del backend las convierte dinámicamente en tallas comerciales de ropa: **Talla de camisa** (XS-XXL según el pecho), **Talla de pantalón** (cintura en pulgadas), **Talla de calzado** (estándares de EE. UU. para hombre/mujer y de la UE según la longitud del pie y el género), **Talla de vestido** (EE. UU. 0-14+ según pecho, cintura y caderas) y **Talla de sostén** (banda + copa según el pecho y el bajo busto estimado).
     - **Autocompletado**: Estas tallas comerciales recomendadas se rellenan automáticamente en los campos del *Modo de edición detallada* dentro del panel de perfil.
     - **Integraciones**: Las medidas son consultadas directamente por los scripts de contenido de la extensión de Chrome **Asistente de compras** (*Shopping Assistant*) para leer las tablas de tallas en sitios web asociados (Zara, Asos) y recomendar tallas.

5. **Estilo de Vida (Estado civil, Sexo)**
   - **¿Por qué es importante?**: Adapta las recomendaciones predeterminadas y puntúa los algoritmos de contenido.
   - **Dependencias del subsistema**: La selección de sexo afecta directamente a la lógica de clasificación de las tarjetas diarias de Trend Scout. Si la categoría de una tarjeta de noticias no coincide con el sexo del usuario, el algoritmo aplica una penalización de puntuación de -2.0, relegándola en el feed.

6. **Enrutamiento de Modelos de IA y Planes de Suscripción (Enrutamiento por Niveles Zero-BYOK y Créditos)**
   - **¿Por qué es importante?**: Determina el enrutamiento de modelos por niveles y el consumo de créditos sin necesidad de claves de API del usuario.
   - **Dependencias del subsistema**: Los usuarios del nivel gratuito se enrutan al contenedor Eyes en servidores propios (`Qwen 2.5 VL 3B` ajustado). Los suscriptores de los planes Manager y Professional se enrutan al modelo rápido en la nube (`Google Gemini 3.5 Flash`), con respaldo automático de cuota hacia el motor Eyes en servidores propios.

7. **Programador y Notificaciones Push (Frecuencia, alarma diaria, enfoque de estilo)**
   - **¿Por qué es importante?**: Gestiona los envíos automáticos diarios de propuestas de estilo.
   - **Dependencias del subsistema**: Activa tareas programadas (cron jobs) de `APScheduler` en el backend FastAPI. Cada mañana, lanza notificaciones push mediante `pywebpush` utilizando las claves VAPID del cliente, ajustándose a los parámetros de enfoque de estilo seleccionados.

8. **Google Calendar (Sincronización OAuth, reglas de exportación)**
   - **¿Por qué es importante?**: Conecta tu armario directamente con tus eventos reales del calendario.
   - **Dependencias del subsistema**: Se autentica mediante Google OAuth. El programador consulta tu calendario para identificar eventos, da formato a los atuendos y envía los eventos de vestuario directamente a tu agenda de Google Calendar.

9. **Servicios de Ubicación (Seguimiento GPS, precisión meteorológica)**
   - **¿Por qué es importante?**: Coordina sugerencias adaptadas al clima y filtros de radio geográfico para transacciones locales.
   - **Dependencias del subsistema**: Activa la geocodificación inversa mediante `navigator.geolocation`. Las coordenadas se envían a la API de OpenWeatherMap para ajustar las recomendaciones del estilista (por ejemplo, ropa impermeable para aguaceros). También calcula distancias para anuncios locales del Mercado y expertos (por ejemplo, comprobaciones de radio en Lisboa).

10. **Voz e Idioma (Selección de voz del estilista virtual)**
    - **¿Por qué es importante?**: Establece los diccionarios de texto regionales y las modulaciones de voz.
    - **Dependencias del subsistema**: Controla el idioma activo de las traducciones mediante `react-i18next`. La selección de voz asigna códigos de voz BCP-47 (por ejemplo, `he-IL` o `ar-JO`) a las voces de síntesis Web Speech del cliente o a los modelos Piper TTS sin conexión.

11. **Invitar Amigos (API de enlace para compartir)**
    - **¿Por qué es importante?**: Proporciona un ciclo viral para ampliar gratuitamente la capacidad del armario.
    - **Dependencias del subsistema**: Añade el ID de MongoDB del usuario que invita a la URL. Los nuevos registros consultan dinámicamente este ID e incrementan de forma atómica el campo `closet_capacity_bonus` del referente en +10 espacios, modificando los límites de control en `closet.py`.

---

### 3.4 Panel de Estadísticas del Armario (Wardrobe Insights)
Analiza el valor de capitalización del armario, el seguimiento de uso de las prendas y los parámetros de costo por uso.

1. Navega hasta **Estadísticas del armario** (*Wardrobe Insights*).
2. **Revisar métricas**:
   - *Valor del armario (Closet Worth)*: Suma dinámica de los precios de compra.
   - *Utilización del armario (Closet Utilization)*: Porcentaje de prendas del armario utilizadas al menos una vez.
   - *Costo promedio por uso (CPW)*: Calculado como `Precio / Número de usos`.
3. **Gráficos de distribución**: Alterna entre las pestañas para ver las visualizaciones de Recharts:
   - *Paleta de colores*: Distribución de códigos hexadecimales asignados.
   - *Materiales*: Distribución porcentual de tejidos.
   - *Subcategorías*: Subcategorías asignadas.
4. **Clasificación de eficiencia**: Consulta las 5 prendas principales con las puntuaciones más bajas de costo por uso (CPW).

---

### 3.5 Lienzo y Planificador de Atuendos (Outfit Canvas)
Crea, superpón en capas y revisa propuestas de atuendos en un lienzo de avatar 2D interactivo.

1. Abre el planificador **Lienzo de atuendos** (*Outfit Canvas*).
2. **Capas de ropa de abrigo (Lienzo dual)**: Si tu atuendo incluye una prenda de abrigo (por ejemplo, una chaqueta) sobre una prenda superior, la página renderiza dos módulos de lienzo verticales: "Con abrigo" (*With Outerwear*, que muestra la chaqueta superpuesta) y "Sin abrigo" (*Without Outerwear*, que deja ver la prenda superior debajo).
3. **Elementos 2D interactivos**: Toca directamente cualquier prenda de vestir sobre el cuerpo del avatar. La aplicación te lleva directamente a la pantalla de detalles de esa prenda.
4. **Pestaña de métricas**: Haz clic en el botón de detalles y elige la pestaña **Métricas** (*Metrics*) para ver las barras de progreso de los criterios de compatibilidad:
   - *Armonía de color* (armonía neutra)
   - *Compatibilidad de estampados* (prevención de choque de patrones)
   - *Ajuste corporal* (concordancia de tallas)
   - *Adecuación al clima* (idoneidad para la estación)
   - *Adecuación al evento* (idoneidad para la actividad)
   - *Adecuación a la ubicación* (comprobación de reglas de modestia)
5. **Renombrar/Describir**: Haz clic en el icono del lápiz para editar los nombres y descripciones de los atuendos.

---

### 3.6 Asistente de Maleta (Suitcase Assistant)
Organiza tus necesidades de equipaje para viajes sin llevar ropa de más.

1. Ve a la página **Maleta** (*Suitcase*) y completa el formulario de contexto del viaje (destino, fechas de inicio y fin, categoría del viaje, eventos del calendario).
2. La IA genera una lista de equipaje personalizada y atuendos diarios basados en la duración del viaje y los pronósticos meteorológicos.
3. Revisa el progreso del equipaje. Si falta algún artículo importante (por ejemplo, un paraguas para la lluvia o un bañador para la playa), el sistema te avisa y sugiere opciones compatibles del mercado o de tiendas locales.
4. Utiliza el cuadro de chat integrado para afinar las sugerencias (por ejemplo, "Cambia el día 2 a ropa informal de noche"). El asistente edita la maleta conservando el resto de la lista.
5. Toca **Aprobar maleta** (*Approve Suitcase*) para finalizar tu plan.

---

### 3.7 Programador y Recordatorios Push
Configura alertas diarias de estilismo para recibir recomendaciones de atuendos automáticamente.

1. Abre **Perfil** y ve a **Programador y Push** (*Scheduler & Push*).
2. Activa las notificaciones, establece una hora de notificación diaria, la frecuencia semanal y el tema de enfoque de estilo.
3. Cada mañana, la tarea programada en segundo plano (`APScheduler`) comprueba los pronósticos meteorológicos y envía una notificación push.
4. Toca la notificación en tu dispositivo (o consulta el Centro de notificaciones de la aplicación web) para abrir un diálogo de propuestas que muestra 3 sugerencias de estilo.
5. Guarda una sugerencia directamente en tu **Diario de armario** (*Wardrobe Diary*).

---

### 3.8 Mercado (Reventa, Alquiler, Intercambio y Donación)
Participa en el mercado circular de moda entre pares (peer-to-peer).

- **Crear un anuncio**: Abre la página de detalles de un artículo, selecciona **Editar intención** (*Edit Intent*) y elige una opción no privada:
  - *En venta (For Sale)*: Introduce el precio de venta y la moneda (detecta tu moneda predeterminada según las preferencias regionales).
  - *Alquiler (Rent)*: Establece la tarifa diaria de alquiler y las condiciones de préstamo.
  - *Intercambio (Swap)*: Marca el artículo como abierto a trueque.
  - *Donar (Donate)*: Publica el artículo de forma gratuita.
- **Sincronización de estado**: Los anuncios se propagan automáticamente al feed. El cliente utiliza `useSyncExternalStore` y el almacenamiento en caché de IndexedDB para cargar los parámetros de búsqueda con latencia cero.
- **Sandbox de prueba virtual**: Los arrendatarios o compradores pueden probar cómo combina un artículo anunciado con las prendas de su armario privado antes de finalizar la compra.
- **Pago transaccional**:
  - *Compra/Alquiler*: Completa la transacción mediante los botones integrados de PayPal. Los webhooks capturados notifican al vendedor, cambian el estado del anuncio a vendido/alquilado y registran las transacciones en el libro mayor descontando la comisión del 7 % de la plataforma.
  - *Trueque (Intercambio)*: Los interesados en intercambiar proponen trueques. El anunciante recibe correos electrónicos de confirmación para aceptar o rechazar la propuesta.

---

### 3.9 Panel de Administración (Admin Panel)
Validación de disponibilidad del sistema, contabilidad financiera y gestión de cuentas de usuario.

1. Navega hasta `/admin` (disponible para roles de administrador).
2. **Resumen general (Overview)**: Audita los volúmenes brutos y los resúmenes de ingresos por comisiones de la plataforma. Inspecciona la **Tabla de actividad de proveedores** (*Provider Activity Table*) para ver las estadísticas de disponibilidad de los servicios conectados (API de Gemini, latencia del servicio meteorológico y tasas de error).
3. **Proveedores (Providers)**: Haz clic en **Verificar clave** (*Verify Key*) para enviar un ping directo a la API de Gemini. Activa o desactiva el interruptor **Anulación de visión Eyes** (*Eyes Vision Override*) para enrutar el análisis de imágenes entre el endpoint predeterminado de Gemini y un contenedor local.
4. **Usuarios (Users)**: Consulta los créditos activos, roles y pagos acumulados. Utiliza acciones directas para promover o degradar usuarios.
5. **Anuncios (Listings)**: Consulta los estados de los anuncios y cambia los indicadores activos para suspender artículos fraudulentos.

---

## 4. Resultados Esperados

- **Registro de prendas**: Los artículos aparecen inmediatamente en la cuadrícula del armario (~16 ms). Los recortes de fondo generan resultados PNG limpios y transparentes.
- **Insignia de verificación DPP**: Al escanear pasaportes válidos se muestra la tarjeta informativa verde con detalles de sostenibilidad.
- **Ropa de abrigo en el avatar**: Las prendas de abrigo se muestran correctamente superpuestas sobre las partes superiores en el lienzo del avatar 2D sin recortar sombreros ni calzado.
- **Respuesta por voz**: Las respuestas de texto del estilista virtual reproducen audio hablado automáticamente con un indicador visual de onda sonora.
- **Suscripciones**: Actualizar a un plan Manager o Professional elimina de inmediato el aviso de límite de capacidad del armario.

---

## 5. Solución de Problemas

### Error HTTP 402 Payment Required
- **Problema**: Registro bloqueado. Has alcanzado el límite base de 50 artículos en el armario (o hasta 150 artículos con bonificaciones por recomendación).
- **Solución**: Ve a la **página de Precios** (`/pricing`) y suscríbete al plan Manager o Professional, o comparte tu enlace de invitación para obtener +10 espacios por cada registro (hasta un máximo de 150 artículos).

### Bloqueo SSRF / Error de DNS en DPP
- **Problema**: La URL del pasaporte QR escaneado no se puede analizar.
- **Solución**: El analizador bloquea direcciones IP privadas (por ejemplo, `127.0.0.1`, `192.168.x.x`) para proteger los servidores internos. Asegúrate de que los códigos QR apunten a dominios públicos.

### Permiso de Cámara / Micrófono Denegado
- **Problema**: El visor de captura/escaneo muestra una pantalla de error con una 'X', o falla el dictado por voz.
- **Solución**: Abre los permisos del navegador, habilita el acceso a la Cámara y al Micrófono para el dominio y vuelve a cargar la página.

### Fallo en el Chat del Estilista / Límites de Velocidad
- **Problema**: El chat muestra errores o se congela.
- **Solución**: El servidor intercepta los límites de velocidad `429` de Gemini y recurre a un algoritmo de selección de armario basado en reglas o al motor local Eyes. Verifica tu conexión a Internet.

### Picos de Falta de Memoria (OOM) en el VPS
- **Problema**: Picos de uso de CPU/RAM durante los procesos de subida.
- **Solución**: El registro de prendas utiliza bloqueos de cola secuenciales para lotes de más de 5 artículos. Asegúrate de que el servidor disponga de al menos 4 GB de RAM.

---

## 6. Limitaciones

- **APIs Web Speech del Navegador**: La transcripción nativa de voz a texto está restringida a Chrome y Safari; los demás navegadores recurren a la entrada de texto estándar.
- **Modulaciones sin Conexión en el Cliente**: La síntesis de voz sin conexión Piper ONNX en dispositivos móviles utiliza menos perfiles de voz que el módulo de audio de Gemini en el servidor.
- **Restricciones de Tamaño de Imagen**: Las subidas de avatar y perfil se comprimen localmente en el navegador al 82 % de calidad para mantenerse dentro del límite de documento de 16 MB de MongoDB.
- **Alcance del Análisis de Recibos**: Los recibos muy borrosos, distorsionados o escritos a mano pueden fallar en la extracción de datos.
