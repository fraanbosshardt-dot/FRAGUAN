# Velocidad de la tienda — 9 de octubre de 2026

## Mejora aplicada

La portada y las colecciones ya reciben el catálogo en la respuesta del servidor. El contenedor de la tienda volvía a solicitarlo al montar la página. Ahora ese contenedor reutiliza los datos iniciales, incluidos los que necesita el buscador.

En las páginas que necesitan consultar el catálogo, los lectores simultáneos comparten únicamente la petición en curso. No se conserva una respuesta en caché: una consulta posterior vuelve a obtener precios y stock actuales. Los errores permiten reintentar.

No se modificaron precios, medios de pago, imágenes, animaciones ni estilos.

## Verificación

- Prueba local en navegador con componentes reales y datos aislados: catálogo inicial, **0 consultas adicionales**; productos visibles y sugerencias del buscador correctas.
- Prueba local sin catálogo inicial: **1 consulta** compartida por la página y su contenedor, productos visibles.
- Pruebas automáticas de concurrencia, actualización de precios en consultas posteriores y recuperación después de un error: **2 aprobadas**.

## Límites de esta revisión

PageSpeed Insights respondió HTTP 429 por cuota agotada del servicio público. No se obtuvo un puntaje Lighthouse ni una comparación de tiempos de carga. Tampoco se realizaron mediciones en teléfonos físicos o con conexiones móviles lentas; ese pendiente se conserva.

La mejora elimina una descarga y una consulta innecesarias en páginas con catálogo inicial. No equivale a una cifra de aceleración medida para toda la tienda, Admin o POS.
