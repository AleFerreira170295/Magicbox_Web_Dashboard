# Auditoría de descarga de partidas por cable — 2026-10-30

## Conclusión

La descarga estructurada funciona con los firmwares USB actuales de PCB V2
(V2.3.23) y PCB V3 (V2.3.22) en navegadores Chromium con Web Serial. No es
correcto afirmar todavía que funciona con cualquier MagicBox sin condiciones.

## Compatibilidad comprobada por código/binario

- V2.3.23 y V2.3.22 contienen deviceInfoRequest, savedGamesListRequest,
  savedGameDownloadRequest, transferencias fragmentadas y borrado batch.
- El dashboard valida integridad del listado, aísla transferId, descarga una
  partida por vez, conserva en el dispositivo las que fallen y solo habilita el
  borrado de originales ya subidos.
- Respuestas correctas e incorrectas se transportan; un error pedagógico no se filtra.
- Firmwares históricos tienen el protocolo BLE, pero no el puente JSON por USB.
  Deben actualizarse antes de poder descargar por Web Serial.

## Hallazgos bloqueantes

1. Layout histórico 0x82: los artefactos compilados históricos —incluido el
   build V2.3.23— usan la misma tabla segura pero etiquetan la partición de datos
   con subtipo 0x82. El preflight desplegado aceptaba solo 0x83, por lo que podía
   bloquear la actualización de cajas sanas antiguas. El cambio preparado acepta
   exclusivamente ambos layouts conocidos (0x82 y 0x83), sin relajar offsets,
   tamaños, flags, MD5 ni rangos.
2. Límite silencioso de 100 partidas: V2 y V3 reservan solo 100 IDs para el
   listado. Una caja con más partidas deja las restantes fuera del inventario web.
   El cambio preparado eleva el límite práctico a 1024; consume ~4 KiB y ambos
   firmwares conservan más de 278 KiB para variables locales después de compilar.
3. Colisiones de ID: cada partida elegía un número aleatorio de cuatro cifras
   sin comprobar existencia. La probabilidad acumulada de al menos una colisión
   es ~12.75% con 50 partidas y ~42.42% con 100. Una colisión mezcla listado,
   descarga, idempotencia y borrado. El cambio preparado consulta games.txt y
   metadata canónica, reintenta y usa búsqueda determinista antes de iniciar.
4. Sin garantía preventiva de capacidad: existe cálculo de uso de LittleFS en
   firmware, pero el dashboard no lo recibe ni avisa antes de agotar espacio.
5. Daño estructural: filas corruptas pueden ser omitidas por el parser legacy.
   Para una garantía forense absoluta hace falta además una exportación raw de los
   archivos de almacenamiento; la ruta raw del API no reemplaza un transporte raw
   desde el dispositivo.
6. Validación física pendiente: la recuperación V2 y el protocolo de identidad
   se probaron físicamente con cero partidas. Falta una matriz con partidas reales,
   respuestas correctas/incorrectas, varios jugadores, cable interrumpido y ambos
   subtipos de tabla.

## Matriz mínima antes de producción

- V2 sana con tabla 0x82, firmware histórico -> actualización -> listado,
  descarga, subida y borrado selectivo.
- V2 V2.3.23 con al menos tres partidas, incluida una respuesta incorrecta.
- V3 sana con tabla 0x82 y V3 V2.3.22 con el mismo conjunto.
- Más de 100 partidas simuladas y verificación de que el inventario no trunca.
- ID repetido histórico: bloquear borrado automático y preservar respaldo raw.
- Desconexión durante lista, partida y subida: ninguna partida borrada.
- Usuario Home: datos visibles solo para el propietario.

## Estado de los cambios

Los cambios de compatibilidad y firmware están en ramas de trabajo, compilan y
sus contratos pasan. No deben incorporarse a releases ni desplegarse hasta
completar la matriz física y definir el respaldo raw para datos estructuralmente
corruptos.
