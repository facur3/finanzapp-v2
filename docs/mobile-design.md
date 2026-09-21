# FinanzApp: dirección visual móvil

Interfaz 15 · 20 de septiembre de 2026. Implementado en código; revisión visual y
gestual en iPhone pendiente. [Alcance del producto](decisions/002-spending-first.md) ·
[Navegación y tarjetas](decisions/003-five-tabs-and-cards.md).

## Referencias y criterio propio

Apple Wallet aporta la jerarquía de una tarjeta y de una fila de transacción:
comercio, contexto en una línea, importe alineado a la derecha, tarjetas apiladas
con nombre, emisor y últimos dígitos. Las referencias tipo MonAI, Cocos y las
láminas "FinanzApp — visual direction" aportan base neutra, un número principal
grande, controles compactos y color solo con significado. No copiamos marcas,
mapas de comercios, estados bancarios ni acciones que la app no ejecuta.

## Sistema

**Color.** Tinta sobre fondo. Claro: fondo #F2F2F6, superficie #FFFFFF, tinta
#0A0A0C, secundario #6E7078, relleno #EEEEF3. Oscuro: fondo #000000, superficie
#1C1C1E, elevado #242426, tinta #F5F5F7, secundario #A0A0A8. Cuatro colores
semánticos: gasto coral (#C42F39 / #F0555C), ingreso verde (#15804F / #3DBE86),
transferencia e interacción azul (#2563EB / #5B9BFF), alerta ámbar (#B45309 /
#E8A030), cada uno con un tinte suave para tiles y chips. Todos los textos
semánticos superan 4,5:1 sobre su fondo. Los botones principales son tinta; los
enlaces, azul. Los importes de gasto van en tinta con signo menos; solo el ingreso
se pinta de verde. Nunca color sin signo o etiqueta.

**Color de categoría.** Ocho tonos apagados de una misma familia (terracota, azul
acero, oliva, rosa, verde azulado, ocre, índigo, pizarra), con variante clara y
oscura. Cada categoría recibe un tono estable por hash de su clave, resolviendo
colisiones en orden de primer uso, así una categoría nueva nunca cambia el color
de una existente. Se usa en la barra de composición de Inicio, la dona y los
puntos de la leyenda, siempre junto al nombre. "Otras" no es una categoría: queda
en gris neutro. Los tiles de glifo en las listas siguen monocromos.

**Tipografía.** Fuente del sistema. Héroe 44/700 tabular con tracking negativo,
título grande 34, título 22, encabezado 17/600, cuerpo 17, subtítulo 15, nota 13,
etiqueta 12. Números siempre tabulares.

**Espacio y forma.** Margen de pantalla 20, tarjeta 16, escala 4–32. Radios: chip
14, tile 12, grupo 16, tarjeta 20, hoja 24, tarjeta de crédito 18. Elevación clara
con sombra suave; en oscuro, escalones de superficie sin sombra.

**Componentes.** Fila de movimiento (tile de glifo · comercio · categoría · cuenta ·
fecha · importe), control segmentado nativo, botones de 52 pt, tiles de glifo
monocromo (los emoji se retiran), estadísticas compactas, tarjeta de crédito con
nombre, emisor, moneda, últimos cuatro dígitos y un tono estable por tarjeta.

## Pantallas de esta entrega

- **Presupuestos.** Un número principal (lo que queda o cuánto se excedió), barra
  total, gastado y límite, una línea de estado y filas densas con porcentaje, estado
  y una barra fina por categoría. Nada de barras enormes repetidas.
- **Recurrentes.** Tres estadísticas compactas para los próximos 30 días por moneda,
  filas con frecuencia, próxima fecha, cuenta, importe con signo y "Hoy / Mañana /
  En N días", y el switch nativo para pausar.
- **Cuentas.** Solo cuentas de dinero, agrupadas por moneda con el total de cada una;
  el detalle muestra saldo, gastos e ingresos del mes, Gasto / Ingreso / Transferir y
  sus movimientos. Tarjetas y deudas viven en su pestaña.
- **Reportes.** Título del mes con flechas, total registrado, promedio por día y
  variación contra los mismos días del mes anterior; barras de seis meses en una
  sola escala (el mes en curso, delineado); dona por categoría en tonos de categoría
  (cinco con nombre, el resto como Otras en gris) y leyenda con importe y participación; Día a
  día; presupuestos con porcentaje; comercios principales; hechos (no consejos);
  ingresos, flujo neto y comparación. Sin "ahorro": no tenemos su definición.
- **Formularios.** Selector Gasto / Ingreso / Transferencia, importe grande (verde
  para ingresos, azul para transferencias) y dos tarjetas de selección a ancho
  completo que no se pueden pasar por alto: Categoría (con la línea de presupuesto
  del mes si existe) y Pagado con / Ingresa en (con saldo registrado o deuda de
  tarjeta, y el tipo de cada opción en la hoja). Comercio y fecha después. El botón
  Guardar repite el importe. Sin controles decorativos de dividir, comprobante o
  etiquetas mientras no existan sus datos.
- **Inicio.** Una fila con Gastos / Disponible y la moneda; etiqueta de período,
  número principal y cantidad de registros; Esta semana / Este mes (solo en Gastos);
  Gasto / Ingreso; una línea de presupuesto solo si hay presupuestos; "En qué
  gastaste" como una barra apilada en tonos de categoría más las tres principales
  (nombre, importe, participación) y una fila neutra "Otras N categorías" que abre
  Reportes; compromisos próximos solo cuando existen; los últimos cuatro movimientos.
  Disponible no lleva aclaraciones en pantalla: un botón de información abre su
  definición. Sin barras de análisis: eso vive en Reportes.
- **Movimientos.** Buscador, filtro Todos / Gastos / Ingresos / Transf., secciones
  "Hoy · 20 sep", "Ayer", día de la semana en los últimos siete días y luego la fecha,
  con el neto del día cuando hay una sola moneda.
- **Detalle de movimiento.** Tile, importe con signo, comercio, fecha completa y
  estado; categoría, cuenta o tarjeta, contexto de presupuesto solo si existe uno
  activo para ese mes, moneda; editar y deshacer. Nada inventado: sin referencias
  bancarias, mapas ni estados de autorización.
- **Tarjetas.** Carrusel horizontal con ajuste al soltar, deuda registrada como
  número principal, disponible del límite, cierre y vencimiento, barra de uso
  (ámbar desde 85 %, coral sobre el límite), acciones Registrar compra / Pagar
  tarjeta, compras y pagos del resumen abierto, recientes y deudas.
- **Detalle de tarjeta.** Tarjeta grande, deuda, límite, disponible, cierre,
  vencimiento, resumen abierto y todos sus movimientos. Pagos se leen como
  "Pago de tarjeta · desde Cuenta", sin signo ambiguo.
- **Deudas y cobros.** Totales por moneda, Debo / Me deben, detalle con estado,
  vencimiento y registro de pagos o cobros limitados al saldo pendiente.
- **Formularios.** Pagar tarjeta y saldar deudas fijan la obligación y solo eligen
  la cuenta de dinero en la misma moneda. El selector de cuenta nombra el tipo
  (Cuenta, Tarjeta de crédito) y nunca ofrece una deuda para un gasto.

## Gráficos

Las barras y las barras de progreso usan vistas nativas y **Reanimated**. La dona
usa **react-native-svg** en la versión incluida por Expo SDK 57 (funciona en Expo
Go); no se agrega una librería de gráficos completa ni una WebView. Las porciones
usan el tono de su categoría (hasta cinco con nombre, el resto como Otras en gris);
los nombres van en la leyenda, nunca solo en el color. Con datos nuevos la dona se
dibuja en sentido horario desde las doce (480 ms) mientras la anterior se desvanece;
el trazo estático es el arco terminado, así el gráfico está completo aunque la
propiedad animada no se aplique. Con Reduce Motion aparece terminada. Los valores
nunca se ocultan hasta terminar una animación.

## Motion y accesibilidad

Un solo lenguaje en `src/ui/motion.tsx`: curva ease-out fuerte
(0.23, 1, 0.32, 1) y duraciones con nombre: presión 100 ms, soltar 160, estado 200,
datos 260, revelado 480. Nada supera 300 ms salvo el revelado de un gráfico. La
motion responde a datos o al dedo, nunca a que una pantalla gane foco (las raíces
siguen montadas, así un revelado al montar no se vería).

- **Presión.** Escala 0,97 al apoyar el dedo, vuelta al soltar; el control responde
  antes de que termine el toque.
- **Control segmentado.** Un solo pulgar se desliza al segmento elegido
  (interrumpible), las etiquetas cambian de color en transición y un háptico de
  selección marca el cambio. Tocar el valor actual no hace nada.
- **Valores.** Cuando cambian los datos de un número principal (métrica, período,
  moneda, mes), el valor anterior se desvanece y el nuevo sube 6 pt; con Reduce
  Motion se reemplaza al instante. Barras y proporciones interpolan entre datos
  reales, nunca desde cero.
- **Bloques.** Un control o sección que aparece o desaparece se funde y los
  vecinos se deslizan en lugar de saltar.
- **Carrusel de tarjetas.** La posición vive en el hilo de UI; las tarjetas vecinas
  retroceden (0,94 / 0,7). Al asentarse en otra tarjeta suena un háptico y el panel
  se funde. Reduce Motion deja todas las tarjetas planas.
- **Hápticos.** Uno por acción del usuario (selección en segmentos, flechas de mes,
  categoría o cuenta elegida, tarjeta asentada; éxito al guardar) y siempre con una
  señal visual.

La pila y las hojas nativas siguen siendo la única transición de pantalla; las
cinco pestañas permanecen montadas sin fade/detach/freeze. Objetivos de 44 pt,
texto escalable con filas apiladas en tamaños grandes, etiquetas de VoiceOver con
importe, moneda y estado.

## Pendiente de revisión en iPhone

- Pulgar del segmentado, fundido del héroe, barrido de la dona y profundidad del
  carrusel a 60/120 Hz, en ambos temas y con Reduce Motion activado y desactivado.
- Tonos de categoría junto al nombre en claro/oscuro; la dona animada en Expo Go.
- Carrusel: ajuste, indicador de página y cambio de panel al soltar.
- Contraste de tarjetas de crédito y del tinte azul en claro/oscuro.
- Filas con nombres largos, texto grande y VoiceOver en Tarjetas y Deudas.
- Inicio y Reportes con la nueva paleta antes de su rediseño (fases siguientes).
