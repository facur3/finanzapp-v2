# Probar FinanzApp en tu iPhone, desde Linux o Windows

Actualizado: 12 de septiembre de 2026.

**El primer piloto ya fue aprobado en Expo Go:** el usuario confirmó que los
movimientos persistieron al cerrar/reabrir y que la navegación se sentía nativa
y fluida. Si ya hiciste esa prueba, seguí en [Después del piloto aprobado](#6-después-del-piloto-aprobado).

Ya hay una primera versión móvil para probar: cuentas, gastos, ingresos,
actividad y guardado local. Es un **piloto**: todavía faltan inversiones,
tarjetas, IA, sincronización y las integraciones de Apple. Tu app actual sigue
siendo la que usás para llevar todas tus finanzas.

Elegimos **Expo + React Native** para crear pantallas móviles y trabajar desde
tu computadora sin comprar una Mac. Swift queda disponible para integraciones
de Apple que lo necesiten. La decisión completa y cuándo reconsiderarla están
en [este documento](decisions/001-native-mobile.md).

## 1. Preparar la computadora y el iPhone

- En la computadora: instalá [Node.js 24 LTS](https://nodejs.org/en/download)
  y [Git](https://git-scm.com/downloads). Node ejecuta las herramientas; Git
  descarga y actualiza el código. VS Code sirve para editarlo.
- En el iPhone: instalá **Expo Go** desde la App Store.
- Usá tu cuenta gratuita de [Expo](https://expo.dev/signup) en Expo Go y en la
  terminal con `npx expo login` si pide iniciar sesión. Son las credenciales de
  Expo; Apple y GitHub son cuentas distintas. Si ya funciona, no repitas el alta.
- Conectá ambos a la misma red Wi-Fi.

Todavía no necesitás pagar Apple Developer ni comprar un servicio de IA.
Expo Go permite esta primera prueba dentro de su aplicación. Más abajo está
el paso para instalar FinanzApp como una aplicación propia.

## 2. Abrir la primera versión

Abrí una terminal en una carpeta donde quieras guardar el proyecto. Esta copia
usa otra carpeta para conservar la que ya tengas:

```bash
git clone --branch master https://github.com/facur3/finanzapp-v2.git finanzapp-ios
cd finanzapp-ios/apps/mobile
npm ci
npm start
```

`npm ci` instala exactamente las herramientas guardadas en el proyecto.
`npm start` muestra un código QR y mantiene encendido el servidor de desarrollo.
Dejá esa terminal abierta, escaneá el QR con la cámara del iPhone y abrilo con
Expo Go. Permití el acceso a la red local si iOS lo pide.

Si la red impide conectarlos, cerrá el servidor con `Ctrl+C` y probá
`npm start -- --tunnel`. Puede pedir instalar la herramienta de túnel de Expo.
Si aparece un error de versión, mandame el texto exacto; no hace falta cambiar
bibliotecas al azar.

## 3. Qué probar ahora

1. Agregá una cuenta y escribí su saldo inicial explícitamente. El piloto empieza
   vacío y no trae tus datos de Cocos, Binance, bancos ni la app anterior.
2. Registrá un gasto o ingreso que quieras usar para esta prueba. Revisá monto,
   cuenta, categoría y fecha antes de guardar. No está habilitada todavía la
   edición de un movimiento ya guardado.
3. Abrí su detalle y volvé. Probá también un gesto hacia atrás muy pequeño,
   cancelándolo sin terminar de mover el dedo.
4. Cerrá y volvé a abrir. Confirmá que el movimiento y el saldo sigan ahí.
5. Probá modo oscuro, texto grande y “Reducir movimiento” en Accesibilidad.
6. En Ajustes → Compartir copia, guardá el archivo en una ubicación privada.

No vuelvas a cargar todo tu patrimonio. El piloto todavía no importa ni
sincroniza tus datos anteriores y no restaura backups desde su interfaz.
La exportación preserva los registros para la siguiente etapa, pero no convierte
al piloto en el reemplazo de la app actual.

La prueba completa está en [la lista para iPhone](mobile-device-checklist.md).
Anotá modelo del iPhone, versión de iOS, pantalla y gesto si algo falla.
Con Expo Go, una apertura sin red puede depender de su caché: la prueba definitiva
de funcionamiento independiente se hace con la versión instalada del paso 4.

## 4. Instalar FinanzApp como una aplicación propia

Después de revisar el piloto:

1. Usá la misma cuenta de Expo con la que ya probaste el piloto.
2. Para firmar e instalar nuestra propia app de esta manera, necesitás tu
   inscripción en el [Apple Developer Program](https://developer.apple.com/programs/enroll/).
   El alta y el pago los hacés vos con tu identidad. No me pases contraseñas.
3. Vinculamos el proyecto de Expo y registramos tu iPhone. Las instrucciones
   exactas y los comandos están en [el README móvil](../apps/mobile/README.md).
4. **EAS Build** compila y firma en una Mac de la nube. Tu computadora puede
   seguir usando Linux o Windows. Revisamos la cuota/costo antes de iniciar.
5. Primero instalamos una versión de desarrollo para trabajar. Después,
   una versión `preview` trae todo incluido y funciona con la computadora apagada.
6. Tras verificarla, usamos **TestFlight**, la aplicación de Apple para distribuir
   versiones de prueba. La publicación en la App Store viene después de completar
   la migración, privacidad, pruebas y revisión de Apple.

Las versiones se llaman **FinanzApp Dev** o **FinanzApp Preview**. Tienen una
identidad separada para no reemplazar tu app actual. No se generó ni instaló
todavía una versión firmada; tampoco se envió nada a la App Store.

## 5. Qué pasa con Supabase, Apple e IA

- **SQLite** es la base de datos dentro del teléfono. Ya la usa este piloto;
  guardar un movimiento no necesita conexión.
- **Supabase** seguirá sirviendo para cuenta de usuario y sincronización opcional
  entre dispositivos. No lo borres. El piloto todavía no se conecta a sus datos.
- **Face ID, recordatorios, inicio de sesión con Apple, widgets y Atajos** están
  en el plan. Necesitan implementación y pruebas en el iPhone.
- **Apple Pay:** exploraremos una automatización de Atajos que prepare el gasto.
  No permite asumir acceso a todo el historial de Wallet ni ejecutar pagos bancarios.
- **IA:** mantendremos primero la interpretación y las consultas locales, sin
  contratar un modelo pago. Sus propuestas se podrán revisar antes de guardar.

El orden y el estado de cada etapa están en [el plan actualizado](mobile-roadmap.md).
Si todavía no lo probaste, completá primero la prueba de arriba.

## 6. Después del piloto aprobado

Seguimos con Expo + React Native y **por ahora seguimos probando gratis en Expo Go**.
Ya está implementada la primera iteración de [la interfaz propia](mobile-design.md):
Inicio más simple, acceso directo a Gasto/Ingreso, movimientos agrupados por fecha
con búsqueda, cuentas en su propia lista y formularios más claros. Conserva la
navegación nativa que ya te gustó. Falta tu prueba de esta nueva interfaz.

Inicio dice **Disponible en tus cuentas**, no patrimonio: el piloto todavía no
incluye inversiones ni deudas. Pesos y dólares se muestran por separado, sin
inventar una cotización. No hay datos precargados ni cambios en tu base local.
Después completamos editar/deshacer y el importador con vista previa para traer
tus datos sin volver a escribir todo. El piloto todavía no es el registro principal.

**Ahora, de tu lado:** conservá una copia JSON privada de la app actual usando su
opción de exportar backup. No la subas al repositorio ni hace falta compartirla
para diseñar la app. No borres Supabase ni vuelvas a cargar el patrimonio en el
piloto. Ya registramos tu **iPhone 14 Pro con iOS 26.6.1**, según tu mensaje.
No hace falta volver a dar ese dato mientras no cambie.

Para actualizar esta misma copia del código, detené Metro con `Ctrl+C` y ejecutá:

```bash
cd ~/Projects/apps/finanzapp-ios
git fetch origin
git switch master
git pull --ff-only
cd apps/mobile
npm ci
npm start
```

Esto cambia desde la antigua rama del piloto a `master`, donde se integran las
entregas verificadas; no hace falta volver a clonar. Si tenés
cambios locales y Git no permite actualizar, conservá el mensaje para revisarlo,
sin borrar archivos ni forzar un reset. Actualizar el código no borra SQLite;
desinstalar Expo Go o borrar sus datos sí puede eliminar los registros del piloto.

**Prueba breve de esta entrega:**

1. Confirmá que aparecen las mismas cuentas, saldos y movimientos que ya tenías.
2. Desde Inicio, abrí Gasto e Ingreso. Si tenés una cuenta USD, seleccioná Dólares
   antes de abrir: el formulario debe abrir con una cuenta en esa moneda.
3. Escribí un monto; usá **Listo** para cerrar su teclado. Abrí Cuenta y Fecha.
   Cambiá la fecha y tocá **Cancelar**: debe conservar la original. Repetí usando
   **Listo**: debe tomar la nueva. Esto modifica el borrador, no guarda un gasto.
4. En Movimientos, buscá por concepto, categoría o cuenta; probá los filtros,
   entrá a un detalle y volvé. La búsqueda y los filtros deben conservarse.
5. Probá un gesto de volver cancelado, modo oscuro y texto grande. Cerrá/reabrí
   Expo Go y confirmá los datos de nuevo. Para comprobar un guardado, usá un
   movimiento que quieras conservar: editar/deshacer lo guardado aún está pendiente.

### Expo Go y EAS: para qué sirve cada uno

| Herramienta | Qué hace | Dónde probás |
| --- | --- | --- |
| Expo Go | Es la app de Expo que ya instalaste. Carga nuestro código con las funciones nativas que trae incluidas. | En tu iPhone, normalmente conectado a Metro en tu computadora. |
| EAS Build | Es un servicio que compila y firma **nuestra propia app** en servidores de Expo. Para iOS usa una Mac en la nube; vos podés seguir en Linux o Windows. | La app resultante se instala en el mismo iPhone. No es un simulador para tu PC. |
| Build `preview` | Es nuestra app con el código incluido, optimizada y con identidad propia. La prepara EAS Build. | En tu iPhone, sin Expo Go y sin depender de la computadora. |

Expo Go no permite verificar absolutamente todo. Por ejemplo, **Face ID en iOS
requiere una versión propia de desarrollo**; también debemos probar allí nuestra
configuración nativa, permisos e integraciones. Un build `development` sigue usando
Metro para editar en vivo; `preview` es el que usaremos para la prueba independiente.
Fuentes: [Expo Go y development builds](https://docs.expo.dev/develop/development-builds/introduction/),
[Face ID en Expo](https://docs.expo.dev/versions/latest/sdk/local-authentication/).

**Cuándo pagar (precios consultados el 12 de septiembre de 2026):**

| Etapa | Qué necesitás |
| --- | --- |
| Mejorar la interfaz y probar los movimientos con Expo Go | Sin pago nuevo. Tu instalación actual alcanza. |
| Compilar nuestra app con EAS | Expo ofrece un plan Free con hasta 15 builds iOS por mes y cola de baja prioridad. Revisar la cuota de tu cuenta antes de iniciar una compilación. |
| Instalar la versión propia por este flujo desde Linux y usar TestFlight/App Store | Apple Developer Program: USD 99 por año; el importe final puede variar por región. El alta y pago se hacen con tu cuenta Apple. |

Fuentes oficiales: [precios de Expo](https://expo.dev/pricing) y
[alta de Apple Developer](https://developer.apple.com/programs/enroll/).
No hace falta contratar Expo de pago ni pagar Apple ahora. Primero revisamos esta
interfaz y completamos la corrección/recuperación básica de los movimientos.
Después vinculamos EAS con el plan gratuito y hacemos el alta de Apple para la
primera versión propia, antes de implementar a fondo Face ID y las integraciones.
No esperamos a terminar toda la migración para probar ese flujo de instalación.

La siguiente prueba después de esa alta será instalar `development`, luego
`preview` y abrirla con la computadora apagada. La versión `preview` trae su
código incluido y permite comprobar persistencia, arranque y fluidez sin Metro.
Esa comprobación y las pruebas específicas de accesibilidad/gestos aún están
pendientes, aunque el primer piloto de uso ya haya pasado.
