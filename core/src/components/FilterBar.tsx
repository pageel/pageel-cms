
import React, { useMemo } from 'react';
import { CollectionTemplate, TemplateField } from '../features/collections';
import { useI18n } from '../i18n/I18nContext';

interface PostData {
  frontmatter: Record<string, any>;
  [key: string]: any;
}

export interface FilterValue {
  type: TemplateField['type'];
  value: any;
}

interface FilterBarProps {
  template: CollectionTemplate | null;
  posts: PostData[];
  activeFilters: Record<string, FilterValue>;
  onFilterChange: (field: string, filter: FilterValue | null) => void;
  onClearFilters: () => void;
}

// Extract unique values for a field from all posts
const getUniqueValues = (posts: PostData[], field: string): string[] => {
  const values = new Set<string>();
  posts.forEach(post => {
    const val = post.frontmatter[field];
    if (val !== undefined && val !== null && val !== '') {
      if (Array.isArray(val)) {
        val.forEach(v => values.add(String(v)));
      } else if (typeof val !== 'object') {
        values.add(String(val));
      }
    }
  });
  return Array.from(values).sort();
};

// Get min/max for numeric fields
const getNumberRange = (posts: PostData[], field: string): { min: number; max: number } => {
  let min = Infinity;
  let max = -Infinity;
  posts.forEach(post => {
    const val = Number(post.frontmatter[field]);
    if (!isNaN(val)) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  });
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 100 : max };
};

// Get min/max for date fields
const getDateRange = (posts: PostData[], field: string): { min: string; max: string } => {
  let min = '';
  let max = '';
  posts.forEach(post => {
    const val = post.frontmatter[field];
    if (val) {
      const d = val instanceof Date ? val : new Date(val);
      if (!isNaN(d.getTime())) {
        const iso = d.toISOString().split('T')[0];
        if (!min || iso < min) min = iso;
        if (!max || iso > max) max = iso;
      }
    }
  });
  return { min, max };
};

// Type pill colors (shared with TemplateGenerator)
const TYPE_COLORS: Record<string, string> = {
  'string': 'border-blue-200 bg-blue-50 text-blue-700',
  'date': 'border-orange-200 bg-orange-50 text-orange-700',
  'array': 'border-purple-200 bg-purple-50 text-purple-700',
  'boolean': 'border-green-200 bg-green-50 text-green-700',
  'number': 'border-teal-200 bg-teal-50 text-teal-700',
};

/**
 * FilterBar: Renders type-aware filter controls based on collection template
 */
