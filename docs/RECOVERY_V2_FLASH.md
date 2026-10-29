# Recuperación de PCB V2 tras una imagen completa escrita como aplicación

## Validación física 2026-10-29

Una PCB V2 confirmada por el operador, ESP32-PICO-D4 rev. 1.1, flash 4 MB,
adaptador USB CH340, fue recuperada por consola con V2.3.23.

Verificado en la placa:

- Escritura y hash correctos de bootloader, tabla, selector OTA, aplicación y
  filesystem inicial (cinco verificaciones independientes).
- Arranque real `MagicBox V2.3.23` / `MAGICBOX_HW_V2_PWM32`.
- Handshake USB devuelve la identidad del chip, versión V2.3.23 y hardware V2.
- LittleFS monta correctamente y lee `settings.json`.
- Listado USB vacío completo, índice de chunk 0 y `isLastChunk: true`.
- Modo USB de carga/sincronización con 5V, RFID, audio, aro y BLE desactivados.
- No se observaron errores de arranque en la captura después de recuperar.

El 2026-10-29 el operador confirmó «El firmware funciona perfecto» después de
la recuperación y autorizó la publicación. Se registra como aceptación física
reportada por el operador, sin afirmar pruebas individuales no documentadas de
RFID, BLE, partidas o autonomía. No se ejercitó el flasheo desde navegador;
se usó consola.

## Diagnóstico y evidencia

El bootloader 0x1000, la tabla 0x8000, NVS 0x9000 y LittleFS 0x3d0000 estaban
completamente borrados (FF). Se encontró una tabla válida desplazada a 0x18000.
El contenido total de flash coincidía byte por byte con el antiguo `.merged.bin`
V3 rotado +0x10000 dentro de 4 MB, salvo 12 bytes del selector OTA en 0xe000.
Esto confirma la consecuencia física de escribir una imagen completa en app0:
se desplazó el código y la escritura envolvió el límite de flash, borrando el
arranque/configuración. La región de partidas ya estaba borrada antes de reparar;
no se encontraron partidas recuperables allí.

Se preservaron el dump completo, las regiones por separado, hashes, manifest de
bloques, captura USB y log de escritura en el directorio local privado de backups.
No publicar dumps de clientes ni sus archivos de juegos en el repositorio.

## Respaldo fiable si el enlace USB pierde paquetes

1. Identificar PCB, MAC y tamaño; no confundir tipo ESP32 con revisión de PCB.
2. Intentar lectura a 115200, sin otros procesos usando el puerto. Ante errores,
   pedir cable de datos directo/sin hub; no aceptar un archivo parcial como backup.
3. Usar la API de esptool para checkpoints de 64 KiB, paquetes de lectura de
   1 KiB y comparación MD5 contra el dispositivo antes/después de cada bloque.
   Reintentar solo el bloque fallido y verificar identidad tras reconectar.
4. Para sectores borrados, reconstruir FF solo si el MD5 del dispositivo coincide
   con el bloque FF esperado. Se puede reutilizar contenido conocido únicamente
   si su hash coincide con el del dispositivo; nunca asumirlo por offsets/nombre.
5. Comparar el MD5 de los 4 MB ensamblados con el MD5 de toda la flash del equipo.
   Guardar SHA-256, manifest de procedencia por bloque y copia inmutable del dump.

En esta prueba las lecturas largas fallaron a 460800, 230400 y finalmente 115200.
El respaldo segmentado y verificado se completó; la escritura a 115200 terminó
sin errores y con sus cinco hashes correctos. No confundir el problema de lectura
USB con el problema independiente de firmware/offsets.

## Reparación mínima, no instalación de una imagen completa

Solo proceder con un backup completo verificado y el layout identificado.
No usar `erase-flash` ni escribir un `.merged.bin`.

| Dirección | Archivo / condición |
| --- | --- |
| 0x1000 | Bootloader ESP32 con DIO 40 MHz, 4 MB |
| 0x8000 | Tabla comprobada, mismos offsets y LittleFS subtype 0x83 |
| 0xe000 | Selector app0 conocido, 8192 bytes |
| 0x10000 | Solo aplicación V2 V2.3.23, 1.357.536 bytes |
| 0x3d0000 | Inicialización LittleFS únicamente si todo 0x20000 se verificó FF |

No escribir NVS ni app1. Verificar las cinco regiones por hash y luego resetear
con IO0 alto (DTR false), pulso EN (RTS true → false) antes del handshake.
Inicializar un filesystem comprobado vacío es una operación de recuperación
explícita; el firmware normal sigue sin autoformatear ante un error de montaje.
Si hay bytes de usuario en LittleFS, no sustituirlo por una imagen inicial.

**Detalle importante de particiones:** el preset `min_spiffs` de Arduino core
3.3.8 genera por defecto el subtipo SPIFFS 0x82. El layout de estas releases usa
la etiqueta histórica `spiffs` con subtipo **LittleFS 0x83**. Los offsets/tamaños
coinciden, pero no son tablas idénticas. Para esta reparación se validó con
`gen_esp32part.py` la tabla recuperada, con checksum correcto, y se restauró ese
layout LittleFS. No copiar a ciegas el `.partitions.bin` generado por el preset.
El actualizador web comprueba 0x83 y debe rechazar una tabla incompatible.

Para crear un filesystem inicial tras probar que está completamente borrado:
usar `mklittlefs -c <carpeta-con-settings-V2> -b 4096 -p 256 -s 131072 <salida>`;
listar su contenido antes de escribirlo. Mantener `speakerPin: 32` y los valores
predeterminados V2. Nunca realizar este paso como respuesta automática a un
fallo de montaje.

## Prueba manual después de recuperar

Con USB conectado, la ausencia de aro/sonido es normal: está cargando/sincronizando.
Desconectar USB, esperar unos 12 segundos (detección de retirada en el ciclo de
carga) y mantener el botón 3–4 segundos. Confirmar sonido y aro. Después probar
registro de jugadores, cartas en ambos lectores y pausa/reanudación. Reconectar
USB y descargar la partida resultante, sin borrarla, para verificar persistencia.
