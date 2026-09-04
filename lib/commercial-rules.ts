/**
 * Pure commercial promotion engine.
 *
 * Monetary values are integer cents and percentage rates are integer basis
 * points (10_000 bps = 100%). Rules are evaluated by descending priority and,
 * for equal priorities, by promotion id. Date ranges are [start, end) and daily
 * ranges are also start-inclusive/end-exclusive.
 *
 * The caller must obtain promotions from a trusted server-side source. The
 * explicit `authorized` flag is fail-closed: a rule can only apply when it is
 * both authorized and active.
 */

export type PromotionKind =
  | 'percentage'
  | 'fixed_amount'
  | 'two_for_one'
  | 'second_unit_percentage';

export type PairGrouping = 'line' | 'cart';

export interface CommercialCartItem {
  id: string;
  category?: string;
  brand?: string;
  unitPriceCents: number;
  quantity: number;
}

export interface PromotionScope {
  categories?: readonly string[];
  brands?: readonly string[];
}

export interface BirthdayCondition {
  daysBefore?: number;
  daysAfter?: number;
}

export interface PromotionSchedule {
  startsAt?: string;
  endsAt?: string;
  /** Sunday = 0, Saturday = 6. */
  daysOfWeek?: readonly number[];
  dailyStart?: string;
  dailyEnd?: string;
  timeZoneOffsetMinutes?: number;
}

export interface PromotionConditions {
  /** Every payment method used by a split payment must be in this allowlist. */
  paymentMethodIds?: readonly string[];
  couponCodes?: readonly string[];
  customerLevels?: readonly string[];
  /** `true` means the exact birthday; an object can define a surrounding window. */
  birthday?: true | BirthdayCondition;
  schedule?: PromotionSchedule;
}

interface PromotionBase {
  id: string;
  name: string;
  authorized: boolean;
  active: boolean;
  priority?: number;
  exclusive?: boolean;
  scope?: PromotionScope;
  conditions?: PromotionConditions;
}

export interface PercentagePromotion extends PromotionBase {
  kind: 'percentage';
  percentBps: number;
}

export interface FixedAmountPromotion extends PromotionBase {
  kind: 'fixed_amount';
  amountCents: number;
}

export interface TwoForOnePromotion extends PromotionBase {
  kind: 'two_for_one';
  groupBy?: PairGrouping;
}

export interface SecondUnitPercentagePromotion extends PromotionBase {
  kind: 'second_unit_percentage';
  percentBps: number;
  groupBy?: PairGrouping;
}

export type CommercialPromotion =
  | PercentagePromotion
  | FixedAmountPromotion
  | TwoForOnePromotion
  | SecondUnitPercentagePromotion;

export interface CommercialCustomerContext {
  level?: string;
  /** Calendar date in YYYY-MM-DD format. */
  birthDate?: string;
}

export interface CommercialRuleContext {
  /** ISO-8601 timestamp with `Z` or an explicit numeric offset. */
  evaluatedAt: string;
  /** Overrides the offset encoded in evaluatedAt for business calendar rules. */
  timeZoneOffsetMinutes?: number;
  paymentMethodIds?: readonly string[];
  couponCode?: string;
  customer?: CommercialCustomerContext | null;
}

export interface CommercialRuleInput {
  items: readonly CommercialCartItem[];
  promotions: readonly CommercialPromotion[];
  context: CommercialRuleContext;
}

export interface AppliedDiscountItem {
  itemId: string;
  amountCents: number;
  affectedQuantity: number;
}

export interface AppliedDiscount {
  promotionId: string;
  promotionName: string;
  kind: PromotionKind;
  priority: number;
  exclusive: boolean;
  amountCents: number;
  items: AppliedDiscountItem[];
}

export interface CommercialRuleItemResult {
  itemId: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

export interface CommercialRuleResult {
  subtotalCents: number;
  discountTotalCents: number;
  totalCents: number;
  appliedDiscounts: AppliedDiscount[];
  items: CommercialRuleItemResult[];
}

export class CommercialRuleValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'CommercialRuleValidationError';
    this.path = path;
  }
}

type JsonRecord = Record<string, unknown>;

interface ParsedInstant {
  epochMs: number;
  offsetMinutes: number;
}

interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

interface NormalizedSchedule {
  startsAtMs?: number;
  endsAtMs?: number;
  daysOfWeek?: ReadonlySet<number>;
  dailyStartMinutes?: number;
  dailyEndMinutes?: number;
  timeZoneOffsetMinutes?: number;
}

interface NormalizedConditions {
  paymentMethodIds?: ReadonlySet<string>;
  couponCodes?: ReadonlySet<string>;
  customerLevels?: ReadonlySet<string>;
  birthday?: { daysBefore: number; daysAfter: number };
  schedule?: NormalizedSchedule;
}

interface NormalizedScope {
  categories?: ReadonlySet<string>;
  brands?: ReadonlySet<string>;
}

interface NormalizedPromotion {
  id: string;
  name: string;
  authorized: boolean;
  active: boolean;
  priority: number;
  exclusive: boolean;
  kind: PromotionKind;
  percentBps?: number;
  amountCents?: number;
  groupBy: PairGrouping;
  scope?: NormalizedScope;
  conditions?: NormalizedConditions;
}

interface NormalizedItem {
  id: string;
  category?: string;
  brand?: string;
  unitPriceCents: number;
  quantity: number;
}

interface NormalizedContext {
  evaluatedAtMs: number;
  timeZoneOffsetMinutes: number;
  paymentMethodIds: ReadonlySet<string>;
  couponCode?: string;
  customer?: { level?: string; birthDate?: ParsedDate };
}

interface UnitLedger {
  serial: number;
  itemIndex: number;
  unitIndex: number;
  baseCents: number;
  remainingCents: number;
}

interface UnitDiscount {
  unit: UnitLedger;
  amountCents: number;
}

const MAX_CART_ITEMS = 500;
const MAX_PROMOTIONS = 500;
const MAX_TOTAL_UNITS = 10_000;
const MAX_LIST_LENGTH = 500;
const MAX_PRIORITY = 1_000_000;
const BASIS_POINTS = BigInt(10_000);

function fail(path: string, message: string): never {
  throw new CommercialRuleValidationError(path, message);
}

function record(value: unknown, path: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(path, 'debe ser un objeto');
  return value as JsonRecord;
}

function exactKeys(
  value: JsonRecord,
  allowed: readonly string[],
  path: string,
) {
  const allow = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allow.has(key)) fail(`${path}.${key}`, 'campo no permitido');
  }
}

function requiredString(value: unknown, path: string, maxLength = 200): string {
  if (typeof value !== 'string') fail(path, 'debe ser texto');
  if (value.length === 0 || value.trim() !== value)
    fail(path, 'no puede estar vacío ni tener espacios exteriores');
  if (value.length > maxLength)
    fail(path, `no puede superar ${maxLength} caracteres`);
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, path);
}

function requiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'debe ser booleano');
  return value;
}

function optionalBoolean(
  value: unknown,
  path: string,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  return requiredBoolean(value, path);
}

function integer(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value)) fail(path, 'debe ser un entero seguro');
  const parsed = value as number;
  if (parsed < minimum || parsed > maximum)
    fail(path, `debe estar entre ${minimum} y ${maximum}`);
  return parsed;
}

function normalizeToken(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

function stringSet(
  value: unknown,
  path: string,
): ReadonlySet<string> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0)
    fail(path, 'debe ser una lista no vacía');
  if (value.length > MAX_LIST_LENGTH)
    fail(path, `no puede superar ${MAX_LIST_LENGTH} valores`);
  const result = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const token = normalizeToken(
      requiredString(value[index], `${path}[${index}]`),
    );
    if (result.has(token)) fail(`${path}[${index}]`, 'valor duplicado');
    result.add(token);
  }
  return result;
}

function numberSet(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): ReadonlySet<number> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0)
    fail(path, 'debe ser una lista no vacía');
  const result = new Set<number>();
  for (let index = 0; index < value.length; index += 1) {
    const parsed = integer(value[index], `${path}[${index}]`, minimum, maximum);
    if (result.has(parsed)) fail(`${path}[${index}]`, 'valor duplicado');
    result.add(parsed);
  }
  return result;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function validateCalendarDate(
  year: number,
  month: number,
  day: number,
  path: string,
) {
  if (year < 1 || year > 9999) fail(path, 'año fuera de rango');
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month))
    fail(path, 'fecha de calendario inválida');
}

