const MAX_SEARCH_TERMS = 8;

export function normalizeCatalogSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseCatalogSearch(value: string) {
  const parts = value.includes("+") ? value.split("+") : [value];
  return [...new Set(parts.map(normalizeCatalogSearch).filter(Boolean))].slice(0, MAX_SEARCH_TERMS);
}

export function buildCatalogSearchFilter(value: string, column = "nome_busca") {
  const terms = parseCatalogSearch(value);
  if (terms.length === 0) return undefined;

  return `(${terms.map((term) => `${column}.ilike.*${term.replaceAll(" ", "*")}*`).join(",")})`;
}
