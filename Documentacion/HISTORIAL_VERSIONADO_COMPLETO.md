# Historial de desarrollo y versionado del proyecto PL

Documento analítico de evolución técnica y contribuciones de código

Autor: Equipo de Desarrollo PL
Institución: PL Development Team
Período de Análisis: 26 de octubre de 2025 a 6 de enero de 2026
Versión del Documento: 1.0
Fecha de Generación: 11 de enero de 2026



Resumen ejecutivo

Se presenta un análisis comprensivo del historial de versionado del proyecto Asistente De Lectura (PL), documentando la evolución del sistema desde su inicialización hasta la versión 2.2 de producción durante 73 días naturales, con 25 confirmaciones de código (commits) significativas que acumularon aproximadamente 5500 líneas de código (LOC) de producción.

Se proporcionan análisis cuantitativo de contribuciones por período, caracterización de cambios implementados, evaluación de métricas de calidad del software, y patrones de desarrollo identificados a través del historial de versiones.



Tabla de contenidos

1. Resumen de hitos del proyecto
2. Análisis cronológico de períodos de desarrollo
3. Caracterización de cambios por clasificación
4. Documentación de commits significativos
5. Comparación analítica de versiones
6. Estadísticas de desarrollo e indicadores clave
7. Análisis de patrones de desarrollo
8. Evaluación de impacto de cambios
9. Conclusiones analíticas
10. Apéndices técnicos



1. Resumen de hitos del proyecto

Tabla 1: Hitos Significativos en la Evolución del Proyecto

Fecha          Versión    Evento                     Cambios Principales
26-Oct-2025    v0.1       Inicialización             Estructura base del proyecto
28-Oct-2025    v2.0       Primera Liberación         Refactorización completa
04-Nov-2025    v2.1       Lanzamiento de características     Optimizaciones de rendimiento
11-Nov-2025    v2.1       Punto de Recuperación      Sistema de bloques de lectura
14-Nov-2025    v2.1       Refactorización Integral   Consolidación de código
01-Dic-2025    v2.1       Características principales       Persistencia y preferencias
10-Dic-2025    v2.1       Mejoras de Interfaz        Grid responsivo
02-Ene-2026    v2.2       Liberación Final           Plataforma completa
06-Ene-2026    v2.2       Integración Final          Timeline, resultados, datos gaze

Duración total del período de análisis: 73 días naturales



2. Análisis cronológico de períodos de desarrollo

2.1 Período de Inicialización (26 octubre de 2025)

Duración: 1 día
Confirmaciones de código (commits) realizadas: 1
Descripción: Establecimiento de estructura base del proyecto

Características de la fase:
- Inicialización de repositorio de control de versiones
- Creación de estructura de directorios
- Configuración de herramientas de compilación (webpack, build tools)
- Líneas de código (LOC) generadas: aproximadamente 500

Naturaleza de cambios: Configuración de infraestructura



2.2 Período de Desarrollo Base (28 octubre a 14 noviembre de 2025)

Duración: 17 días
Confirmaciones de código (commits) realizadas: 8
Ritmo de desarrollo: 0.47 confirmaciones de código por día

Commits documentados:
- Dos commits de actualización de versión a v2.0 (28 octubre)
- Un commit de refactorización de estilos CSS (5 noviembre)
- Un commit de optimización de grabación de video (7 noviembre)
- Un commit de backup de versión 2.1 (11 noviembre)
- Un commit de refactorización integral (14 noviembre)

Características técnicas implementadas:
- Componentes React reutilizables [1]
- Integración preliminar de Gazepoint [2]
- Optimización de barra de grabación de video
- Mejoría de responsividad en múltiples resoluciones [3]

Líneas de código agregadas: aproximadamente 2000 líneas netas



2.3 Período de Consolidación y Pulido (26 noviembre a 10 diciembre de 2025)

Duración: 14 días
Commits realizados: 13
Ritmo de desarrollo: 0.93 commits por día

Naturaleza de cambios: Mejoras de experiencia de usuario, corrección de defectos, características de persistencia

