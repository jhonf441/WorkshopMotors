# WorkshopMotors -- historial de versiones

## 2.6.6 -- 2026-10-30

- Manifest: sbcRequired true (needs WorkshopService); side bar keeps the group names

## 2.6.5 -- 2026-10-29

- Steps per revolution of each motor (Advisor column), RPM note says the number used

## 2.6.4 -- 2026-10-29

- Phone layout fixes (44 px touch targets, no overflow), Workbench full-screen section picker, clamps hint, interrupted jobs off the table, Machine scale label

## 2.6.3 -- 2026-10-29

- Audit and UX fixes: Jog owns workzeroaxis.g, restart notice with time, shared pulse table with update and download, side bar tooltips, spacing, wider field

## 2.6.2 -- 2026-10-29

- State chips with an icon: the icon carries the color and there is no dot (family.css); chosen chip tinted

## 2.6.1 -- 2026-10-29

- PID chart read from the service (any screen), Activity shows its active filters, health state without the duplicate icon

## 2.6.0 -- 2026-10-29

- Side bars: no gray line, a chosen item goes to the start of its section; Printing: start-up chip without the mode rows, tests notice only when the chip is not green, no-sensor fault reading; Vision: settings cards packed in columns, laser crosses only with Laser mode; Zones: visible mode dot

## 2.5.30 -- 2026-10-28

- Design family: final shared styles

## 2.5.29 -- 2026-10-28

- Design family: page bar with lead, own design css removed, section color as --wf-sec

## 2.5.28 -- 2026-10-28

- Minimalist design: neutral top bar with a solid badge, text menu with a section line, neutral section cards, outline buttons and chips, collapsible long notes

## 2.5.27 -- 2026-10-28

- Release and enable buttons follow the state of each motor

## 2.5.26 -- 2026-10-27

- Plan warnings in words, risk dialogs in DWC style, mesh point selection, link to Machine modes

## 2.5.25 -- 2026-10-27

- Side bar no longer makes the page jump when a shorter section is chosen; start-up chip as in every page (header, same wording)

## 2.5.24 -- 2026-10-26

- Run-time guard: the 3.6 build refuses to start on a host with window.DWC and the 3.7 build outside DWC 3.7.x (visible warning); shipped as a strict per-line zip (dwcVersion 3.6 / 3.7)

## 2.5.23 -- 2026-10-26

- Shared pages: accessible names, contrast, start-up guide button and friendlier errors.

## 2.5.22 -- 2026-10-24

- Start-up assistant: active lines highlighted, single-step way back, dark select options; Lights time picker and defaults; Printing FFF switch; Mesh handles above the points

## 2.5.21 -- 2026-10-24

- Start-up card reports its pending count to the service (machine setup list)

## 2.5.20 -- 2026-10-24

- Charts without readings explain why (StallGuard needs speed)

## 2.5.19 -- 2026-10-23

- Follow a sign-in or logout made in another tab

## 2.5.18 -- 2026-10-23

- One sign-in for every tab (token in localStorage)

## 2.5.17 -- 2026-10-23

- Header: no health chip while signed out

## 2.5.16 -- 2026-10-23

- Compact live job strip in the bar; page header treats an expired session as sign in; numeric PIN field

## 2.5.15 -- 2026-10-23

- Page header asks who is signed in; PIN field is numeric

## 2.5.14 -- 2026-10-23

- Common page header: health chip, session chip, quiet start-up icon when ready

## 2.5.13 -- 2026-10-23

- Side bar sections no longer overflow the page on narrow screens (under 900 px)

## 2.5.12 -- 2026-10-22

- Side-bar pin only while the bar is open; Lights panel counts only the faults the service marks

## 2.5.11 -- 2026-10-22

- Pin on every side bar, thin scrollbars, one sign-in dialog

## 2.5.10 -- 2026-10-22

- Sign-in never opens by itself; keyboard only on touch

## 2.5.9 -- 2026-10-22

- Fix names, values and catalog markers the English rename left behind

## 2.5.8 -- 2026-10-22

- Sessions made clear: not-signed-in chip, sign-in on visitor 403, refusal toast

## 2.5.7 -- 2026-10-22

- Sign-in dialog focus and kiosk keyboard helper; Jog blocked touches explained

## 2.5.6 -- 2026-10-22

- Kiosk keyboard helper call, sign-in dialog font

## 2.5.5 -- 2026-10-22

- Jog and bars tell why an action is blocked and ask for the session; Jog loses the Machine pointer sections

## 2.5.4 -- 2026-10-22

