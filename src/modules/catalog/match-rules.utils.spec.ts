import {
  MatchRule,
  ruleInScope,
  rulePowerMatches,
  TrimScope,
  unanimous,
  validateRule,
} from './match-rules.utils';

function scope(overrides: Partial<TrimScope> = {}): TrimScope {
  return {
    makeSlug: 'vag',
    modelSlug: 'golf',
    yearFrom: 2013,
    yearTo: 2019,
    ...overrides,
  };
}

function rule(overrides: Partial<MatchRule> = {}): MatchRule {
  return {
    enginePattern: '2\\.0\\s*TDI',
    engineFamilySlug: 'vag-ea288',
    ...overrides,
  };
}

describe('validateRule', () => {
  it('accepts a well-formed rule', () => {
    expect(validateRule(rule(), 0)).toEqual(rule());
  });

  it('rejects a rule with no enginePattern', () => {
    const bad = { engineFamilySlug: 'x' } as MatchRule;
    expect(() => validateRule(bad, 3)).toThrow('match-rules.json[3]: enginePattern is required');
  });

  it('rejects a rule with neither engineSlug nor engineFamilySlug', () => {
    const bad = rule({ engineFamilySlug: undefined });
    expect(() => validateRule(bad, 1)).toThrow(
      'match-rules.json[1]: set exactly one of engineSlug / engineFamilySlug',
    );
  });

  it('rejects a rule with both engineSlug and engineFamilySlug', () => {
    const bad = rule({ engineSlug: 'vag-cjxb' });
    expect(() => validateRule(bad, 2)).toThrow(
      'match-rules.json[2]: set exactly one of engineSlug / engineFamilySlug',
    );
  });

  it('rejects yearFrom after yearTo', () => {
    const bad = rule({ yearFrom: 2015, yearTo: 2010 });
    expect(() => validateRule(bad, 4)).toThrow(
      'match-rules.json[4]: yearFrom 2015 is after yearTo 2010',
    );
  });
});

describe('ruleInScope', () => {
  it('rejects a make/model outside the rule', () => {
    expect(ruleInScope(rule({ makes: ['bmw'] }), scope())).toBe(false);
    expect(ruleInScope(rule({ models: ['passat'] }), scope())).toBe(false);
  });

  it('accepts when makes/models are unset (no restriction)', () => {
    expect(ruleInScope(rule(), scope())).toBe(true);
  });

  it('accepts a make/model the rule explicitly lists', () => {
    expect(ruleInScope(rule({ makes: ['vag'], models: ['golf'] }), scope())).toBe(true);
  });

  describe('default (overlap) year matching', () => {
    it('accepts a generation that overlaps the rule window', () => {
      expect(ruleInScope(rule({ yearFrom: 2015, yearTo: 2018 }), scope())).toBe(true);
    });

    it('rejects a generation entirely before the rule window', () => {
      expect(
        ruleInScope(rule({ yearFrom: 2020 }), scope({ yearFrom: 2013, yearTo: 2019 })),
      ).toBe(false);
    });

    it('rejects a generation entirely after the rule window', () => {
      expect(
        ruleInScope(rule({ yearTo: 2010 }), scope({ yearFrom: 2013, yearTo: 2019 })),
      ).toBe(false);
    });
  });

  describe('yearsStrict containment matching', () => {
    // This is what separates VAG engine eras: 2.0 TDI PD ≤2010, EA189 2008-2015, EA288 2013+.
    it('accepts a generation fully inside the strict window', () => {
      const strictRule = rule({ yearsStrict: true, yearFrom: 2013, yearTo: 2019 });
      expect(ruleInScope(strictRule, scope({ yearFrom: 2013, yearTo: 2017 }))).toBe(true);
    });

    it('rejects a generation that starts before the strict window', () => {
      const strictRule = rule({ yearsStrict: true, yearFrom: 2013, yearTo: 2019 });
      expect(ruleInScope(strictRule, scope({ yearFrom: 2010, yearTo: 2017 }))).toBe(false);
    });

    it('rejects a generation that ends after the strict window', () => {
      const strictRule = rule({ yearsStrict: true, yearFrom: 2013, yearTo: 2019 });
      expect(ruleInScope(strictRule, scope({ yearFrom: 2013, yearTo: 2021 }))).toBe(false);
    });

    it('rejects a generation straddling two strict eras entirely (era-boundary case)', () => {
      // A generation spanning 2008-2015 belongs fully to neither the PD (≤2010) nor
      // EA288 (2013+) era, so it should fail both strict rules rather than match either.
      const pdEra = rule({ yearsStrict: true, yearTo: 2010 });
      const ea288Era = rule({ yearsStrict: true, yearFrom: 2013 });
      const straddling = scope({ yearFrom: 2008, yearTo: 2015 });
      expect(ruleInScope(pdEra, straddling)).toBe(false);
      expect(ruleInScope(ea288Era, straddling)).toBe(false);
    });

    it('treats an open-ended generation (yearTo null) as ongoing to the current year', () => {
      const strictRule = rule({ yearsStrict: true, yearFrom: 2013, yearTo: 2019 });
      expect(ruleInScope(strictRule, scope({ yearFrom: 2013, yearTo: null }))).toBe(false);
    });
  });
});

describe('rulePowerMatches', () => {
  it('matches any power when the rule does not pin one', () => {
    expect(rulePowerMatches(rule(), 116)).toBe(true);
    expect(rulePowerMatches(rule(), null)).toBe(true);
  });

  it('matches only a listed power', () => {
    const pinned = rule({ powerHp: [116, 150] });
    expect(rulePowerMatches(pinned, 116)).toBe(true);
    expect(rulePowerMatches(pinned, 141)).toBe(false);
  });

  it('rejects unknown power against a rule that requires one', () => {
    const pinned = rule({ powerHp: [116] });
    expect(rulePowerMatches(pinned, null)).toBe(false);
  });
});

describe('unanimous', () => {
  it('returns the shared value when every entry agrees', () => {
    expect(unanimous(['a', 'a', 'a'])).toBe('a');
  });

  it('returns null when entries disagree', () => {
    expect(unanimous(['a', 'b'])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(unanimous([])).toBeNull();
  });

  it('returns null when the first entry is null/undefined', () => {
    expect(unanimous([null, null])).toBeNull();
    expect(unanimous([undefined, undefined])).toBeNull();
  });
});
