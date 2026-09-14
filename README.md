# Cuaderno de pronósticos

Aplicación web local sin registro ni login. Node.js 22.13+ (incluido en este equipo); sin dependencias npm y sin bases de datos externas.

## Abrir

Hacer doble clic en **Iniciar.cmd**, o ejecutar `npm start` y abrir http://127.0.0.1:3210. Iniciar.cmd ejecuta Iniciar.ps1, que inicia el servidor oculto si no está abierto y abre el navegador. Con `npm start`, Ctrl+C lo detiene. Para detener el proceso oculto, identifica el PID que escucha el puerto 3210 en el Administrador de tareas; no finalices otros procesos Node.

Base persistente exacta: `C:\Users\fcgbr\Documents\Repos\Pronosticos\data\pronosticos.sqlite`. No borrar ni reemplazar data al actualizar la aplicación. SQLite usa WAL; no copiar únicamente el .sqlite mientras está abierto. El botón **Copia local** usa VACUUM INTO para una copia coherente en `data\backups\`. Consulta y exportación funcionan sin internet. Abrir la interfaz vuelve a consultar resultados en segundo plano; los errores se muestran y conservan los datos.

## Historial, copias y restauración

No se recibieron registros históricos. El historial inicial está vacío. Importar JSON acepta un array de pronósticos (añade de forma atómica, mismo ID/contenido no duplica), o una exportación completa `pronosticos-v1` (restaura solo sobre historial vacío para evitar sobreescritura). Una exportación JSON incluye originales, apuestas, resultados, estadísticas, auditoría y criterios. CSV es una exportación de consulta con original_json; la importación utiliza JSON, no CSV. Para restaurar la copia SQLite: detener servidor, conservar la carpeta data actual con otro nombre como respaldo y colocar la copia bajo una carpeta data nueva con el nombre pronosticos.sqlite; iniciar. Nunca mezclar archivos WAL antiguos con una copia restaurada.

Los campos desconocidos de cuota e importe se conservan como null. El importador exige los identificadores, fuentes y datos mínimos para un pronóstico auditable; si el historial antiguo no los contiene, debe adaptarse y verificarse antes de importarlo, sin inventar valores. No se consultan automáticamente otros chats.

## Integración para el analista

Antes de recomendar: leer `docs/ANALYSIS.md`, GET /api/predictions, /api/stats y /api/criteria. Consultar calendario con GET /api/fixtures?league=esp.1&date=2026-09-14 (fecha de ejemplo; usar la actual).

Guardar array u objeto de pronóstico en un archivo y ejecutar `npm run save -- archivo.json`. El comando inserta mediante POST /api/predictions y comprueba los IDs con GET. El contrato y un ejemplo sintético están en `docs/prediction.example.json`: no importarlo en el historial real. Los campos de match se obtienen de /api/fixtures. No hay un generador IA en segundo plano; el analista de esta conversación investiga y utiliza este mecanismo cuando se solicitan pronósticos.

POST /api/bets requiere predictionId, confirmed:true, stake y odds (ambos admiten null), moneda EUR. La interfaz pide confirmación expresa, no credenciales. POST /api/corrections añade reason y note sin sobrescribir originales. POST /api/criteria registra change, reason y evidenceIds. GET /api/history?id=... muestra correcciones/liquidaciones. POST /api/refresh inicia actualización; GET /api/status informa avance y errores. POST /api/backup devuelve la ruta comprobada. Solo escucha loopback, sin cuentas; se rechazan Host/Origin externos y escrituras que no sean application/json.

## Cobertura y reglas

Ver `docs/COVERAGE.md` y `docs/SETTLEMENT.md`. La API pública de ESPN fue probada; no es un contrato estable ni una fuente de cuotas Bet365. El motor solo liquida los mercados y periodos documentados cuando existe regla explícita y datos suficientes. Tarjetas, córners y casos especiales permanecen pendientes de verificación en esta versión.

## Graphify

Graphify-Labs, paquete graphifyy 0.9.61, instalado en `.tools\graphify`, configuración Codex en `.codex` y AGENTS.md. Documentación: https://github.com/Graphify-Labs/graphify.

En un clon nuevo, la aplicación funciona con `npm start` sin instalar Graphify. Para habilitar el grafo en Windows con Python disponible: `python -m venv .tools/graphify`, después `.tools/graphify/Scripts/python.exe -m pip install graphifyy==0.9.61` y `.tools/graphify/Scripts/graphify.exe install --platform codex --project`. Finalmente ejecutar `npm run graph`. El entorno, la configuración local y el grafo generado no se versionan.

Ejecutar `npm run graph` tras cambios importantes (Graphify update más índice documental local). Consultar `.tools\graphify\Scripts\graphify.exe query "settle Store refresh"` o `explain "settle"`. Datos, backups, herramientas y secretos se excluyen mediante .graphifyignore. Extracción de código local sin credenciales; el grafo no sustituye SQLite. La documentación se representa mediante títulos y referencias literales del texto, no mediante inferencias de una IA externa.

## Verificación

`npm test` ejecuta pruebas aisladas en directorios temporales, jamás sobre data real. Comprueba liquidaciones, nulas, casos pendientes, idempotencia, correcciones, importación atómica, persistencia, respaldo/restauración, fallos de red e identidad y rentabilidad. `node scripts/integration-test.js` comprueba la API y el comando de guardado con servidor y base temporales separados.
