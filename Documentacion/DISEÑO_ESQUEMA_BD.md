# Diseño de esquema de base de datos - Plataforma PL

Justificación de decisiones arquitectónicas en persistencia relacional

Autores: Equipo de Desarrollo PL
Institución: PL Development Team
Fecha: 11 de enero de 2026
Versión: 2.0
Clasificación: Investigación Técnica

El esquema está diseñado para manejar experimentos de seguimiento ocular en la lectura. La estructura divide los datos en tres capas: usuarios con autenticación, definición de experimentos y bloques, y luego toda la data de ejecución (runs, muestras de gaze, eventos). Esta separación es clara y permite que cada parte escale independientemente sin afectar las otras.

La clave del diseño es mezclar normalización con desnormalización estratégica. Se guarda el `block_number` directamente en `gaze_samples` para evitar joins costosos cuando se consultan millones de registros de seguimiento ocular. De manera similar, `block_summaries` contiene los agregados precalculados para que los reportes no procesen datos en tiempo real. Los índices se construyen sobre las consultas (queries) más frecuentes: `(run_id, timestamp_ms)` para el acceso temporal y `(user_id, deleted_at DESC)` para los listados activos.

La eliminación lógica (soft delete) es crítica. En lugar de eliminar registros, se marcan con `deleted_at`. Esto mantiene la integridad referencial, preserva el historial completo y proporciona auditoría en contextos académicos donde la reproducibilidad es un requerimiento fundamental. Sin esta estrategia, eliminar un experimento rompería la trazabilidad de estudios anteriores.

La configuración se almacena en formato JSON en `config` porque los parámetros experimentales evolucionan: número de bloques, duración, cuotas. Este enfoque permite cambios sin ejecutar migraciones cada vez que se ajusta el protocolo, manteniendo flexibilidad sin sacrificar estructura.

El resultado es una arquitectura que soporta millones de registros manteniendo rendimiento, preserva latencias bajas en operaciones críticas, proporciona historial completo para auditoría y reproducibilidad, y requiere mínimas refactorizaciones cuando evoluciona un requisito experimental.

Referencias bibliográficas

[1] Codd, E. F., "A Relational Model of Data for Large Shared Data Banks," Communications of the ACM, vol. 13, no. 6, pp. 377-387, June 1970.

[2] ISO/IEC, "ISO/IEC 9075-1:2016 Information technology -- Database languages -- SQL -- Part 1: Framework (SQL/Framework)," International Organization for Standardization, 2016.

[3] Date, C. J., "An Introduction to Database Systems," 8th ed., Pearson Education, 2004.

Fin del Documento

Generado: 11 de enero de 2026
Versión: 2.0
Clasificación: Investigación Técnica Académica

