# FRAGUAN — Animaciones (criterio: pocas, sutiles, livianas)

Todo es CSS puro, sin librerías extra. Todas respetan "reducir movimiento" del dispositivo.
Cada bloque está marcado en `index.html` con un comentario `/* ANIM n · ... */`: para sacar una, borrás ese bloque.

## Ya estaban y se mantienen (son la identidad de la marca)
- Logo FRAGUAN que se revela letra por letra en el inicio.
- Texto gigante que se enciende con el scroll, "Lo más vendido" con scroll horizontal y contadores.
- Marquesina superior, hover de las categorías y de los tiles, carrito lateral que se desliza.

## REEMPLAZO: animación de envío gratis (la nueva reemplaza a la anterior)
La versión anterior (banda azul a pantalla completa + camión + destellos) se eliminó por completo.
La nueva es más sutil y cuenta algo útil:
1. **Camioncito en la barra de progreso.** Viaja a lo largo de la barra a medida que sumás productos. El cliente "ve" que se acerca al envío gratis.
2. Al llegar al mínimo: la barra pasa un **brillo una sola vez**, el camión da un **saltito** y se pinta del color de la marca.
3. Aparece un **cartel chico** arriba ("Envío gratis desbloqueado") con un tilde que se dibuja solo y se va a los 3 segundos.
4. Se dispara solo al cruzar el mínimo, no al recargar ni al abrir el carrito.
El monto se cambia en `FREE` (arriba del script de `index.html` y en `api/crear-pago.js`).

## Las 6 micro-animaciones que suman
| # | Qué hace | Dónde | Por qué suma |
|---|---|---|---|
| 1 | Fundido suave al cambiar de página y de paso del checkout | Todo el sitio | Quita el "salto" seco entre pantallas; se siente una sola app. |
| 2 | Las líneas del carrito entran escalonadas; el producto nuevo se desliza adentro | Carrito lateral | Confirma qué se agregó sin tener que mirar el contador. |
| 3 | Subrayado que crece en el menú; la marquesina se pausa al pasar el mouse | Barra superior | Detalle de pulido y permite leer la promo con calma. |
| 4 | Corazón de favoritos con un "pop" | Tarjetas de producto | Feedback inmediato al guardar. |
| 5 | Zoom lento (4%) de la foto al pasar el mouse | Tarjetas con foto real | Da vida a las fotos sin distraer. |
| 6 | Cartel + barra de envío gratis (arriba) | Carrito | Empuja a sumar un producto más, que es lo que más convierte. |

## Lo que NO recomiendo agregar
Parallax en todas las secciones, tarjetas que se inclinan en 3D, botones "magnéticos", partículas o confeti,
textos que se escriben solos en cada título. Pesan, marean en el celular y le quitan protagonismo a la ropa.

## Cómo aplicar
1. Reemplazá `index.html` de tu proyecto por el de este paquete (o copiá la carpeta completa).
2. `vercel --prod` desde la carpeta del proyecto.
3. Probá agregando productos hasta pasar el mínimo de envío gratis.
