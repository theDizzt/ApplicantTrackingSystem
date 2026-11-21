// 연봉 산정의 최저 기준이 되는 최저시급.
// 최저시급은 매년 8월 초 고시되고 다음 해 1월 1일부터 적용된다. 공식 API가 없어 자동 수집하지 않고,
// 아래 표 + 관리자 설정(연도별 덮어쓰기)으로 관리한다. 적용 연도는 한국 시간 기준 오늘 날짜로 고른다.
import { getSetting } from "./openai";

/** 고시된 연도별 최저시급 (원/시간). 새 연도가 고시되면 여기 또는 관리자 페이지에서 추가한다. */
export const MIN_WAGE_HOURLY_BY_YEAR: Readonly<Record<number, number>> = {
  2024: 9_860,
  2025: 10_030,
  2026: 10_320,
};

/** 주 40시간 + 주휴 8시간 기준 월 소정 근로시간 */
export const MONTHLY_HOURS = 209;
export const MIN_WAGE_SETTING_KEY = "min_wage_overrides";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MIN_HOURLY = 1_000;
const MAX_HOURLY = 100_000;

export type MinWageSource = "override" | "table" | "fallback";

export interface MinWage {
  /** 실제로 쓴 값의 연도 */
  year: number;
  /** 오늘 날짜 기준으로 적용하려던 연도 (표에 없으면 year와 다르다) */
  requestedYear: number;
  hourly: number;
  /** 월 209시간 × 12개월 기준 연 최저연봉 (만원, 반올림) */
  annualWan: number;
  source: MinWageSource;
}

/** 한국 시간 기준 연도 (서버가 UTC여도 1월 1일 0시에 바로 바뀌도록) */
export function koreaYear(now: Date): number {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
}

export function annualMinWageWan(hourly: number): number {
  return Math.round((hourly * MONTHLY_HOURS * 12) / 10_000);
}

export function isValidMinWageEntry(year: unknown, hourly: unknown): year is number {
  return typeof year === "number" && Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR &&
    typeof hourly === "number" && Number.isInteger(hourly) && hourly >= MIN_HOURLY && hourly <= MAX_HOURLY;
}

/** 관리자 설정 JSON({"2027": 10500})을 읽는다. 잘못된 항목은 버린다. */
export function parseMinWageOverrides(raw: string | null | undefined): Record<number, number> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<number, number> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const year = Number(key);
    if (isValidMinWageEntry(year, value)) out[year] = value as number;
  }
  return out;
}

/**
 * 적용할 최저시급을 고른다. 관리자 설정 → 기본 표 순서로 그 연도 값을 찾고,
 * 없으면 그 연도 이전 중 가장 최근 값(fallback)을 쓴다.
 */
export function resolveMinWage(now: Date, overrides: Record<number, number> = {}): MinWage {
  const requestedYear = koreaYear(now);
  const make = (year: number, hourly: number, source: MinWageSource): MinWage =>
    ({ year, requestedYear, hourly, annualWan: annualMinWageWan(hourly), source });

  if (overrides[requestedYear] != null) return make(requestedYear, overrides[requestedYear], "override");
  if (MIN_WAGE_HOURLY_BY_YEAR[requestedYear] != null) return make(requestedYear, MIN_WAGE_HOURLY_BY_YEAR[requestedYear], "table");

  const merged: Record<number, number> = { ...MIN_WAGE_HOURLY_BY_YEAR, ...overrides };
  const years = Object.keys(merged).map(Number).sort((a, b) => a - b);
  const earlier = years.filter((year) => year < requestedYear);
  const year = earlier.length > 0 ? earlier[earlier.length - 1] : years[0];
  return make(year, merged[year], "fallback");
}

/** 오늘 적용할 최저시급. 설정을 읽지 못하면 기본 표만으로 고른다. */
export async function getMinWage(now = new Date()): Promise<MinWage> {
  let overrides: Record<number, number> = {};
  try {
    overrides = parseMinWageOverrides(await getSetting(MIN_WAGE_SETTING_KEY));
  } catch {
    overrides = {};
  }
  return resolveMinWage(now, overrides);
}

/** 화면에 그대로 보여 주는 산정 기준 문구 */
export function minWageBasis(wage: MinWage): string {
  return `${wage.year} 최저시급(${wage.hourly.toLocaleString("ko-KR")}원/시간) 및 업계 평균 기준 산정`;
}
