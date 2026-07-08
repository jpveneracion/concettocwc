'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useWizard } from '@/components/QuoteWizard';
import type { QuoteItem, MeasureUnit } from '@/types';
import { calcFinalSize, calcAreaSqft } from '@/lib/calc';

interface MeasurementData {
  items: QuoteItem[];
}

interface MeasurementsStepProps {
  existingData?: MeasurementData;
}

interface ProductLookupResult {
  id: string;
  code: string;
  collection: string;
  description: string;
  retail_price: number;
  supplier_cost: number;
}

interface LookupStatus {
  [key: string]: 'loading' | 'found' | 'notfound' | '';
}

interface AutocompleteSuggestion {
  code: string;
  collection: string;
  description: string;
  unit: string;
}

interface AutocompleteState {
  [key: string]: {
    suggestions: AutocompleteSuggestion[];
    loading: boolean;
    show: boolean;
  };
}

type ItemRow = Omit<QuoteItem, 'id' | 'quote_id'> & { _key: string };

function newRow(order: number): ItemRow {
  return {
    _key: crypto.randomUUID(),
    sort_order: order,
    location: '',
    product_id: null,
    product_code: '',
    product_collection: '',
    product_description: '',
    unit: 'in' as MeasureUnit,
    is_fixed: true,
    measured_width: 0,
    measured_drop: 0,
    final_width: 0,
    final_drop: 0,
    area_sqft: 0,
    retail_price_sqft: 0,
    supplier_cost_sqft: 0,
    retail_amount: 0,
    supplier_amount: 0,
  };
}

function recomputeRow(row: ItemRow): ItemRow {
  const { final_width, final_drop } = calcFinalSize(
    row.measured_width,
    row.measured_drop,
    row.is_fixed,
    row.unit as MeasureUnit
  );
  const area_sqft = calcAreaSqft(final_width, final_drop, row.unit as MeasureUnit);

  return {
    ...row,
    final_width,
    final_drop,
    area_sqft,
    // Calculate amounts if prices are available
    retail_amount: area_sqft * row.retail_price_sqft,
    supplier_amount: area_sqft * row.supplier_cost_sqft,
  };
}