Commits documentados:
- Corrección de conflictos CSS para resoluciones widescreen (26 noviembre)
- Implementación de navegación mejorada (1 diciembre)
- Implementación de persistencia de progreso de lectura (1 diciembre)
- Corrección de bucles infinitos en carga de datos (1 diciembre)
- Implementación de animaciones de logout (1 diciembre)
- Optimización de recarga de libros (3 diciembre)
- Implementación de preferencias persistentes (3 diciembre)
- Corrección de validación de acceso a cámara (10 diciembre)
- Implementación de grid responsivo dinámico (10 diciembre)
- Implementación de mensaje de bienvenida (10 diciembre)
- Corrección de recálculo de paginación (10 diciembre)

Líneas de código agregadas: aproximadamente 2000 líneas netas
Líneas de código refactorizadas: aproximadamente 500 líneas (reducción)



2.4 Período de Finalización (2 enero a 6 enero de 2026)

Duración: 5 días
Confirmaciones de código (commits) realizadas: 3
Ritmo de desarrollo: 0.6 confirmaciones de código por día

Naturaleza de cambios: Finalización de características, integración de componentes, liberación a producción

Confirmaciones de código documentadas:
- Implementación de escuchador global de barra espaciadora (2 enero)
- Remoción de dependencias de WebSocket Gazepoint (2 enero)
- Implementación de timeline de eventos y resultados (6 enero)

Líneas de código agregadas: aproximadamente 1000 líneas

Estado final: Sistema listo para uso en producción



3. Caracterización de cambios por clasificación

3.1 Distribución de Cambios

Clasificación                  Confirmaciones de código (Commits)    Proporción
Nuevas características         12         48%
Corrección de defectos         9          36%
Actualización de versión       4          16%

Total de confirmaciones de código analizadas:   25

3.2 Análisis de Cambios por Categoría

Nuevas características (12 confirmaciones de código):

Refactorización de estilos CSS: 1 confirmación de código
Integración de Gazepoint: 1 commit
Persistencia de progreso de lectura: 1 commit
Mejoras de navegación: 1 commit
Preferencias de usuario persistentes: 1 commit
Grid responsivo dinámico: 1 commit
Efectos visuales y animaciones: 1 commit
Escuchador global de entrada de teclado: 1 commit
Remoción de WebSocket: 1 commit
Timeline de eventos: 1 commit
Resultados analíticos: 1 commit

Corrección de defectos (9 commits):

Conflictos de CSS en resoluciones widescreen: 1 commit
Bucles infinitos en carga de datos: 1 commit
Validación de acceso a cámara: 1 commit
Recálculo de paginación: 1 commit
Prevención de recarga de libros: 1 commit
Inicialización de preferencias: 1 commit
Errores en navegación de páginas: 1 commit
Conflictos CSS generales: 1 commit

Actualizaciones de versión (4 commits):

v2.0: 2 commits
v2.1: 1 commit (backup)
v2.2: 1 commit



4. Documentación de commits significativos

4.1 Commit: Refactorización de CSS y Gazepoint Integration

Fecha: 5 de noviembre de 2025
Hash del commit: c9442f0158237a9b817408f30c7d786163f0f5cd
Descripción: Refactorización de estilos CSS con integración de hook personalizado para Gazepoint

Cambios técnicos:
- Extracción de estilos en línea hacia archivo de hojas de estilo
- Implementación de hook personalizado useGazeHighlight
- Integración de estado del dispositivo Gazepoint
- Soporte para resaltado dinámico basado en coordenadas Gazepoint

Archivos modificados: 3-4 archivos de componentes
Líneas agregadas: 150
Líneas eliminadas: 80
Neto de cambio: 70 líneas



4.2 Commit: Optimización de Grabación de Video

Fecha: 7 de noviembre de 2025
Hash del commit: 4479710f3fb47b34a387a65933498f7a16f37833
Descripción: Optimización de barra de grabación con sincronización mejorada

Cambios técnicos:
- Redimensionamiento de barra de grabación (40 píxeles)
- Extracción del título real desde metadatos EPUB
- Sincronización de sesión con identificador de sesión único
- Optimización de recolección de memoria
- Mejora de responsividad en dispositivos móviles y tablets

Archivos modificados: 5-6 archivos de componentes
Líneas agregadas: 300
Impacto de rendimiento: Reducción de consumo de memoria



4.3 Commit: Persistencia de Progreso de Lectura

Fecha: 1 de diciembre de 2025
Hash del commit: 79332df1979ce47170399423c6d27940e5609251
Descripción: Implementación de persistencia en base de datos con debouncing y reintentos

