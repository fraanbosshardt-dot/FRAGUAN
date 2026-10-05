/* Fraguan · animaciones (8) · JS puro, sin dependencias.
   Uso: <script src="fraguan-animaciones.js" defer></script>  y se auto-inicia. */
(function () {
  'use strict';

  var EASE = 'cubic-bezier(.22,1,.36,1)';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dur = function (ms) { return reduce ? 0 : ms; };
  var visible = function (el) { return el.getClientRects().length > 0; };

  /* 1 · Reordenamiento fluido (FLIP) ---------------------------------
     Fraguan.flip(contenedor, function () { ...filtrar / ordenar / mover nodos... }) */
  function flip(container, mutate) {
    var first = new Map();
    Array.prototype.forEach.call(container.children, function (k) {
      if (visible(k)) first.set(k, k.getBoundingClientRect());
    });
    mutate();
    Array.prototype.forEach.call(container.children, function (k) {
      if (!visible(k)) return;
      var f = first.get(k);
      if (!f) {
        k.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: dur(500), easing: EASE });
        return;
      }
      var l = k.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
      if (dx || dy) k.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: dur(650), easing: EASE });
    });
  }

  /* 2 · Botones con texto que rueda: clase .fg-roll ------------------- */
  function wrapRoll(root) {
    (root || document).querySelectorAll('.fg-roll').forEach(function (b) {
      if (b.querySelector('.fg-roll__txt')) return;
      var t = b.textContent.trim();
      b.setAttribute('aria-label', t);
      b.innerHTML = '<span class="fg-roll__txt" aria-hidden="true"><span class="fg-roll__a">' + t + '</span><span class="fg-roll__b">' + t + '</span></span>';
    });
  }

  /* 3 · Total tipo odómetro ------------------------------------------
     Fraguan.odometer(elemento, 125000)  ·  opcional: { format: function (n) { return '...'; } } */
  var ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  function odometer(el, value, opts) {
    var fmt = (opts && opts.format) || function (n) { return ars.format(n); };
    var str = fmt(value).replace(/\u00a0/g, ' ');
    var chars = Array.from(str), prev = el._fgChars;
    var same = prev && prev.length === chars.length && chars.every(function (c, i) { return /\d/.test(c) === /\d/.test(prev[i]); });
    el.classList.add('fg-odo');
    el.setAttribute('role', 'text');
    el.setAttribute('aria-label', str);
    if (!same) {
      el.innerHTML = '';
      chars.forEach(function (c) {
        if (/\d/.test(c)) {
          var col = document.createElement('span'), strip = document.createElement('span');
          col.className = 'fg-odo__col'; col.setAttribute('aria-hidden', 'true');
          strip.className = 'fg-odo__strip';
          for (var d = 0; d < 10; d++) { var s = document.createElement('span'); s.textContent = d; strip.appendChild(s); }
          col.appendChild(strip); el.appendChild(col);
        } else {
          var sep = document.createElement('span');
          sep.className = 'fg-odo__sep'; sep.setAttribute('aria-hidden', 'true');
          el.appendChild(sep);
        }
      });
    }
    var first = !same;
    var apply = function () {
      chars.forEach(function (c, i) {
        var node = el.children[i];
        if (/\d/.test(c)) node.firstChild.style.transform = 'translateY(' + (-Number(c) * 10) + '%)';
        else node.textContent = c === ' ' ? '\u00a0' : c;
      });
    };
    if (first && !reduce) requestAnimationFrame(function () { requestAnimationFrame(apply); }); else apply();
    el._fgChars = chars;
  }

  /* 4 · Cambio de color con cortina -----------------------------------
     Fraguan.colorSwipe(bloque, '#d8c3a5', { label: elNombre, name: 'Arena', curtain: '#1a1a1a', swap: fn }) */
  function colorSwipe(block, color, opts) {
    opts = opts || {};
    if (getComputedStyle(block).position === 'static') block.style.position = 'relative';
    block.style.overflow = 'hidden';
    var apply = function () { block.style.background = color; if (opts.swap) opts.swap(); };
    if (opts.label && opts.name) labelSlide(opts.label, opts.name);
    if (reduce) { apply(); return; }
    var ov = document.createElement('div');
    ov.className = 'fg-swipe';
    ov.style.background = opts.curtain || '#1a1a1a';
    block.appendChild(ov);
    var inn = ov.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 450, easing: EASE, fill: 'forwards' });
    inn.finished.then(function () {
      apply();
      return ov.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }], { duration: 550, easing: EASE, fill: 'forwards' }).finished;
    }).then(function () { ov.remove(); });
  }
  function labelSlide(el, text) {
    if (reduce) { el.textContent = text; return; }
    el.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-60%)', opacity: 0 }], { duration: 220, easing: 'ease-in' }).finished.then(function () {
      el.textContent = text;
      el.animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 400, easing: EASE });
    });
  }

  /* 5 · Formularios: error con sacudida ------------------------------
     Fraguan.shake(campo, 'Ingresá un email válido')   ·   Fraguan.clearError(campo) */
  function shake(field, message) {
    field.classList.add('is-error');
    var msg = field.querySelector('.fg-field__msg');
    if (msg && message) msg.textContent = message;
    if (reduce) return;
    field.classList.remove('is-shake');
    void field.offsetWidth;
    field.classList.add('is-shake');
    field.addEventListener('animationend', function h() { field.classList.remove('is-shake'); field.removeEventListener('animationend', h); });
  }
  function clearError(field) { field.classList.remove('is-error'); }

  /* 6 · Banda de texto que acelera con el scroll ----------------------
     Markup: <div class="fg-marquee" data-fg-marquee data-speed="70"><div class="fg-marquee__track"><span class="fg-marquee__item">FORJÁ TU ESTILO ✦</span></div></div> */
  function marquee(root) {
    var track = root.querySelector('.fg-marquee__track');
    if (!track || root._fgMarquee) return;
    root._fgMarquee = true;
    var base = Number(root.dataset.speed) || 70;
    var boost = Number(root.dataset.boost) || 1;
    var setW = track.scrollWidth, html = track.innerHTML, guard = 0;
    while (track.scrollWidth < root.offsetWidth + setW && guard++ < 20) track.insertAdjacentHTML('beforeend', html);
    if (reduce) return;
    var x = 0, vel = 0, lastY = window.scrollY, last = performance.now(), on = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { on = e[0].isIntersecting; }).observe(root);
    (function tick(t) {
      var dt = Math.min((t - last) / 1000, .05); last = t;
      var y = window.scrollY, dy = Math.abs(y - lastY); lastY = y;
      var target = Math.min(dy / Math.max(dt, .001) / 250, 10) * boost;
      vel += (target - vel) * Math.min(1, dt * 5);
      if (on) {
        x -= base * (1 + vel) * dt;
        if (x <= -setW) x += setW;
        track.style.transform = 'translate3d(' + x + 'px,0,0)';
      }
      requestAnimationFrame(tick);
    })(last);
  }

  /* 7 · Pasos del checkout --------------------------------------------
     Fraguan.setStep(document.querySelector('.fg-steps'), 1)   // paso actual, empieza en 0 */
  function setStep(list, n) {
    Array.prototype.forEach.call(list.querySelectorAll('.fg-step'), function (li, i) {
      li.classList.toggle('is-done', i < n);
      li.classList.toggle('is-current', i === n);
      if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  /* 8 · Fotos que se revelan al hacer scroll: atributo data-reveal ---- */
  function reveal(root) {
    var els = (root || document).querySelectorAll('[data-reveal]:not(.is-in)');
    if (!('IntersectionObserver' in window) || reduce) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* Inicialización ---------------------------------------------------- */
  function init(root) {
    document.documentElement.classList.add('fg-js');
    wrapRoll(root);
    (root || document).querySelectorAll('[data-fg-marquee]').forEach(marquee);
    (root || document).querySelectorAll('[data-odometer]').forEach(function (el) { odometer(el, Number(el.dataset.odometer)); });
    (root || document).querySelectorAll('.fg-field input, .fg-field textarea').forEach(function (i) {
      if (!i._fgBound) { i._fgBound = true; i.addEventListener('input', function () { clearError(i.closest('.fg-field')); }); }
    });
    reveal(root);
  }

  window.Fraguan = { init: init, flip: flip, odometer: odometer, colorSwipe: colorSwipe, shake: shake, clearError: clearError, marquee: marquee, setStep: setStep, reveal: reveal };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();