// Debounce function for autocomplete
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function MeasurementsStep({ existingData }: MeasurementsStepProps) {
  const { setStepData, getStepData } = useWizard();

  const [rows, setRows] = useState<ItemRow[]>(
    existingData?.items?.length
      ? existingData.items.map((item, index) => ({
          ...item,
          _key: crypto.randomUUID(),
          sort_order: index,
        }))
      : [newRow(0)]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>({});
  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState>({});
  const autocompleteRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const data: MeasurementData = {
      items: rows.map(({ _key, ...rest }) => ({
        ...rest,
        id: '',
        quote_id: '',
      })),
    };
    setStepData('measurements', data);
  }, [rows, setStepData]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    // Check for at least one window with measurements AND product
    const validWindows = rows.filter((r) => r.area_sqft > 0 && r.product_id);
    if (validWindows.length === 0) {
      newErrors.items = 'Add at least one window with measurements and a valid product code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Expose validation function to parent wizard
  useEffect(() => {
    (window as any).__measurementsStepValidation = validate;
    return () => {
      delete (window as any).__measurementsStepValidation;
    };
  }, [rows]);

  // Handle click outside for autocomplete dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(autocompleteRefs.current).forEach((key) => {
        const ref = autocompleteRefs.current[key];
        if (ref && !ref.contains(event.target as Node)) {
          setAutocompleteState((prev) => ({
            ...prev,
            [key]: { ...prev[key], show: false }
          }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const updateRow = (key: string, patch: Partial<ItemRow>) => {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? recomputeRow({ ...r, ...patch }) : r))
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, newRow(prev.length)]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => {
      const filtered = prev.filter((r) => r._key !== key);
      // Renumber remaining rows
      return filtered.map((r, index) => ({ ...r, sort_order: index }));
    });
  };

  const lookupCode = async (key: string, code: string) => {
    if (!code.trim()) return;

    setLookupStatus((prev) => ({ ...prev, [key]: 'loading' }));

    try {
      const res = await fetch(`/api/products/lookup?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const product = await res.json();

        // Find the row index
        const rowIndex = rows.findIndex((r) => r._key === key);
        if (rowIndex !== -1) {
          updateRow(key, {
            product_id: product.id,
            product_code: product.code,
            product_collection: product.collection,
            product_description: product.description,
            retail_price_sqft: product.retail_price,
            supplier_cost_sqft: product.supplier_cost,
            retail_amount: rows[rowIndex].area_sqft * product.retail_price,
            supplier_amount: rows[rowIndex].area_sqft * product.supplier_cost,
          });
        }

        setLookupStatus((prev) => ({ ...prev, [key]: 'found' }));
      } else {
        setLookupStatus((prev) => ({ ...prev, [key]: 'notfound' }));
      }
    } catch (error) {
      console.error('Product lookup failed:', error);
      setLookupStatus((prev) => ({ ...prev, [key]: 'notfound' }));
    }
  };

  const fetchAutocompleteSuggestions = async (key: string, query: string) => {
    if (query.length < 2) {
      setAutocompleteState((prev) => ({ ...prev, [key]: { suggestions: [], loading: false, show: false } }));
      return;
    }

    setAutocompleteState((prev) => ({ ...prev, [key]: { suggestions: [], loading: true, show: true } }));

    try {
      const res = await fetch(`/api/products/autocomplete?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const suggestions = await res.json();
        setAutocompleteState((prev) => ({
          ...prev,
          [key]: { suggestions, loading: false, show: true }
        }));
      } else {
        setAutocompleteState((prev) => ({
          ...prev,
          [key]: { suggestions: [], loading: false, show: false }
        }));
      }
    } catch (error) {
      console.error('Autocomplete failed:', error);
      setAutocompleteState((prev) => ({
        ...prev,
        [key]: { suggestions: [], loading: false, show: false }
      }));
    }
  };

  const debouncedFetchAutocomplete = useMemo(
    () => debounce(fetchAutocompleteSuggestions, 300),
    []
  );

  const handleProductCodeChange = (key: string, value: string) => {
    const upperValue = value.toUpperCase();
    updateRow(key, { product_code: upperValue });
    setLookupStatus((prev) => ({ ...prev, [key]: '' }));

    if (upperValue.length >= 2) {
      debouncedFetchAutocomplete(key, upperValue);
    } else {
      setAutocompleteState((prev) => ({ ...prev, [key]: { suggestions: [], loading: false, show: false } }));
    }
  };

  const selectAutocompleteSuggestion = (key: string, suggestion: AutocompleteSuggestion) => {
    updateRow(key, { product_code: suggestion.code });
    setAutocompleteState((prev) => ({ ...prev, [key]: { suggestions: [], loading: false, show: false } }));
    setLookupStatus((prev) => ({ ...prev, [key]: '' }));
    // Trigger the lookup immediately
    lookupCode(key, suggestion.code);
  };

  const handleProductCodeBlur = (key: string) => {
    // Delay hiding autocomplete to allow clicking on suggestions
    setTimeout(() => {
      setAutocompleteState((prev) => ({
        ...prev,
        [key]: { ...prev[key], show: false }
      }));
    }, 200);
  };

  const handleProductCodeFocus = (key: string, currentCode: string) => {
    if (currentCode.length >= 2) {
      debouncedFetchAutocomplete(key, currentCode);
    }
  };

  const totalArea = rows.reduce((sum, row) => sum + row.area_sqft, 0);

  // AutocompleteDropdown component
  const AutocompleteDropdown = ({ rowKey, suggestions, onSelect }: {
    rowKey: string;
    suggestions: AutocompleteSuggestion[];
    onSelect: (suggestion: AutocompleteSuggestion) => void;
  }) => {
    if (suggestions.length === 0) return null;

    return (
      <div
        ref={(el) => { autocompleteRefs.current[rowKey] = el; }}
        className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg"
      >
        {suggestions.map((suggestion, index) => (
          <div
            key={`${suggestion.code}-${index}`}
            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
            onClick={() => onSelect(suggestion)}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm text-gray-800">{suggestion.code}</span>
              <span className="text-xs text-gray-500">{suggestion.unit}</span>
            </div>
            <div className="text-xs text-gray-600 truncate">{suggestion.collection}</div>
            <div className="text-xs text-gray-500 truncate">{suggestion.description}</div>
          </div>
        ))}
      </div>
    );
  };
  const panelCount = rows.filter((r) => r.area_sqft > 0).length;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Window Measurements</h3>

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={row._key} className="border border-gray-200 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Window #{idx + 1}</span>
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(row._key)}
                  className="text-xs px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  🗑️ Remove
                </button>
              )}
            </div>

            {/* Mobile: Single column, Desktop: Side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Measurements */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Location</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={row.location}
                    onChange={(e) => updateRow(row._key, { location: e.target.value })}
                    placeholder="e.g. Living Room"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Unit</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={row.unit}
                      onChange={(e) => updateRow(row._key, { unit: e.target.value as MeasureUnit })}
                    >
                      <option value="in">Inches</option>
                      <option value="cm">Centimeters</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Type</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={row.is_fixed ? 'yes' : 'no'}
                      onChange={(e) => updateRow(row._key, { is_fixed: e.target.value === 'yes' })}
                    >
                      <option value="yes">Fixed (as-is)</option>
                      <option value="no">Non-fixed (+{row.unit === 'cm' ? '15cm' : '6in'} overlap)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Width ({row.unit})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={row.measured_width || ''}
                      onChange={(e) => updateRow(row._key, { measured_width: parseFloat(e.target.value) || 0 })}
                      placeholder="0.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Drop ({row.unit})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={row.measured_drop || ''}
                      onChange={(e) => updateRow(row._key, { measured_drop: parseFloat(e.target.value) || 0 })}
                      placeholder="0.0"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Product Selection */}
              <div className="space-y-3">
                <div className="relative">
                  <label className="block text-sm text-gray-600 mb-1">Product Code</label>
                  <input
                    className={`w-full border rounded-lg px-3 py-2 text-sm uppercase ${
                      lookupStatus[row._key] === 'loading'
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300'
                    }`}
                    value={row.product_code}
                    onChange={(e) => handleProductCodeChange(row._key, e.target.value)}
                    onBlur={() => handleProductCodeBlur(row._key)}
                    onFocus={() => handleProductCodeFocus(row._key, row.product_code)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setAutocompleteState((prev) => ({
                          ...prev,
                          [row._key]: { ...prev[row._key], show: false }
                        }));
                      }
                    }}
                    placeholder="e.g. P5012"
                  />
                  {lookupStatus[row._key] === 'loading' && (
                    <div className="absolute right-3 top-8">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {lookupStatus[row._key] === 'found' && (
                    <p className="text-xs text-green-600 mt-1">✓ {row.product_collection} - {row.product_description}</p>
                  )}
                  {lookupStatus[row._key] === 'notfound' && (
                    <p className="text-xs text-red-500 mt-1">Product code not found. Try typing partial code for suggestions.</p>
                  )}

                  {/* Autocomplete Dropdown */}
                  {autocompleteState[row._key]?.show && !autocompleteState[row._key]?.loading && (
                    <AutocompleteDropdown
                      rowKey={row._key}
                      suggestions={autocompleteState[row._key].suggestions}
                      onSelect={(suggestion) => selectAutocompleteSuggestion(row._key, suggestion)}
                    />
                  )}
                  {autocompleteState[row._key]?.loading && (
                    <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg mt-1 p-3 shadow-lg">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                        <span className="text-xs text-gray-600">Searching products...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Product Details Display */}
                {row.product_id && (
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200">
                    <div className="space-y-3">
                      {/* Collection and Unit - Prominent Display */}
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Collection</p>
                          <p className="text-lg font-semibold text-gray-800">{row.product_collection || 'Unknown Collection'}</p>
                        </div>
                        <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                          {row.product_code}
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Description</p>
                        <p className="text-sm text-gray-700">{row.product_description || 'No description available'}</p>
                      </div>

                      {/* Pricing Information */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                        <div className="bg-white rounded p-2">
                          <p className="text-xs text-gray-500">Retail Price</p>
                          <p className="text-sm font-semibold text-green-700">${row.retail_price_sqft.toFixed(2)}/sq.ft</p>
                        </div>
                        <div className="bg-white rounded p-2">
                          <p className="text-xs text-gray-500">Supplier Cost</p>
                          <p className="text-sm font-semibold text-blue-700">${row.supplier_cost_sqft.toFixed(2)}/sq.ft</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Results display */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500">Final Width ({row.unit})</p>
                  <p className="text-sm font-medium text-blue-700">{row.final_width.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Final Drop ({row.unit})</p>
                  <p className="text-sm font-medium text-blue-700">{row.final_drop.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Area (sq.ft.)</p>
                  <p className="text-sm font-medium">{row.area_sqft.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {errors.items && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{errors.items}</p>
          </div>
        )}

        <button
          onClick={addRow}
          className="w-full text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
        >
          ➕ Add Another Window
        </button>
      </div>

      {/* Summary */}
      {panelCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600">Total Windows</p>
              <p className="text-lg font-semibold text-blue-700">{panelCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Area</p>
              <p className="text-lg font-semibold text-blue-700">{totalArea.toFixed(2)} sq.ft.</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">Add at least one window with measurements to continue</p>
    </div>
  );
}