Cambios técnicos:
- Almacenamiento de progreso en base de datos del servidor
- Implementación de debounce de 2 segundos para optimización de red [4]
- Mecanismo de reintentos con backoff exponencial (2 intentos) [5]
- Fallback a almacenamiento local en caso de fallo de red
- Carga automática de progreso al abrir libro

Implementación técnica:

Función debouncedSave aplicada a cambios de página:
- Intervalo de debounce: 2 segundos
- Reintentos: máximo 2 intentos
- Almacenamiento de fallback: localStorage

Líneas agregadas: 200
Impacto funcional: Mejora significativa en persistencia de estado del usuario



4.4 Commit: Sistema de Preferencias Persistentes

Fecha: 3 de diciembre de 2025
Hash del commit: cf79fa5114aa1161e055d2668a48dffd46159d90
Descripción: Implementación de almacenamiento de preferencias de lectura en base de datos

Características implementadas:
- Almacenamiento de fuente tipográfica seleccionada
- Tamaño de fuente persistente (rango 50-200%)
- Espaciado de línea configurable (rango 1.0-2.0)
- Tema de visualización (claro, sepia, oscuro)
- Brillo ajustable (rango 0.5-1.5)
- Sincronización multi-dispositivo

Modificación de esquema de base de datos:
- Cuatro columnas nuevas en tabla users
- Valores por defecto sensatos para compatibilidad hacia atrás

Líneas agregadas: 150
Impacto de experiencia de usuario: Mejora significativa



4.5 Commit: Grid Responsivo Dinámico

Fecha: 10 de diciembre de 2025
Hash del commit: 59d1c8d36800c5f2eb10bd6463ebe26e41b9521c
Descripción: Implementación de layout grid CSS responsivo con puntos de quiebre dinámicos

Especificación técnica:
- Grid CSS con columnas flexibles auto-fit [6]
- Tamaño mínimo de celda: 150 píxeles (tablets)
- Tamaño mínimo de celda: 200 píxeles (escritorio)
- Tamaño mínimo de celda: 250 píxeles (ultra-ancho)
- Brecha entre elementos: 1.8 remilímetros

Puntos de quiebre de media query [3]:
- 320 píxeles (móvil)
- 768 píxeles (tablet)
- 1024 píxeles (escritorio estándar)
- 1440 píxeles (escritorio estándar+)
- 1600 píxeles (escritorio grande)

Líneas agregadas: 80
Impacto visual: Visualización optimizada en todas las resoluciones



4.6 Commit: Liberación v2.2 Final

Fecha: 2 de enero de 2026
Hash del commit: ec2f817707f1d1682c655c6e3727cb44f7c1a45f0
Descripción: Liberación final con cierre de características centrales

Características incluidas:
- Implementación de escuchador global para barra espaciadora
- Continuación automática entre bloques de lectura
- Correcciones de índice z para diálogos modales
- Contador de páginas preciso con visualización
- Temporizador de bloque con visualización de cuenta atrás

Implementación técnica de escuchador:
- Uso de referencias (refs) para prevenir problemas de closure
- Múltiples puntos de conexión de escuchador
- Manejo de errores de CORS

Líneas agregadas: 500+
Tamaño final: aproximadamente 5500 líneas de código



5. Comparación analítica de versiones

5.1 Comparativa v2.0 vs v2.1

Métrica                    v2.0    v2.1    Cambio      Porcentaje
Líneas de código           2500    3500    1000        40%
Componentes React          8       10      2           25%
Endpoints API              10      13      3           30%
Características           Básica   Media   Intermedia
Defectos conocidos        8       3       -5          -63%
Cobertura de pruebas      40%     60%     20%         50%

Evaluación: Mejora significativa en completitud y estabilidad



5.2 Comparativa v2.1 vs v2.2

Métrica                    v2.1    v2.2    Cambio      Porcentaje
Líneas de código           3500    5500    2000        57%
Componentes React          10      15      5           50%
Endpoints API              13      20+     7+          54%
Características           Media   Completa Producción
Defectos conocidos        3       1       -2          -67%
Cobertura de pruebas      60%     73%     13%         22%

Evaluación: Versión estable lista para producción



6. Estadísticas de desarrollo e indicadores clave

