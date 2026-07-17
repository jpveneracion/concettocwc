'use client';

import { PaymentMethod } from '@/types/payment';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
}

const paymentMethods = [
  {
    id: 'gcash' as PaymentMethod,
    name: 'GCash',
    description: 'Instant mobile payment',
    icon: '📱',
    color: 'blue'
  },
  {
    id: 'gotyme' as PaymentMethod,
    name: 'GoTyme',
    description: 'Bank transfer app',
    icon: '🏦',
    color: 'purple'
  },
  {
    id: 'usdc' as PaymentMethod,
    name: 'USDC',
    description: 'Crypto payment',
    icon: '₿',
    color: 'green'
  }
];

export default function PaymentMethodSelector({
  selectedMethod,
  onMethodChange
}: PaymentMethodSelectorProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Select Payment Method
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {paymentMethods.map((method) => (
          <button
            key={method.id}
            onClick={() => onMethodChange(method.id)}
            className={`
              p-4 rounded-lg border-2 transition-all text-left
              ${selectedMethod === method.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }
            `}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{method.icon}</span>
              <h4 className="font-semibold text-gray-900">{method.name}</h4>
            </div>
            <p className="text-sm text-gray-600">{method.description}</p>

            {selectedMethod === method.id && (
              <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                <span className="text-green-600">✓</span>
                <span className="font-medium">Selected</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}