function parseDate(value: unknown, path: string): ParsedDate {
  const text = requiredString(value, path, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) fail(path, 'debe usar el formato YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  validateCalendarDate(year, month, day, path);
  return { year, month, day };
}

function utcEpoch(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return date.getTime();
}

function parseInstant(value: unknown, path: string): ParsedInstant {
  const text = requiredString(value, path, 35);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(
      text,
    );
  if (!match)
    fail(path, 'debe ser ISO-8601 e incluir Z o un desplazamiento numérico');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const millisecond =
    match[7] === undefined ? 0 : Number(match[7].padEnd(3, '0'));
  validateCalendarDate(year, month, day, path);
  if (hour > 23 || minute > 59 || second > 59)
    fail(path, 'hora de calendario inválida');

  let offsetMinutes = 0;
  if (match[8] !== 'Z') {
    const offsetHour = Number(match[8].slice(1, 3));
    const offsetMinute = Number(match[8].slice(4, 6));
    if (
      offsetHour > 14 ||
      offsetMinute > 59 ||
      (offsetHour === 14 && offsetMinute !== 0)
    )
      fail(path, 'desplazamiento horario inválido');
    const sign = match[8][0] === '+' ? 1 : -1;
    offsetMinutes = sign * (offsetHour * 60 + offsetMinute);
  }
  const epochMs =
    utcEpoch(year, month, day, hour, minute, second, millisecond) -
    offsetMinutes * 60_000;
  if (!Number.isFinite(epochMs)) fail(path, 'instante fuera de rango');
  return { epochMs, offsetMinutes };
}

function parseClock(value: unknown, path: string): number {
  const text = requiredString(value, path, 5);
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) fail(path, 'debe usar el formato HH:MM');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) fail(path, 'hora inválida');
  return hour * 60 + minute;
}

function parseScope(value: unknown, path: string): NormalizedScope | undefined {
  if (value === undefined) return undefined;
  const source = record(value, path);
  exactKeys(source, ['categories', 'brands'], path);
  const categories = stringSet(source.categories, `${path}.categories`);
  const brands = stringSet(source.brands, `${path}.brands`);
  if (!categories && !brands) fail(path, 'debe contener al menos un filtro');
  return { categories, brands };
}

function parseSchedule(
  value: unknown,
  path: string,
): NormalizedSchedule | undefined {
  if (value === undefined) return undefined;
  const source = record(value, path);
  exactKeys(
    source,
    [
      'startsAt',
      'endsAt',
      'daysOfWeek',
      'dailyStart',
      'dailyEnd',
      'timeZoneOffsetMinutes',
    ],
    path,
  );
  const startsAtMs =
    source.startsAt === undefined
      ? undefined
      : parseInstant(source.startsAt, `${path}.startsAt`).epochMs;
  const endsAtMs =
    source.endsAt === undefined
      ? undefined
      : parseInstant(source.endsAt, `${path}.endsAt`).epochMs;
  if (
    startsAtMs !== undefined &&
    endsAtMs !== undefined &&
    startsAtMs >= endsAtMs
  )
    fail(path, 'startsAt debe ser anterior a endsAt');
  const daysOfWeek = numberSet(source.daysOfWeek, `${path}.daysOfWeek`, 0, 6);
  const hasDailyStart = source.dailyStart !== undefined;
  const hasDailyEnd = source.dailyEnd !== undefined;
  if (hasDailyStart !== hasDailyEnd)
    fail(path, 'dailyStart y dailyEnd deben declararse juntos');
  const dailyStartMinutes = hasDailyStart
    ? parseClock(source.dailyStart, `${path}.dailyStart`)
    : undefined;
  const dailyEndMinutes = hasDailyEnd
    ? parseClock(source.dailyEnd, `${path}.dailyEnd`)
    : undefined;
  if (
    dailyStartMinutes !== undefined &&
    dailyEndMinutes !== undefined &&
    dailyStartMinutes === dailyEndMinutes
  )
    fail(path, 'la franja diaria no puede tener inicio y fin iguales');
  const timeZoneOffsetMinutes =
    source.timeZoneOffsetMinutes === undefined
      ? undefined
      : integer(
          source.timeZoneOffsetMinutes,
          `${path}.timeZoneOffsetMinutes`,
          -840,
          840,
        );
  if (
    startsAtMs === undefined &&
    endsAtMs === undefined &&
    !daysOfWeek &&
    dailyStartMinutes === undefined &&
    timeZoneOffsetMinutes === undefined
  )
    fail(path, 'debe contener al menos una condición temporal');
  return {
    startsAtMs,
    endsAtMs,
    daysOfWeek,
    dailyStartMinutes,
    dailyEndMinutes,
    timeZoneOffsetMinutes,
  };
}

