import { code39 } from '@/lib/barcode';
export function Barcode({ value }: { value: string }) {
  const code = code39(value);
  if (!code)
    return (
      <small>
        Para imprimir barras, usá un código de hasta 24 caracteres: números,
        mayúsculas, guion o punto.
      </small>
    );
  return (
    <svg
      role="img"
      aria-label={`Código de barras ${value}`}
      viewBox={`0 0 ${code.width} 48`}
      style={{ width: '100%', height: 48, background: '#fff' }}
      preserveAspectRatio="none"
    >
      <rect width={code.width} height={48} fill="white" />
      {code.bars.map((bar, index) => (
        <rect
          key={index}
          x={bar.x}
          width={bar.width}
          height={48}
          fill="black"
        />
      ))}
    </svg>
  );
}
