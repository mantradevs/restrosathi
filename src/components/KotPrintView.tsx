'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  notes?: string;
  price_at_order: number;
}

interface Order {
  id: string;
  created_at: string;
  created_by: string;
  notes?: string;
  status: string;
  total_amount?: number;
  payment_status?: string;
}

interface KotSettings {
  restaurant_name: string;
  header_text: string;
  footer_text: string;
  show_price: boolean;
}

interface KotPrintViewProps {
  order: Order | null;
  items: OrderItem[];
  tableNumber: string;
  settings?: KotSettings;
  /** If true, renders the KOT visible on-screen inside a modal (bill preview) */
  previewMode?: boolean;
  /** If provided, renders a consolidated bill from multiple orders */
  allOrders?: { order: Order; items: OrderItem[] }[];
}

const defaultSettings: KotSettings = {
  restaurant_name: 'RestroSathi',
  header_text: 'KITCHEN ORDER TICKET',
  footer_text: 'Thank you! Visit again.',
  show_price: true
};

export default function KotPrintView({ order, items, tableNumber, settings = defaultSettings, previewMode = false, allOrders }: KotPrintViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const activeSettings = settings || defaultSettings;

  // Consolidated mode: show all orders in one bill
  const isConsolidated = allOrders && allOrders.length > 0;

  // If not consolidated and no single order, nothing to render
  if (!isConsolidated && !order) return null;

  const containerStyle: React.CSSProperties = previewMode
    ? { ...printStyles.container, display: 'block' }
    : printStyles.container;

  // For single order mode
  const singleFormattedDate = order ? new Date(order.created_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }) : '';

  // Calculate consolidated total
  const consolidatedTotal = isConsolidated
    ? allOrders!.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.price_at_order * i.quantity, 0), 0)
    : items.reduce((sum, i) => sum + i.price_at_order * i.quantity, 0);

  const consolidatedItemCount = isConsolidated
    ? allOrders!.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
    : items.reduce((sum, i) => sum + i.quantity, 0);

  // Parse order notes for discount
  let discountType = 'none';
  let discountValue = 0;
  let discountAmount = 0;
  let cleanNotes = order?.notes || '';

  if (order?.notes) {
    try {
      const trimmed = order.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        discountType = parsed.discount_type || 'none';
        discountValue = Number(parsed.discount_value) || 0;
        discountAmount = Number(parsed.discount_amount) || 0;
        cleanNotes = parsed.notes || '';
      }
    } catch (e) {
      // Not JSON
    }
  }

  const content = (
    <div className="kot-print-area" style={containerStyle}>
      {/* Header */}
      <div style={printStyles.header}>
        <h1 style={printStyles.restaurantName}>{activeSettings.restaurant_name.toUpperCase()}</h1>
        <h2 style={printStyles.title}>
          {isConsolidated ? 'CONSOLIDATED BILL' : activeSettings.header_text.toUpperCase()}
        </h2>
        <h1 style={printStyles.tableNo}>{tableNumber.toUpperCase()}</h1>
      </div>

      <div className="kot-divider" style={printStyles.dashedLine}></div>

      {isConsolidated ? (
        <>
          {/* Consolidated: show each order as a section */}
          {allOrders!.map((entry, idx) => (
            <div key={entry.order.id}>
              {idx > 0 && <div className="kot-divider" style={printStyles.dashedLine}></div>}
              <div style={printStyles.metaGrid}>
                <div><strong>Order #{idx + 1}:</strong> #{entry.order.id.slice(0, 8)}</div>
                <div><strong>Server:</strong> {entry.order.created_by}</div>
                <div><strong>Time:</strong> {new Date(entry.order.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</div>
                <div><strong>Payment:</strong> {(entry.order.payment_status || 'unpaid').toUpperCase()}</div>
              </div>

              <table style={printStyles.table}>
                <thead>
                  <tr style={printStyles.tableHeaderRow}>
                    <th style={{ ...printStyles.th, width: '40px', textAlign: 'left' }}>QTY</th>
                    <th style={{ ...printStyles.th, textAlign: 'left' }}>ITEM</th>
                    {activeSettings.show_price && (
                      <th style={{ ...printStyles.th, width: '60px', textAlign: 'right' }}>PRICE</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {entry.items.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr>
                        <td style={printStyles.qtyCol}><strong>{item.quantity}x</strong></td>
                        <td style={printStyles.nameCol}>{item.item_name}</td>
                        {activeSettings.show_price && (
                          <td style={printStyles.priceCol}>Rs. {item.price_at_order * item.quantity}</td>
                        )}
                      </tr>
                      {item.notes && (
                        <tr>
                          <td></td>
                          <td colSpan={activeSettings.show_price ? 2 : 1} style={printStyles.itemNotes}>
                            * {item.notes}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {activeSettings.show_price && (
                <div style={{ ...printStyles.subtotalRow }}>
                  <span>Subtotal:</span>
                  <strong>Rs. {entry.items.reduce((s, i) => s + i.price_at_order * i.quantity, 0)}</strong>
                </div>
              )}
            </div>
          ))}

          <div className="kot-divider" style={printStyles.dashedLine}></div>
        </>
      ) : (
        <>
          {/* Single order mode */}
          <div style={printStyles.metaGrid}>
            <div><strong>KOT ID:</strong> #{order!.id.slice(0, 8)}</div>
            <div><strong>Date:</strong> {singleFormattedDate}</div>
            <div><strong>Server:</strong> {order!.created_by}</div>
            <div><strong>Status:</strong> {order!.status.toUpperCase()}</div>
          </div>

          <div className="kot-divider" style={printStyles.dashedLine}></div>

          <table style={printStyles.table}>
            <thead>
              <tr style={printStyles.tableHeaderRow}>
                <th style={{ ...printStyles.th, width: '40px', textAlign: 'left' }}>QTY</th>
                <th style={{ ...printStyles.th, textAlign: 'left' }}>ITEM</th>
                {activeSettings.show_price && (
                  <th style={{ ...printStyles.th, width: '60px', textAlign: 'right' }}>PRICE</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <React.Fragment key={item.id}>
                  <tr>
                    <td style={printStyles.qtyCol}><strong>{item.quantity}x</strong></td>
                    <td style={printStyles.nameCol}>{item.item_name}</td>
                    {activeSettings.show_price && (
                      <td style={printStyles.priceCol}>Rs. {item.price_at_order * item.quantity}</td>
                    )}
                  </tr>
                  {item.notes && (
                    <tr>
                      <td></td>
                      <td colSpan={activeSettings.show_price ? 2 : 1} style={printStyles.itemNotes}>
                        * {item.notes}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <div className="kot-divider" style={printStyles.dashedLine}></div>

          {cleanNotes && (
            <div style={printStyles.orderNotes}>
              <strong>Special Instructions:</strong>
              <p style={{ marginTop: '4px', fontStyle: 'italic' }}>{cleanNotes}</p>
              <div className="kot-divider" style={printStyles.dashedLine}></div>
            </div>
          )}
        </>
      )}

      {/* Total */}
      {activeSettings.show_price && (
        <>
          {discountType !== 'none' && (
            <>
              <div style={{ ...printStyles.subtotalRow, fontWeight: 'bold' }}>
                <span>SUBTOTAL:</span>
                <span>Rs. {consolidatedTotal}</span>
              </div>
              <div style={printStyles.subtotalRow}>
                <span>DISCOUNT ({discountType === 'percentage' ? `${discountValue}%` : 'Flat'}):</span>
                <span>- Rs. {discountAmount}</span>
              </div>
            </>
          )}
          <div style={printStyles.totalRow}>
            <span>{isConsolidated ? 'GRAND TOTAL:' : 'TOTAL AMOUNT:'}</span>
            <strong>Rs. {consolidatedTotal - discountAmount}</strong>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={printStyles.footer}>
        <p>Total Items: {consolidatedItemCount}</p>
        <p style={{ marginTop: '8px', fontWeight: 'bold' }}>{activeSettings.footer_text}</p>
        <p style={{ marginTop: '12px', fontSize: '9px', opacity: 0.7 }}>--- {isConsolidated ? 'Bill Copy' : 'Print Copy'} ---</p>
      </div>
    </div>
  );

  if (previewMode) {
    return content;
  }

  if (!mounted || typeof window === 'undefined') {
    return null;
  }

  return createPortal(content, document.body);
}

/** Bill Preview Modal: wraps KotPrintView in a visible on-screen overlay */
export function BillPreviewModal({
  show,
  onClose,
  onPrint,
  children
}: {
  show: boolean;
  onClose: () => void;
  onPrint: () => void;
  children: React.ReactNode;
}) {
  if (!show) return null;

  return (
    <div style={modalStyles.overlay} className="no-print" onClick={onClose}>
      <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px' }}>Bill Preview</h3>
          <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
        </div>

        <div style={modalStyles.previewBody}>
          <div style={modalStyles.receiptWrapper}>
            {children}
          </div>
        </div>

        <div style={modalStyles.footer}>
          <button onClick={onClose} style={modalStyles.cancelBtn}>Close</button>
          <button onClick={onPrint} style={modalStyles.printBtn}>🖨️ Print Bill</button>
        </div>
      </div>
    </div>
  );
}

const printStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'none', // Hidden on screen, shown in print via CSS
  },
  header: {
    textAlign: 'center',
    marginBottom: '8px',
  },
  restaurantName: {
    fontSize: '24px',
    fontWeight: '800',
    margin: '0 0 2px 0',
    letterSpacing: '0.5px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 'bold',
    margin: 0,
    letterSpacing: '1px',
    opacity: 0.8,
  },
  tableNo: {
    fontSize: '32px',
    fontWeight: '900',
    margin: '8px 0 0 0',
    border: '2px solid #000',
    display: 'inline-block',
    padding: '4px 12px',
  },
  dashedLine: {
    borderTop: '1px dashed #000',
    margin: '6px 0',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2px',
    fontSize: '15px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '6px',
    fontSize: '16px',
  },
  tableHeaderRow: {
    borderBottom: '1px dashed #000',
  },
  th: {
    padding: '4px 0',
    fontWeight: 'bold',
    fontSize: '15px',
  },
  qtyCol: {
    padding: '6px 0',
    verticalAlign: 'top',
  },
  nameCol: {
    padding: '6px 0',
    verticalAlign: 'top',
  },
  priceCol: {
    padding: '6px 0',
    verticalAlign: 'top',
    textAlign: 'right',
    fontWeight: '500',
  },
  itemNotes: {
    padding: '0 0 6px 0',
    fontSize: '13px',
    fontStyle: 'italic',
    color: '#000',
  },
  subtotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '15px',
    margin: '4px 0',
    paddingTop: '4px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '8px 0',
    padding: '6px 0',
    borderTop: '2px solid #000',
    borderBottom: '2px solid #000',
  },
  orderNotes: {
    fontSize: '15px',
    marginTop: '6px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '12px',
    fontSize: '15px',
  },
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    maxWidth: '420px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
  },
  previewBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    backgroundColor: '#f9f9f9',
  },
  receiptWrapper: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '16px 24px 16px 12px',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '15px',
    lineHeight: 1.4,
    color: '#000',
    maxWidth: '320px',
    margin: '0 auto',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '14px 20px',
    borderTop: '1px solid var(--border-color)',
  },
  cancelBtn: {
    padding: '8px 18px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  printBtn: {
    padding: '8px 18px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
};