function parseBirthday(
  value: unknown,
  path: string,
): { daysBefore: number; daysAfter: number } | undefined {
  if (value === undefined) return undefined;
  if (value === true) return { daysBefore: 0, daysAfter: 0 };
  if (value === false) fail(path, 'use true o quite la condición');
  const source = record(value, path);
  exactKeys(source, ['daysBefore', 'daysAfter'], path);
  const daysBefore =
    source.daysBefore === undefined
      ? 0
      : integer(source.daysBefore, `${path}.daysBefore`, 0, 366);
  const daysAfter =
    source.daysAfter === undefined
      ? 0
      : integer(source.daysAfter, `${path}.daysAfter`, 0, 366);
  return { daysBefore, daysAfter };
}

function parseConditions(
  value: unknown,
  path: string,
): NormalizedConditions | undefined {
  if (value === undefined) return undefined;
  const source = record(value, path);
  exactKeys(
    source,
    [
      'paymentMethodIds',
      'couponCodes',
      'customerLevels',
      'birthday',
      'schedule',
    ],
    path,
  );
  const paymentMethodIds = stringSet(
    source.paymentMethodIds,
    `${path}.paymentMethodIds`,
  );
  const couponCodes = stringSet(source.couponCodes, `${path}.couponCodes`);
  const customerLevels = stringSet(
    source.customerLevels,
    `${path}.customerLevels`,
  );
  const birthday = parseBirthday(source.birthday, `${path}.birthday`);
  const schedule = parseSchedule(source.schedule, `${path}.schedule`);
  if (
    !paymentMethodIds &&
    !couponCodes &&
    !customerLevels &&
    !birthday &&
    !schedule
  )
    fail(path, 'debe contener al menos una condición');
  return { paymentMethodIds, couponCodes, customerLevels, birthday, schedule };
}

