/**
 * Country code → Apple storefront ID, needed for the X-Apple-Store-Front
 * header on the search-hints endpoint.
 */
export const STOREFRONTS: Record<string, number> = {
  us: 143441,
  gb: 143444,
  fr: 143442,
  de: 143443,
  ca: 143455,
  au: 143460,
  it: 143450,
  es: 143454,
  nl: 143452,
  se: 143456,
  ch: 143459,
  jp: 143462,
  cn: 143465,
  kr: 143466,
  in: 143467,
  mx: 143468,
  ru: 143469,
  tw: 143470,
  hk: 143463,
  sg: 143464,
  br: 143503,
  tr: 143480,
  ae: 143481,
  sa: 143479,
  pl: 143478,
  pt: 143453,
  dk: 143458,
  fi: 143447,
  no: 143457,
  at: 143445,
  be: 143446,
  ie: 143449,
  nz: 143461,
  id: 143476,
  th: 143475,
  my: 143473,
  ph: 143474,
  vn: 143471,
  il: 143491,
  za: 143472,
  ar: 143505,
  cl: 143483,
  co: 143501,
  eg: 143516,
  ua: 143492,
};

export const COUNTRIES = Object.keys(STOREFRONTS);

export function storefrontHeader(country: string): Record<string, string> {
  const id = STOREFRONTS[country.toLowerCase()] ?? STOREFRONTS.us;
  return { "X-Apple-Store-Front": `${id}-1,29` };
}
