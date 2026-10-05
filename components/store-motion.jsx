'use client';
import React, {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import './store-motion.css';

const ease = 'cubic-bezier(.22,1,.36,1)';
const reduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function RollingText({ children }) {
  return (
    <span className="fg-roll__txt">
      <span className="fg-roll__a">{children}</span>
      <span className="fg-roll__b" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

export function Odometer({ value }) {
  const text = '$ ' + Math.round(value).toLocaleString('es-AR');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <span className="fg-odo" aria-label={text}>
      <span className="fg-sr-only">{text}</span>
      {Array.from(text).map((char, i) =>
        /\d/.test(char) ? (
          <span className="fg-odo__col" key={i} aria-hidden="true">
            <span
              className="fg-odo__strip"
              style={{
                transform: `translateY(-${ready ? Number(char) * 10 : 0}%)`,
              }}
            >
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span className="fg-odo__sep" key={i} aria-hidden="true">
            {char === ' ' ? '\u00a0' : char}
          </span>
        ),
      )}
    </span>
  );
}

// Capture committed positions before the next React update; React keeps ownership of the list.
export function useFluidGrid(ref, identity) {
  const previous = useRef(new Map());
  useEffect(() => {
    const node = ref.current;
    if (!node || !('ResizeObserver' in window)) return;
    const observer = new ResizeObserver(() => {
      previous.current = new Map(
        Array.from(node.children)
          .filter((child) => child.dataset.fgKey)
          .map((child) => [
            child.dataset.fgKey,
            { left: child.offsetLeft, top: child.offsetTop },
          ]),
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  useLayoutEffect(() => {
    const next = new Map();
    const running = [];
    for (const child of ref.current?.children || []) {
      const key = child.dataset.fgKey;
      if (!key) continue;
      const position = {
        left: child.offsetLeft,
        top: child.offsetTop,
      };
      next.set(key, position);
      if (reduced() || !child.animate) continue;
      const before = previous.current.get(key);
      if (!before && previous.current.size) {
        running.push(
          child.animate(
            [
              { opacity: 0, transform: 'scale(.96)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 500, easing: ease },
          ),
        );
      } else if (before) {
        const x = before.left - position.left,
          y = before.top - position.top;
        if (x || y)
          running.push(
            child.animate(
              [
                { transform: `translate(${x}px,${y}px)` },
                { transform: 'none' },
              ],
              { duration: 650, easing: ease },
            ),
          );
      }
    }
    previous.current = next;
    return () => running.forEach((animation) => animation.cancel());
  }, [ref, identity]);
}

export function ColorMedia({
  color,
  tone,
  className = '',
  children,
  imageRef,
}) {
  const [shown, setShown] = useState(color);
  const requested = useRef(color);
  const curtain = useRef(null);
  useLayoutEffect(() => {
    if (requested.current === color) return;
    requested.current = color;
    const node = curtain.current;
    if (reduced() || !node?.animate) {
      setShown(color);
      return;
    }
    let cancelled = false;
    const cover = node.animate(
      [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
      { duration: 450, easing: ease, fill: 'forwards' },
    );
    let uncover;
    cover.finished
      .then(() => {
        if (cancelled) return;
        setShown(color);
        uncover = node.animate(
          [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }],
          { duration: 550, easing: ease },
        );
        return uncover.finished;
      })
      .catch(() => {})
      .finally(() => cover.cancel());
    return () => {
      cancelled = true;
      cover.cancel();
      uncover?.cancel();
    };
  }, [color]);
  return (
    <div ref={imageRef} className={'m t-' + tone(shown) + ' ' + className}>
      {typeof children === 'function' ? children(shown) : children}
      <span className="fg-color-curtain" ref={curtain} aria-hidden="true" />
    </div>
  );
}

export function PhotoReveal({ children }) {
  const ref = useRef(null);
  const [hidden, setHidden] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    // Never cover the first visible product photo, including on mobile.
    if (
      reduced() ||
      !('IntersectionObserver' in window) ||
      node.getBoundingClientRect().top < window.innerHeight
    )
      return;
    setHidden(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      if (media.matches) {
        setHidden(false);
        observer.disconnect();
      }
    };
    media.addEventListener('change', update);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);
  return (
    <span className={'fg-photo' + (hidden ? ' fg-photo-hidden' : '')} ref={ref}>
      {children}
    </span>
  );
}

export function AnimatedLabel({ children, className = '', ...props }) {
  const parts = Children.toArray(children);
  const field = parts.find(
    (child) => isValidElement(child) && child.type === 'input',
  );
  const simple =
    field &&
    !['checkbox', 'radio', 'hidden'].includes(field.props.type) &&
    parts.every((child) => typeof child === 'string' || child === field);
  if (!simple)
    return (
      <label className={className} {...props}>
        {children}
      </label>
    );
  const title = parts
    .filter((child) => typeof child === 'string')
    .join('')
    .trim();
  return (
    <label className={className + ' fg-field'} {...props}>
      {cloneElement(field, { placeholder: ' ' })}
      <span className="fg-field-label">{title}</span>
    </label>
  );
}

export function useAnimatedFields(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const animations = new Set();
    const invalid = (event) => {
      const field = event.target.closest('label') || event.target;
      event.target.setAttribute('aria-invalid', 'true');
      if (reduced() || !field.animate) return;
      const animation = field.animate(
        [
          { transform: 'none' },
          { transform: 'translateX(-7px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(2px)' },
          { transform: 'none' },
        ],
        { duration: 450, easing: ease },
      );
      animations.add(animation);
      animation.finished
        .finally(() => animations.delete(animation))
        .catch(() => {});
    };
    const input = (event) => event.target.removeAttribute('aria-invalid');
    root.addEventListener('invalid', invalid, true);
    root.addEventListener('input', input);
    return () => {
      root.removeEventListener('invalid', invalid, true);
      root.removeEventListener('input', input);
      animations.forEach((a) => a.cancel());
    };
  });
}
export function AnimatedForm({ children, ...props }) {
  const ref = useRef(null);
  useAnimatedFields(ref);
  return (
    <form {...props} ref={ref}>
      {children}
    </form>
  );
}

export function CheckoutSteps({
  step,
  labels = ['Tus datos', 'Envío', 'Pago'],
}) {
  return (
    <ol className="fg-steps" aria-label="Pasos de compra">
      {labels.map((title, i) => (
        <li
          key={title}
          className={
            'fg-step' +
            (step > i + 1 ? ' is-done' : step === i + 1 ? ' is-current' : '')
          }
          aria-current={step === i + 1 ? 'step' : undefined}
        >
          <span className="fg-step-dot" aria-hidden="true">
            <span>{step > i + 1 ? '' : i + 1}</span>
            <svg viewBox="0 0 24 24">
              <path d="M5 12l4 4L19 6" />
            </svg>
          </span>
          <span className="fg-step-label">
            {title}
            <span className="fg-sr-only">
              {step > i + 1 ? ', completado' : ''}
            </span>
          </span>
          {i < 2 && <span className="fg-step-line" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

export function ScrollMarquee({ children, ...props }) {
  const root = useRef(null),
    track = useRef(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame,
      on = true,
      paused = false,
      x = 0,
      velocity = 0,
      lastY = window.scrollY,
      last = performance.now();
    const observer = new IntersectionObserver(([entry]) => {
      on = entry.isIntersecting;
    });
    observer.observe(root.current);
    const tick = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      const y = window.scrollY,
        delta = Math.abs(y - lastY);
      lastY = y;
      const target = Math.min(delta / Math.max(dt, 0.001) / 250, 10);
      velocity += (target - velocity) * Math.min(1, dt * 5);
      if (on && !paused && !media.matches) {
        const width = track.current.scrollWidth / 2;
        x -= 70 * (1 + velocity) * dt;
        if (width) x %= width;
        track.current.style.transform = `translate3d(${x}px,0,0)`;
      }
      if (!media.matches) frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      if (!media.matches) frame = requestAnimationFrame(tick);
      else track.current.style.transform = 'none';
    };
    const pause = () => {
        paused = true;
      },
      resume = () => {
        paused = false;
      };
    root.current.addEventListener('mouseenter', pause);
    root.current.addEventListener('mouseleave', resume);
    root.current.addEventListener('focusin', pause);
    root.current.addEventListener('focusout', resume);
    media.addEventListener('change', restart);
    restart();
    const element = root.current;
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener('change', restart);
      element.removeEventListener('mouseenter', pause);
      element.removeEventListener('mouseleave', resume);
      element.removeEventListener('focusin', pause);
      element.removeEventListener('focusout', resume);
    };
  }, []);
  return (
    <div {...props} className="mq fg-scroll-marquee" ref={root}>
      <div ref={track} aria-hidden="true">
        <span className="fg-marquee-group">{children}</span>
        <span className="fg-marquee-group">{children}</span>
      </div>
    </div>
  );
}