function parseItem(value: unknown, path: string): NormalizedItem {
  const source = record(value, path);
  exactKeys(
    source,
    ['id', 'category', 'brand', 'unitPriceCents', 'quantity'],
    path,
  );
  const id = requiredString(source.id, `${path}.id`);
  const category = optionalString(source.category, `${path}.category`);
  const brand = optionalString(source.brand, `${path}.brand`);
  const unitPriceCents = integer(
    source.unitPriceCents,
    `${path}.unitPriceCents`,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const quantity = integer(
    source.quantity,
    `${path}.quantity`,
    1,
    MAX_TOTAL_UNITS,
  );
  return {
    id,
    category: category === undefined ? undefined : normalizeToken(category),
    brand: brand === undefined ? undefined : normalizeToken(brand),
    unitPriceCents,
    quantity,
  };
}

function parsePromotion(value: unknown, path: string): NormalizedPromotion {
  const source = record(value, path);
  exactKeys(
    source,
    [
      'id',
      'name',
      'authorized',
      'active',
      'priority',
      'exclusive',
      'kind',
      'percentBps',
      'amountCents',
      'groupBy',
      'scope',
      'conditions',
    ],
    path,
  );
  const id = requiredString(source.id, `${path}.id`);
  const name = requiredString(source.name, `${path}.name`);
  const authorized = requiredBoolean(source.authorized, `${path}.authorized`);
  const active = requiredBoolean(source.active, `${path}.active`);
  const priority =
    source.priority === undefined
      ? 0
      : integer(
          source.priority,
          `${path}.priority`,
          -MAX_PRIORITY,
          MAX_PRIORITY,
        );
  const exclusive = optionalBoolean(
    source.exclusive,
    `${path}.exclusive`,
    false,
  );
  const kind = requiredString(source.kind, `${path}.kind`, 40) as PromotionKind;
  if (
    kind !== 'percentage' &&
    kind !== 'fixed_amount' &&
    kind !== 'two_for_one' &&
    kind !== 'second_unit_percentage'
  )
    fail(`${path}.kind`, 'tipo de promoción desconocido');

  let percentBps: number | undefined;
  let amountCents: number | undefined;
  let groupBy: PairGrouping = 'line';
  if (kind === 'percentage' || kind === 'second_unit_percentage') {
    percentBps = integer(source.percentBps, `${path}.percentBps`, 1, 10_000);
  } else if (source.percentBps !== undefined) {
    fail(`${path}.percentBps`, `no corresponde a ${kind}`);
  }
  if (kind === 'fixed_amount') {
    amountCents = integer(
      source.amountCents,
      `${path}.amountCents`,
      1,
      Number.MAX_SAFE_INTEGER,
    );
  } else if (source.amountCents !== undefined) {
    fail(`${path}.amountCents`, `no corresponde a ${kind}`);
  }
  if (kind === 'two_for_one' || kind === 'second_unit_percentage') {
    if (
      source.groupBy !== undefined &&
      source.groupBy !== 'line' &&
      source.groupBy !== 'cart'
    )
      fail(`${path}.groupBy`, 'debe ser line o cart');
    groupBy = (source.groupBy as PairGrouping | undefined) ?? 'line';
  } else if (source.groupBy !== undefined) {
    fail(`${path}.groupBy`, `no corresponde a ${kind}`);
  }

  return {
    id,
    name,
    authorized,
    active,
    priority,
    exclusive,
    kind,
    percentBps,
    amountCents,
    groupBy,
    scope: parseScope(source.scope, `${path}.scope`),
    conditions: parseConditions(source.conditions, `${path}.conditions`),
  };
}

function parseContext(value: unknown, path: string): NormalizedContext {
  const source = record(value, path);
  exactKeys(
    source,
    [
      'evaluatedAt',
      'timeZoneOffsetMinutes',
      'paymentMethodIds',
      'couponCode',
      'customer',
    ],
    path,
  );
  const instant = parseInstant(source.evaluatedAt, `${path}.evaluatedAt`);
  const timeZoneOffsetMinutes =
    source.timeZoneOffsetMinutes === undefined
      ? instant.offsetMinutes
      : integer(
          source.timeZoneOffsetMinutes,
          `${path}.timeZoneOffsetMinutes`,
          -840,
          840,
        );
  const paymentMethodIds =
    stringSet(source.paymentMethodIds, `${path}.paymentMethodIds`) ??
    new Set<string>();
  const couponCode = optionalString(source.couponCode, `${path}.couponCode`);
  let customer: NormalizedContext['customer'];
  if (source.customer !== undefined && source.customer !== null) {
    const customerSource = record(source.customer, `${path}.customer`);
    exactKeys(customerSource, ['level', 'birthDate'], `${path}.customer`);
    const level = optionalString(
      customerSource.level,
      `${path}.customer.level`,
    );
    const birthDate =
      customerSource.birthDate === undefined
        ? undefined
        : parseDate(customerSource.birthDate, `${path}.customer.birthDate`);
    if (level === undefined && birthDate === undefined)
      fail(`${path}.customer`, 'debe contener nivel o fecha de nacimiento');
    customer = {
      level: level === undefined ? undefined : normalizeToken(level),
      birthDate,
    };
  }
  return {
    evaluatedAtMs: instant.epochMs,
    timeZoneOffsetMinutes,
    paymentMethodIds,
    couponCode:
      couponCode === undefined ? undefined : normalizeToken(couponCode),
    customer,
  };
}

function parseInput(input: unknown): {
  items: NormalizedItem[];
  promotions: NormalizedPromotion[];
  context: NormalizedContext;
  subtotalCents: number;
} {
  const source = record(input, 'input');
  exactKeys(source, ['items', 'promotions', 'context'], 'input');
  if (!Array.isArray(source.items) || source.items.length === 0)
    fail('input.items', 'debe ser una lista no vacía');
  if (source.items.length > MAX_CART_ITEMS)
    fail('input.items', `no puede superar ${MAX_CART_ITEMS} líneas`);
  if (!Array.isArray(source.promotions))
    fail('input.promotions', 'debe ser una lista');
  if (source.promotions.length > MAX_PROMOTIONS)
    fail('input.promotions', `no puede superar ${MAX_PROMOTIONS} reglas`);

  const items = source.items.map((item, index) =>
    parseItem(item, `input.items[${index}]`),
  );
  const itemIds = new Set<string>();
  let totalUnits = 0;
  let subtotal = BigInt(0);
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (itemIds.has(item.id))
      fail(`input.items[${index}].id`, 'identificador duplicado');
    itemIds.add(item.id);
    totalUnits += item.quantity;
    if (totalUnits > MAX_TOTAL_UNITS)
      fail('input.items', `no puede superar ${MAX_TOTAL_UNITS} unidades`);
    subtotal += BigInt(item.unitPriceCents) * BigInt(item.quantity);
    if (subtotal > BigInt(Number.MAX_SAFE_INTEGER))
      fail('input.items', 'el subtotal excede el rango monetario seguro');
  }

  const promotions = source.promotions.map((promotion, index) =>
    parsePromotion(promotion, `input.promotions[${index}]`),
  );
  const promotionIds = new Set<string>();
  for (let index = 0; index < promotions.length; index += 1) {
    if (promotionIds.has(promotions[index].id))
      fail(`input.promotions[${index}].id`, 'identificador duplicado');
    promotionIds.add(promotions[index].id);
  }

  return {
    items,
    promotions,
    context: parseContext(source.context, 'input.context'),
    subtotalCents: Number(subtotal),
  };
}