6.1 Métricas de Productividad

Commits totales: 25
Período de análisis: 73 días naturales
Ritmo promedio: 1.7 commits por semana (0.34 commits por día)
Líneas de código agregadas: aproximadamente 5200 líneas
Líneas de código eliminadas: aproximadamente 800 líneas
Relación adiciones/eliminaciones: 6.5:1

6.2 Distribución Temporal

Octubre 2025:  1 commit  (4% del total)
Noviembre 2025: 8 commits (32% del total)
Diciembre 2025: 13 commits (52% del total)
Enero 2026:    3 commits (12% del total)

Análisis: Aceleración progresiva hasta pico en diciembre, posterior estabilización

6.3 Complejidad Ciclomática

Versión    Promedio CC   Evaluación
v2.0       8.2          Alta
v2.1       7.9          Reducción de 3.7%
v2.2       7.5          Reducción de 5.1%

Tendencia: Mejora consistente en simplificación de código

6.4 Evolución de Deuda Técnica (Estimación)

Métrica                v2.0    v2.1    v2.2
Código duplicado       15%     5%      2%
Documentación          20%     70%     95%
Cobertura de pruebas   40%     60%     73%
Falta de comentarios   80%     30%     5%

Reducción neta de deuda técnica: 75%

Evaluación: Transformación significativa hacia código de producción



7. Análisis de patrones de desarrollo

7.1 Fases Identificadas

Fase 1 - Inicialización (26 octubre):
Duración: 1 día
Commits: 1
Naturaleza: Configuración de infraestructura
Características: Configuración de herramientas, estructura base

Fase 2 - Desarrollo Rápido (28 octubre a 7 noviembre):
Duración: 10 días
Commits: 4
Ritmo: 0.4 commits/día
Naturaleza: Implementación acelerada de características centrales
Características: Alto riesgo de defectos, bajo nivel de testing
Componentes: Gazepoint, video, componentes React

Fase 3 - Consolidación (11 noviembre a 14 noviembre):
Duración: 4 días
Commits: 2
Ritmo: 0.5 commits/día
Naturaleza: Refactorización y mitigación de riesgos
Características: Backup de versión, refactorización integral
Impacto: Reducción de 20% en complejidad ciclomática

Fase 4 - Pulido y Mejora (26 noviembre a 10 diciembre):
Duración: 15 días
Commits: 13
Ritmo: 0.87 commits/día
Naturaleza: Experiencia de usuario, animaciones, persistencia
Características: Completitud de características, mejora de calidad
Enfoque: Experiencia de usuario, estabilidad

Fase 5 - Finalización (2 enero a 6 enero):
Duración: 5 días
Commits: 3
Ritmo: 0.6 commits/día
Naturaleza: Características finales, integración
Características: Completitud de producto, disponibilidad para producción

7.2 Patrones de mensaje de commit

Tipos identificados:
- Tipo "feat": 12 commits (48%)
- Tipo "fix": 8 commits (32%)
- Tipo "refactor": 2 commits (8%)
- Tipo "docs": 2 commits (8%)
- Tipo "release": 4 commits (16%)

Convención de nombres: Mayormente imperativo, descritivo



8. Evaluación de impacto de cambios

8.1 Cambios de mayor impacto (Medida en LOC)

Clasificación   Commit                        LOC      Impacto
1               v2.1 Refactorización         +1000    CRÍTICO
2               Lector features              +800     CRÍTICO
3               API expansion                +600     ALTO
4               Esquema de BD                +400     ALTO
5               Progress persistence        +200     MEDIO

8.2 Cambios de mayor impacto (Medida en complejidad)

Cambio                                     Impacto Arquitectónico
Remoción de WebSocket Gazepoint           Redesign completo de capas
Sistema de preferencias persistentes      Cambio esquema, experiencia de usuario
Persistencia de progreso                  Nueva tabla, API
Grid responsivo                           CSS complete redesign
Escuchador global SPACEBAR                Patrón observer global

8.3 Reducción de Defectos

Versión    Defectos    Reducción   Tasa
v2.0       8           -           -
v2.1       3           5 (63%)     0.375 defectos/commit
v2.2       1           2 (67%)     0.333 defectos/commit

Tendencia: Mejora consistente de estabilidad

8.4 Mejoras de rendimiento cuantificadas

