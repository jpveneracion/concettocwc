'use client';

import React from 'react';

interface DemoWatermarkProps {
  children: React.ReactNode;
  subscriptionStatus: string;
}

export default function DemoWatermark({ children, subscriptionStatus }: DemoWatermarkProps) {
  const shouldShowWatermark =
    !subscriptionStatus ||
    ['demo', 'trial'].includes(subscriptionStatus);

  return (
    <div style={{ position: 'relative' }}>
      {children}
      {shouldShowWatermark && (
        <div
          className="demo-watermark"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
              fontSize: '120px',
              fontWeight: 900,
              color: '#ff0000',
              whiteSpace: 'nowrap',
              letterSpacing: '8px',
              userSelect: 'none',
            }}
          >
            DEMO
          </div>
        </div>
      )}
    </div>
  );
}