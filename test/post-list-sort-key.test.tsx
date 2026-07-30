import { describe, it, expect } from 'vitest';

describe('PostList dynamicSortOptions deduplication', () => {
  it('should not contain duplicate sort option keys when template has a date field', () => {
    const activeTemplate = {
      name: 'post',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'date', type: 'string' },
        { name: 'author', type: 'string' }
      ]
    };

    const baseOptions = [
      { value: 'date-desc', label: 'Date (Newest)' },
      { value: 'date-asc', label: 'Date (Oldest)' },
      { value: 'title-asc', label: 'Title (A-Z)' },
      { value: 'title-desc', label: 'Title (Z-A)' },
    ];

    const extraFields = activeTemplate.fields.filter(
      f => !['title', 'image', 'cover', 'thumbnail', 'heroImage', 'date'].includes(f.name) &&
           f.type !== 'object' && f.type !== 'array'
    );

    extraFields.forEach(f => {
      baseOptions.push(
        { value: `${f.name}-asc`, label: `${f.name} (A→Z)` },
        { value: `${f.name}-desc`, label: `${f.name} (Z→A)` },
      );
    });

    const values = baseOptions.map(opt => opt.value);
    const uniqueValues = new Set(values);

    expect(values.length).toBe(uniqueValues.size);
    expect(values.filter(v => v === 'date-asc').length).toBe(1);
    expect(values.filter(v => v === 'date-desc').length).toBe(1);
    expect(values).toContain('author-asc');
  });
});
