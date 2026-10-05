# Animaciones para fraguan.com

Dos archivos para el sitio (`fraguan-animaciones.css` y `fraguan-animaciones.js`) y una `demo.html` para probar todo funcionando. No usan librerías: JavaScript puro, sirven en cualquier plataforma.

## Instalación

1. Subí los dos archivos a tu sitio (carpeta de assets o tema).
2. En el `<head>`: `<link rel="stylesheet" href="/ruta/fraguan-animaciones.css">`
3. Antes de cerrar `</body>`: `<script src="/ruta/fraguan-animaciones.js" defer></script>`

El script se inicia solo. Si tu tienda carga contenido después (por ejemplo, un carrito lateral), llamá a `Fraguan.init(elemento)` sobre lo nuevo.

## Cómo usar cada una

**1 · Reordenamiento fluido.** Envolvé el cambio que hacés en el listado:
```js
Fraguan.flip(contenedorDeTarjetas, function () {
  // acá filtrás (hidden) o reordenás (appendChild)
});
```

**2 · Botones con texto que rueda.** Agregá la clase `fg-roll` a cualquier botón o enlace. El texto se duplica solo.

**3 · Total tipo odómetro.** `<span id="total" data-odometer="45000"></span>` y, cada vez que cambie el monto: `Fraguan.odometer(el, nuevoMonto)`. Formato por defecto: pesos argentinos. Podés pasar `{ format: fn }` para otro.

**4 · Cambio de color con cortina.**
```js
Fraguan.colorSwipe(bloque, '#d8c3a5', { label: elNombreDelColor, name: 'Arena', swap: function () { /* cambiar la foto real */ } });
```
Con fotos reales, la cortina tapa, ejecuta `swap` y destapa.

**5 · Formularios.** Estructura de cada campo: `<div class="fg-field"><input id="x" placeholder=" "><label for="x">Email</label><span class="fg-field__msg"></span></div>`. El `placeholder=" "` (un espacio) es obligatorio. Para marcar error: `Fraguan.shake(campo, 'Ingresá un email válido')`. El error se limpia al escribir.

**6 · Banda de texto.** `<div class="fg-marquee" data-fg-marquee data-speed="70"><div class="fg-marquee__track"><span class="fg-marquee__item">FORJÁ TU ESTILO ✦</span></div></div>`. `data-speed` es la velocidad base en px/seg; `data-boost` ajusta cuánto acelera con el scroll.

**7 · Pasos del checkout.** Copiá el markup de la demo (`<ol class="fg-steps">`) y llamá a `Fraguan.setStep(lista, n)` al avanzar. `n` empieza en 0.

**8 · Fotos con cortina.** Envolvé cada imagen: `<div data-reveal><img src="..." alt="..."></div>`. Conviene usarlo cuando tengas las fotos reales y no ponerlo en la primera imagen visible de la página (la que se ve sin hacer scroll).

## Detalles

- Los colores se cambian con variables en el CSS: `--fg-accent`, `--fg-ink`, `--fg-line`, `--fg-error`.
- Respetan "reducir movimiento" del sistema: si el visitante lo tiene activo, las animaciones se vuelven instantáneas.
- Si tu tienda usa Tiendanube, Shopify, WooCommerce u otra, los pasos 2 a 4 son iguales; solo cambia dónde pegás el HTML. Si me decís cuál usás, te adapto los selectores.
