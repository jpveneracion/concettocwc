'use client';

import { Smartphone, Landmark, Coins, Pi, CheckCircle2 } from 'lucide-react';
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
    icon: Smartphone,
    color: 'blue'
  },
  {
    id: 'gotyme' as PaymentMethod,
    name: 'GoTyme',
    description: 'Bank transfer app',
    icon: Landmark,
    color: 'purple'
  },
  {
    id: 'usdc' as PaymentMethod,
    name: 'USDC',
    description: 'Crypto payment',
    icon: Coins,
    color: 'green'
  },
  {
    id: 'pi' as PaymentMethod,
    name: 'Pi Network',
    description: 'Pay with Pi (sandbox)',
    icon: Pi,
    color: 'purple'
  }
];

export default function PaymentMethodSelector({
  selectedMethod,
  onMethodChange
}: PaymentMethodSelectorProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-stone-200 mb-6">
      <h3 className="text-lg font-semibold text-stone-900 mb-4">
        Select Payment Method
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {paymentMethods.map((method) => (
          <button
            key={method.id}
            onClick={() => onMethodChange(method.id)}
            className={`
              p-4 rounded-lg border-2 transition-all text-left
              ${selectedMethod === method.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }
            `}
          >
            <div className="flex items-center gap-3 mb-2">
              <method.icon className="w-6 h-6 text-indigo-600" />
              <h4 className="font-semibold text-stone-900">{method.name}</h4>
            </div>
            <p className="text-sm text-stone-600">{method.description}</p>

            {selectedMethod === method.id && (
              <div className="mt-3 flex items-center gap-2 text-sm text-indigo-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">Selected</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}