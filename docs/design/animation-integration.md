# Integración del paquete de microanimaciones

Se aplican a la tienda pública: transiciones de página, transiciones de los tres pasos del checkout, entrada escalonada del carrito lateral, subrayado del menú, pausa de la marquesina, pop de favoritos y zoom de imágenes reales.

La celebración y las nuevas animaciones de envío gratis quedan excluidas por indicación del usuario. Se conserva la barra existente. Se mantienen los acentos corregidos, los controles de color/talle y el asistente; no se reintroducen la tarjeta flotante de categorías ni WhatsApp.

Los datos y los pagos siguen usando el backend existente; el HTML adjunto se conserva únicamente como referencia.

## Segundo paquete: ocho efectos

Se adaptan a React en `components/store-motion.jsx` y CSS con tokens del tema: FLIP en listados filtrados/ordenados; texto rodante en botones principales; odómetro para importes reales; cortina y etiqueta al cambiar color; etiquetas flotantes y sacudida de campos inválidos en cuenta/checkout; marquesina que acelera con scroll y pausa al pasar el cursor; progreso con tilde y conectores en checkout; revelado de fotos reales fuera de la primera pantalla.

No se inyecta el script original que altera innerHTML de nodos de React. Las imágenes faltantes conservan la representación del catálogo actual; no se agregan fotos de ejemplo. Los campos conservan valores y validación existente. Se limpian observadores, listeners y animaciones al desmontar, y se respeta reducir movimiento.

## Celebración de envío gratis

Por pedido posterior del usuario se incorpora una celebración propia al cruzar los 150.000 pesos: panel azul integrado al carrito, tilde dibujado, cuatro destellos y camión suave. Dura 4,2 segundos, se cancela al bajar de la meta y no se repite al cargar un carrito ya elegible. El estado inicial espera la hidratación del carrito. Incluye anuncio accesible y respeta reducir movimiento. No modifica el cálculo de envío ni los pagos.
