# Decisión 005: Forest, cuatro pestañas y una acción de registro aparte

Fecha: 2026-09-30. Aceptada: decisión del dueño, definitiva, para la app nativa (Producto
24UX6A, PR #70, rama `feat/producto-24ux6a-home-shell`). Complementa las decisiones 001, 002
y 004. **Reemplaza** la navegación y el sistema visual de la
[decisión 003](003-five-tabs-and-cards.md), la regla de Producto 22 «cinco pestañas con el
Asistente en el centro» y el rechazo de un «+» flotante de la primera iteración de 24UX6A
(detalle abajo, «Qué reemplaza»). No cambia ninguna regla contable: las invariantes de tarjetas
1–8 de la decisión 003 siguen vinculantes y fijadas por `packages/domain/card-invariants.test.ts`.

*Enmendada el 2026-10-01 por Producto 24UX6C (presentación de movimientos, Inicio y Más): ver «Enmienda 2026-10-01 —
Producto 24UX6C» al final; las frases reemplazadas están marcadas en su lugar.* *Enmendada otra vez el 2026-10-01 por
Producto 24UX6C2 (la actividad de Inicio incluye transferencias; los compromisos en una ventana de 30 días; una fila
contextual del presupuesto general cuando pide atención; la dona no repite el total): ver «Enmienda 2026-10-01 —
Producto 24UX6C2» al final.* *Enmendada otra vez el 2026-10-01 por Producto 24UX6D (Reportes Categorías sin total
externo, con el total del período en el centro de la dona; la fila del presupuesto general como fila de progreso;
Tarjetas con el saldo y los datos planos y la regla de franjas del mazo): ver «Enmienda 2026-10-01 — Producto 24UX6D» al
final, con su refinamiento del dueño (la atención de presupuestos de Inicio incluye los presupuestos por categoría, dos
filas como máximo; la composición de Reportes queda congelada; la selección de Tarjetas, razonada).* *Enmendada otra
vez el 2026-10-01 por Producto 24UX6E (más destinos financieros en Forest: en Deudas el color marca el estado y no la
dirección; el presupuesto general plano con el héroe en tinta salvo excedido; resúmenes planos y una sola nota de ciclo
de vida en Cuentas, Presupuestos, Recurrentes, Deudas y Categorías; sin chevron en una fila que abre un editor modal; el
ámbar de Recurrentes solo para un gasto): ver «Enmienda 2026-10-01 — Producto 24UX6E» al final. Con ella se cierra la
línea visual amplia de Forest.* *Enmendada el 2026-10-03 por Producto 25VIS1, **aceptada por el dueño en el iPhone** el
mismo día como la paleta actual del producto (los colores de Forest reemplazados por Electric Lime con los mismos tokens; navegación, composición y
reglas semánticas sin cambio): ver «Enmienda 2026-10-03 — Producto 25VIS1» al final.*

## Decisión

1. **Cuatro pestañas:** Inicio, Movimientos, Reportes y Más. Tarjetas sigue en Más → Finanzas.
   El Asistente deja de ser pestaña.
2. **Una acción de registro separada, el «+»**, al lado de las pestañas y fuera de la lista de
   pestañas. Abre el hub Registrar con cuatro opciones, en este orden: **Asistente, Gasto,
   Ingreso, Transferencia**.
3. **El Asistente es una pantalla de la pila raíz** (`app/assistant.tsx`), con una conversación
   que vive en memoria durante la sesión de la app: no se guarda, cerrar la app la borra.
4. **Identidad Forest:** una paleta de pino en la ventana de tono 158–168° con una regla
   semántica nueva para gasto, ingreso y transferencia. Las categorías no cambian.
5. **Inicio** es un campo financiero (derivado de la propuesta B del dueño, no de B2) con el
   mes, el número y su alcance, y debajo solo próximos compromisos y actividad reciente.

## Qué reemplaza

| Antes | Dónde | Ahora |
| --- | --- | --- |
| La tabla de cinco pestañas (Inicio, Movimientos, Reportes, Tarjetas, Ajustes) y «no hay pestaña central de "acción" ni de IA» | Decisión 003, §Navegación (ya desactualizada frente al código desde Producto 22) | Cuatro pestañas y el «+» aparte (§Navegación, abajo) |
| «Cinco pestañas, cada una con un significado, el Asistente en el centro» (Inicio, Movimientos, Asistente, Reportes, Más) | Producto 22; principios de `docs/mobile-roadmap.md`; `docs/mobile-design.md`, «Producto 22» | El Asistente es la primera opción del hub y una pantalla de la pila raíz |
| Un «+» flotante persistente rechazado (competía con la pestaña central del Asistente) y la cápsula «＋ Registrar» bajo el número con su hoja de cuatro filas; la barra con etiquetas visibles y la pestaña elegida en cobalto | Primera iteración de 24UX6A (roadmap y `docs/mobile-design.md`, «Producto 24UX6A») | El «+» del dock y el hub Registrar; Inicio ya no tiene botón Registrar; el dock es solo íconos |
| Primario cobalto/zafiro; gasto coral, ingreso verde, transferencia azul, alerta ámbar | Decisión 003, §Sistema visual; `docs/mobile-design.md`, «Primario FinanzApp» y «Semántica aparte» | Forest y su regla semántica (§Sistema visual, abajo) |

Las secciones reemplazadas quedan escritas como registro histórico, marcadas en su lugar; no se
borra ninguna entrega pasada.

## Navegación

- **Raíces.** `app/(tabs)/_layout.tsx` declara cuatro raíces: `index` (Inicio, sin encabezado),
  `activity` (Movimientos, conserva el «+» de su encabezado hacia `/new-entry`) *(Reemplazado el 2026-10-01 por 24UX6C: ver «Enmienda 2026-10-01 — Producto 24UX6C», abajo.)*, `reports`
  (Reportes) y `settings` (Más). No hay pestaña de Asistente.
- **Mitigación de pantallas negras, sin cambio.** `src/ui/navigation.ts` sigue igual:
  `detachInactiveScreens: false`; cada pestaña `animation: 'none'`, `lazy: false`,
  `freezeOnBlur: false`; fondo de escena opaco. Las cuatro raíces quedan montadas, sin
  fade/detach/freeze. **No hay fundido entre pestañas** hasta que exista evidencia en un iPhone.
  La pila nativa y las hojas siguen siendo dueñas de cada transición.
- **El dock** (`src/ui/floating-tab-bar.tsx`, geometría pura en `src/ui/dock-geometry.ts`) es un
  objeto en dos partes: una píldora de pino con las cuatro pestañas y, 10 pt a su derecha, el «+»
  de 60 pt. Ambos miden 60 pt de alto, a 16 pt de los bordes (más el inset lateral en
  horizontal), apoyados en la parte alta del área del indicador de inicio
  (`tabBarBottomGap`: inset − 14, mínimo 10; 10 sin indicador). **Queda en el layout, nunca
  encima del contenido:** cada pantalla termina arriba de él, y el compositor del Asistente, el
  teclado y las áreas seguras funcionan como antes (la razón de 24UX6A sigue valiendo).
  *(Reemplazado el 2026-10-02 por 25UX1: el dock flota sobre las raíces, sin franja detrás; ver «Enmienda 2026-10-02 —
  Producto 25UX1», abajo.)*
- **Pestañas solo con íconos a la vista, nombradas por completo para la tecnología de apoyo.**
  Sin texto visible. VoiceOver oye cada pestaña como la barra del sistema: en iOS un botón
  «Inicio, pestaña, 1 de 4» (`nav.tabPosition`; el rol `tab` de React Native no da rasgo en
  iOS), el rol `tab` en otras plataformas, y el estado seleccionado. El visor de contenido grande
  de iOS muestra el nombre al mantener presionado con tamaños de accesibilidad. Cada pestaña es un
  blanco de 48 pt de alto y de unos 65 pt de ancho a 375 pt (unos 70 a 393 pt).
- **El estado elegido nunca es solo color:** glifo relleno más una cápsula `dockActive` detrás
  del glifo; las demás pestañas, glifo de contorno en `dockInk`.
- **Eventos.** Tocar emite `tabPress` (prevenible) y navega solo a una pestaña no elegida y no
  prevenida; mantener presionado emite `tabLongPress`.
- **El «+» no es una pestaña.** Un botón «Registrar» («Abre las opciones para registrar»), fuera
  de la lista de pestañas, sin estado elegido, con un toque háptico liviano. **Solo toque:** sin
  pulsación larga en esta versión.

## Registrar: el hub

- `src/ui/capture-hub.tsx`. El «+» abre una hoja flotante sobre el dock (`BottomSheet` con
  `floating`: tarjeta de 32 pt de radio, título pequeño «Registrar», sin fila Cancelar/Listo; sube
  12 pt con fundido y, con Reducir movimiento, solo funde en el lugar; los mismos tiempos de
  300/200 ms y las mismas reglas de cierre que la hoja normal, que no cambia). La tarjeta nunca
  pasa del alto de la ventana menos el área segura superior y el espacio del dock (mínimo
  200 pt): cuando su contenido no entra (tamaños de texto de accesibilidad), se desplaza dentro
  de la tarjeta, sin rebote. Un botón «Cerrar»
  se dibuja exactamente donde está el «+», sobre el velo, dentro del grupo modal de VoiceOver
  (el gesto de escape también cierra).
- **Orden fijo:** el tile del Asistente (fondo de pino, destello sobre un círculo de acento,
  «Asistente» y «Decilo con tus palabras o preguntá lo que quieras»), luego Gasto («Una compra o
  un pago»), Ingreso («Sueldo, cobro u otro ingreso») y Transferencia («Entre cuentas o pago de
  tarjeta»).
- **«Continuar: «…»»** aparece en el tile del Asistente **solo** cuando la conversación de esta
  sesión tiene un mensaje de la persona, y muestra sus últimas palabras reales
  (`lastUserWords`). Nunca un texto de ejemplo.
- **Sin micrófono en el hub.** Un micrófono que todavía no puede dictar sería un callejón sin
  salida. El dictado es trabajo posterior del Asistente (25A); no hay dictado automático.
- **Destinos:** Gasto → `/new-entry` (`kind: 'expense'`), Ingreso → `/new-entry`
  (`kind: 'income'`), Transferencia → `/new-transfer`, Asistente → `/assistant`; siempre con
  `router.push`, una sola vez, después de que el hub se fue. **La primera elección se sostiene:**
  mientras el hub se va, una segunda fila, el velo o el «+» no hacen nada. La moneda de un
  movimiento es la moneda de la vista solo mientras una cuenta viva la tiene; el Asistente recibe
  la moneda de la vista. Nada se escribe desde el hub.

## Asistente

- Pantalla de la pila raíz (`app/assistant.tsx`, registrada en `app/_layout.tsx` con el título
  `assistant.title`). Se abre desde el hub y vuelve con el gesto atrás nativo.
- **Conversación de la sesión, solo en memoria** (`src/assistant/session.ts`, puro): una única
  instancia por proceso con el reductor real de la conversación. Salir de la pantalla ya no
  aborta una respuesta: llega a la sesión. Volver muestra la conversación y la desplaza una vez
  a su último intercambio. «Nuevo chat» (en el encabezado, solo con mensajes) la reinicia y
  aborta una respuesta en curso. **Nada se persiste**; cerrar la app la borra.
- Sin cambio en su autoridad: escribe solo cuando la persona confirma un borrador (cero
  escrituras autónomas); un reintento reutiliza el mismo id de movimiento. Los enlaces de
  evidencia a una raíz (`/`, `/activity`, `/reports`, `/settings`) usan `router.dismissTo`:
  vuelven a las pestañas que ya existen debajo del Asistente y eligen esa pestaña (un
  `navigate` desde esta pantalla de la pila apilaría un segundo juego de pestañas); los demás,
  `push`.

## Sistema visual: Forest

*(Los colores de esta sección se reemplazan el 2026-10-03 por Electric Lime, Producto 25VIS1: ver la enmienda
al final. La regla semántica sigue, con la transferencia en pizarra neutra.)*

- **Ventana de tono 158–168°**, pino sobrio: nunca turquesa, cian, esmeralda ni azul. Sin
  reescritura global de tipografía ni radios. La ventana vinculante de 158–168° rige el campo
  (`hero`) y la marca clara (`primary`, `primaryFill`). Los hex exactos de la entrega para el
  acento salvia (#9FD8C1 / #86C9B0) y la marca oscura (#94D2BB / #86C9B0) miden 155,8–157,7°:
  las cifras HSL de la entrega están redondeadas. Se conservan esos hex; las pruebas
  (`tests/theme.node.ts`) exigen 155–168° para todos los tokens de marca y 158–168° para el
  campo y la marca clara.
- **Tokens** (`src/ui/palette.ts`, claro / oscuro): fondo #F0F3F1 / #000000 (OLED); superficie
  #FFFFFF / #0F1513; inset #E6EBE8 / #171E1B; tinta #0F1A16 / #EDF3EF; secundario #45564E /
  #A2B1A9; terciario #586961 / #899A91; marca como texto (`primary`) #1D5647 / #94D2BB y como
  relleno (`primaryFill`) #1D4F42 / #86C9B0 con `onPrimary` #FFFFFF / #05211A; campo financiero
  `hero` #14362D / #0F2A22 con su tinta #EEF5F1 / #EDF5F0 y secundario #A8C4B9 / #A1BDB2;
  acento del «+» #9FD8C1 / #86C9B0 con `onAccent` #0F2A22 / #05211A; dock #1B3C33 / #133029,
  `dockInk` #B5C9C1 / #A9BFB6, `dockActive` #3C6356 / #335A4E. Los valores restantes están en
  `palette.ts` y en `docs/mobile-design.md`.
- **Regla semántica:** un gasto común es **tinta con signo menos** *(Reemplazado en las filas de movimientos el 2026-10-01 por 24UX6C: ver «Enmienda 2026-10-01 — Producto 24UX6C», abajo.)*; el ingreso es positivo
  (`income` #1F7A4F / #5CCB93); una transferencia es neutra, en tinta secundaria (`transfer` =
  secundario) *(Reemplazado el 2026-10-01 por 24UX6C: ver «Enmienda 2026-10-01 — Producto 24UX6C», abajo.)*; el tono negativo (`expense` #B3432E / #EE8A72) queda **solo** para lo destructivo,
  lo vencido y lo pasado de límite; alerta ámbar (`warning` #9A5B00 / #E8A94A). Nunca color sin
  signo o etiqueta.
- **Vidrio solo** en el dock, el «+», el hub, los controles circulares compactos, los menús, el
  compositor y las píldoras de movimiento del detalle de una cuenta (una superficie existente,
  desde 24UX3). Filas, tarjetas, gráficos y encabezados fijos son **sólidos**. En esta entrega
  el código dibuja Liquid Glass (donde iOS lo ofrece y Reducir transparencia está apagado) en
  tres superficies: la píldora del dock, las píldoras de movimiento del detalle de una cuenta y
  el compositor del Asistente; el «+» y la tarjeta del hub son sólidos. Sin vidrio (Expo Go, iOS
  anterior, Reducir transparencia, `EXPO_PUBLIC_DISABLE_GLASS`), el dock es pino sólido con un
  filo fino y, en claro, una sombra suave.
- **Identidad de categorías sin cambio.** Los ids de color guardados (`packages/domain`), los
  presets, el hash y el orden de asignación y los tonos (`src/ui/category-color.ts`, `HUES`)
  quedan intactos, también los que están fuera de la ventana de Forest: esa ventana rige la
  marca y la interfaz, no las categorías. Cualquier recoloreo de categorías necesita su propia
  decisión.
- Apariencia (Sistema, Claro, Oscuro; guardar y después aplicar, sin parpadeo) sigue como en la
  primera iteración de 24UX6A.

## Inicio

- **Campo financiero** (`hero`, radio inferior de 32 pt, bajo la barra de estado, con
  contenido claro en la barra mientras el campo está debajo y la de cada tema al pasarlo o al
  salir de Inicio):
  - fila 1: el mes actual (texto, **no interactivo**, sin chevron) y el atajo a Cuentas;
  - fila 2, **solo con dos monedas o más en el historial** (la regla del chip de 25B2): la
    moneda de la vista y la ayuda; con una sola moneda la fila no existe y la ayuda pasa al lado
    de la línea inferior *(Reemplazado el 2026-10-01 por 24UX6C: ver «Enmienda 2026-10-01 — Producto 24UX6C», abajo.)*;
  - el número (tinta del campo; secundario cuando es exactamente cero; las cifras por moneda
    cuando falta una cotización; el texto de fuera de rango);
  - la línea inferior *(Reemplazado el 2026-10-01 por 24UX6C: ver «Enmienda 2026-10-01 — Producto 24UX6C», abajo.)*: con **Gastado**, «Hasta hoy · {promedio} por día» (`dailyAverageMinor`,
    la misma cifra que Reportes) o «Sin gastos este mes»; con **Disponible**, «Saldo registrado
    · N cuentas» y **nunca** una cifra por día;
  - Gastado | Disponible, que solo cambia el número.
- **Semántica sin cambio.** Gastado = el gasto del mes en la moneda de la vista (solo gastos;
  transferencias y pagos de tarjeta nunca; cuotas en el mes de su resumen; consolidado por la
  fecha de cada movimiento o una moneda sola). Disponible = dinero registrado en cuentas
  normales (sin tarjetas, deudas ni cobros); no es ingresos menos gastos ni lo que queda del
  presupuesto.
- **Próximos compromisos:** solo reglas recurrentes de gasto que vencen hoy o en los próximos
  seis días *(Reemplazado el 2026-10-01 por 24UX6C2: ventana de 30 días, de hoy a hoy + 30 inclusive; ver «Enmienda
  2026-10-01 — Producto 24UX6C2», abajo.)*, en la vista, dos como máximo, «Ver todos» → Recurrentes; sin ninguno, la sección no
  existe. **Por qué solo recurrentes:** un resumen de tarjeta no tiene un importe conocido
  (FinanzApp no lee el resumen del banco) y las cuotas ya son parte de la tarjeta; listarlas
  aparte las contaría dos veces.
- **Actividad reciente:** gastos e ingresos de este mes (sin transferencias) *(Reemplazado el 2026-10-01 por 24UX6C2:
  ver «Enmienda 2026-10-01 — Producto 24UX6C2», abajo.)*, en la vista, los
  más nuevos primero; cuatro con compromisos, seis sin ellos; «Ver todos» → Movimientos.
- **Vacíos:** sin compromisos ni actividad, «Todavía no hay movimientos este mes» / «Registrá un
  gasto con el botón Registrar (+) o contáselo al Asistente.» (el «+» nombrado como lo lee
  VoiceOver), sin acción. Con una moneda de varias mostrada sola («Solo X»), el título nombra la
  moneda: «Todavía no hay movimientos en X este mes» (la regla de 24UX2, restituida). Sin
  cuentas, el estado vacío con «Empezar» → nueva cuenta.
- **Fuera de Inicio:** el botón «＋ Registrar», la línea de atención, rankings, gráficos,
  tarjetas de presupuesto y la entrada del Asistente. Sus rutas siguen donde estaban. *(Precisado el 2026-10-01 por
  24UX6C2: sigue sin haber tarjeta permanente de presupuesto, pero aparece una fila contextual del presupuesto general
  cuando pide atención; ver «Enmienda 2026-10-01 — Producto 24UX6C2», abajo.)* *(Refinado el 2026-10-01 en 24UX6D: el
  general y los presupuestos por categoría que piden atención, hasta dos filas; ver «Enmienda 2026-10-01 — Producto
  24UX6D», «Refinamiento del dueño».)*

## Qué no cambia

Toda regla contable, de moneda y de tipo de cambio: unidades menores enteras por moneda,
monedas nunca mezcladas sin una tasa fechada y solo en la vista, transferencias, tarjetas
(invariantes 1–8 de la decisión 003), cuotas, deudas y cobros; el esquema SQLite 13 y la copia
v13; la versión «FinanzApp 0.1.0 (24UX6A)». No se agrega ninguna dependencia nativa ni se hace
un build de EAS.

## Próximas entregas de la línea UX (aprobadas, no implementadas)

La línea **24UX6A → 24UX6B → 24UX6C → 24UX6D** se suma al roadmap de producto; no lo reemplaza:
24T3, 25A, 25C/25C2, 25D, 25E/25F y Producto 26 siguen como están.
*(→ 2026-10-01: la línea quedó 24UX6A → 24UX6B → 24UX6C → 24UX6C2 → 24UX6D → 24UX6E, toda antes de 24T3; 24UX6A–24UX6E
mergeadas (PRs #70–#75); 24UX6E, su última pasada, en «Enmienda 2026-10-01 — Producto 24UX6E».)*

- **24UX6B, Reportes.** Se conservan presupuestos, observaciones y flujo neto (se reordenan o
  reestilan; nunca se quitan porque una maqueta los omita). La dona seleccionable solo como
  selección visual dentro del reporte *(implementada el 2026-10-01 por 24UX6C2)*. Se permite el gráfico Día a día y un encabezado fijo
  sólido. Las barras de Evolución conservan la navegación por mes actual (sin una segunda
  selección solo para comparar). Se conserva la agrupación «Otras» por top N actual: **no** se
  adopta la regla del 3 % en esta generación. No se inventa una ruta de detalle por comercio: el
  resumen de comercios sigue sin interacción salvo que se agregue una ruta real a propósito.
- **24UX6C, Movimientos y Más.** *(Implementada en parte el 2026-10-01: ver «Enmienda 2026-10-01 — Producto
  24UX6C»; los filtros por cuenta, categoría, período y período a medida siguen aprobados y pendientes; desde
  24UX6D pertenecen al alcance de búsqueda y productividad de Producto 25C, con sus búsquedas guardadas. Hoy existen la
  búsqueda y el filtro de tipo Todos / Gastos / Ingresos / Transf.)* Filas, búsqueda y filtros en Forest; filtros por período,
  cuenta y categoría con datos del repositorio; los totales del día conservan su semántica
  actual (neto donde el repositorio define neto). No se inventa nota, origen Apple Pay ni hora
  del movimiento. Se conservan Deshacer/Recuperar (sin un borrado definitivo falso) y
  Movimientos deshechos. Idioma y Región siguen siendo rutas separadas, agrupadas a la vista; se
  omite «Ajustes» (no hay ruta).
- **24UX6D, Tarjetas.** *(Implementada el 2026-10-01: ver «Enmienda 2026-10-01 — Producto 24UX6D».)* Se conserva la funcionalidad real: la presentación del Disponible de
  crédito, Registrar compra y Recientes. Se permite un mazo/slivers y el reestilo Forest. El
  progreso de cuotas es registradas/facturadas según el dominio, nunca «pagadas» inferidas; los
  importes de cuota son los programados reales. Ninguna fórmula contable ni de crédito
  disponible cambia.

## Estado y verificación

Implementado en `apps/mobile` y probado en Linux; **la verificación en iPhone está pendiente**
y no hay build de EAS. Pendiente en el dispositivo: el dock de cuatro íconos con VoiceOver
«n de 4» y «Registrar» que no es pestaña; el visor de contenido grande; 30–40 cambios rápidos
de pestaña sin pantallas negras; vidrio frente a pino sólido (Reducir transparencia); abrir y
cerrar el hub (×, velo, escape de VoiceOver), la primera elección sostenida, el fundido con
Reducir movimiento y la tarjeta que se desplaza con texto de accesibilidad (AX5 a 375 pt); el
Asistente apilado (ida y vuelta, la conversación durante la sesión, Continuar solo después de
un intercambio real, borrada por Nuevo chat y al cerrar la app, el teclado del compositor, el
enlace de evidencia que vuelve a las pestañas existentes en Movimientos); el campo de Inicio bajo la barra
de estado en claro y oscuro, el mes no tocable, la fila de alcance solo con dos monedas, el
promedio diario solo en Gastado, compromisos ≤ 2 u omitidos, actividad 4/6, vacíos (con la
moneda nombrada en «Solo X»), importes
largos a 375 pt, tamaños de accesibilidad y Dynamic Type; el contraste de Forest; categorías sin
cambio; Apariencia sin parpadeo; el mapeo de glifos SF Symbols/Ionicons. Ver
`docs/mobile-device-checklist.md`.

Verificación en Linux del árbol enmendado (2026-10-01): `npm test` en la raíz 415 pasan y 1 pendiente;
`npm run check:repo` OK; en `apps/mobile`, typecheck sin errores, `test:storage` 936/936, `currency:verify` y
`regions:verify` OK, `i18n:check -- --strict` sin errores ni inglés desactualizado, `check` y `export:ios` OK. El job
`mobile_api` necesita PostgreSQL y corre en CI. Nada de esto es una prueba en el iPhone.

## Enmienda 2026-10-01 — Producto 24UX6C (presentación de movimientos, Inicio y Más)

Fecha: 2026-10-01. Producto 24UX6C, rama `feat/producto-24ux6c-movements-more-polish` desde master ecfd1dc (24UX6B
mergeada como PR #71). Enmienda solo de **presentación**: no cambia ninguna regla contable, signo del libro, importe
guardado, esquema (13), copia (v13), cotización, tarjeta, cuota, deuda ni la materialización de recurrentes; no agrega
dependencias nativas ni animaciones entre pestañas (la mitigación de pantallas negras de §Navegación sigue intacta).
El texto original de arriba queda como registro; las frases reemplazadas llevan su marca en el lugar.

### Qué reemplaza

| Antes (texto de esta decisión) | Dónde | Ahora |
| --- | --- | --- |
| «un gasto común es **tinta con signo menos**» | §Sistema visual, regla semántica | En una fila o un detalle de un movimiento con tipo, el gasto muestra el importe guardado **sin signo**, en tinta; el ingreso lleva «+» en el verde de ingreso; la transferencia, el importe guardado sin signo en el tono `transfer` |
| «una transferencia es neutra, en tinta secundaria (`transfer` = secundario)» | §Sistema visual, regla semántica | `transfer` es un azul petróleo sobrio, distinto del secundario: claro #2D6476 sobre `transferSoft` #E2EDF1, oscuro #8FC3D2 sobre #132830 (unos 194°, saturación ≤ 0,45; 6,6:1 sobre blanco) |
| Movimientos «conserva el «+» de su encabezado hacia `/new-entry`» | §Navegación, raíces | Movimientos no tiene «+» en el encabezado: registra el «+» del dock, el mismo desde cada pestaña |
| La línea inferior de Inicio («Hasta hoy · … por día», «Sin gastos este mes», «Saldo registrado · N cuentas») y la ayuda «al lado de la línea inferior» | §Inicio, campo financiero | Sin línea bajo el número. Con una moneda, la ayuda (ⓘ) va al lado del número (Disponible siempre la tiene; Gastado solo cuando hay conversión). Con dos monedas o más, el chip y su ayuda siguen en la fila de alcance |

### La regla: el signo de presentación no es el signo contable

El libro guarda magnitudes positivas en unidades menores enteras más un tipo (gasto, ingreso, transferencia); lo que
un movimiento le hace a un saldo sale del tipo, nunca de un signo guardado. En una fila cuyo tipo ya se dice (glifo,
leyenda y, para VoiceOver, las palabras «Gasto», «Ingreso», «Transferencia»), el importe no lo repite con un signo:
`presentedAmount(kind, storedMinor)` (`src/ui/movement-amount.ts`, puro) devuelve el importe tal como está guardado
(sin valor absoluto), un signo solo para el ingreso y el tono del tipo. Se aplica a las filas de movimiento y de
transferencia en todo contexto, al detalle de un movimiento, a las filas y al detalle de Recurrentes y a la tarjeta de
borrador del Asistente. **Todo signo calculado se conserva:** un saldo negativo, el neto del día, el flujo neto, las
diferencias entre períodos, los saldos de tarjeta y de deuda, el exceso de un presupuesto y las filas de evidencia del
Asistente. «Nunca color sin signo o etiqueta» sigue valiendo: la fila lleva la etiqueta. *(→ 24UX6E: Movimientos
deshechos no muestra neto del día, porque lo deshecho no cuenta en ningún saldo; y los «Gastos este mes» de una cuenta
son una suma rotulada, sin signo, como los «Gastos» de Recurrentes.)*

El tono `transfer` queda fuera de la ventana de Forest (158–168°) a propósito: esa ventana rige la marca y la
interfaz, no la semántica, y un azul petróleo bien separado del pino evita que una transferencia se lea como
interacción. `tests/theme.node.ts` exige 185–210°, saturación ≤ 0,5 y que no sea el secundario.

### Lo que agrega sin reemplazar texto de esta decisión

- **Hub Registrar.** El orden (Asistente, Gasto, Ingreso, Transferencia) y los destinos no cambian. Las filas llevan
  un tile teñido sobrio: gasto `inset` con el glifo en tinta, ingreso `incomeSoft` con el glifo de ingreso,
  transferencia `transferSoft` con el glifo de transferencia (antes, tres tiles neutros con el glifo en el primario).
- **Asistente.** Sin la leyenda permanente «No conectado en esta versión…»: en el build desconectado, un mensaje
  enviado recibe en el hilo la nota «El Asistente todavía no está conectado en esta versión. Tu mensaje quedó escrito
  para cuando lo esté.», el límite dicho donde importa. Sin el micrófono del compositor ni su nota hasta que exista el
  dictado (Producto 25A). Su autoridad no cambia: escribe solo con un borrador confirmado.
- **Más.** Los mismos dos grupos y las mismas rutas en el mismo orden; cada grupo con un rótulo pequeño en versalitas
  con rol de encabezado; sin fila «Ajustes».

### Qué queda pendiente del alcance aprobado de 24UX6C

Los filtros por período, cuenta y categoría con datos del repositorio (§Próximas entregas) siguen aprobados y no están
en esta entrega: Movimientos conserva su filtro por tipo y su búsqueda.

### Estado

Implementado en `apps/mobile`; **nada se revisó en un iPhone** y no hubo build de EAS. La verificación en Linux y la
lista del dispositivo están en `docs/mobile-roadmap.md` («Producto 24UX6C») y `docs/mobile-device-checklist.md`
(«Producto 24UX6C»).

## Enmienda 2026-10-01 — Producto 24UX6C2 (actividad de Inicio y la dona de Reportes)

Fecha: 2026-10-01. Producto 24UX6C2, rama `feat/producto-24ux6c2-home-activity-reports-polish` desde master c673be6
(24UX6C mergeada como PR #72). Un pulido chico de **presentación**: no cambia ninguna regla contable, el libro, el
esquema (13), la copia (v13), cotizaciones, tarjetas ni cuotas; sin dependencias nativas ni animaciones entre
pestañas; la regla de presentación de 24UX6C y la paleta Forest no cambian.

| Antes (texto de esta decisión) | Dónde | Ahora |
| --- | --- | --- |
| «gastos e ingresos de este mes (sin transferencias)» | §Inicio, Actividad reciente | Gastos, ingresos **y transferencias** de este mes en la vista, del más nuevo; una transferencia es un registro y aparece **una sola vez** (origen → destino, sin signo, en el tono `transfer`; abre su detalle). El límite de cuatro o seis se aplica después de unir. Gastado y Disponible no leen la lista: una transferencia sigue sin ser gasto |
| «solo reglas recurrentes de gasto que vencen hoy o en los próximos seis días» | §Inicio, Próximos compromisos | Reglas recurrentes de gasto activas y no borradas, en la vista, cuya próxima fecha cae en una **ventana móvil de 30 días**: de hoy a hoy + 30 días, **los dos extremos incluidos** (el 2026-10-01, del 2026-10-01 al 2026-10-31); el mismo límite que el pronóstico «próximos 30 días» de Recurrentes; nunca «el mes calendario». Por fecha, comercio e id, después dos como máximo; sin ninguna, la sección no existe |
| «tarjetas de presupuesto» fuera de Inicio | §Inicio, Fuera de Inicio | Sigue sin haber **tarjeta permanente** de presupuesto ni presupuestos por categoría. Se agrega **una fila contextual** del presupuesto **general** del mes solo cuando `budgetState` del dominio dice aviso (85 % a 100 % inclusive) o excedido (más de 100 %); detalle abajo *(Refinado el 2026-10-01 en 24UX6D: también los presupuestos por categoría, hasta dos filas; ver «Enmienda 2026-10-01 — Producto 24UX6D».)* |
| El centro de la dona con «Total del período» y el total del mes | Reportes (24UX6B, sin texto propio en esta decisión) | La dona no repite el total del KPI de arriba, que sigue en Categorías y Día a día; sirve para **elegir una categoría** (solo selección visual dentro del reporte, como se aprobó): sin elección, «Tocá una categoría»; con una, su nombre, su importe y su parte del gasto; VoiceOver la recorre como un control ajustable *(Reemplazado el 2026-10-01 por 24UX6D: sin KPI externo; el centro lleva el total del período por defecto. Ver «Enmienda 2026-10-01 — Producto 24UX6D».)* |

**Inicio sigue mínimo.** Inicio muestra el campo financiero, la fila del presupuesto general cuando pide atención
*(→ refinamiento de 24UX6D: las filas de atención del general y de los por categoría, dos como máximo)*, los
compromisos cercanos cuando existen y la actividad reciente. «Próximos compromisos» sigue condicional: solo reglas
recurrentes de gasto activas y no borradas, en la vista, cuya próxima fecha cae **desde hoy hasta hoy + 30 días, los
dos extremos incluidos** (`COMMITMENT_WINDOW_DAYS`, reemplazó al horizonte de siete días; el mismo límite que
Recurrentes), dos como máximo, ausente sin ninguna; lo posterior en Recurrentes; un ingreso recurrente nunca es un
compromiso, y tampoco resúmenes de tarjeta, cuotas ni pagos de deudas. Rankings, una tarjeta permanente de presupuesto,
los presupuestos por categoría, la línea de atención calculada y un módulo permanente de recurrentes siguen fuera de
Inicio; ver más adelante es trabajo del calendario y las notificaciones futuras.

**La fila de atención del presupuesto general.** No es una tarjeta: es una sola fila, solo mientras el presupuesto
general del mes pide atención según el dominio (`budgetState`, `BUDGET_WARNING_RATIO` 0,85): por debajo del 85 % no hay
nada; del 85 % al 100 % inclusive, aviso en ámbar («Usaste 87 % del presupuesto del mes», «Quedan … de …»); por encima
del 100 %, el tono de alerta («Superaste el presupuesto del mes», «… por encima de …») *(los textos citados, reemplazados
el 2026-10-01 por 24UX6D: una fila de progreso compacta con la misma semántica; ver «Enmienda 2026-10-01 — Producto
24UX6D»)*. Un sublímite por categoría nunca
la muestra ni elige la moneda. Qué presupuesto (`homeBudget`, con la regla de 24C1 de que cada presupuesto conserva su
moneda): con «Solo …», el general de esa moneda; en consolidado, el general de la moneda de visualización y después el de
cada moneda del historial, y la fila es el primero que pide atención (un presupuesto tranquilo nunca esconde el
excedido de otra moneda), nombrando su moneda cuando no es la de visualización. Una sola fila, nunca dos. *(→ «Un
sublímite por categoría nunca la muestra» y «una sola fila» quedan reemplazados por el refinamiento de 24UX6D: el
general y los por categoría, hasta dos filas; ver «Enmienda 2026-10-01 — Producto 24UX6D».)* Se mide sobre el libro real en la moneda propia del presupuesto y nunca se convierte. Va
después del campo financiero y antes de «Próximos compromisos» y «Actividad reciente»; tocarla abre Presupuestos en la
moneda y el mes del presupuesto. Un aviso local opcional del mismo cambio de estado queda solo documentado para 25D
(`docs/mobile-roadmap.md`, «Producto 25D»); no cambia el orden del producto.

**Estado.** Implementado en `apps/mobile`; **nada se revisó en un iPhone** y no hubo build de EAS. La verificación en
Linux y la lista del dispositivo están en `docs/mobile-roadmap.md` («Producto 24UX6C2») y
`docs/mobile-device-checklist.md` («Producto 24UX6C2»).

## Enmienda 2026-10-01 — Producto 24UX6D (Tarjetas en Forest y pulido final de Inicio y Reportes)

Fecha: 2026-10-01. Producto 24UX6D, rama `feat/producto-24ux6d-cards-forest` desde master 5c73813 (24UX6C2 mergeada
como PR #73). Enmienda solo de **presentación**: no cambia ninguna regla contable de tarjetas (pagos, ciclos y fechas,
reconocimiento de cuotas, principal comprometido, la compuerta del disponible, el ciclo de vida), el libro, las reglas
de presupuesto, el esquema (13), la copia (v13) ni cotizaciones; sin dependencias nativas ni animaciones entre
pestañas. Las invariantes de tarjetas de la decisión 003 siguen vinculantes. Solo se registran aquí las reglas visuales
vinculantes que cambiaron; el resto del detalle está en `docs/mobile-design.md` («Producto 24UX6D»).

| Antes (texto de esta decisión) | Dónde | Ahora |
| --- | --- | --- |
| «La dona no repite el total del KPI de arriba, que sigue en Categorías y Día a día … sin elección, «Tocá una categoría»» (Enmienda 24UX6C2) | Reportes, Categorías | **Sin total externo:** no hay KPI «Gastado», importe grande ni promedio arriba del análisis. El centro de la dona lleva **por defecto el total del período** («Total del período» y el importe exacto); una categoría elegida lo reemplaza ahí (nombre, importe, parte del gasto) y la elección se limpia con la misma porción, el agujero, el espacio neutro de la fila de la dona (sin interceptor global), un cambio de mes, moneda o modo y Categorías ↔ Día a día. El dinero exacto nunca se corta: si no entra, la lectura baja debajo de la dona. Día a día lleva una línea compacta «Total  $ …», sin héroe ni promedio |
| «aviso en ámbar («Usaste 87 % del presupuesto del mes», «Quedan … de …») … («Superaste el presupuesto del mes», «… por encima de …»)» (Enmienda 24UX6C2) | Inicio, la fila del presupuesto general | **Misma semántica** (solo el presupuesto general, ausente por debajo del 85 %, aviso del 85 % al 100 % inclusive, excedido por encima, en su moneda, la elección de `homeBudget`, antes de los compromisos, abre Presupuestos en su moneda y mes), presentada como **fila de progreso compacta**: «Presupuesto» y el porcentaje entero; una barra visualmente limitada al 100 %; «Quedan $ …», «Límite alcanzado» o «$ … por encima». Aviso en ámbar, excedido en el tono de alerta y con un glifo de alerta, distinguibles por más que el color *(«Solo el presupuesto general» y «la elección de `homeBudget`», reemplazados por el refinamiento de abajo.)* |
| «Se permite un mazo/slivers y el reestilo Forest» (§Próximas entregas, 24UX6D) | Tarjetas, el detalle de tarjeta | **El saldo y los datos van planos sobre el lienzo** (sin superficie propia), en el orden identidad → Saldo pendiente → Vence · Cierra → Disponible → acción → cuotas → actividad; **sin superficies anidadas del mismo peso** (las que quedan son listas agrupadas). **Regla de franjas del mazo:** con cualquier tarjeta activa hay una al frente; hasta cuatro tarjetas cada franja mide 50 pt, desde la quinta todas miden 44 pt, nunca menos de 44 pt, con la primera fila entera; la misma regla para cualquier cantidad (sin carrusel ni tarjetas ocultas). El progreso de un plan se dice como registradas y futuras según el dominio («reconocida» y «facturada» son sinónimos en `packages/domain/installments.ts`), nunca «pagadas» |

**Refinamiento del dueño (2026-10-01), dentro de 24UX6D.** Cambia una regla vinculante de Inicio y fija Reportes y la
selección de Tarjetas; no cambia el dominio de presupuestos, el libro, el almacenamiento ni el esquema.

| Antes (texto de esta decisión) | Dónde | Ahora |
| --- | --- | --- |
| «Un sublímite por categoría nunca la muestra ni elige la moneda … Una sola fila, nunca dos» (Enmienda 24UX6C2) y «solo el presupuesto general» (fila de arriba) | Inicio, la atención de presupuestos | El presupuesto **general** y los presupuestos **por categoría** activos del mes, solo con `budgetState` (tranquilo por debajo del 85 %, nunca; aviso del 85 % al 100 % inclusive; excedido por encima del 100 %), cada uno en su moneda, medido con `summarizeMonthlyBudgets` sobre el libro real y nunca convertido («Solo …»: solo esa moneda; consolidado: la de visualización y cada moneda del historial). **Como máximo dos filas** (`BUDGET_ATTENTION_ROWS`), en este orden: excedido antes que aviso; dentro de un estado, el general antes que los por categoría; después la proporción mayor; desempate estable: la moneda de visualización, el código, `categoryKey(categoría)` y el id. Una fila nombra su moneda cuando no es la de visualización. Una categoría se titula con su nombre localizado («Supermercado», «Supermercado · USD»), en tinta: solo los colores de estado, nunca el tono de la categoría. VoiceOver «Presupuesto de Supermercado, cerca del límite, 97 % usado, quedan …» / «Presupuesto de Supermercado superado, …». Las dos filas comparten una superficie agrupada con un filete; cada una abre Presupuestos en su moneda y mes (sin ruta nueva); el lugar no cambia. Sin ninguna, nada |

Sigue sin haber **tarjeta permanente ni tablero de presupuestos** en Inicio: son, como máximo, dos filas contextuales de
atención; lo demás vive en Presupuestos. Ejemplos del dueño: general 90 %, Supermercado 97 %, Transporte 50 % → general y
Supermercado; general 50 %, Supermercado 95 %, Transporte 88 % → Supermercado y Transporte; general excedido, una
categoría excedida y varias en aviso → el general excedido y la categoría excedida; cinco categorías → las dos primeras.

**Reportes, congelado.** La composición de esta entrega (PR #74) es vinculante. Categorías: período y alcance →
Categorías | Día a día → la dona grande → en el centro, por defecto, el total exacto del período → con una categoría
elegida, su nombre, importe y porcentaje → su fila marcada → Evolución → los hechos de abajo. Día a día: el total exacto
compacto → el análisis por día → los hechos de abajo. Sin héroe «Gastado», sin titular por día, sin «Tocá una
categoría».

**Tarjetas, la selección no cambia.** Siempre una al frente y solo ella alimenta el resumen: es una pantalla de estado
financiero; con una tarjeta un toque más sería fricción y con varias la del frente ya dice cuál está elegida; si el
resumen pesa, se refina la jerarquía en lugar de esconder información detrás de un toque.

**Fuera de esta enmienda.** Los filtros aprobados de Movimientos (cuenta, categoría, período y período a medida junto al
filtro por tipo y la búsqueda, con estados de limpiar y restablecer) pertenecen al alcance de búsqueda y productividad de
Producto 25C; no se envía un botón de filtro a medias. Los demás destinos financieros en Forest (Cuentas, Presupuestos,
Recurrentes, Deudas y cobros y Categorías) son Producto 24UX6E, «More financial destinations in Forest» (planificada;
solo presentación y ciclo de vida; las utilidades de Más se auditan sin rediseñarse) *(→ implementada: ver «Enmienda
2026-10-01 — Producto 24UX6E»)*. El orden de producto no cambia:
después del carril UX, 24T3 sigue antes de 25A.

**Estado.** Implementado en `apps/mobile`; **nada se revisó en un iPhone** y no hubo build de EAS. La verificación en
Linux y la lista del dispositivo están en `docs/mobile-roadmap.md` («Producto 24UX6D») y
`docs/mobile-device-checklist.md` («Producto 24UX6D»).

## Enmienda 2026-10-01 — Producto 24UX6E (más destinos financieros en Forest; cierre de la línea UX)

Fecha: 2026-10-01. Producto 24UX6E, rama `feat/producto-24ux6e-more-financial-forest` desde master 8f758ad (24UX6D
mergeada como PR #74). Enmienda de **presentación y ciclo de vida**, más los errores reales que aparecieron (corregidos
y registrados como errores en `docs/mobile-roadmap.md`, «Producto 24UX6E»): no cambia el dominio, el almacenamiento, las
reglas de saldos, presupuestos, recurrentes ni deudas, el esquema (13), la copia (v13) ni cotizaciones; sin
dependencias nativas ni animaciones nuevas. Inicio, Reportes (congelado por 24UX6D) y Tarjetas no cambian; Tarjetas
solo vuelve a su lista con `dismissTo` después de «Eliminar tarjeta». Solo se registran aquí las reglas visuales
vinculantes que cambiaron; el resto del detalle está en `docs/mobile-design.md` («Producto 24UX6E»).

| Antes | Dónde | Ahora |
| --- | --- | --- |
| El ámbar marcaba lo que debo y el verde lo que me deben, en el tile de la fila y del detalle y en los totales (Deudas y cobros, sin texto en esta decisión) | Deudas y cobros: lista, fila, detalle | **El color marca el estado, nunca la dirección ni la identidad.** Tiles neutros con la flecha de dirección y totales en tinta. Solo las palabras de estado toman tono: vencida en el tono de alerta (las dos direcciones); vence en tres días o menos en ámbar, solo en una deuda que debo (la ventana de «Vence» en Tarjetas). Una deuda cerrada nunca se dibuja vencida: no tiene línea de estado y lleva la nota de ciclo de vida |
| El presupuesto general como resumen en una tarjeta: número → barra → Gastado / Límite → «N % utilizado», el número en ámbar en aviso (Producto 19, `docs/mobile-design.md`) | Presupuestos | **Plano sobre el lienzo**, en el orden héroe → barra → estado → Gastado / Límite; el héroe de 40 pt **en tinta** en calma y en aviso, en el tono de alerta solo cuando se excedió; el aviso va en la barra y la línea de estado. El tile de un sublímite es **solo identidad**: su tono nunca dice el estado, que llevan el porcentaje, la barra y el glifo de alerta |
| Resúmenes por moneda en tarjetas con relleno (el pronóstico de Recurrentes, los totales de Deudas, el presupuesto general, los datos del mes de una cuenta) | Cuentas, Presupuestos, Recurrentes, Deudas y cobros | **Resúmenes planos sobre el lienzo**, como el bloque de estado de Tarjetas (24UX6D); solo las listas agrupadas siguen siendo contenedores. En Recurrentes «Gastos · ARS» va en su propia línea a ancho completo, nunca achicado ni cortado |
| Cada estado de ciclo de vida con su propio texto suelto (un pie sobre las acciones, una fila «Estado», «Cuenta eliminada» como rótulo del saldo, la fila archivada al 0,6) | Una cuenta eliminada, un recurrente pausado, cerrado o para revisar, una deuda cerrada, una categoría archivada | **Una sola nota de ciclo de vida** (`LifecycleNote`, la forma de `CardLifecycleNote`): un glifo secundario, un título opcional y una línea que dice qué sigue haciendo, bajo el héroe (arriba del editor en una categoría), sin superficie ni color de alarma; ámbar solo en las palabras de un recurrente para revisar. Una regla cerrada dice «Cuenta eliminada» / «Tarjeta eliminada», no «Pausado». Nada se atenúa para decir un estado |
| Filas tocables con o sin chevron sin una regla escrita | Sublímites de Presupuestos, Categorías | **Sin chevron en una fila que abre un editor modal**; el chevron promete un push (una cuenta lo lleva y lo cuenta al decidir si apila). Las filas de Recurrentes y Deudas siguen sin chevron |
| «ámbar solo hoy y mañana» (24UX2, `docs/mobile-design.md`) | Recurrentes | **Ámbar solo para un gasto** que vence hoy o mañana: un ingreso no es una obligación. «Revisar» sigue en ámbar |

**Cierre de la línea UX.** Con 24UX6E la línea visual amplia de Forest (24UX6A → 24UX6B → 24UX6C → 24UX6C2 → 24UX6D →
24UX6E) queda **cerrada**: otra pasada visual necesita evidencia del iPhone de una regresión concreta, no un reestilo
general. El orden de producto sigue: **24T3** es la próxima entrega, después 25A; los filtros avanzados de Movimientos
siguen en 25C; 25C2, 25D, 25E, 25F y 26 no cambian.

**Fuera de esta enmienda.** Las utilidades de Más (Copia de seguridad, Importar copia, Idioma, Región, Apariencia,
Movimientos deshechos) se auditaron sin rediseñarse; solo se corrigieron dos errores (la tarjeta fijada de los
selectores, separada 20 pt; Movimientos deshechos sin neto del día) y el resto quedó anotado como pulido chico posterior
en el roadmap.

**Estado.** Implementado en `apps/mobile`; **nada se revisó en un iPhone** y no hubo build de EAS. La verificación en
Linux y la lista del dispositivo están en `docs/mobile-roadmap.md` («Producto 24UX6E») y
`docs/mobile-device-checklist.md` («Producto 24UX6E»).

## Enmienda 2026-10-02 — Producto 25UX1 (dock, Tarjetas y Reportes: interacción)

Tres problemas que el dueño observó en el producto; no reabre la línea visual amplia de Forest.

- **El dock flota** *(reemplaza «Queda en el layout, nunca encima del contenido»)*. La píldora de pino y el «+» son el
  control y nada más: el dock se fija al borde inferior de la ventana, fuera del layout, sin pintar fondo (no hay franja
  ni rectángulo detrás), y sus márgenes vacíos dejan pasar los toques. Las raíces llegan hasta el borde de la ventana y
  terminan su contenido arriba del dock con **un único inset compartido** (`dockClearance`: el aire de abajo + 60 + 8;
  88 pt con un indicador de 34): `useDockClearance` vale eso dentro de una escena de las pestañas y 0 en cualquier otra
  pantalla, y lo suman `Screen`, `EntryList`, Inicio y Reportes a su relleno inferior y a su indicador de scroll. La
  geometría del dock, el hub de captura, las opciones del navegador (la mitigación de pantallas negras: sin fade,
  detach, freeze ni lazy), Reduce Transparency (la píldora opaca), los blancos de 48 pt y VoiceOver no cambian.
- **Tarjetas abre en reposo** *(reemplaza «Siempre una al frente» de 24UX6D, `docs/mobile-design.md`)*. Ninguna tarjeta
  está elegida al entrar, aunque haya una sola: el mazo es el protagonista (la identidad de cada tarjeta, nunca su
  saldo, fechas, disponible, cuotas, movimientos ni acciones). El primer toque en cualquier tarjeta la elige y la lleva
  al frente (el movimiento de datos del mazo, 260 ms); el resumen aparece debajo: Saldo pendiente → Vence · Cierra →
  Disponible (o su desconocido honesto) → una sola acción, Pagar tarjeta → Recientes. Registrar es el «+» del dock; las
  cuotas futuras y los planes viven en el detalle. Tocar la elegida abre su detalle; al cambiar de tarjeta los números
  viejos se van en el acto y los nuevos entran, nunca juntos. El detalle conserva la cara y los hechos arriba y pone
  **Movimientos antes de Cuotas**; ningún plan ni acción desaparece. Ninguna regla contable cambia.
- **Reportes: la fila elegida sube a la vista** *(amplía «Reportes: congelado»)*. Con una categoría elegida en la dona,
  su fila se lista primera mientras está elegida (las demás conservan su orden canónico) y viaja hacia arriba mientras
  las otras le hacen lugar (`rowReorder`: el movimiento de datos, 260 ms, la curva única, sin resorte); al limpiar o
  elegir otra, vuelve a su lugar. Un cambio de mes, moneda o modo reordena en el acto; con Reduce Motion el orden cambia
  sin viaje; Día a día nunca reordena. La dona, sus porcentajes, su paso de VoiceOver y el orden sin elección siguen
  siendo los del dominio; la pista de VoiceOver de la fila elegida dice que se muestra primero por estar elegida, nunca
  que gastó más. El resto de la composición de Reportes sigue congelada.

**Estado.** Implementado en `apps/mobile` y mergeado como PR #80; no hubo build de EAS. La pasada del dueño en el iPhone
(2026-10-02, en términos generales) confirmó el dock sin franja, Tarjetas y Reportes, y encontró que la última fila no
quedaba arriba del dock (corregido por 25OPS1, abajo). La verificación en Linux y la lista del dispositivo están en
`docs/mobile-roadmap.md` («Producto 25UX1») y `docs/mobile-device-checklist.md` («Producto 25UX1»).

## Enmienda 2026-10-02 — Producto 25OPS1 (la última fila sobre el dock)

- **El espacio del dock es layout** *(precisa «un único inset compartido» de la enmienda de 25UX1)*. Las raíces terminan
  su contenido arriba del dock con relleno inferior del contenido, en todas las plataformas: `useDockInset` devuelve
  `dockClearance` como `extraPadding` y `Screen`, `EntryList`, Inicio y Reportes lo suman a su propio relleno. Ninguna
  raíz pasa un `contentInset` nativo (en el iPhone no se sostuvo: la última fila volvía a quedar debajo de la píldora);
  solo el inset del indicador de scroll es nativo. Sigue siendo un único invariante compartido, 0 fuera de las pestañas;
  el dock, su geometría, el hub y todo lo demás de la enmienda de 25UX1 no cambian.

**Estado.** Implementado en `apps/mobile`, en su rama; **sin revisar en un iPhone** (`docs/mobile-device-checklist.md`,
«Producto 25OPS1»).

## Enmienda 2026-10-03 — Producto 25VIS1 (paleta Electric Lime)

- **Aceptada.** Empezó como prueba; el dueño la revisó en su iPhone, en claro y oscuro, el 2026-10-03 y la conserva
  como la paleta actual del producto, tal como está implementada. Es la dirección visual del producto, no un nombre,
  logo ni identidad de marca pública terminados: la compuerta de nombre, marca registrada y similitud confusa
  (`docs/brand-brief.md` §3) sigue pendiente. Los valores de Forest quedan en el historial (master 227942c).
- **Reemplaza §Sistema visual: Forest en su color:** la marca es una lima amarilla-chartreuse (#C6F12E, ventana de tono
  68–82°), siempre con tinta encima; lienzos, tinta y dock son neutros (grafito, blanco mineral, casi negro); no hay
  un verde bosque como segunda marca. La lima va al campo de Inicio, al «+», al botón lleno y a la tarjeta del Asistente;
  como texto, un oliva-lima profundo en claro y una lima suave en oscuro. El lienzo oscuro deja de ser negro OLED puro
  (#0B0C0A). Detalle y tabla de tokens en `docs/mobile-design.md`, «Producto 25VIS1».
- **La regla semántica sigue:** gasto en tinta, ingreso en su verde (lejos de la lima), alerta ámbar, vencido y
  destructivo en rojo; la transferencia pasa de azul petróleo a **pizarra neutra**. La lima nunca es éxito, ingreso,
  alerta ni error.
- **No cambia:** cuatro pestañas, el dock y su geometría (ahora grafito; solo el «+» es lima), el hub, Inicio y sus
  módulos (Próximos compromisos sigue neutro como Actividad reciente), Reportes, Tarjetas, colores de categorías y caras
  de tarjeta, ni ninguna regla contable.

**Estado.** Implementado en `apps/mobile`, en su rama (PR #83, sin mergear); paleta aceptada por el dueño en el iPhone
el 2026-10-03; los demás puntos de `docs/mobile-device-checklist.md`, «Producto 25VIS1», siguen abiertos.
