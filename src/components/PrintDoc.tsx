'use client';
import type { Quote, Settings } from '@/types';
import { phpFormat, generatePoNumber } from '@/lib/calc';

interface Props {
  quote: Quote;
  settings: Settings;
  type: 'quotation' | 'po';
}

export default function PrintDoc({ quote, settings, type }: Props) {
  const isPO = type === 'po';
  const title = isPO ? 'PURCHASE ORDER' : 'QUOTATION';
  const docNum = isPO ? generatePoNumber(quote.quote_number) : quote.quote_number;
  const items = quote.items ?? [];
  const totalCost = items.reduce((s, i) => s + i.supplier_amount, 0);

  return (
    <div className="print-doc" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000', width: '100%', padding: '0', background: '#fff' }}>
      {/* Header */}
      <div style={{ fontSize: '16pt', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>{settings.company}</div>
      <div style={{ textAlign: 'center', fontSize: '13pt', fontWeight: 700, textDecoration: 'underline', marginBottom: '12px' }}>{title}</div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '10px', fontSize: '8.5pt' }}>
        <div>
          {settings.address}<br />
          Mobile: {settings.mobile}<br />
          E-mail: {settings.email}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>N<sup>o</sup>: <strong>{docNum}</strong></div>
          <div>Date: <strong>{quote.quote_date}</strong></div>
          <div>Our Ref: {quote.our_ref}</div>
          <div>Project: WINDOWBLINDS</div>
        </div>
      </div>

      {/* To */}
      <div style={{ fontSize: '8.5pt', marginBottom: '8px' }}>
        <strong>To:</strong> {quote.customer_name}<br />
        <span style={{ paddingLeft: '24px' }}>{quote.customer_address}</span>
      </div>

      <div style={{ fontSize: '8pt', borderBottom: '1px solid #000', marginBottom: '4px', fontStyle: 'italic' }}>Trading</div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', marginBottom: '6px' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>S/#</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Product Code</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Description</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Loc</th>
            <th colSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Final Size</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Area<br />(sq.ft.)</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Qty</th>
            {isPO ? (
              <>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Cost/sqft</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Cost Amt</th>
              </>
            ) : (
              <>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Retail Price<br />per sq.ft.</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0' }}>Retail Amount<br />Php</th>
              </>
            )}
          </tr>
          <tr>
            <th style={{ border: '1px solid #000', padding: '2px 4px', background: '#f0f0f0' }}>Width({items[0]?.unit?.toUpperCase() || 'IN'})</th>
            <th style={{ border: '1px solid #000', padding: '2px 4px', background: '#f0f0f0' }}>Drop({items[0]?.unit?.toUpperCase() || 'IN'})</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id}>
              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{i + 1}</td>
              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 700, fontSize: '9pt' }}>
                {item.product_code || '-'}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}>
                {item.product_collection}<br />
                <small>{item.product_description}</small>
              </td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}>{item.location}</td>
              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', color: '#0000ff', fontWeight: 700 }}>
                {item.final_width.toFixed(1)}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', color: '#0000ff', fontWeight: 700 }}>
                {item.final_drop.toFixed(1)}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right' }}>
                {item.area_sqft.toFixed(2)}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>1</td>
              {isPO ? (
                <>
                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right' }}>
                    {item.supplier_cost_sqft.toFixed(2)}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right' }}>
                    {item.supplier_amount.toFixed(2)}
                  </td>
                </>
              ) : (
                <>
                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', color: '#0000ff', fontWeight: 700 }}>
                    {item.retail_price_sqft.toFixed(2)}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', color: '#0000ff', fontWeight: 700 }}>
                    {item.retail_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                </>
              )}
            </tr>
          ))}
          {/* Blank rows to fill space */}
          {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}>&nbsp;</td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
              <td style={{ border: '1px solid #000', padding: '3px 4px' }}></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ textAlign: 'center', fontSize: '8pt', margin: '4px 0' }}>-NF-</p>

      {/* Service section */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginTop: '8px' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', fontWeight: 700, border: '1px solid #999', padding: '3px 5px' }}>Service</td>
            <td style={{ border: '1px solid #999', padding: '3px 5px' }}></td>
          </tr>
          <tr>
            <td colSpan={2} style={{ border: '1px solid #999', padding: '3px 5px', fontWeight: 700 }}>
              Description of Work &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <span style={{ float: 'right' }}>Total Area: {quote.total_area.toFixed(2)} sq.ft. &nbsp;&nbsp; Amount/sq.ft. &nbsp;&nbsp; Php</span>
            </td>
          </tr>
          <tr>
            <td style={{ color: 'red', border: '1px solid #999', padding: '3px 5px' }}>Installation</td>
            <td style={{ textAlign: 'right', color: 'red', border: '1px solid #999', padding: '3px 5px' }}>{quote.installation_fee.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={{ color: 'red', border: '1px solid #999', padding: '3px 5px' }}>Delivery</td>
            <td style={{ textAlign: 'right', color: 'red', border: '1px solid #999', padding: '3px 5px' }}>{quote.delivery_fee.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ textAlign: 'right', marginTop: '8px', fontSize: '9pt' }}>
        <div>Total Area: {quote.total_area.toFixed(2)} sq.ft. &nbsp; No of panels: {quote.panel_count}</div>
        <div style={{ fontSize: '11pt', fontWeight: 700, borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
          Total: {phpFormat(isPO ? totalCost : quote.total)}
        </div>
      </div>

      {/* Terms */}
      <div style={{ fontSize: '7.5pt', marginTop: '8px', borderTop: '1px solid #000', paddingTop: '6px' }}>
        <div><strong>TERMS:</strong> {settings.terms}</div>
        <div><strong>DEL:</strong> {settings.del_note}</div>
        <div style={{ marginTop: '4px' }}>{settings.closing_note}</div>
      </div>

      {/* Signatures */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '32px', fontSize: '8.5pt' }}>
        <div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '3px', marginTop: '20px' }}>Conformed by:</div>
          <div>Authorized Signature</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '3px', marginTop: '20px' }}>Prepared by:</div>
          <div>{settings.prepared_by}</div>
        </div>
      </div>
    </div>
  );
}
