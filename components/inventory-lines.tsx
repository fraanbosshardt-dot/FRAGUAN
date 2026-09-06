'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export type CountLine = { variantId: string; counted: string };
export function InventoryLines({
  lines,
  onChange,
  choices,
}: {
  lines: CountLine[];
  onChange: (lines: CountLine[]) => void;
  choices: [string, string][];
}) {
  return (
    <fieldset>
      <legend>Prendas del conteo</legend>
      {lines.map((line, index) => (
        <div className="purchase-line-editor" key={index}>
          <label>
            Variante
            <select
              required
              value={line.variantId}
              onChange={(e) =>
                onChange(
                  lines.map((r, i) =>
                    i === index ? { ...r, variantId: e.target.value } : r,
                  ),
                )
              }
            >
              <option value="">Seleccionar…</option>
              {choices.map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                  disabled={lines.some(
                    (r, i) => i !== index && r.variantId === value,
                  )}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cantidad encontrada
            <Input
              type="number"
              min={0}
              max={100000}
              required
              value={line.counted}
              onChange={(e) =>
                onChange(
                  lines.map((r, i) =>
                    i === index ? { ...r, counted: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          {lines.length > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(lines.filter((_, i) => i !== index))}
            >
              Quitar
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={lines.length >= 100}
        onClick={() => onChange([...lines, { variantId: '', counted: '' }])}
      >
        Agregar variante
      </Button>
      <p className="quiet">
        El conteo guarda las diferencias. El stock cambia únicamente al
        aprobarlo.
      </p>
    </fieldset>
  );
}
