# Auditoría PCB V2 / firmware V0.14 / comportamiento V3

Fecha: 2026-10-29. Estado: código y compilación verificados; prueba física V2 pendiente.

## Incidente confirmado

El dashboard ofrecía `magicbox-v2-V2.3.18.bin`, 4.194.304 bytes,
SHA-256 `aea43cc1dedce2f59d6ac1623393d324f5df3e419e6a0a15353f0b06e886efe8`.
Ese hash coincide exactamente con
`Magicbox_Firmware_V3/build/new-hardware-v2.3.18/MagicBox_V2_3_18.ino.merged.bin`.
Había DOS errores independientes: imagen para PCB V3 etiquetada V2 y una imagen
completa (base 0) escrita como aplicación en 0x10000. En 0x0 contiene FF; su
aplicación real está en 0x10000. La grabación desplazada no produce una aplicación
arrancable y abarca regiones ajenas a app0. El daño concreto a cada equipo o a sus
partidas no puede afirmarse sin leer su flash. No borrar ni formatear para recuperar.

La descarga incorrecta fue retirada del contenedor activo antes del nuevo deploy.
La nueva release elimina ese archivo del árbol público, no lo renombra ni extrae
su app V3 para reutilizarla en V2.

## Fuentes y alcance

- V0.14 original: commit `4e79bbe`, sketch `MagicBox_V0_14.ino`.
- Base V2: tag `old-hardware-v2.3.17`, commit `2b8e2a6`.
- Referencia V3: tag `new-hardware-v2.3.22`, commit `1f73cbf`.
- Nueva aplicación V2: `V2.3.23`, marcador compilado `MAGICBOX_HW_V2_PWM32`.
- Se portaron las partes independientes del hardware de `ba15b84`, `21ec875`,
  `e3f5b80` y `2d9c389`: USB serial, filesystem sin autoformato, cierre del listado
  antes de descarga e identidad. No se trasplantó el perfil eléctrico V3.

## Arquitectura preservada

| Elemento | V0.14 / PCB V2 nueva | V3 |
| --- | --- | --- |
| Audio | PWM GPIO32, driver legacy configurable | DAC GPIO26 / NS8002 |
| GPIO32 | Buzzer | Apagado del amplificador |
| Boost 5 V | GPIO15 activo HIGH | Igual |
| Alimentación RFID | GPIO22 activo LOW | Igual |
| RFID rojo / azul / reset | GPIO27 / 14 / 13; SPI habitual | Igual |
| Aro LED | GPIO25, 16 píxeles | Igual |
| Indicador / botón | GPIO2 / GPIO0 activo LOW | Igual |
| USB / batería / cargador | GPIO4 / GPIO35 ADC1_CH7 / GPIO34 activo LOW | Igual |
| Divisor batería | R1=470k, R2=1M | Igual |
| Deep sleep | Procedimiento legacy y wake por botón/USB | Holds de alimentación y amplificador propios de V3 |
| Blanco de lectura/puntajes | Brillo limitado, evita pico de consumo | Animación V3 de mayor brillo/sonido |

La base V2 conserva las excepciones de polaridad LED por CHIPID. No contiene
`AMP_SYSOFF_PIN`, `dacWrite`, `dacDisable` ni las rutinas de apagado NS8002.
No se copiaron los cambios de hold GPIO de V3 sobre una PCB no probada.

## Paridad de funcionamiento (comparación de cuerpos de funciones)

Se ignoran comentarios, espacios y trazas Serial; esto comprueba paridad de
fuente, no reemplaza una prueba de comportamiento en placa.

- **Game.ino: 70 funciones en ambos perfiles, 69 equivalentes**. Registro,
  jugadores, colores, configuración de mazo, rondas, intentos, puntuación,
  cartas bloqueadas, límites de cartas, pausa/reanudación, timeout y persistencia
  coinciden. Única excepción: `showAccumulatedPoints`, deliberadamente limitada
  en brillo/duración y sin tonos simultáneos por protección de alimentación V2.
- **Button.ino: 7/7**, **Notifications.ino: 4/4**, **OTA.ino: 3/3**, equivalentes.
- **BLE.ino: 56 funciones**. 54 equivalentes; diferencias en exposición de
  `speakerPin`/diagnóstico PWM e identidad `hardware: V2` en los comandos.
  Listado, descarga incremental, bloqueo durante juego y temporización coinciden.