function localDate(epochMs: number, offsetMinutes: number): Date {
  return new Date(epochMs + offsetMinutes * 60_000);
}

function scheduleMatches(
  schedule: NormalizedSchedule,
  context: NormalizedContext,
): boolean {
  if (
    schedule.startsAtMs !== undefined &&
    context.evaluatedAtMs < schedule.startsAtMs
  )
    return false;
  if (
    schedule.endsAtMs !== undefined &&
    context.evaluatedAtMs >= schedule.endsAtMs
  )
    return false;

  const offset =
    schedule.timeZoneOffsetMinutes ?? context.timeZoneOffsetMinutes;
  const local = localDate(context.evaluatedAtMs, offset);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  let scheduleDay = local.getUTCDay();

  if (
    schedule.dailyStartMinutes !== undefined &&
    schedule.dailyEndMinutes !== undefined
  ) {
    const start = schedule.dailyStartMinutes;
    const end = schedule.dailyEndMinutes;
    if (start < end) {
      if (minutes < start || minutes >= end) return false;
    } else {
      if (minutes >= end && minutes < start) return false;
      if (minutes < end) scheduleDay = (scheduleDay + 6) % 7;
    }
  }
  return !schedule.daysOfWeek || schedule.daysOfWeek.has(scheduleDay);
}

function utcDayNumber(year: number, month: number, day: number): number {
  return Math.floor(utcEpoch(year, month, day) / 86_400_000);
}

function birthdayMatches(
  birthday: { daysBefore: number; daysAfter: number },
  birthDate: ParsedDate | undefined,
  context: NormalizedContext,
  offsetMinutes: number,
): boolean {
  if (!birthDate) return false;
  const local = localDate(context.evaluatedAtMs, offsetMinutes);
  const currentYear = local.getUTCFullYear();
  const currentDay = utcDayNumber(
    currentYear,
    local.getUTCMonth() + 1,
    local.getUTCDate(),
  );

  for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
    // A 29-Feb birthday is observed on 28-Feb in non-leap years.
    const anniversaryDay = Math.min(
      birthDate.day,
      daysInMonth(year, birthDate.month),
    );
    const difference =
      currentDay - utcDayNumber(year, birthDate.month, anniversaryDay);
    if (difference >= -birthday.daysBefore && difference <= birthday.daysAfter)
      return true;
  }
  return false;
}