const FilterBar: React.FC<FilterBarProps> = ({
  template,
  posts,
  activeFilters,
  onFilterChange,
  onClearFilters,
}) => {
  const { t } = useI18n();

  // Only show filterable fields (exclude object type and commonly fixed fields)
  const filterableFields = useMemo(() => {
    if (!template?.fields) return [];
    return template.fields.filter(
      f => f.type !== 'object' && !['title', 'image', 'cover', 'thumbnail', 'heroImage'].includes(f.name)
    );
  }, [template]);

  const activeFilterCount = Object.keys(activeFilters).length;

  if (filterableFields.length === 0) return null;

  const renderFilterControl = (field: TemplateField) => {
    const currentFilter = activeFilters[field.name];
    const colorClass = TYPE_COLORS[field.type] || 'border-gray-200 bg-gray-50 text-gray-700';

    switch (field.type) {
      case 'string': {
        const uniqueValues = getUniqueValues(posts, field.name);
        if (uniqueValues.length === 0) return null;
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-notion-muted uppercase tracking-wider">{field.name}</label>
            <select
              value={currentFilter?.value || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  onFilterChange(field.name, null);
                } else {
                  onFilterChange(field.name, { type: 'string', value: val });
                }
              }}
              className={`text-xs px-2 py-1.5 rounded-sm border focus:outline-none focus:ring-1 focus:ring-notion-blue cursor-pointer ${
                currentFilter ? colorClass : 'bg-white border-notion-border text-notion-text'
              }`}
            >
              <option value="">All</option>
              {uniqueValues.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        );
      }

      case 'date': {
        const range = getDateRange(posts, field.name);
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-notion-muted uppercase tracking-wider">{field.name}</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={currentFilter?.value?.from || ''}
                min={range.min}
                max={range.max}
                onChange={(e) => {
                  const from = e.target.value;
                  const to = currentFilter?.value?.to || '';
                  if (!from && !to) {
                    onFilterChange(field.name, null);
                  } else {
                    onFilterChange(field.name, { type: 'date', value: { from, to } });
                  }
                }}
                className={`text-xs px-1.5 py-1 rounded-sm border focus:outline-none focus:ring-1 focus:ring-notion-blue w-[120px] ${
                  currentFilter ? colorClass : 'bg-white border-notion-border'
                }`}
              />
              <span className="text-[10px] text-notion-muted">→</span>
              <input
                type="date"
                value={currentFilter?.value?.to || ''}
                min={range.min}
                max={range.max}
                onChange={(e) => {
                  const to = e.target.value;
                  const from = currentFilter?.value?.from || '';
                  if (!from && !to) {
                    onFilterChange(field.name, null);
                  } else {
                    onFilterChange(field.name, { type: 'date', value: { from, to } });
                  }
                }}
                className={`text-xs px-1.5 py-1 rounded-sm border focus:outline-none focus:ring-1 focus:ring-notion-blue w-[120px] ${
                  currentFilter ? colorClass : 'bg-white border-notion-border'
                }`}
              />
            </div>
          </div>
        );
      }

      case 'array': {
        const allTags = getUniqueValues(posts, field.name);
        if (allTags.length === 0) return null;
        const selectedTags: string[] = currentFilter?.value || [];
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-notion-muted uppercase tracking-wider">{field.name}</label>
            <div className="flex flex-wrap gap-1 max-w-xs">
              {allTags.slice(0, 12).map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      let newTags: string[];
                      if (isSelected) {
                        newTags = selectedTags.filter(t => t !== tag);
                      } else {
                        newTags = [...selectedTags, tag];
                      }
                      if (newTags.length === 0) {
                        onFilterChange(field.name, null);
                      } else {
                        onFilterChange(field.name, { type: 'array', value: newTags });
                      }
                    }}
                    className={`
                      px-1.5 py-0.5 rounded-sm text-[10px] font-medium transition-all border
                      ${isSelected
                        ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-sm'
                        : 'bg-white text-notion-muted border-notion-border hover:bg-gray-50 hover:text-notion-text'
                      }
                    `}
                  >
                    {tag}
                  </button>
                );
              })}
              {allTags.length > 12 && (
                <span className="text-[10px] text-notion-muted self-center">+{allTags.length - 12}</span>
              )}
            </div>
          </div>
        );
      }

      case 'boolean': {
        const currentVal = currentFilter?.value; // true | false | undefined (all)
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-notion-muted uppercase tracking-wider">{field.name}</label>
            <div className="flex bg-gray-100 p-0.5 rounded-sm border border-notion-border">
              {[
                { label: 'All', val: undefined },
                { label: 'True', val: true },
                { label: 'False', val: false },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  onClick={() => {
                    if (opt.val === undefined) {
                      onFilterChange(field.name, null);
                    } else {
                      onFilterChange(field.name, { type: 'boolean', value: opt.val });
                    }
                  }}
                  className={`
                    px-2 py-0.5 rounded-sm text-[10px] font-medium transition-all
                    ${currentVal === opt.val || (opt.val === undefined && currentVal === undefined)
                      ? 'bg-white shadow-sm text-notion-text'
                      : 'text-notion-muted hover:text-notion-text'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'number': {
        const range = getNumberRange(posts, field.name);
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-notion-muted uppercase tracking-wider">{field.name}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder={String(range.min)}
                value={currentFilter?.value?.min ?? ''}
                onChange={(e) => {
                  const min = e.target.value === '' ? undefined : Number(e.target.value);
                  const max = currentFilter?.value?.max;
                  if (min === undefined && max === undefined) {
                    onFilterChange(field.name, null);
                  } else {
                    onFilterChange(field.name, { type: 'number', value: { min, max } });
                  }
                }}
                className={`text-xs px-1.5 py-1 rounded-sm border focus:outline-none focus:ring-1 focus:ring-notion-blue w-16 ${
                  currentFilter ? colorClass : 'bg-white border-notion-border'
                }`}
              />
              <span className="text-[10px] text-notion-muted">→</span>
              <input
                type="number"
                placeholder={String(range.max)}
                value={currentFilter?.value?.max ?? ''}
                onChange={(e) => {
                  const max = e.target.value === '' ? undefined : Number(e.target.value);
                  const min = currentFilter?.value?.min;
                  if (min === undefined && max === undefined) {
                    onFilterChange(field.name, null);
                  } else {
                    onFilterChange(field.name, { type: 'number', value: { min, max } });
                  }
                }}
                className={`text-xs px-1.5 py-1 rounded-sm border focus:outline-none focus:ring-1 focus:ring-notion-blue w-16 ${
                  currentFilter ? colorClass : 'bg-white border-notion-border'
                }`}
              />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-notion-border rounded-sm p-3 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-notion-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-xs font-semibold text-notion-text">Filters</span>
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-notion-blue text-white">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onClearFilters}
            className="text-[10px] text-notion-muted hover:text-red-600 font-medium transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        {filterableFields.map(field => renderFilterControl(field))}
      </div>
    </div>
  );
};

// Helper to check if a post matches a filter value
export const matchesFilter = (
  fieldValue: any,
  filter: FilterValue
): boolean => {
  switch (filter.type) {
    case 'string':
      return String(fieldValue) === filter.value;

    case 'date': {
      if (!fieldValue) return false;
      const d = fieldValue instanceof Date ? fieldValue : new Date(fieldValue);
      if (isNaN(d.getTime())) return false;
      const iso = d.toISOString().split('T')[0];
      const { from, to } = filter.value;
      if (from && iso < from) return false;
      if (to && iso > to) return false;
      return true;
    }

    case 'array': {
      if (!Array.isArray(fieldValue)) return false;
      const selectedTags: string[] = filter.value;
      return selectedTags.some(tag => fieldValue.map(String).includes(tag));
    }

    case 'boolean':
      return Boolean(fieldValue) === filter.value;

    case 'number': {
      const num = Number(fieldValue);
      if (isNaN(num)) return false;
      const { min, max } = filter.value;
      if (min !== undefined && num < min) return false;
      if (max !== undefined && num > max) return false;
      return true;
    }

    default:
      return true;
  }
};

export default FilterBar;