- Sign-in dialog redesign and on-screen keyboard; single floating panel for power actions; risk bar on one line; Jog gear and scrollbar; side tabs transition

## 2.5.3 -- 2026-10-21

- PIN sign enters by itself when the PIN has the length that worked last time

## 2.5.2 -- 2026-10-21

- Side bar: pin next to the fold arrow keeps the bar open

## 2.5.1 -- 2026-10-21

- Page routes in English with redirects from the old ones, localStorage keys migrated to English

## 2.5.0 -- 2026-10-21

- Health and commissioning sections by role, crashSens with the old name still written, settings with revision, route /Plugins/Motors

## 2.4.1 -- 2026-10-21

- Page reloads when the DWC language changes; Vision pins dsf-python below 3.7; meter wizard copy over http

## 2.4.0 -- 2026-10-21

- English migration: texts through the catalog, no in-browser translator, interfaces per part

## 2.3.2 -- 2026-10-21

- Shared notices, motion reasons and chart scale texts translated through the catalog

## 2.3.1 -- 2026-10-20

- English names: remaining values, ids, theme panels and the Vision backend keys (fixes a mismatch with the page)

## 2.3.0 -- 2026-10-20

- All the code, data keys and enum values are in English; stored data is converted by the one-off migration script

## 2.2.2 -- 2026-10-18

- Start-up entry is a chip in the page header

## 2.2.1 -- 2026-10-17

- Machine free rule follows the movement owner settings (like Duet / release seconds)

## 2.2.0 -- 2026-10-16

- Start-up card is now a dialog opened from a strip on the page (one card per function, progress, step-by-step assistant), with a plain explanation for every row

## 2.1.13 -- 2026-10-16

- Start-up assistant (shared piece), Lights: the strip pin is chosen in Advanced (plain LED removed)

## 2.1.12 -- 2026-10-15

- Start-up card (shared piece): Printing assistant renamed so it no longer collides with the card

## 2.1.11 -- 2026-10-15

- Rebuilt with the shared start-up card piece

## 2.1.10 -- 2026-10-15

- Spanish texts with accents and enie

## 2.1.9 -- 2026-10-15

- Hide every mention of another plugin when it is absent

## 2.1.8 -- 2026-10-14

- Cleanup: no more lookups of the old service Id (PiCustomCodes) or mentions of the removed custom G-codes

## 2.1.7 -- 2026-10-14

- Header is its own card above the side bar, like the other pages

## 2.1.6 -- 2026-10-14

- Side bar icons are 18 px like the bar of Vision

## 2.1.5 -- 2026-10-13

- The side bar is like the ones of Vision and the Work table: 190 px, 52 px folded with the double arrow in the middle, it folds by itself after choosing and opens only with the arrow (nothing floats over the page when the pointer passes by)

## 2.1.4 -- 2026-10-13

- The side bar has the double arrow (fold / open) like the bar of Vision, besides folding by itself after choosing

## 2.1.3 -- 2026-10-13

- The side bar has no pin: it is open at first, folds to the icons by itself when something is chosen and opens again over the page with the pointer or the focus

## 2.1.2 -- 2026-10-13

- The side bar uses the same measures and colors as the bar of Vision (190 px, sticky under the DWC bar)

## 2.1.1 -- 2026-10-13

- The side bar can be pinned or collapse by itself (pin button)

## 2.1.0 -- 2026-10-13

- Tabs as a side bar (like Work table and Vision)

## 2.0.2 -- 2026-10-13

- Files and macros written by the plugin are in English; bilingual risk texts

## 2.0.1 -- 2026-10-13

- Official localization completed: no Spanish text left in the sources, texts with parameters are single keys

## 2.0.0 -- 2026-10-13

- Needs WorkshopService 2.0: calls its central API (POST /machine/WorkshopService/api) instead of the custom codes M9003 / M9010, which are gone
- Enable / disable motors, stall calibration notes and the stall as end stop through the API

## 1.13.0 -- 2026-10-13

- Official DWC localization: es.json / en.json via registerPluginLocalization

## 1.12.1 -- 2026-10-12

- Heartbeat so the service reads drivers only while the page is open; read-only handling of the single-place database; origin tags

## 1.12.0 -- 2026-10-12

- Alertas de drivers reales segun el chip, graficas a eleccion con reporte avanzado, final de carrera sin sensor, habilitar y soltar motores (nivel 4); dwcVersion 3.6

## 1.11.0 -- 2026-10-11

- Carpetas en ingles bajo 0:/sys/workshop (datos, disenos, malla, cortar por partes); arreglos de la Mesa de trabajo

