/**
 * Pure matching logic for data/kb/match-rules.json, split out of
 * scripts/link-catalog-engines.ts so it's covered by jest (scripts/ sits outside
 * jest's rootDir). See that script for how these compose into the full linker,
 * and docs/V1_7_VEHICLE_ENCYCLOPEDIA.md §4.3.1 for the rule format.
 */

export type MatchRule = {
  makes?: string[];
  models?: string[];
  yearFrom?: number;
  yearTo?: number;
  /** Require the generation to sit fully inside the window instead of merely overlapping it. */
  yearsStrict?: boolean;
  enginePattern: string;
  notEnginePattern?: string;
  powerHp?: number[];
  /** Exactly one of the two: a concrete unit, or a family when the code stays unknown. */
  engineSlug?: string;
  engineFamilySlug?: string;
  /** Gearbox key (MT/AT/DCT/…) → transmission unit slug, or a family slug when the unit is unknown. */
  transmissions?: Record<string, string>;
};

export type TrimScope = {
  makeSlug: string;
  modelSlug: string;
  yearFrom: number | null;
  yearTo: number | null;
};

/**
 * Shape checks applied to every rule at load time: exactly one of engineSlug /
 * engineFamilySlug, enginePattern required, yearFrom <= yearTo. Throws with the
 * rule's index so a bad entry in match-rules.json points straight at itself.
 */
export function validateRule(rule: MatchRule, index: number): MatchRule {
  if (!rule.enginePattern) {
    throw new Error(`match-rules.json[${index}]: enginePattern is required`);
  }
  if (!rule.engineSlug === !rule.engineFamilySlug) {
    throw new Error(
      `match-rules.json[${index}]: set exactly one of engineSlug / engineFamilySlug`,
    );
  }
  if (
    rule.yearFrom != null &&
    rule.yearTo != null &&
    rule.yearFrom > rule.yearTo
  ) {
    throw new Error(
      `match-rules.json[${index}]: yearFrom ${rule.yearFrom} is after yearTo ${rule.yearTo}`,
    );
  }
  return rule;
}

/**
 * Make / model / production-years gate — everything except the engine label itself.
 *
 * Default year check is an overlap. `yearsStrict` demands containment instead, which is
 * what separates engine eras: a 2003–2010 generation belongs to the PD era, while one
 * straddling the 2008 switch to common rail matches neither rule and stays unlinked.
 */
export function ruleInScope(rule: MatchRule, scope: TrimScope): boolean {
  if (rule.makes && !rule.makes.includes(scope.makeSlug)) return false;
  if (rule.models && !rule.models.includes(scope.modelSlug)) return false;

  if (rule.yearsStrict) {
    const genTo = scope.yearTo ?? new Date().getFullYear();
    if (
      rule.yearFrom != null &&
      (scope.yearFrom == null || scope.yearFrom < rule.yearFrom)
    ) {
      return false;
    }
    if (rule.yearTo != null && genTo > rule.yearTo) return false;
    return true;
  }

  if (
    rule.yearFrom != null &&
    scope.yearTo != null &&
    scope.yearTo < rule.yearFrom
  )
    return false;
  if (
    rule.yearTo != null &&
    scope.yearFrom != null &&
    scope.yearFrom > rule.yearTo
  )
    return false;
  return true;
}

export function rulePowerMatches(
  rule: MatchRule,
  powerHp: number | null,
): boolean {
  if (!rule.powerHp?.length) return true;
  return powerHp != null && rule.powerHp.includes(powerHp);
}

/** Single value shared by every entry, or null when they disagree / the list is empty. */
export function unanimous<T>(values: Array<T | null | undefined>): T | null {
  const first = values[0];
  if (first == null) return null;
  return values.every((v) => v === first) ? first : null;
}
