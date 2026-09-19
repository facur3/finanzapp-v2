# FinanzApp: dirección visual móvil

Interfaz 07 · 19 de septiembre de 2026. Implementado en código; revisión visual y
gestual en iPhone pendiente. [Alcance del producto](decisions/002-spending-first.md).

## Referencias y criterio propio

Se revisaron los tres ZIP suministrados. Buro aporta el espacio, la jerarquía de
importes, las superficies suaves y un acento contenido. No copiamos su marca,
activos, APY, promociones ni navegación de trading. Zenfinance aporta lectura de
actividad y separación de acciones; Smart Expense Tracker aporta compromisos
próximos, pero descartamos la densidad de chips, mensajes de estado y colores.
No se incorporan imágenes personales, cifras, logos ni HTML de estas referencias.

La identidad elegida combina blanco cálido (#F8F7FA), tinta (#1C1B25), índigo
(#4B3BDB), superficies blancas y lavanda muy tenue. En oscuro, fondo #101014 y
acento #B4AAFF. Rojo/verde significan gasto/ingreso o estado, no decoración.
Tipografía del sistema, números claros, esquinas consistentes y respiración.

## Inicio actual

1. Fechas y moneda, discretas y explícitas.
2. **Gastado este mes/esta semana**, importe protagonista y cantidad de registros.
3. Selector Semana/Mes; barras de gastos por día o grupos de hasta siete días.
4. Acciones Gasto/Ingreso. Ingresos del período como dato secundario si existen.
5. En qué gastaste: hasta tres categorías, barras proporcionales al total y detalle.
6. Últimos movimientos del período/moneda. El acceso Ver todos abre la actividad completa.

Cuentas se abre con el icono del encabezado o desde Ajustes. No compite con el
gasto principal, no se llama patrimonio y no requiere conectar un banco. El saldo
inicial puede quedar vacío: base de registro cero, claramente explicada, nunca
una afirmación de que la cuenta bancaria esté vacía. El onboarding aún necesita
un nombre para agrupar movimientos; eliminar ese paso requiere un cambio posterior.

No se agrega una tarjeta de IA, presupuesto, deuda o vencimiento sin una función
operativa detrás. Próximos pagos se sumará solo con recurrentes/deudas almacenados.
No repetir el importe del mes en otra tarjeta. Sin listas de inversiones nativas.

## Gráficos

Estas barras usan vistas nativas y **Reanimated**, ya instalado. Recharts usa la
interfaz web/SVG del navegador y no es la elección para este cliente React Native.
No agregamos una dependencia de gráficos complejos a cinco/siete barras ni una
WebView. Si luego hace falta una serie interactiva más compleja, evaluar una
librería nativa compatible con la versión de Expo y medirla antes de adoptarla.

- Barras de categoría: porcentaje de todo el gasto del período, no solo las tres visibles.
- Serie temporal: escala cero → máximo mostrado, etiquetas de fechas y valores
  exactos al abrir. Bloques sin registros no acreditan gasto real cero.
- No curvas suavizadas que inventen valores entre transacciones, rendimiento,
  porcentajes de crecimiento sin datos ni gráficos de ejemplo.
- La semana comienza lunes y puede cruzar un mes/año; se conserva ese rango al abrir
  categorías. El reporte mensual se etiqueta como tal, incluso desde la semana.
- Tocar una barra abre sus movimientos; monto/moneda/fecha también disponibles a VoiceOver.
- Animación breve de datos, sin empezar desde cero, sin reiniciarse al volver.
  Reduce Motion aplica el valor directamente. Scroll no modifica valores financieros.

## Navegación, accesibilidad y pantallas

La pila y las hojas nativas son la única transición de pantalla. Las tres pestañas
siguen montadas sin fade/detach/freeze; no se afirma que el bloqueo negro esté
resuelto en iPhone sin repetir la prueba. Los nuevos componentes usan presión
breve y selección existentes, sin una capa animada sobre el gesto de volver.

Se conservan importe/fecha en hojas nativas, recuperación de errores y acciones
Editar/Deshacer/Recuperar. Objetivos de 44 puntos, texto escalable, tema claro/oscuro,
contraste, fondo opaco y listas virtualizadas. La serie horizontal conserva objetivos
táctiles en pantallas estrechas. Revisar el contenido completo con texto grande.

## Revisión pendiente

- Inicio → semana → categoría → movimiento → volver conserva fechas/moneda.
- Selector, teclado, fecha, modal y gesto cancelado sin destello ni pestaña vacía.
- Claro/oscuro, texto grande, montos largos y VoiceOver en iPhone 14 Pro.
- Barras: etiqueta/importe y escala comprensibles, sin depender solo del color.
- 30–40 cambios entre pestañas, fondo/primer plano y regreso desde formularios.
- Versión optimizada independiente de Metro antes de afirmar fluidez de producción.

La vista de componentes web de esta entrega no pudo abrirse en el navegador del
entorno (dirección local bloqueada). Typecheck, export y tests no prueban layout ni
frame rate nativo. No hay aceptación visual nueva. Ver [guía de prueba](empezar-en-iphone.md).
