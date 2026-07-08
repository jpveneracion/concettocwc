'use client';
import { useEffect, useState } from 'react';
import { useWizard } from '@/components/QuoteWizard';
import type { QuoteItem } from '@/types';
import { calcAmounts } from '@/lib/calc';

interface ProductData {
  items: QuoteItem[];
  installation_fee: number;
  delivery_fee: number;
}

interface ProductsStepProps {
  existingData?: ProductData;
}

interface LookupStatus {
  [key: string]: 'loading' | 'found' | 'notfound' | '';
}

export default function ProductsStep({ existingData }: ProductsStepProps) {
  const { getStepData, setStepData } = useWizard();

  const measurementsData = getStepData('measurements') as { items: QuoteItem[] } | undefined;
  const [items, setItems] = useState<QuoteItem[]>(
    measurementsData?.items?.map((item, index) => ({
      ...item,
      id: '',
      quote_id: '',
      sort_order: index,
    })) || []
  );

  const [installation, setInstallation] = useState(existingData?.installation_fee ?? 0);
  const [delivery, setDelivery] = useState(existingData?.delivery_fee ?? 0);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update items when measurements data changes
  useEffect(() => {
    if (measurementsData?.items) {
      setItems(
        measurementsData.items.map((item, index) => ({
          ...item,
          id: '',
          quote_id: '',
          sort_order: index,
        }))
      );
    }
  }, [measurementsData]);

  useEffect(() => {
    const data: ProductData = {
      items: items.map((item) => ({
        ...item,
        id: '',
        quote_id: '',
      })),
      installation_fee: installation,
      delivery_fee: delivery,
    };
    // setStepData('products', data); // DISABLED: ProductsStep removed from wizard
  }, [items, installation, delivery, setStepData]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    const itemsWithProducts = items.filter((item) => item.area_sqft > 0 && item.product_id);
    if (itemsWithProducts.length === 0 && items.some((item) => item.area_sqft > 0)) {
      newErrors.products = 'Add at least one product to continue';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Expose validation function to parent wizard
  useEffect(() => {
    (window as any).__productsStepValidation = validate;
    return () => {
      delete (window as any).__productsStepValidation;
    };
  }, [items, installation, delivery]);

  const updateItem = (index: number, updates: Partial<QuoteItem>) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };

      // Recpute amounts if prices changed
      if (updates.retail_price_sqft !== undefined || updates.supplier_cost_sqft !== undefined) {
        const { retail_amount, supplier_amount } = calcAmounts(
          updated[index].area_sqft,
          updated[index].retail_price_sqft,
          updated[index].supplier_cost_sqft
        );
        updated[index] = { ...updated[index], retail_amount, supplier_amount };
      }

      return updated;
    });
  };

  const lookupCode = async (index: number, code: string) => {
    if (!code.trim()) return;

    const itemKey = index.toString();
    setLookupStatus((prev) => ({ ...prev, [itemKey]: 'loading' }));

    try {
      const res = await fetch(`/api/products/lookup?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const product = await res.json();

        const { retail_amount, supplier_amount } = calcAmounts(
          items[index].area_sqft,
          product.retail_price,
          product.supplier_cost
        );

        updateItem(index, {
          product_id: product.id,
          product_code: product.code,
          product_collection: product.collection,
          product_description: product.description,
          retail_price_sqft: product.retail_price,
          supplier_cost_sqft: product.supplier_cost,
          retail_amount,
          supplier_amount,
        });

        setLookupStatus((prev) => ({ ...prev, [itemKey]: 'found' }));
      } else {
        setLookupStatus((prev) => ({ ...prev, [itemKey]: 'notfound' }));
      }
    } catch (error) {
      console.error('Product lookup failed:', error);
      setLookupStatus((prev) => ({ ...prev, [itemKey]: 'notfound' }));
    }
  };

  // Calculate totals
  const validItems = items.filter((item) => item.area_sqft > 0);
  const totalArea = validItems.reduce((sum, item) => sum + item.area_sqft, 0);
  const subtotal = validItems.reduce((sum, item) => sum + item.retail_amount, 0);
  const total = subtotal + installation + delivery;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Product Selection & Pricing</h3>

      <div className="space-y-4">
        {validItems.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700">
              No windows with measurements found. Please complete the Measurements step first.
            </p>
          </div>
        )}

        {items.map((item, idx) => {
          if (item.area_sqft === 0) return null; // Skip items without measurements

          const itemKey = idx.toString();
          return (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700">
                  {item.location || `Window #${idx + 1}`}
                </span>
                <span className="text-xs text-gray-500">{item.area_sqft.toFixed(2)} sq.ft.</span>
              </div>

              <div className="space-y-3">
                {/* Product Code */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Product Code</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
                    value={item.product_code}
                    onChange={(e) => {
                      updateItem(idx, { product_code: e.target.value.toUpperCase() });
                      setLookupStatus((prev) => ({ ...prev, [itemKey]: '' }));
                    }}
                    onBlur={(e) => lookupCode(idx, e.target.value)}
                    placeholder="e.g. P5012"
                  />
                  {lookupStatus[itemKey] === 'found' && (
                    <p className="text-xs text-green-600 mt-1">✓ {item.product_description}</p>
                  )}
                  {lookupStatus[itemKey] === 'notfound' && (
                    <p className="text-xs text-red-500 mt-1">Product code not found</p>
                  )}
                  {lookupStatus[itemKey] === 'loading' && (
                    <p className="text-xs text-gray-400 mt-1">Looking up product...</p>
                  )}
                </div>

                {/* Read-only product details */}
                {item.product_id && (
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Collection</p>
                      <p className="text-sm text-gray-700">{item.product_collection || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Description</p>
                      <p className="text-sm text-gray-700">{item.product_description || '-'}</p>
                    </div>
                  </div>
                )}

                {/* Pricing display */}
                {item.product_id && (
                  <div className="grid grid-cols-2 gap-3 bg-blue-50 rounded-lg p-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Retail Price/sq.ft.</p>
                      <p className="text-sm font-medium text-blue-700">₱{item.retail_price_sqft.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Supplier Cost/sq.ft.</p>
                      <p className="text-sm font-medium text-blue-700">₱{item.supplier_cost_sqft.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Retail Amount</p>
                      <p className="text-sm font-semibold text-blue-700">₱{item.retail_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Supplier Amount</p>
                      <p className="text-sm font-semibold text-blue-700">₱{item.supplier_amount.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {errors.products && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{errors.products}</p>
          </div>
        )}
      </div>

      {/* Service Charges */}
      {validItems.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Service Charges</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Installation Fee (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={installation || ''}
                onChange={(e) => setInstallation(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Delivery Fee (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={delivery || ''}
                onChange={(e) => setDelivery(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {validItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Quote Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Area:</span>
              <span className="text-sm font-medium">{totalArea.toFixed(2)} sq.ft.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Subtotal:</span>
              <span className="text-sm font-medium">₱{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Installation:</span>
              <span className="text-sm font-medium">₱{installation.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Delivery:</span>
              <span className="text-sm font-medium">₱{delivery.toFixed(2)}</span>
            </div>
            <div className="border-t border-blue-200 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-base font-semibold text-gray-800">Total:</span>
                <span className="text-lg font-bold text-blue-700">₱{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}