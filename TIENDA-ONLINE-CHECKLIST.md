# FRAGUAN — cierre de tienda online

Actualizado: 8 de septiembre de 2026.

## Experiencia terminada en local

- Portada editorial propia, sin fotografías, con identidad arena, hueso, carbón, acero y cobre.
- Catálogo con búsqueda, secciones, filtros, ordenamiento, favoritos y agregado rápido por talle.
- Ficha con variante, precio online, stock real, calce, material, cuidado, asistente de talle y productos relacionados.
- Carrito persistente, cantidades, progreso de envío gratis y total con transferencia.
- Checkout como invitado o con cuenta, autocompletado, DNI, datos de entrega, retiro, Correo Argentino, transferencia con 10% y tarjeta mediante adaptador de Mercado Pago.
- Reserva de stock, protección contra sobreventa, referencia única, conciliación de pago, emails y seguimiento privado.
- Cola conectada con POS para pedidos pagos: prendas y ubicación, preparación, aviso de retiro listo y registro de entrega; el vendedor recibe una respuesta sin importes ni datos financieros.
- Mi FRAGUAN con Google Sign-In preparado, email/contraseña, perfil, Club, puntos, cashback, favoritos y pedidos.
- Footer completo en todas las superficies públicas, newsletter, ayuda y navegación legal.
- Envíos, pagos, guía de talles, contacto, cambios y devoluciones, privacidad, cookies, términos y condiciones.
- Botón de arrepentimiento visible desde el primer acceso, sin registro, con verificación razonable de pedido/email, código inmediato, email y aparición en Administración.
- Metadata por página, canonical, sitemap, robots, datos estructurados de producto y cabeceras de seguridad.
- Navegación responsive, foco visible, reducción de movimiento y formularios accesibles.
- Colecciones con URLs indexables, sitemap dinámico de productos y categorías, canonical, breadcrumbs y datos estructurados de variantes, ofertas, organización y devoluciones.
- Medición propia con consentimiento: sesiones, búsqueda, producto, carrito, checkout, compra, UTM, campaña y facturación atribuida, sin costos internos ni datos de tarjeta.
- Panel `Crecimiento online` en Administración con embudo, canales, productos mirados, carritos, reposiciones y moderación de reseñas.
- Cupones online validados en servidor por el motor central de promociones y guardados en pedido y venta.
- Recuperación de carrito consentida, direcciones guardadas, edición del carrito en checkout, stock bajo, barra de compra móvil y feedback inmediato.
- Reseñas moderadas con compra verificable y resumen preparado para SEO.
- Automatizaciones para Resend: bienvenida, nutrición, navegación y carrito abandonados, reposición, poscompra y reactivación.
- Transiciones, microinteracciones, skeletons y reducción de movimiento.

## Conexiones externas pendientes de credenciales

Estas tareas requieren datos o cuentas que no pueden inventarse en desarrollo:

1. Crear el cliente web en Google Cloud, autorizar `fraguan.com` y cargar el mismo ID en `GOOGLE_CLIENT_ID` y `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
2. Cargar razón social, CUIT, domicilio y contacto reales en las variables `STORE_*`.
3. Configurar Mercado Pago, Correo Argentino y Resend con credenciales productivas y webhooks públicos.
4. Verificar `emails.fraguan.com` en Resend, crear `atencion@fraguan.com`, activar el programador de automatizaciones y probar las bajas.
5. Decidir y conectar la base productiva; aplicar migraciones hasta `0020_store_growth.sql`.
6. Probar un pago real, un reintegro, una etiqueta de Correo Argentino, todos los emails y el flujo físico de cambio.
7. Agregar fotografías reales cuando estén disponibles; Merchant Center queda pendiente hasta contar con imágenes aprobables.
8. Conectar Search Console y Merchant Center, enviar el sitemap y revisar resultados enriquecidos después del lanzamiento autorizado.
9. Ejecutar revisión legal final con los datos reales del comercio antes de habilitar ventas.

## Referencia normativa y técnica usada

- Disposición 954/2025 sobre derecho de arrepentimiento, botón visible, código dentro de 24 horas y atención al consumidor: https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-954-2025-417152/texto
- Disposición 3/2026 sobre verificación razonable de identidad y seguridad: https://www.argentina.gob.ar/normativa/nacional/norma-423007
- Código Civil y Comercial, derecho de revocación en contratos a distancia: https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion
- Resolución 270/2020, información clara en comercio electrónico: https://www.argentina.gob.ar/normativa/nacional/norma-341933/texto
- AAIP, protección de datos personales: https://www.argentina.gob.ar/aaip/datospersonales
- Google Identity Services para web: https://developers.google.com/identity/gsi/web/guides/overview

## Regla de publicación

El trabajo se mantiene en local y GitHub. Vercel continúa mostrando “Próximamente
disponible”. No se habilita ningún deploy sin autorización explícita del usuario.
