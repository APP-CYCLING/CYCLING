# Apariencia de CYCLING

La app usa modo claro por defecto, incluso si el teléfono está en modo oscuro.
En Perfil → Configuración y seguridad → Modo oscuro se puede activar el tema oscuro
y volver al claro. La opción está disponible también para invitados.

La preferencia se conserva en AsyncStorage bajo `cycling:appearance:v1`; es local
a cada instalación, independiente del usuario de Supabase y del tema del sistema.
No se consulta `useColorScheme`. Las escrituras se serializan y una lectura inicial
tardía no puede reemplazar una selección más reciente. Si falla el almacenamiento,
se aplica el tema en la sesión actual y se muestra un error en Configuración.

`ThemeProvider` comparte la paleta con pantallas, pestañas, controles, logos y loaders;
`Appearance.setColorScheme` sincroniza los elementos nativos. El StatusBar y el
fondo nativo siguen usando el tema elegido mediante la integración existente.
El mapa base conserva su estilo cartográfico actual.

El splash nativo y la configuración Expo usan claro fijo. Después de arrancar
React Native se recupera el tema guardado; el splash estático no lee AsyncStorage.
Es necesario recompilar las APK para incorporar el cambio del splash/configuración
nativa. Los cambios del interruptor se aplican al instante y no requieren reiniciar.

Validación: TypeScript, pruebas de persistencia/restauración, lectura tardía,
selecciones consecutivas, errores de almacenamiento, control accesible y
configuración Expo en development/preview. Pendiente la comprobación visual en
dispositivo físico de ambos temas, incluyendo el arranque con una preferencia guardada.
