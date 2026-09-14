# Comprobaciones de fuente · 14/09/2026

Cliente Node fetch, sin credenciales:

- https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20260913 devolvió HTTP 200.
- https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/summary?event=401882885 devolvió HTTP 200 para el mismo evento y equipos 85/99.
- Scoreboard trae status.period=2. Summary omite period; contiene dos linescores por equipo y STATUS_FULL_TIME/completed=true. El adaptador contempla ambos formatos, sin asumir que cualquier completed es 90 minutos.
- Scoreboard incluyó wonCorners y eventos de tarjetas. Summary.boxscore.teams incluye wonCorners, yellowCards, redCards, faltas y otras estadísticas. No se presume disponibilidad en cada encuentro ni equivalencia con reglas de tarjetas de Bet365.
- Prueba de scoreboard para 13/09/2026: esp.1 4 eventos, fra.1 3, ger.1 2, ita.1 3, bel.1 4, por.1 3, eng.2 1, irl.1 0, uefa.champions 0; todas respuestas HTTP 200. Cero eventos no demuestra falta de cobertura ni calendario completo. No se afirma haber probado resultados de todas las ligas.
- PowerShell Invoke-WebRequest recibió Access Denied; Node fetch sí funcionó. La aplicación utiliza Node. Se establecen timeout de 12 segundos por evento y errores visibles.

El servidor guarda respuestas de resultados íntegramente en SQLite. Los fixtures consultados para análisis deben incluirse en availableData al guardar la recomendación. Consulta por ID preserva cambios de horario sin buscar por nombre. No hay garantías de disponibilidad, arbitraje, alineaciones o cuotas: deberán investigarse con fuentes adicionales al solicitar análisis.
