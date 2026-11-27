import type { Facet, FacetCounts, Form } from '../components/types';

export const TOP_FACETS = 8;
export const FACET_SEARCH_LIMIT = 20;

function compareNames(a: Facet, b: Facet): number {
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}

export function alphabeticalFacets(facets: Facet[]): Facet[] {
  return [...facets].sort(compareNames);
}

export function topFacets(facets: Facet[]): Facet[] {
  return [...facets].sort((a, b) => b.count - a.count || compareNames(a, b)).slice(0, TOP_FACETS);
}

function searchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function searchFacets(facets: Facet[], query: string): Facet[] {
  const needle = searchText(query.trim());
  if (!needle) return [];
  const matches = facets.flatMap((facet) => {
    const name = searchText(facet.name);
    if (!name.includes(needle)) return [];
    const rank = name === needle ? 0 : name.startsWith(needle) ? 1 : 2;
    return [{ facet, rank }];
  });
  return matches
    .sort((a, b) => a.rank - b.rank || b.facet.count - a.facet.count || compareNames(a.facet, b.facet))
    .slice(0, FACET_SEARCH_LIMIT)
    .map(({ facet }) => facet);
}

export interface ArchiveYear {
  year: string;
  count: number;
  months: Facet[];
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function archiveYears(facets: Facet[]): ArchiveYear[] {
  const years = new Map<string, ArchiveYear>();
  const months = [...facets].sort((a, b) => b.slug.localeCompare(a.slug));
  for (const facet of months) {
    const year = MONTH.exec(facet.slug)?.[1];
    if (!year || facet.count <= 0) continue;
    const group = years.get(year) ?? { year, count: 0, months: [] };
    group.count += facet.count;
    group.months.push(facet);
    years.set(year, group);
  }
  return [...years.values()];
}

export type DateFilters = Pick<Form, 'date_facets' | 'date_after' | 'date_before'>;

export const emptyDateFilters: DateFilters = { date_facets: '', date_after: '', date_before: '' };

export function yearFilter(year: string): DateFilters {
  return { date_facets: '', date_after: `${year}-01-01`, date_before: `${year}-12-31` };
}

export function monthFilter(month: string): DateFilters {
  return { ...emptyDateFilters, date_facets: month };
}

export function rangeFilter(from: string, until: string): DateFilters {
  return { date_facets: '', date_after: from, date_before: until };
}

export function rangeYear({ date_after, date_before }: DateFilters): string {
  const year = /^(\d{4})-01-01$/.exec(date_after)?.[1];
  return year && date_before === `${year}-12-31` ? year : '';
}

export function expandedYear(filters: DateFilters): string {
  return MONTH.exec(filters.date_facets)?.[1] ?? rangeYear(filters);
}

export function monthLabel(value: string, locale?: string, includeYear = true): string {
  if (!MONTH.test(value)) return value;
  const date = new Date(`${value}-01T00:00:00Z`);
  const options: Intl.DateTimeFormatOptions = { month: 'short', timeZone: 'UTC' };
  if (includeYear) options.year = 'numeric';
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return value;
  }
}

export function facetName(facets: Facet[], slug: string): string {
  return facets.find((facet) => facet.slug === slug)?.name ?? slug;
}

export function orderLabel(order: string): string {
  return order === 'visible_date' ? 'Oldest first' : `Order: ${order}`;
}

export function filterChips(form: Form, facets: FacetCounts, locale?: string) {
  const chips: { label: string; clear: Partial<Form> }[] = [];
  if (form.search) chips.push({ label: `Search: ${form.search}`, clear: { search: '' } });
  if (form.category_facets) {
    chips.push({
      label: `Category: ${facetName(facets.category_facets ?? [], form.category_facets)}`,
      clear: { category_facets: '' },
    });
  }
  if (form.tag_facets) {
    chips.push({
      label: `Tag: ${facetName(facets.tag_facets ?? [], form.tag_facets)}`,
      clear: { tag_facets: '' },
    });
  }
  if (form.date_facets) {
    chips.push({ label: monthLabel(form.date_facets, locale), clear: { date_facets: '' } });
  }
  if (form.date_after || form.date_before) {
    const label = rangeYear(form) || (form.date_after && form.date_before
      ? `${form.date_after} to ${form.date_before}`
      : form.date_after ? `From ${form.date_after}` : `Until ${form.date_before}`);
    chips.push({ label, clear: { date_after: '', date_before: '' } });
  }
  if (form.order && form.order !== '-visible_date') {
    chips.push({ label: orderLabel(form.order), clear: { order: '' } });
  }
  return chips;
}
