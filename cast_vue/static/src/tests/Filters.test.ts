import { describe, expect, test } from 'vitest';
import {
  alphabeticalFacets, archiveYears, emptyDateFilters, expandedYear, filterChips, monthFilter, rangeFilter,
  rangeYear, searchFacets, topFacets, yearFilter,
} from '@/helpers/filters';

const facet = (slug: string, count = 1, name = slug) => ({ slug, name, count });

describe('facet discovery', () => {
  test('returns eight facets ranked by frequency and then by name without reordering the catalog', () => {
    const catalog = [...'jighfedcba'].map((name) => facet(name, name === 'j' ? 20 : 1));
    expect(topFacets(catalog).map(({ slug }) => slug)).toEqual(['j', 'a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(catalog[0].slug).toBe('j');
    expect(catalog[1].slug).toBe('i');
  });

  test('search matches anywhere across case and accents and caps the results', () => {
    const catalog = alphabeticalFacets([
      ...Array.from({ length: 21 }, (_, index) => facet(`tag-${index}`, 3, `Déjà vu ${index}`)),
      facet('unrelated'),
    ]);
    expect(searchFacets(catalog, '  EJA V ')).toEqual(catalog.slice(0, 20));
    expect(searchFacets(catalog, 'déjà vu 20')).toEqual([facet('tag-20', 3, 'Déjà vu 20')]);
    expect(searchFacets(catalog, '  ')).toEqual([]);
    expect(searchFacets(catalog, 'missing')).toEqual([]);
  });

  test('ranks exact and prefix matches before more frequent substring matches', () => {
    const catalog = [
      facet('cpython', 99, 'CPython'), facet('europython', 21, 'EuroPython'),
      facet('python-tools', 4, 'Python Tools'), facet('python-ai', 4, 'Python AI'),
      facet('python', 1, 'Pýthon'), facet('python-news', 5, 'Python News'),
    ];
    expect(searchFacets(catalog, ' PYTHON ').map(({ slug }) => slug)).toEqual([
      'python', 'python-news', 'python-ai', 'python-tools', 'cpython', 'europython',
    ]);
  });
});

test.each([
  ['', []],
  ['-visible_date', []],
  ['visible_date', [{ label: 'Oldest first', clear: { order: '' } }]],
  ['title', [{ label: 'Order: title', clear: { order: '' } }]],
])('labels the applied order %s', (order, chips) => {
  expect(filterChips({
    order, page: 1, search: '', category_facets: '', tag_facets: '', ...emptyDateFilters,
  }, { category_facets: [], date_facets: [], tag_facets: [] })).toEqual(chips);
});

describe('archive', () => {
  test('aggregates years and occupied months newest first', () => {
    expect(archiveYears([
      facet('2023-11', 2), facet('2025-02', 3), facet('2025-12', 4),
      facet('2024-01', 1), facet('2025-01', 0), facet('2025-13', 5), facet('invalid'),
    ])).toEqual([
      { year: '2025', count: 7, months: [facet('2025-12', 4), facet('2025-02', 3)] },
      { year: '2024', count: 1, months: [facet('2024-01')] },
      { year: '2023', count: 2, months: [facet('2023-11', 2)] },
    ]);
  });

  test('year, month and custom range selections replace each other', () => {
    const year = yearFilter('2024');
    expect(year).toEqual({ date_facets: '', date_after: '2024-01-01', date_before: '2024-12-31' });
    expect(expandedYear(year)).toBe('2024');

    const month = { ...year, ...monthFilter('2024-02') };
    expect(month).toEqual({ date_facets: '2024-02', date_after: '', date_before: '' });
    expect(expandedYear(month)).toBe('2024');

    const custom = { ...month, ...rangeFilter('2025-01-01', '2025-06-30') };
    expect(custom).toEqual({ date_facets: '', date_after: '2025-01-01', date_before: '2025-06-30' });
    expect(expandedYear(custom)).toBe('');
    expect(rangeYear(rangeFilter('2025-01-01', ''))).toBe('');
    expect({ ...custom, ...yearFilter('2024') }).toEqual(year);
    expect({ ...month, ...emptyDateFilters }).toEqual(rangeFilter('', ''));
  });
});
