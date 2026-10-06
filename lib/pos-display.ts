export function posDay(now = Date.now()) {
  return new Date(now - 3 * 3600000).toISOString().slice(0, 10);
}
export function posPeriod(key: string, now = Date.now()) {
  const end = posDay(now);
  const day = (offset: number) =>
    new Date(Date.parse(end + 'T12:00:00Z') - offset * 86400000)
      .toISOString()
      .slice(0, 10);
  return {
    from:
      key === 'ayer'
        ? day(1)
        : key === '7'
          ? day(6)
          : key === '30'
            ? day(29)
            : key === 'mes'
              ? end.slice(0, 7) + '-01'
              : end,
    to: key === 'ayer' ? day(1) : end,
  };
}
export function promotionStatus(
  p: { active?: number | boolean; startsAt?: string; endsAt?: string },
  day = posDay(),
) {
  if (!p.active) return 'Pausada';
  if ((p.startsAt ?? '').slice(0, 10) > day) return 'Programada';
  if ((p.endsAt ?? '').slice(0, 10) < day) return 'Vencida';
  return 'Vigente';
}
