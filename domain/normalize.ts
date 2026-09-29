export function normalizeFrench(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/[’]/g, "'").toLocaleLowerCase("fr").trim().replace(/\s+/g, " ");
}

/** Canonical identity normalization preserves accents because côte and côté are different lexemes. */
export function normalizeFrenchIdentity(value: string): string {
  return value.normalize("NFC").replace(/[’]/g, "'").toLocaleLowerCase("fr").trim().replace(/\s+/g, " ");
}