function conditionsMatch(
  promotion: NormalizedPromotion,
  context: NormalizedContext,
): boolean {
  if (!promotion.authorized || !promotion.active) return false;
  const conditions = promotion.conditions;
  if (!conditions) return true;
  if (
    conditions.paymentMethodIds &&
    (context.paymentMethodIds.size === 0 ||
      [...context.paymentMethodIds].some(
        (method) => !conditions.paymentMethodIds?.has(method),
      ))
  )
    return false;
  if (
    conditions.couponCodes &&
    (!context.couponCode || !conditions.couponCodes.has(context.couponCode))
  )
    return false;
  if (
    conditions.customerLevels &&
    (!context.customer?.level ||
      !conditions.customerLevels.has(context.customer.level))
  )
    return false;
  if (conditions.schedule && !scheduleMatches(conditions.schedule, context))
    return false;
  if (conditions.birthday) {
    const offset =
      conditions.schedule?.timeZoneOffsetMinutes ??
      context.timeZoneOffsetMinutes;
    if (
      !birthdayMatches(
        conditions.birthday,
        context.customer?.birthDate,
        context,
        offset,
      )
    )
      return false;
  }
  return true;
}

function scopeMatches(
  item: NormalizedItem,
  scope: NormalizedScope | undefined,
): boolean {
  if (!scope) return true;
  if (
    scope.categories &&
    (!item.category || !scope.categories.has(item.category))
  )
    return false;
  if (scope.brands && (!item.brand || !scope.brands.has(item.brand)))
    return false;
  return true;
}

function sumRemaining(units: readonly UnitLedger[]): number {
  return units.reduce((sum, unit) => sum + unit.remainingCents, 0);
}

function percentOf(amountCents: number, percentBps: number): number {
  return Number((BigInt(amountCents) * BigInt(percentBps)) / BASIS_POINTS);
}

function allocateDiscount(
  units: readonly UnitLedger[],
  requestedCents: number,
): UnitDiscount[] {
  const eligible = units.filter((unit) => unit.remainingCents > 0);
  const availableCents = sumRemaining(eligible);
  const amountCents = Math.min(requestedCents, availableCents);
  if (amountCents <= 0 || availableCents <= 0) return [];

  const denominator = BigInt(availableCents);
  const shares = eligible.map((unit) => {
    const numerator = BigInt(amountCents) * BigInt(unit.remainingCents);
    return {
      unit,
      amountCents: Number(numerator / denominator),
      remainder: numerator % denominator,
    };
  });
  let allocated = shares.reduce((sum, share) => sum + share.amountCents, 0);
  const remainderOrder = [...shares].sort((left, right) => {
    if (left.remainder > right.remainder) return -1;
    if (left.remainder < right.remainder) return 1;
    return left.unit.serial - right.unit.serial;
  });
  for (let index = 0; allocated < amountCents; index += 1) {
    remainderOrder[index].amountCents += 1;
    allocated += 1;
  }

  const changes: UnitDiscount[] = [];
  for (const share of shares) {
    if (share.amountCents <= 0) continue;
    share.unit.remainingCents -= share.amountCents;
    changes.push({ unit: share.unit, amountCents: share.amountCents });
  }
  return changes;
}

function pairTargets(
  units: readonly UnitLedger[],
  groupBy: PairGrouping,
): UnitLedger[] {
  if (groupBy === 'cart') {
    const ordered = [...units].sort(
      (left, right) =>
        right.baseCents - left.baseCents || left.serial - right.serial,
    );
    return ordered.filter((_, index) => index % 2 === 1);
  }

  const byLine = new Map<number, UnitLedger[]>();
  for (const unit of units) {
    const group = byLine.get(unit.itemIndex);
    if (group) group.push(unit);
    else byLine.set(unit.itemIndex, [unit]);
  }
  const result: UnitLedger[] = [];
  for (const group of byLine.values()) {
    group.sort((left, right) => left.unitIndex - right.unitIndex);
    for (let index = 1; index < group.length; index += 2)
      result.push(group[index]);
  }
  return result;
}