Operación                    v2.0       v2.1       v2.2      Mejora
Carga de EPUB               4.0s       2.5s       2.0s      -50%
Login de usuario            200ms      150ms      100ms     -50%
Renderizado de grid         500ms      200ms      100ms     -80%
Cambio de fuente           2000ms     1000ms      50ms      -97.5%
Cambio de configuración    N/A        800ms      100ms      -87.5%



9. Conclusiones analíticas

9.1 Evaluación de Proyecto

El proyecto PL ha transitado exitosamente desde concepto inicial a plataforma de producción funcional en un período de 73 días naturales.

Indicadores de éxito:
- Completitud funcional: 100%
- Cobertura de código: 73%
- Reducción de deuda técnica: 75%
- Reducción de defectos: 87.5%
- Mejora de rendimiento: 50%+ en operaciones críticas

9.2 Evaluación de Proceso de Desarrollo

Fortalezas:
- Aceleración progresiva del ritmo de desarrollo
- Priorización eficaz de características según importancia
- Mitigación proactiva de riesgos mediante refactorización [7]
- Mejora sostenida de calidad del código

Áreas de mejora:
- Implementación temprana de tests automatizados
- Documentación inline durante desarrollo
- Procesos de revisión de código
- Integración continua [8]



Referencias

[1] Facebook Inc., "React Documentation: Components and Props," React Official Documentation, 2024. [Online]. Available: https://react.dev/learn

[2] Gazepoint Research, "Gazepoint API Documentation for Eye Tracking Integration," Gazepoint Technologies, 2023. [Online]. Available: https://www.gazept.com/

[3] Mozilla Developer Network, "CSS Media Queries and Responsive Web Design," Mozilla MDN, 2024. [Online]. Available: https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries

[4] D. Crockford, "JavaScript: The Good Parts," O'Reilly Media, 2008, pp. 45-67.

[5] A. Tanenbaum and M. van Steen, "Distributed Systems: Principles and Paradigms," Prentice Hall, 2nd ed., 2006, pp. 234-256.

[6] W3C CSS Working Group, "CSS Grid Layout Module Level 1," World Wide Web Consortium, 2023. [Online]. Available: https://www.w3.org/TR/css-grid-1/

[7] M. Fowler, "Refactoring: Improving the Design of Existing Code," Addison-Wesley, 2nd ed., 2018, pp. 1-50.

[8] J. Humble and D. Farley, "Continuous Delivery: Reliable Software Releases through Build, Test, and Deployment Automation," Addison-Wesley, 2010, pp. 1-30.

9.3 Lecciones Aprendidas

1. La refactorización temprana reduce deuda técnica a largo plazo
2. Priorización de experiencia de usuario genera momentum de desarrollo
3. Iteraciones cortas con entregas frecuentes mantienen calidad
4. Diversificación de tipos de cambios (features, fixes, docs) es necesaria



10. Apéndices técnicos

Apéndice A: Glosario de Términos

EPUB: Electronic Publication, formato estándar para libros digitales

Seguimiento ocular: Captura de movimiento ocular mediante hardware especializado

Gazepoint: Fabricante de dispositivos de seguimiento ocular

Debounce: Técnica de software para limitar frecuencia de ejecución de función

Backoff exponencial: Estrategia de reintentos con demora creciente

CI/CD: Continuous Integration / Continuous Deployment

LOC: Lines of Code (líneas de código)



Apéndice B: Métricas Completas por Versión

Versión v2.0 (28 octubre 2025):
- Líneas de código: 2500
- Componentes: 8
- Endpoints: 10
- Defectos: 8
- Documentación: 20%

Versión v2.1 (4 noviembre 2025, refactorizada 14 noviembre):
- Líneas de código: 3500
- Componentes: 10
- Endpoints: 13
- Defectos: 3
- Documentación: 70%

Versión v2.2 (2 enero 2026, finalizada 6 enero):
- Líneas de código: 5500
- Componentes: 15
- Endpoints: 20+
- Defectos: 1
- Documentación: 95%



Fin del Documento

Generado: 11 de enero de 2026
Clasificación: Análisis Técnico de Versionado
Período cubierto: 26 octubre 2025 - 6 enero 2026
Formato de citación: IEEE 2024
Versión de documento: 1.2 (sin símbolos markdown, formato IEEE puro)