## 1.10.1 -- 2026-10-11

- Las paginas vuelven a cargar (punto y coma en safe-saving.js)

## 1.10.0 -- 2026-10-11

- Id nuevo en ingles (Workshop...) y guardado seguro ante cortes de luz

## 1.9.0 -- 2026-10-11

- Id nuevo en ingles (Workshop...) y guardado seguro ante cortes de luz

# TallerMotores -- historial de versiones

## 1.8.5 -- 2026-10-11

- Compatibilidad con los Id nuevos en ingles (etapa 1, sin cambiar el Id); Motores: tabla de referencias del techo de pulsos

## 1.8.4 -- 2026-10-10

- Estilo comun segun DESIGN.md (alto de botones, colores de la paleta, encabezados)

## 1.8.3 -- 2026-10-10

- Los comandos de la pagina van por HTTP desde el primero (antes salian por G-code mientras cargaban los plugins) y reintentan ~15 s si el servicio se esta reiniciando

## 1.8.2 -- 2026-10-10

- Las calibraciones y ajustes guardados quedan anotados en Actividad; estandar de advertencias y nombre visible del servicio

## 1.8.1 -- 2026-10-10

- Comunicacion: el aviso de falta el servicio de la Pi explica en el lugar como se comunica la Pi con la Duet (antes enlazaba a GitHub)

## 1.8.0 -- 2026-10-10

- Pestana Choque: estado de la deteccion de choque del jog sin limites y calibracion de sensibilidad (sys/taller/choque-cal.g)

## 1.7.5 -- 2026-10-10

- Aviso con enlace a la explicacion cuando falta el servicio de la Pi (sin modo SBC, sin PiCustomCodes o detenido)

## 1.7.4 -- 2026-10-10

- Linea de diseno comun: colores por significado, encabezado con el icono del menu, textos legibles con el tema claro de DWC

## 1.7.3 -- 2026-10-10

- Textos legibles con el tema claro de DWC

## 1.7.2 -- 2026-10-09

- Ctrl+rueda / Ctrl+tecla pasan al zoom de Chrome

## 1.7.1 -- 2026-10-09

- Macro prueba-eje con lineas cortas

## 1.7.0 -- 2026-10-09

- Pestana Medir: techo de pulsos real de la placa y corriente de cada motor con pinza; Advisor y Detalles usan el techo medido; datos de motor con drivers legibles

## 1.6.1 -- 2026-10-09

- Tabla de motores: drivers legibles

## 1.6.0 -- 2026-10-09

- Advisor: datos del motor general, por eje y por motor; corriente y voltaje por eje

## 1.5.0 -- 2026-10-09

- Prueba: Z con la sonda y cualquier eje con final de carrera (lista desde la maquina)

## 1.4.1 -- 2026-10-09

- Advisor: limites y consejos para todos los ejes (Z y los que se agreguen), no solo X/Y

## 1.4.0 -- 2026-10-09

- Detalles redisenado: placa y pulsos, tarjetas por eje, drivers con estado, graficas por eje, ayuda plegable; se quito el 'lazo de M122' (no media pulsos)

## 1.3.1 -- 2026-10-09

- Advisor: consejos de aceleracion a partir de las pruebas

## 1.3.0 -- 2026-10-09

- Rediseno: pestanas Resumen / Advisor (consejos por modo, corriente, aceleracion, voltaje del motor) / Prueba (perdida de pasos con G1 H4, escaleras de velocidad y aceleracion) / Detalles

## 1.2.4 -- 2026-10-09

- Graficos: el tooltip se ve tambien en escala 'sin picos' (antes quedaba fuera del grafico)

## 1.2.3 -- 2026-10-09

- Graficos: en escala logaritmica el eje Y muestra numeros (1, 2, 5 de cada decada)

## 1.2.2 -- 2026-10-08

- Escala de graficos: cambiar uno cambia todos

## 1.2.1 -- 2026-10-08

- Velocidad por eje: aclara que es el promedio del ultimo segundo; placa sin motores sin grafico vacio

## 1.2.0 -- 2026-10-08

- Charts de Motores: el historial ya no se borra al cambiar de pagina ni al recargar (sigue juntando datos con la pagina cerrada)

## 1.1.0 -- 2026-10-08

- Graficos: escala lineal / logaritmica / sin picos (boton abajo a la izquierda)

## 1.0.2 -- 2026-10-08

- Nombre visible en ingles

## 1.0.1 -- 2026-10-08

- Graficos: los ejes mantienen el formato (3k, sin diagonal) despues de zoom/pan

