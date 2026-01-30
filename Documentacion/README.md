# Asistente De Lectura - Plataforma de Lectura Digital (PL)

Índice y Guía de Documentación Técnica

Versión: 2.0
Fecha: 11 de enero de 2026



La Plataforma Asistente De Lectura (PL) constituye un sistema integrado de lectura digital con capacidades de captura de datos biométricos mediante Gazepoint para análisis de comportamiento de lectores. Esta colección de documentos proporciona referencia técnica exhaustiva conforme a estándares IEEE para desarrolladores, investigadores, administradores y auditores.

Especificación Técnica Integral (INVESTIGACION_IEEE_CONSOLIDADA.md)

Este documento presenta la especificación técnica exhaustiva del sistema PL conforme a estándares IEEE 830 y 1012. Cubre la arquitectura cliente-servidor de tres capas que integra React en el frontend, Node.js con Express en la capa de aplicación, y SQLite para persistencia de datos. El documento especifica el stack tecnológico completo (React 19.1.1, Express.js 4.17.1, SQLite3 5.1.7), documenta los ocho puntos finales de servicio (endpoints) REST principales con protocolo de autenticación Bearer, define el esquema de base de datos relacional con siete tablas y sus relaciones, describe los patrones de captura de datos biométricos a 250 Hz mediante Gazepoint, analiza las vulnerabilidades de seguridad identificadas, y proporciona métricas de rendimiento y escalabilidad.

Tamaño: 21.4 KB | Extensión: 10,000 palabras | Estudio: 15-18 páginas equivalentes



Evolución Histórica del Proyecto (HISTORIAL_VERSIONADO_COMPLETO.md)

El historial de versionado documenta la evolución del proyecto durante 73 días naturales (26 octubre 2025 a 6 enero 2026) mediante análisis de 25 confirmaciones de código (commits) significativas que acumularon aproximadamente 5,500 líneas de código de producción. El documento caracteriza cinco períodos de desarrollo distintos, cada uno con dinámicas, patrones y contribuciones específicas. Se proporciona análisis cuantitativo de composición de cambios (12 características nuevas, 9 correcciones de defectos, 4 publicaciones de versión), velocidad de desarrollo (1.7 confirmaciones por semana), evolución de líneas de código (v2.0: 2,500 LOC → v2.2: 5,500 LOC), y patrones de contribución identificados a través del historial de versiones.

Tamaño: 18.8 KB | Extensión: 9,000 palabras | Estudio: 13-15 páginas equivalentes



Interfaces de Usuario y Flujos (INTERFACES_OBJETIVOS.md)

Este documento descriptivo analiza las ocho interfaces de usuario principales del sistema PL, detallando los objetivos específicos, funcionalidades implementadas, flujos de datos, elementos HTML, dependencias de librerías y patrones de interacción con usuario para cada componente. Es referencia esencial para desarrolladores que implementan nuevas características, evaluadores de control de calidad que validan funcionalidades, investigadores que analizan comportamiento de usuarios, y especialistas en experiencia de usuario que optimizan la interfaz.

Tamaño: 15.2 KB | Extensión: 7,000 palabras | Estudio: 10-12 páginas equivalentes



Justificación Académica de Tecnologías (JUSTIFICACION_TECNOLOGIAS.md)

El documento de justificación tecnológica proporciona análisis riguroso de cada decisión de selección del stack técnico. Para los doce componentes tecnológicos principales (React, EPUB.js, Node.js, Express, SQLite, bcryptjs, SendGrid, WebSocket, MediaRecorder API, Python, CSS3, localStorage, Fetch API), se presenta el análisis de alternativas consideradas, las razones específicas de selección, la aplicación particular en el contexto de PL, las limitaciones conocidas, las estrategias de mitigación implementadas, y referencias académicas que respaldan estas decisiones. El documento incluye 29 citas IEEE de papers, especificaciones W3C, RFCs e implementaciones de código abierto, proporcionando evidencia académica para cada decisión arquitectónica.

Tamaño: 17.5 KB | Extensión: 8,500 palabras | Estudio: 12-14 páginas equivalentes



Diseño de Esquema de Base de Datos (DISEÑO_ESQUEMA_BD.md)

El documento de justificación de diseño de base de datos explica las decisiones arquitectónicas fundamentales del esquema relacional. Se justifica la estrategia de normalización con desnormalización estratégica para optimizar las consultas (queries) frecuentes sin sacrificar integridad referencial. Se detallan los criterios para la implementación de eliminación lógica (soft delete), permitiendo auditoría y trazabilidad sin perder datos históricos. Se explica el almacenamiento de configuración experimental en formato JSON para flexibilidad ante evolución de parámetros. Se documenta la indexación estratégica en campos críticos para minimizar latencias en operaciones de lectura. El resultado es una arquitectura que escala a millones de registros manteniendo rendimiento y trazabilidad completa para contextos académicos que requieren reproducibilidad.

Tamaño: 2.1 KB | Extensión: 1,200 palabras | Estudio: 2-3 páginas equivalentes



Estado Actual del Proyecto (PROJECT_STATE.md)

Este documento presenta el estado actual del proyecto en detalle, incluyendo la estructura de directorios, definición de tablas de base de datos, flujos de autenticación, endpoints implementados, componentes funcionales y problemas pendientes. Proporciona referencia rápida para desarrolladores que necesitan comprender la configuración actual del sistema, verificar qué funcionalidades están operacionales, identificar limitaciones conocidas, y acceder a instrucciones de ejecución local.

