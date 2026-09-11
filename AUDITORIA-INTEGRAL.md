# FRAGUAN — auditoría integral de tienda, POS y Administración

Actualizado: 11 de septiembre de 2026.

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
- La cookie del PIN ahora está firmada, ligada al usuario y vence en el servidor. Se cerró
  el acceso directo de ADMIN/GERENTE a clientes y ventas amplias sin PIN; el alcance POS
  devuelve únicamente clientes básicos y ventas propias recientes.
- Se añadieron límites por IP y cuenta para autenticación y formularios públicos, tamaño y
  complejidad máxima de JSON, rechazo de claves peligrosas, formatos estrictos y timeouts
  en integraciones externas. La autenticación temporal por encabezados queda bloqueada
  fuera del entorno local salvo proxy confiable explícito.
- Los webhooks de pago verifican firma en tiempo constante, actualidad del timestamp,
  moneda, referencia e importe, y vuelven a consultar el pago al proveedor antes de
  confirmar una orden.
- Se amplió la política CSP y las cabeceras de aislamiento, manteniendo Google Sign-In y el
  retorno hacia Mercado Pago dentro de los orígenes previstos.
- Se añadieron nombres accesibles a controles de cantidad, anuncios de error y relaciones
  seguras para políticas abiertas en otra pestaña.
- Administración usa ahora una única navegación segmentada en todas sus áreas. Bancos,
  comunicaciones, canjes, comisiones y permisos dejaron de abrirse con una estructura
  distinta, por lo que el usuario conserva siempre el contexto y el acceso al POS.
- Se retiró la gestión de instrumentos de pago diferido de la interfaz, los formularios,
  las respuestas de la API y las proyecciones. Bancos queda centrado en cuentas,
  movimientos y conciliación; las tablas históricas permanecen inertes para no romper
  migraciones ni borrar datos antiguos.
- Se aumentó el tamaño de textos operativos, enlaces y controles en POS, Administración,
  catálogo y checkout, manteniendo compactas las prendas del POS y de la tienda.
- El carrito lateral se comprobó con producto real: conserva contraste, foco, cantidades,
  subtotal, descuento por transferencia y acción de compra visible. El checkout conserva
  los controles de cantidad ordenados y exige verificación por código de email.
- Se eliminó del acceso inicial la cantidad fija de productos de demostración, para evitar
  mostrar cifras internas o desactualizadas.

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
