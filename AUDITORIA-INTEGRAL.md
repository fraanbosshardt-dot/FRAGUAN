# FRAGUAN — auditoría integral de tienda, POS y Administración

Actualizado: 8 de septiembre de 2026.

## Alcance revisado

Se revisaron los tres recorridos del producto: tienda pública, caja POS y sistema de
Administración. La auditoría cubrió experiencia de compra, accesibilidad, SEO técnico,
rendimiento percibido, cálculo monetario, stock, permisos, acceso por PIN, cabeceras web,
integridad de pagos y regresiones automatizadas. Se mantuvo la decisión de no usar fotos.

## Correcciones aplicadas

- `fraguan.com` sirve la tienda real al habilitar expresamente el lanzamiento. La variable
  `FRAGUAN_DEPLOY_ENABLED=true` permite levantar el bloqueo de “Próximamente”; sin esa
  habilitación, producción continúa cerrada.
- La raíz `/` es la URL principal y canónica. `/tienda` queda como acceso secundario sin
  competir en buscadores. Navegación, emails, sitemap y búsqueda apuntan a la raíz.
- El catálogo se entrega inicialmente desde el servidor y muestra 16 productos por tanda.
  Esto reduce el árbol inicial, mantiene filtros y evita montar 50 tarjetas a la vez.
- Las variantes tienen URLs directas por SKU, preseleccionan color y talle y se describen
  en el HTML inicial mediante `ProductGroup`, `Product`, `Offer`, SKU, stock y precio.
- El aviso de privacidad recuperó contraste sólido y dejó de aparecer dentro de POS y
  Administración.
- Los importes online muestran hasta dos decimales cuando existen; no se pierden centavos.
- El checkout obtiene del backend una cotización completa: subtotal, descuento por
  transferencia, cupón, envío y total. Cambiar carrito, pago, código postal o retiro invalida
  la cotización anterior. El botón de confirmar queda bloqueado hasta tener una cotización
  vigente. El pedido vuelve a calcular todo en el servidor y una prueba compara ambos
  resultados.
- Los descuentos se explican por separado en el resumen. Un cupón escrito pero no aplicado
  no se envía al pedido.
- Las APIs exclusivas de Administración exigen sesión autorizada y también la cookie
  HttpOnly creada por el PIN. Las rutas del POS conservan su contrato específico y el rol
  VENDEDOR continúa recibiendo únicamente campos comerciales.
- Se amplió la política CSP y las cabeceras de aislamiento, manteniendo Google Sign-In y el
  retorno hacia Mercado Pago dentro de los orígenes previstos.
- Se añadieron nombres accesibles a controles de cantidad, anuncios de error y relaciones
  seguras para políticas abiertas en otra pestaña.

## Estado de cada superficie

| Superficie | Estado local | Riesgo pendiente antes de operar |
| --- | --- | --- |
| Tienda online | Recorrido completo, responsive, sin fotos, con catálogo, ficha, carrito, cuenta, Club, checkout y postventa | Fotografías reales, contenido legal y comercial definitivo, pruebas con usuarios y servicios externos reales |
| POS | Venta y pedidos online con contrato mínimo de datos, precios y stock calculados en servidor | Prueba física con lector, impresora y terminal; alta de vendedores individuales |
| Administración | Áreas segmentadas, permisos, auditoría, PIN y operaciones conectadas | Revisión operativa con datos reales, políticas finales y credenciales productivas |

## Criterio de lanzamiento

El código local puede seguir evolucionando y subirse a GitHub. No se realiza deploy hasta
que el usuario lo autorice expresamente. Antes de vender deben conectarse la base definitiva,
Google Auth, Mercado Pago, Correo Argentino y Resend; cargar datos legales; probar pagos y
webhooks con importes controlados; y completar una prueba integral en dispositivos reales.