- **Funciones.ino: 60 compartidas + disableSpeakerOutput legacy**. Diferencias
  acotadas a initPins, deep sleep/carga, ajustes de audio, comandos de diagnóstico
  PWM y blanco limitado en lectura RFID. La recuperación de ambos MFRC522,
  selección/liberación de tarjeta, pausa y lógica de cartas se preservan de V2.3.17,
  que ya había portado las correcciones de V3 V2.3.20.
- **Sonidos.ino**: implementación completa intacta de V2.3.17, PWM; melodías
  compartidas iguales a V3, distinto generador y sin funciones de amplificador.
- **USB**: monta LittleFS antes del retorno de modo carga; atiende JSON/listados/
  descargas sin light sleep mientras USB está conectado; no autoformatea fallos.

## Cambios de uso frente al firmware V0.14

Se conserva la política de energía legacy V2.3.16/17 alineada con V3:
USB conectado significa carga/sincronización, sin BLE, lectores, sonido ni aro de
juego. No confundir ese modo silencioso con un equipo averiado. Para juego:
desconectar USB y mantener presionado el botón. Se conserva protección de batería
(3 lecturas <=3,50 V durante uso; comprobación al arranque). El indicador usa el
estado del cargador; la tensión bajo USB no decide si terminó la carga.

## Build reproducible

ESP32 Arduino core 3.3.8, Adafruit NeoPixel 1.15.2, ArduinoJson 7.4.2,
MFRC522 1.4.12, OneButton 2.6.1. Las librerías locales de Documents estaban
inaccesibles como placeholders iCloud; se instalaron esas versiones en un
sketchbook independiente, sin modificar los repositorios originales.

Copiar los `.ino`/`.h` raíz a un staging llamado `MagicBox_V2_2` y ejecutar:

```sh
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=min_spiffs,FlashMode=dio,FlashFreq=40 \
  --build-path build/v2.3.23 build/staging/MagicBox_V2_2
python3 -m unittest discover -s tests -v
esptool image-info build/v2.3.23/MagicBox_V2_2.ino.bin
```

En este host se usó `--config-file /tmp/magicbox-v2-arduino.yaml` para el
sketchbook `/Users/macbook/dev/magicbox-arduino-toolchain`.

- Programa: 1.357.291 bytes, RAM global: 45.888 bytes.
- Archivo app-only: 1.357.536 bytes, ESP32 chip ID 0, DIO 40 MHz, checksum y hash
  interno válidos. App0 disponible: 1.966.080 bytes.
- SHA-256: `c96db95668f653a02451a7b932944210e13eab067cd87d2daad204b00a730327`.
- No distribuir `.merged.bin`, `.bootloader.bin` ni dumps como aplicación.

## Instalación y recuperación preservando datos

El dashboard valida tamaño, SHA-256 publicado, cabecera/segmentos/descriptor,
checksum/hash internos, chip ESP32 y marcador V2; lee la tabla REAL antes de
escribir. Solo acepta el layout min_spiffs conocido (app0 0x10000/0x1e0000,
app1 0x1f0000/0x1e0000, LittleFS 0x3d0000/0x20000, NVS 0x9000/0x5000,
otadata 0xe000/0x2000). Si difiere, aborta sin modificarla: no migrar a ciegas.
Escribe únicamente la aplicación y después el selector app0 validado; no borra
NVS, tabla, app1 ni LittleFS. La selección PCB sigue requiriendo confirmación
física del operador: el modelo de chip ESP32 por sí solo NO identifica V2/V3.

Para una caja afectada: identificar PCB, guardar dump completo y tabla/NVS/OTA/
LittleFS ANTES de cualquier grabación, leer log de arranque y determinar layout.
Regrabar únicamente la app V2 si la tabla lo permite. Un filesystem dañado por
el archivo anterior no se arregla formateándolo; preservar evidencia y buscar
backup. No prometer recuperación de partidas sin comprobarlas.

## Validación física pendiente

No se grabó ni se reinició el puerto conectado, cuya PCB no fue confirmada.
Falta: arranque y wake por botón; sonido PWM; aro y consumo; ambos lectores;
registro/configuración de jugadores/mazo; aciertos/fallos/fin; pausa/reanudación;
BLE; guardar/listar/descargar una partida; reconexión USB; carga/batería/sleep.
Las pruebas software y el build no prueban esos circuitos ni el estado de las
cajas que recibieron la imagen anterior.
