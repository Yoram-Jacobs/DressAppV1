# Programación matutina y alertas push

Comience su día con recomendaciones de estilo automáticas y apropiadas para el clima, entregadas directamente en su dispositivo.

## Descripción general
El Programador Matutino automatiza la selección de su atuendo al entregar sugerencias de estilo personalizadas cada mañana. Consulta los pronósticos del clima local y sus actividades diarias (a través de Google Calendar) para generar tres opciones combinadas. Toque la notificación para ver las opciones en su avatar personal, guarde su opción favorita y vea instantáneamente las puntuaciones de compatibilidad con el clima.

## Requisitos previos
- **Notificaciones permitidas**: Las notificaciones push deben estar habilitadas para DressApp en la configuración de su dispositivo o navegador.
- **Artículos en el armario**: Debe tener al menos una prenda superior, una inferior y un calzado cargados en su armario.
- **Google Calendar**: Una cuenta vinculada de Google Calendar (opcional, pero recomendada para que las sugerencias tengan en cuenta sus eventos).
- **Clave de Gemini**: Una clave de API de Gemini personalizada configurada en sus ajustes.

## Instrucciones paso a paso
1. **Habilitar alertas**: Vaya a **Configuración de perfil** -> **Programador y alertas push**. Active el interruptor de notificaciones.
2. **Establecer horario**: Configure la hora y el minuto exactos en que desea recibir su sugerencia (por ejemplo, las 07:30 AM).
3. **Vincular calendario**: En Configuración de calendario, conecte su cuenta de Google Calendar para que la IA conozca su agenda.
4. **Abrir sugerencia**: Cuando llegue la alerta push de la mañana, haga clic en ella. Se le redirigirá directamente a la pestaña **Sugerencia diaria** (Match) en la sección **Estilista** (Stylist).
5. **Ver opciones**: El selector **Programar atuendo** se abrirá automáticamente, mostrando sus tres combinaciones estilizadas representadas directamente en su avatar.
6. **Guardar y revisar**: Toque cualquiera de las sugerencias diarias para programarla en su calendario. La aplicación guardará el atuendo y abrirá inmediatamente un panel de detalles que muestra sus métricas de compatibilidad con el clima (armonía de colores, ajuste de temperatura y consistencia de estilo).

## Resultados esperados
Se entrega una notificación diariamente a la hora elegida. Al hacer clic en ella, se abre la aplicación, se muestran tres opciones en su avatar y se le permite guardar una en su calendario con todos los detalles de compatibilidad.

## Resolución de problemas
- **No llegan las notificaciones**: 
  - Asegúrese de que las notificaciones estén permitidas para el sitio web de DressApp en la configuración del sitio de su navegador o en la configuración de su sistema operativo.
  - Verifique que su dispositivo no esté en modo "No molestar" o "Enfoque" durante la hora de notificación programada.
- **Faltan prendas en el avatar**: 
  - Asegúrese de tener ropa en todas las categorías básicas (prendas superiores, inferiores, zapatos) en su armario para que el programador pueda vestir al avatar correctamente.
- **Recomendaciones genéricas**: 
  - Vincule su Google Calendar para que las sugerencias coincidan con sus eventos diarios específicos.

## Limitaciones
- Puede programar hasta un atuendo por día en su calendario.
- Las actualizaciones del clima requieren una conexión a Internet activa en el servidor.
