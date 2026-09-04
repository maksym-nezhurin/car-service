/**
 * Mandatory defense-in-depth: strips any 11-digit PESEL-shaped sequence from
 * extracted field values, regardless of which field it appeared in or whether
 * the extraction step was supposed to have avoided it. Since this OCR approach
 * reads the entire document, the owner's PESEL is present in the raw text on
 * every call — this filter is the primary safeguard, not just a backstop.
 * See docs/V1_5_VEHICLE_AUTOADD_OCR_RESEARCH.md §5.
 */
const PESEL_PATTERN = /(?<!\d)\d{11}(?!\d)/g;

export type PeselFilterResult<T extends Record<string, string | undefined>> = {
  cleaned: T;
  triggered: boolean;
};

/** Strips PESEL-shaped sequences from every string value of the given object. */
export function stripPeselFromFields<
  T extends Record<string, string | undefined>,
>(fields: T): PeselFilterResult<T> {
  let triggered = false;
  const cleaned = { ...fields };

  for (const key of Object.keys(cleaned) as (keyof T)[]) {
    const value = cleaned[key];
    if (typeof value !== 'string') continue;

    if (PESEL_PATTERN.test(value)) {
      triggered = true;
      cleaned[key] = value.replace(PESEL_PATTERN, '') as T[keyof T];
    }
    PESEL_PATTERN.lastIndex = 0;
  }

  return { cleaned, triggered };
}
