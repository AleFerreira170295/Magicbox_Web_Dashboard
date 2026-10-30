# Blindaje de actualización web de firmware

Estado: implementado y probado el 2026-10-30.

## Objetivo

El flujo normal solo actualiza una MagicBox que ya tiene arranque, aplicación y
layout válidos. Una caja dañada se clasifica como recuperación requerida y no se
intenta reparar desde el navegador. La recuperación mantiene respaldo previo y
continúa siendo un procedimiento separado por consola.

## Invariantes antes de escribir

1. La release publicada solo se acepta si versión, tamaño y SHA-256 coinciden
   exactamente con la allowlist compilada para V2 o V3. Una release nueva requiere
   revisión, tests y despliegue del dashboard; no basta cambiar metadata del API.
2. El binario debe ser una aplicación ESP32 app-only: cabecera/descriptor,
   segmentos, DIO 40 MHz, checksum e internal SHA-256 válidos. Se rechazan dumps
   merged, bootloaders, relleno de flash, otros chips y aplicaciones sobredimensionadas.
3. V2 debe contener el marcador compilado MAGICBOX_HW_V2_PWM32; V3 debe carecer
   de ese marcador. El operador sigue confirmando físicamente la PCB porque el
   modelo ESP32 no distingue V2 de V3.
4. Se leen secuencialmente, antes de cualquier escritura, las cabeceras del
   bootloader (0x1000), tabla (0x8000) y app0 (0x10000). Cabeceras borradas o
   inválidas bloquean el flujo normal como recuperación requerida.
5. La tabla debe tener exactamente seis entradas, orden, etiquetas, tipos,
   subtipos, offsets, tamaños y flags conocidos, incluido el subtipo histórico 0x82 o LittleFS 0x83 y el
   registro MD5 de tabla. Extras, ausencia, SPIFFS 0x82, solapamientos o cambios
   de tamaño se rechazan sin escribir.

## Escritura en dos fases

- Fase 1: escribir únicamente app0 en 0x10000 con eraseAll desactivado.
- Verificar el MD5 calculado por el ESP32 contra la allowlist.
- Solo si coincide, fase 2: escribir boot_app0.bin en 0xe000.
- Verificar también el MD5 del selector.
- Nunca escribir bootloader, tabla, NVS, app1 o LittleFS en una actualización normal.
- Si falla la verificación de app0, el selector no se modifica.

## Estados de interfaz

- Firmware cargado correctamente: escritura e integridad de ambos rangos verificadas.
- La MagicBox requiere recuperación: bootloader, tabla o app instalada ausentes o
  incompatibles. El mensaje no recomienda repetir a ciegas ni atribuye el fallo al cable.
- Error de transporte: conserva la guía de revisar puerto/cable y no afirma éxito.

## Cobertura automatizada

Las pruebas cubren binarios reales V2/V3, full-flash de 4 MB, cruce V2/V3,
hashes internos/externos, bootloader y tabla borrados, layouts históricos exactos 0x82/0x83, MD5 de tabla,
activación en dos fases, fallo de MD5 sin tocar selector, otros ESP32 y ausencia de
eraseAll. La suite completa del dashboard debe pasar, además de TypeScript y lint.
El build Linux de producción es la puerta final cuando SWC local no está disponible.
