MEPRE Agenda Mejorada
=====================

Qué hace
--------
- Agrega una barra arriba del calendario de MEPRE.
- "Ver lista": muestra la agenda en formato grande y ordenado por día/hora. Funciona tanto en vista Mes como en vista Semana y toma automáticamente la vista actual.
- "Imprimir A4": imprime exactamente la vista actual (Mes o Semana) en una versión limpia, sin ventanas emergentes, y con columna para anotaciones.
- "Exportar .ics": descarga los eventos de la vista actual (Mes o Semana) para importarlos en Google Calendar.
- Todo funciona localmente en el navegador; la extensión no envía los datos a ningún servidor.

Instalación en Chrome
---------------------
1. Descomprimir la carpeta "mepre-agenda-mejorada".
2. Abrir Chrome y escribir: chrome://extensions
3. Activar "Modo de desarrollador" (arriba a la derecha).
4. Pulsar "Cargar descomprimida".
5. Elegir la carpeta "mepre-agenda-mejorada".
6. Abrir MEPRE normalmente y entrar en "Ver Agenda".
7. Arriba del calendario aparecerá "Agenda mejorada" con tres botones.

Google Calendar
---------------
1. En MEPRE pulsar "Exportar .ics".
2. En Google Calendar (web): Configuración > Importar y exportar > Importar.
3. Elegir el archivo MEPRE-agenda-AAAA-MM-DD.ics y el calendario de destino.

Importante
----------
El archivo .ics es una exportación, no una sincronización permanente. Si luego cambia una audiencia en MEPRE, hay que volver a exportar/importar.

Privacidad
----------
La extensión sólo tiene permiso para https://www2.jus.gov.ar/mepre/* y no solicita permisos adicionales.


VERSIÓN 1.1.0
- Corrige la agenda vacía en MEPRE.
- Ya no depende únicamente de clientEvents de FullCalendar: reconstruye fecha y hora a partir del calendario visible.
- La comunicación entre la página y la extensión usa JSON en el DOM para evitar problemas entre contextos aislados de Chrome.
- Mantiene impresión sin pop-ups y exportación ICS en horario de Buenos Aires.


VERSIÓN 1.2.0
- Agrega soporte automático para la vista “Semana” de MEPRE.
- Los botones Ver lista, Imprimir A4 y Exportar .ics trabajan sobre la vista actualmente seleccionada.
- La barra indica “Vista actual: Mes” o “Vista actual: Semana”.
- En la vista semanal, la fecha se reconstruye usando las columnas de FullCalendar y el rango visible de la semana.
- Mantiene el soporte de la vista mensual de la versión 1.1.0.
