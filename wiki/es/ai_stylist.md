# Estilista conversacional con inteligencia artificial

Interactúe con un estilista personal inteligente que conoce su armario, el pronóstico del tiempo y su agenda diaria.

## Descripción general
El Estilista IA es su asistente personal de moda en DressApp. Puede chatear escribiendo o hablando de forma natural. El estilista consulta el clima local, revisa sus eventos de Google Calendar y sugiere conjuntos completos y elegantes combinando prendas que ya posee en su armario.

El motor de estilismo de DressApp funciona con un modelo local optimizado (**Gemma-4-E4B**) que se ejecuta automáticamente para todas las cuentas gratuitas sin necesidad de configurar una clave de API. Para usuarios con clave de Google Gemini propia, DressApp incluye **Respaldo automático por cuota (Quota Fallback)**: si su clave supera los límites de solicitudes o agota su cuota, el sistema redirige la consulta sin interrupciones al modelo local Gemma mostrando un aviso informativo, garantizando que su experiencia nunca falle.

## Requisitos previos
- Al menos una prenda superior, una inferior y un par de zapatos en su armario.
- Permiso de micrófono habilitado para consultas por voz con manos libres.
- *(Opcional)* Google Calendar conectado para sugerencias adaptadas a sus eventos.
- *(Opcional)* Clave de Google Gemini API personal si desea utilizar su propia cuota en la nube.

## Instrucciones paso a paso
1. **Abrir el Estilista**: Toque la pestaña **AI Stylist** en la barra de navegación inferior.
2. **Hable o escriba**: Toque el **icono del micrófono** y pregunte qué ponerse (por ejemplo: *"¿Qué me pongo para un almuerzo informal en un día lluvioso?"* o *"Sugiere un look elegante de negocios"*).
3. **Escuche la respuesta hablada**: El estilista responde con consejos personalizados y muestra tarjetas de atuendos combinados. Toque **Reproducir respuesta** para escuchar el audio en cualquier momento.
4. **Herramienta Shuffle**: ¿Desea nuevas combinaciones? Toque la pestaña **Shuffle** para mezclar su armario y descubrir combinaciones creativas.
5. **Guardar en el diario**: Toque **Guardar en diario** para programar el look en su calendario de estilo.

## Resultados esperados
Sugerencias de atuendos completas y adaptadas al clima, acompañadas de explicaciones habladas. Si su clave de API personalizada se agota, un aviso le informará que el motor local de DressApp respondió a su consulta con total fluidez.

## Solución de problemas
- **El micrófono no detecta palabras**: Compruebe los permisos del navegador o dispositivo para garantizar el acceso al micrófono.
- **El estilista repite atuendos**: Registre sus prendas usadas en el calendario para que el estilista priorice ropa no utilizada recientemente.
- **Aviso "Usando estilista de la plataforma (Quota Fallback)"**: Aparece cuando su clave personal de Gemini supera sus límites. Su solicitud se completó con éxito con nuestro motor local.

## Limitaciones
- El estilista trabaja exclusivamente con las prendas subidas a su armario digital.
- Los usuarios del plan gratuito reciben 10 créditos diarios de estilismo que se reponen cada 24 horas.
