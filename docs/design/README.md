# Diseño FRAGUAN

Referencia original: fraguan-reference.html (archivo recibido del usuario, sin modificar).

Implementación: components/store-design.jsx y app/store-design.css. React y HTM se sirven desde las dependencias del proyecto; Anton y DM Sans están en public/fonts, con sus licencias OFL. No se usan los scripts CDN del mockup.

Rutas: /, /tienda, /coleccion/[section], /producto/[slug], /carrito, /favoritos, /cuenta, /checkout, /gracias/[id], /pedido/[id], /informacion/[page], /arrepentimiento y /recuperar-carrito/[token].

La portada conserva todas las secciones, animaciones, colores, tipografía, grillas y transiciones de la referencia. La tienda usa el catálogo completo existente. Las pantallas de ayuda conservan las políticas completas de FRAGUAN. Los datos, stock, pedidos, sesiones y precios siguen usando las APIs existentes, sin la simulación de pedidos ni las contraseñas en localStorage del ejemplo. Los datos de tarjeta se ingresan en Mercado Pago, nunca en esta tienda.

Los archivos recibidos no contienen fotografías; se mantienen las composiciones tipográficas del diseño. El botón WhatsApp lleva a Contacto mientras no haya un número comercial confirmado. Efectivo aparece en el diseño del checkout pero no se habilita como medio online: el sistema actual solo procesa transferencia y tarjeta/Mercado Pago. La conexión de pagos, emails y Correo Argentino permanece pendiente según lo acordado previamente.

El usuario autorizó subir y desplegar este diseño en el proyecto existente de FRAGUAN, conservando el dominio www.fraguan.com.
