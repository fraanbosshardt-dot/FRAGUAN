/** Vuela la imagen real (o su representación actual) al botón del carrito. */
export function volarAlCarrito(origen, destino, onEnd) {
  if (
    !origen ||
    !destino ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !origen.animate
  ) {
    onEnd?.();
    return;
  }
  const a = origen.getBoundingClientRect(),
    b = destino.getBoundingClientRect();
  if (!a.width || !a.height || !b.width || !b.height) {
    onEnd?.();
    return;
  }
  const size = Math.min(a.width, a.height, 160);
  const ghost = document.createElement('div');
  ghost.className = 'fa-fly';
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    left: a.left + a.width / 2 - size / 2 + 'px',
    top: a.top + a.height / 2 - size / 2 + 'px',
    width: size + 'px',
    height: size + 'px',
  });
  if (origen.tagName === 'IMG') {
    const img = origen.cloneNode(true);
    img.removeAttribute('id');
    ghost.append(img);
  } else {
    const text = origen.querySelector('.big') || origen;
    const style = getComputedStyle(origen),
      font = getComputedStyle(text);
    const placeholder = document.createElement('span');
    placeholder.className = 'fa-fly-placeholder';
    placeholder.textContent = text.textContent;
    Object.assign(placeholder.style, {
      background: style.background,
      color: font.color,
      fontFamily: font.fontFamily,
    });
    ghost.append(placeholder);
  }
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2),
    dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const animation = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
      {
        transform:
          'translate(' +
          dx * 0.45 +
          'px,' +
          (dy * 0.45 - 90) +
          'px) scale(.7) rotate(-8deg)',
        opacity: 1,
        offset: 0.5,
      },
      {
        transform:
          'translate(' + dx + 'px,' + dy + 'px) scale(.12) rotate(10deg)',
        opacity: 0.4,
      },
    ],
    { duration: 750, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' },
  );
  const finish = () => {
    ghost.remove();
    if (destino.isConnected)
      destino.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.35)' },
          { transform: 'scale(.92)' },
          { transform: 'scale(1)' },
        ],
        { duration: 450 },
      );
    onEnd?.();
  };
  animation.onfinish = finish;
  animation.oncancel = () => {
    ghost.remove();
    onEnd?.();
  };
}