function applyPromotion(
  promotion: NormalizedPromotion,
  eligibleUnits: readonly UnitLedger[],
): UnitDiscount[] {
  const availableCents = sumRemaining(eligibleUnits);
  if (availableCents <= 0) return [];
  if (promotion.kind === 'percentage') {
    return allocateDiscount(
      eligibleUnits,
      percentOf(availableCents, promotion.percentBps as number),
    );
  }
  if (promotion.kind === 'fixed_amount') {
    return allocateDiscount(eligibleUnits, promotion.amountCents as number);
  }
  const targets = pairTargets(eligibleUnits, promotion.groupBy);
  const targetCents = sumRemaining(targets);
  if (promotion.kind === 'two_for_one')
    return allocateDiscount(targets, targetCents);
  return allocateDiscount(
    targets,
    percentOf(targetCents, promotion.percentBps as number),
  );
}

function stablePromotionOrder(
  left: NormalizedPromotion,
  right: NormalizedPromotion,
): number {
  if (left.priority !== right.priority) return right.priority - left.priority;
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

function summarizeDiscount(
  promotion: NormalizedPromotion,
  changes: readonly UnitDiscount[],
  items: readonly NormalizedItem[],
): AppliedDiscount {
  const perItem = new Map<
    number,
    { amountCents: number; units: Set<number> }
  >();
  for (const change of changes) {
    const current = perItem.get(change.unit.itemIndex) ?? {
      amountCents: 0,
      units: new Set<number>(),
    };
    current.amountCents += change.amountCents;
    current.units.add(change.unit.unitIndex);
    perItem.set(change.unit.itemIndex, current);
  }
  const discountItems = [...perItem.entries()]
    .sort(([left], [right]) => left - right)
    .map(([itemIndex, value]) => ({
      itemId: items[itemIndex].id,
      amountCents: value.amountCents,
      affectedQuantity: value.units.size,
    }));
  return {
    promotionId: promotion.id,
    promotionName: promotion.name,
    kind: promotion.kind,
    priority: promotion.priority,
    exclusive: promotion.exclusive,
    amountCents: discountItems.reduce((sum, item) => sum + item.amountCents, 0),
    items: discountItems,
  };
}

/**
 * Validates and evaluates trusted promotion definitions without mutating input.
 * No product cost, margin, commission, or other internal commercial field is
 * accepted or returned by this boundary.
 */
export function evaluateCommercialRules(input: unknown): CommercialRuleResult {
  const parsed = parseInput(input);
  const units: UnitLedger[] = [];
  let serial = 0;
  for (let itemIndex = 0; itemIndex < parsed.items.length; itemIndex += 1) {
    const item = parsed.items[itemIndex];
    for (let unitIndex = 0; unitIndex < item.quantity; unitIndex += 1) {
      units.push({
        serial,
        itemIndex,
        unitIndex,
        baseCents: item.unitPriceCents,
        remainingCents: item.unitPriceCents,
      });
      serial += 1;
    }
  }

  const appliedDiscounts: AppliedDiscount[] = [];
  let exclusiveApplied = false;
  for (const promotion of [...parsed.promotions].sort(stablePromotionOrder)) {
    if (exclusiveApplied || !conditionsMatch(promotion, parsed.context))
      continue;
    if (promotion.exclusive && appliedDiscounts.length > 0) continue;
    const eligibleUnits = units.filter((unit) =>
      scopeMatches(parsed.items[unit.itemIndex], promotion.scope),
    );
    const changes = applyPromotion(promotion, eligibleUnits);
    if (changes.length === 0) continue;
    const summary = summarizeDiscount(promotion, changes, parsed.items);
    if (summary.amountCents === 0) continue;
    appliedDiscounts.push(summary);
    if (promotion.exclusive) exclusiveApplied = true;
  }

  const itemResults = parsed.items.map((item, itemIndex) => {
    const itemUnits = units.filter((unit) => unit.itemIndex === itemIndex);
    const totalCents = sumRemaining(itemUnits);
    const subtotalCents = item.unitPriceCents * item.quantity;
    return {
      itemId: item.id,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      subtotalCents,
      discountCents: subtotalCents - totalCents,
      totalCents,
    };
  });
  const totalCents = itemResults.reduce(
    (sum, item) => sum + item.totalCents,
    0,
  );
  const discountTotalCents = parsed.subtotalCents - totalCents;
  return {
    subtotalCents: parsed.subtotalCents,
    discountTotalCents,
    totalCents,
    appliedDiscounts,
    items: itemResults,
  };
}

export const applyCommercialRules = evaluateCommercialRules;
