# Probar FinanzApp en tu iPhone, desde Linux o Windows

Actualizado: 11 de septiembre de 2026.

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
- Conectá ambos a la misma red Wi-Fi.

Todavía no necesitás pagar Apple Developer ni comprar un servicio de IA.
Expo Go permite esta primera prueba dentro de su aplicación. Más abajo está
el paso para instalar FinanzApp como una aplicación propia.

## 2. Abrir la primera versión

Abrí una terminal en una carpeta donde quieras guardar el proyecto. Esta copia
usa otra carpeta para conservar la que ya tengas:

```bash
git clone --branch feat/expo-native-foundation https://github.com/facur3/finanzapp-v2.git finanzapp-ios
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

1. Creá tu cuenta en [Expo](https://expo.dev/signup).
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
El próximo paso concreto es abrir este piloto en tu iPhone y completar la primera
prueba, antes de trasladar tus datos y reconstruir todas las secciones.
