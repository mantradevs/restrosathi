'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { 
  Plus, Minus, Trash2, Check, RefreshCw, ShoppingCart, 
  Layers, Clipboard, AlertTriangle, Search, Info, Image, Lock
} from 'lucide-react';

interface StaffDashboardProps {
  user: { id: string; username: string; name: string; role: 'owner' | 'admin' | 'staff' };
}

export default function StaffDashboard({ user }: StaffDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Database Data States
  const [tables, setTables] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // POS Interaction States
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [cart, setCart] = useState<any[]>([]); // pending/draft items
  const [confirmedItems, setConfirmedItems] = useState<any[]>([]); // already confirmed items on this active order
  const [orderNotes, setOrderNotes] = useState('');
  const [sessionOrders, setSessionOrders] = useState<any[]>([]); // all orders in session
  const [posRightTab, setPosRightTab] = useState<'cart' | 'history'>('cart');

  // Ordering Workflow & Mobile Stepper States
  const [isMobile, setIsMobile] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1); // 1: Select Table, 2: Choose Items, 3: Review & Confirm
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, number>>({});

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (supabase) {
      loadData();
    }
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showToast = (message: string, isSuccess = true) => {
    if (isSuccess) {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      setError(message);
      setTimeout(() => setError(null), 4000);
    }
  };

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Load tables
      const { data: tData, error: tErr } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number', { ascending: true });
      if (tErr) throw tErr;
      setTables(tData || []);

      // Load categories
      const { data: cData, error: cErr } = await supabase
        .from('menu_categories')
        .select('*')
        .order('name', { ascending: true });
      if (cErr) throw cErr;
      setCategories(cData || []);

      // Load menu items
      const { data: mData, error: mErr } = await supabase
        .from('menu_items')
        .select('*, menu_categories(name)')
        .eq('is_available', true)
        .order('name', { ascending: true });
      if (mErr) throw mErr;
      setMenuItems(mData || []);
    } catch (err: any) {
      showToast(err.message || 'Error loading records', false);
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = async (table: any, autoBeginOrder = false) => {
    if (!supabase) return;
    setSelectedTable(table);
    setCart([]);
    setConfirmedItems([]);
    setActiveOrder(null);
    setActiveSession(null);
    setOrderNotes('');
    setSessionOrders([]);
    setPosRightTab('cart');
    setIsOrdering(autoBeginOrder);
    setCurrentStep(autoBeginOrder && isMobile ? 2 : 1);

    setLoading(true);
    try {
      // Check if there is an active session for this table
      const { data: sessionData } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('table_id', table.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1);

      if (sessionData && sessionData.length > 0) {
        const session = sessionData[0];
        setActiveSession(session);

        // Find the active order/bill in this session (pending or confirmed)
        const { data: orderData } = await supabase
          .from('orders')
          .select('*')
          .eq('session_id', session.id)
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (orderData && orderData.length > 0) {
          const order = orderData[0];
          setActiveOrder(order);
          setOrderNotes(order.notes || '');

          const { data: itemsData } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

          const dbItems = itemsData || [];
          const pending = dbItems.filter((it: any) => (it.status || 'confirmed') === 'pending');
          const confirmed = dbItems.filter((it: any) => (it.status || 'confirmed') === 'confirmed');

          setCart(pending);
          setConfirmedItems(confirmed);
        }

        // Fetch all orders in session with items
        const { data: allOrders } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false });
        setSessionOrders(allOrders || []);
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading table details', false);
    } finally {
      setLoading(false);
    }
  };

  const handleBeginOrdering = () => {
    if (!selectedTable) return;
    setIsOrdering(true);
    if (window.innerWidth <= 768) {
      setCurrentStep(2);
    }
  };

  const handleCancelOrdering = () => {
    setIsOrdering(false);
    setCurrentStep(1);
    if (selectedTable) {
      handleTableSelect(selectedTable);
    }
  };



  // Selection operations before adding to the cart
  const toggleItemSelection = (menuItem: any) => {
    setSelectedItemsMap(prev => {
      const next = { ...prev };
      if (next[menuItem.id] !== undefined) {
        delete next[menuItem.id];
      } else {
        next[menuItem.id] = 1;
      }
      return next;
    });
  };

  const updateSelectionQty = (itemId: string, newQty: number) => {
    setSelectedItemsMap(prev => {
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: newQty };
    });
  };

  const handleReviewOrderWithSelected = () => {
    if (!selectedTable) {
      setCurrentStep(3);
      return;
    }

    const itemsToAdd = Object.entries(selectedItemsMap).map(([itemId, qty]) => {
      const menuItem = menuItems.find(m => m.id === itemId);
      return { menuItem, quantity: qty };
    }).filter(x => x.menuItem !== undefined);

    if (itemsToAdd.length > 0) {
      setCart(prev => {
        let nextCart = [...prev];
        itemsToAdd.forEach(({ menuItem, quantity }) => {
          const existingIdx = nextCart.findIndex(item => item.menu_item_id === menuItem.id);
          if (existingIdx > -1) {
            nextCart[existingIdx] = {
              ...nextCart[existingIdx],
              quantity: nextCart[existingIdx].quantity + quantity
            };
          } else {
            nextCart.push({
              id: `temp-${Date.now()}-${menuItem.id}`,
              order_id: activeOrder ? activeOrder.id : '',
              menu_item_id: menuItem.id,
              item_name: menuItem.name,
              price_at_order: menuItem.price || 0,
              quantity: quantity,
              notes: ''
            });
          }
        });
        return nextCart;
      });
      setSelectedItemsMap({});
      showToast(`Added ${itemsToAdd.length} item(s) to order list`);
    }

    setCurrentStep(3);
  };

  const handleAddSelectedToCart = () => {
    if (!selectedTable) {
      showToast('Please select a table first.', false);
      return;
    }

    const itemsToAdd = Object.entries(selectedItemsMap).map(([itemId, qty]) => {
      const menuItem = menuItems.find(m => m.id === itemId);
      return { menuItem, quantity: qty };
    }).filter(x => x.menuItem !== undefined);

    if (itemsToAdd.length === 0) {
      showToast('Please select at least one item first.', false);
      return;
    }

    setCart(prev => {
      let nextCart = [...prev];
      itemsToAdd.forEach(({ menuItem, quantity }) => {
        const existingIdx = nextCart.findIndex(item => item.menu_item_id === menuItem.id);
        if (existingIdx > -1) {
          nextCart[existingIdx] = {
            ...nextCart[existingIdx],
            quantity: nextCart[existingIdx].quantity + quantity
          };
        } else {
          nextCart.push({
            id: `temp-${Date.now()}-${menuItem.id}`,
            order_id: activeOrder ? activeOrder.id : '',
            menu_item_id: menuItem.id,
            item_name: menuItem.name,
            price_at_order: menuItem.price || 0,
            quantity: quantity,
            notes: ''
          });
        }
      });
      return nextCart;
    });

    // Reset selection map
    setSelectedItemsMap({});
    showToast(`Added ${itemsToAdd.length} item(s) to order list`);
  };

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(cart.filter(item => item.id !== itemId));
    } else {
      setCart(cart.map(item => 
        item.id === itemId ? { ...item, quantity: newQty } : item
      ));
    }
  };

  const handleItemNotesChange = (itemId: string, note: string) => {
    setCart(cart.map(item => 
      item.id === itemId ? { ...item, notes: note } : item
    ));
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // Submit/Confirm Order
  const handleSubmitOrder = async (isConfirm: boolean) => {
    if (!supabase || !selectedTable) return;

    // Calculate total bill first
    const confirmedTotal = confirmedItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0);
    const cartTotal = cart.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0);
    const totalBill = confirmedTotal + cartTotal;

    if (totalBill <= 0) {
      showToast('Cannot save or confirm an empty order (Rs. 0)', false);
      return;
    }

    setLoading(true);
    try {
      let session = activeSession;

      // 1. If no active session, create one and mark table occupied
      if (!session) {
        const { error: tErr } = await supabase
          .from('restaurant_tables')
          .update({ status: 'occupied' })
          .eq('id', selectedTable.id);
        if (tErr) throw tErr;

        const { data: sessionData, error: sErr } = await supabase
          .from('table_sessions')
          .insert({ table_id: selectedTable.id, status: 'active' })
          .select()
          .single();
        if (sErr) throw sErr;
        session = sessionData;
        setActiveSession(session);
        setSelectedTable((prev: any) => prev ? { ...prev, status: 'occupied' } : null);
      }

      // 2. If no active order, create one
      let order = activeOrder;
      if (!order) {
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({
            table_id: selectedTable.id,
            session_id: session.id,
            status: 'pending',
            payment_status: 'unpaid',
            total_amount: totalBill,
            created_by: user.name,
            notes: orderNotes
          })
          .select()
          .single();
        if (orderErr) throw orderErr;
        order = orderData;
        setActiveOrder(order);
      }

      // 3. Delete all current PENDING order items in DB for this order
      const { error: delErr } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id)
        .eq('status', 'pending');
      if (delErr) throw delErr;

      // 4. Insert the new ones from cart
      const dbItems = cart.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        price_at_order: item.price_at_order,
        quantity: item.quantity,
        notes: item.notes || null,
        status: isConfirm ? 'confirmed' : 'pending'
      }));

      if (dbItems.length > 0) {
        const { error: insErr } = await supabase
          .from('order_items')
          .insert(dbItems);
        if (insErr) throw insErr;
      }

      // 5. Update the Order table (updating status if confirmed)
      const updatePayload: any = {
        total_amount: totalBill,
        notes: orderNotes
      };

      if (isConfirm) {
        updatePayload.status = 'confirmed';
        updatePayload.confirmed_by = user.name;
      }

      const { error: updErr } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);
      
      if (updErr) throw updErr;

      if (isConfirm) {
        showToast('Order confirmed and sent to kitchen');
      } else {
        showToast('Draft saved successfully');
      }

      // Reload/Refresh the table details to sync state
      await handleTableSelect(selectedTable, isOrdering);
    } catch (err: any) {
      showToast(err.message || 'Error saving order details', false);
    } finally {
      setLoading(false);
    }
  };

  // Filters
  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = selectedCategoryId === 'all' || item.category_id === selectedCategoryId;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderStepperHeader = () => {
    if (!isMobile || !isOrdering) return null;
    return (
      <div style={styles.mobileStepperHeader}>
        <div style={styles.mobileStepperStep}>
          <div style={{
            ...styles.stepNumber,
            backgroundColor: currentStep >= 1 ? 'var(--primary)' : 'var(--bg-surface-elevated)',
            color: currentStep >= 1 ? '#fff' : 'var(--text-muted)'
          }}>1</div>
          <span style={{ fontSize: '12px', fontWeight: currentStep === 1 ? '600' : '400', color: currentStep === 1 ? 'var(--primary)' : 'var(--text-main)' }}>Table</span>
        </div>
        <div style={{ flex: 1, height: '2px', backgroundColor: currentStep >= 2 ? 'var(--primary)' : 'var(--border-color)', margin: '0 8px', alignSelf: 'center' }} />
        <div style={styles.mobileStepperStep}>
          <div style={{
            ...styles.stepNumber,
            backgroundColor: currentStep >= 2 ? 'var(--primary)' : 'var(--bg-surface-elevated)',
            color: currentStep >= 2 ? '#fff' : 'var(--text-muted)'
          }}>2</div>
          <span style={{ fontSize: '12px', fontWeight: currentStep === 2 ? '600' : '400', color: currentStep === 2 ? 'var(--primary)' : 'var(--text-main)' }}>Menu</span>
        </div>
        <div style={{ flex: 1, height: '2px', backgroundColor: currentStep >= 3 ? 'var(--primary)' : 'var(--border-color)', margin: '0 8px', alignSelf: 'center' }} />
        <div style={styles.mobileStepperStep}>
          <div style={{
            ...styles.stepNumber,
            backgroundColor: currentStep >= 3 ? 'var(--primary)' : 'var(--bg-surface-elevated)',
            color: currentStep >= 3 ? '#fff' : 'var(--text-muted)'
          }}>3</div>
          <span style={{ fontSize: '12px', fontWeight: currentStep === 3 ? '600' : '400', color: currentStep === 3 ? 'var(--primary)' : 'var(--text-main)' }}>Confirm</span>
        </div>
      </div>
    );
  };

  const renderTableDetails = () => {
    if (!selectedTable) return null;
    
    const totalBilled = sessionOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    const hasPendingOrder = sessionOrders.some(o => o.status === 'pending');

    return (
      <div style={styles.tableDetailsPanel} className="glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-serif)', color: 'var(--text-main)' }}>Table {selectedTable.table_number}</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Capacity: {selectedTable.seating_capacity} seats</span>
          </div>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: selectedTable.status === 'occupied' ? 'rgba(217, 119, 6, 0.12)' :
                            selectedTable.status === 'reserved' ? 'rgba(79, 70, 229, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: selectedTable.status === 'occupied' ? 'var(--primary)' :
                   selectedTable.status === 'reserved' ? 'var(--secondary)' : 'var(--success)'
          }}>
            {selectedTable.status.toUpperCase()}
          </span>
        </div>

        <div style={{ marginTop: '4px', marginBottom: '8px' }}>
          <button
            onClick={handleBeginOrdering}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            className="glow-hover"
          >
            <Plus size={16} />
            {hasPendingOrder ? 'Modify Draft Order' : activeSession ? 'Add Items to Order' : 'Start New Order'}
          </button>
        </div>

        {activeSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Session Status:</span>
              <strong style={{ color: 'var(--success)' }}>Active Session</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Orders in Session:</span>
              <strong style={{ color: 'var(--text-main)' }}>{sessionOrders.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Current Bill Total:</span>
              <strong style={{ color: 'var(--primary)' }}>Rs. {totalBilled}</strong>
            </div>

            <div style={{ marginTop: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-muted)' }}>Session Orders History</h4>
              {sessionOrders.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  No orders placed in this session yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                  {sessionOrders.map((o) => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <div>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>#{o.id.slice(0, 8)}</span>
                        <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '10px' }}>
                          {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--primary)' }}>Rs. {o.total_amount}</span>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: o.status === 'completed' ? 'rgba(16, 185, 129, 0.12)' :
                                          o.status === 'confirmed' ? 'rgba(99, 102, 241, 0.12)' :
                                          o.status === 'pending' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: o.status === 'completed' ? 'var(--success)' :
                                 o.status === 'confirmed' ? 'var(--secondary)' :
                                 o.status === 'pending' ? 'var(--primary)' : 'var(--danger)'
                        }}>{o.status.toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            This table is currently available. Start ordering to open a session.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="responsive-pos-container" style={{ paddingBottom: (isMobile && isOrdering && currentStep === 2) ? '80px' : 0 }}>
      {successMessage && (
        <div style={styles.toast} className="animate-fade-in">
          <Check size={18} style={{ marginRight: 8 }} />
          {successMessage}
        </div>
      )}

      {error && (
        <div style={{ ...styles.toast, backgroundColor: 'var(--danger)' }} className="animate-fade-in">
          <AlertTriangle size={18} style={{ marginRight: 8 }} />
          {error}
        </div>
      )}

      {renderStepperHeader()}

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={styles.panel} className="glass">
                <h2 style={styles.sectionHeading}>Dining Tables</h2>
                {loading && tables.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 24px', width: '100%', boxSizing: 'border-box' }}>
                    <RefreshCw size={24} className="spin" color="var(--primary)" />
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading dining tables...</p>
                  </div>
                ) : tables.length === 0 ? (
                  <div style={styles.emptyState}>No tables registered.</div>
                ) : (
                  <div style={styles.tablesGrid}>
                    {tables.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleTableSelect(t, true)}
                        style={{
                          ...styles.tableBtn,
                          padding: isMobile ? '16px 12px' : '12px 6px',
                          borderColor: selectedTable?.id === t.id ? 'var(--primary)' : 'var(--border-color)',
                          backgroundColor: t.status === 'occupied' 
                            ? 'rgba(217, 119, 6, 0.08)' 
                            : t.status === 'reserved' 
                              ? 'rgba(79, 70, 229, 0.08)'
                              : 'rgba(0, 0, 0, 0.02)',
                          boxShadow: selectedTable?.id === t.id ? 'var(--shadow-glow)' : 'none',
                        }}
                      >
                        <span style={styles.tableNum}>{t.table_number}</span>
                        <span style={{
                          ...styles.tableStatusText,
                          color: t.status === 'occupied' ? 'var(--primary)' : 
                                 t.status === 'reserved' ? 'var(--secondary)' : 'var(--success)'
                        }}>
                          {t.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cap: {t.seating_capacity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTable && renderTableDetails()}
            </div>
          )}

          {currentStep === 2 && selectedTable && (
            <>
              <div className="glass" style={{ 
                ...styles.panel, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px', 
                padding: '12px', 
                height: 'calc(100dvh - 150px)',
                minHeight: '400px',
                position: 'relative'
              }}>
                <div style={styles.menuHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={handleCancelOrdering}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back
                    </button>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Table {selectedTable.table_number} Menu</span>
                      <h2 style={{ ...styles.sectionHeading, fontSize: '16px', marginBottom: 0 }}>Browse Menu</h2>
                    </div>
                  </div>
                  <div style={{ ...styles.searchBar, width: '100%', maxWidth: '200px' }}>
                    <Search size={16} color="var(--text-muted)" style={{ marginRight: 8 }} />
                    <input
                      type="text"
                      placeholder="Search menu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={styles.searchInput}
                    />
                  </div>
                </div>

                <div style={styles.categoriesContainer}>
                  <button
                    onClick={() => setSelectedCategoryId('all')}
                    style={{
                      ...styles.categoryTab,
                      padding: isMobile ? '10px 16px' : '8px 14px',
                      backgroundColor: selectedCategoryId === 'all' ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                      color: selectedCategoryId === 'all' ? '#fff' : 'var(--text-main)',
                    }}
                  >
                    All Items
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategoryId(c.id)}
                      style={{
                        ...styles.categoryTab,
                        padding: isMobile ? '10px 16px' : '8px 14px',
                        backgroundColor: selectedCategoryId === c.id ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                        color: selectedCategoryId === c.id ? '#fff' : 'var(--text-main)',
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <div style={styles.menuGridContainer}>
                  {filteredMenuItems.length === 0 ? (
                    <div style={styles.emptyState}>No items match your search.</div>
                  ) : (
                    <div style={{ ...styles.menuItemsGrid, gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                      {filteredMenuItems.map((item) => {
                        const isSelected = selectedItemsMap[item.id] !== undefined;
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => toggleItemSelection(item)}
                            style={{
                              ...styles.menuItemCard,
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-surface)',
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              height: '100%',
                              cursor: 'pointer'
                            }}
                            className="glow-hover"
                          >
                            <div>
                              <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                zIndex: 10,
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                border: '2px solid ' + (isSelected ? 'var(--primary)' : 'var(--border-color)'),
                                backgroundColor: isSelected ? 'var(--primary)' : 'rgba(0, 0, 0, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'var(--transition-fast)'
                              }}>
                                {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                              </div>

                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} style={styles.itemImg} />
                              ) : (
                                <div style={styles.itemNoImg}>
                                  <Image size={20} color="var(--text-muted)" />
                                </div>
                              )}
                              <div style={styles.itemInfo}>
                                <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{item.name}</h4>
                                <span style={styles.itemPrice}>Rs. {item.price}</span>
                              </div>
                            </div>

                            {isSelected && (
                              <div 
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 12px',
                                  borderTop: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-surface-elevated)',
                                  gap: '8px',
                                  borderBottomLeftRadius: 'var(--radius-sm)',
                                  borderBottomRightRadius: 'var(--radius-sm)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                                  <button 
                                    onClick={() => updateSelectionQty(item.id, selectedItemsMap[item.id] - 1)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: isMobile ? '28px' : '20px',
                                      height: isMobile ? '28px' : '20px',
                                      borderRadius: '50%',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--bg-surface)',
                                      color: 'var(--text-main)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Minus size={isMobile ? 12 : 10} />
                                  </button>
                                  <span style={{ fontSize: '12px', fontWeight: '700' }}>
                                    {selectedItemsMap[item.id]}
                                  </span>
                                  <button 
                                    onClick={() => updateSelectionQty(item.id, selectedItemsMap[item.id] + 1)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: isMobile ? '28px' : '20px',
                                      height: isMobile ? '28px' : '20px',
                                      borderRadius: '50%',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--bg-surface)',
                                      color: 'var(--text-main)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Plus size={isMobile ? 12 : 10} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.mobileBottomBar}>
                {Object.keys(selectedItemsMap).length > 0 ? (
                  <>
                    <div style={styles.mobileBottomInfo}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Selection</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>
                        {Object.values(selectedItemsMap).reduce((sum, q) => sum + q, 0)} Items Selected
                      </span>
                    </div>
                    <div style={styles.mobileBottomActions}>
                      <button 
                        onClick={handleAddSelectedToCart}
                        style={{ ...styles.backBtn, backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '10px 12px', fontSize: '12px' }}
                      >
                        Add Selected ({Object.keys(selectedItemsMap).length})
                      </button>
                      <button 
                        onClick={handleReviewOrderWithSelected}
                        style={{ ...styles.nextBtn, padding: '10px 12px', fontSize: '12px' }}
                      >
                        Review Order
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.mobileBottomInfo}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Cart</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} Items | Rs. {cart.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0)}
                      </span>
                    </div>
                    <div style={styles.mobileBottomActions}>
                      <button onClick={handleCancelOrdering} style={styles.backBtn}>
                        Cancel
                      </button>
                      <button 
                        onClick={() => setCurrentStep(3)} 
                        disabled={cart.length === 0}
                        style={{ ...styles.nextBtn, opacity: cart.length === 0 ? 0.5 : 1 }}
                      >
                        Review Order
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {currentStep === 3 && selectedTable && (
            <>
              <div style={{ 
                ...styles.panel, 
                padding: '12px', 
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100dvh - 150px)',
                minHeight: '400px',
                position: 'relative'
              }} className="glass">
                <div style={styles.cartContainer}>
                  <div style={styles.cartHeader}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-serif)', color: 'var(--text-main)' }}>Table {selectedTable.table_number} Order</h2>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status: {activeOrder ? activeOrder.status.toUpperCase() : 'NEW DRAFT'}</span>
                    </div>
                  </div>

                  <div style={styles.cartItemsList}>
                    {confirmedItems.length === 0 && cart.length === 0 ? (
                      <div style={styles.emptyCart}>
                        <ShoppingCart size={32} color="var(--border-color)" style={{ marginBottom: 8 }} />
                        <p>Your order card is empty.</p>
                        <p style={{ fontSize: '12px' }}>Go back to menu to add.</p>
                      </div>
                    ) : (
                      <>
                        {confirmedItems.map((item) => (
                          <div key={item.id} style={{ ...styles.cartItemRow, opacity: 0.85, backgroundColor: 'rgba(16, 185, 129, 0.02)', borderLeft: '3px solid var(--success)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={styles.cartItemName}>
                                {item.item_name}
                                <span style={{
                                  marginLeft: 8,
                                  fontSize: '9px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                  color: 'var(--success)',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-full)',
                                  fontWeight: '700'
                                }}>COOKING</span>
                              </div>
                              <div style={styles.cartItemPrice}>Rs. {item.price_at_order} each</div>
                              {item.notes && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>* {item.notes}</div>}
                            </div>
                            <div style={styles.cartItemQuantityArea}>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '12px' }}>Qty: {item.quantity}</span>
                              <span style={styles.cartItemTotal}>Rs. {item.price_at_order * item.quantity}</span>
                            </div>
                          </div>
                        ))}

                        {cart.map((item) => (
                          <div key={item.id} style={{ ...styles.cartItemRow, borderLeft: '3px solid var(--primary)', backgroundColor: 'rgba(245, 158, 11, 0.01)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={styles.cartItemName}>
                                {item.item_name}
                                <span style={{
                                  marginLeft: 8,
                                  fontSize: '9px',
                                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                  color: 'var(--primary)',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-full)',
                                  fontWeight: '700'
                                }}>NEW</span>
                              </div>
                              <div style={styles.cartItemPrice}>Rs. {item.price_at_order} each</div>
                              
                              <input
                                type="text"
                                placeholder="Instructions (e.g. no spicy)"
                                value={item.notes || ''}
                                onChange={(e) => handleItemNotesChange(item.id, e.target.value)}
                                style={styles.itemNoteInput}
                              />
                            </div>

                            <div style={styles.cartItemQuantityArea}>
                              <div style={styles.qtyControls}>
                                <button 
                                  onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                                  style={{
                                    ...styles.cartQtyBtn,
                                    width: isMobile ? '32px' : '22px',
                                    height: isMobile ? '32px' : '22px',
                                  }}
                                >
                                  <Minus size={isMobile ? 14 : 12} />
                                </button>
                                <span style={{ width: '20px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>
                                  {item.quantity}
                                </span>
                                <button 
                                  onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                                  style={{
                                    ...styles.cartQtyBtn,
                                    width: isMobile ? '32px' : '22px',
                                    height: isMobile ? '32px' : '22px',
                                  }}
                                >
                                  <Plus size={isMobile ? 14 : 12} />
                                </button>
                              </div>
                              <span style={styles.cartItemTotal}>Rs. {item.price_at_order * item.quantity}</span>
                              <button
                                onClick={() => handleRemoveFromCart(item.id)}
                                style={{
                                  ...styles.cartDeleteBtn,
                                  padding: isMobile ? '8px' : '0px',
                                }}
                              >
                                <Trash2 size={isMobile ? 18 : 14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {isMobile && (
                    <div style={{ marginBottom: 8, flexShrink: 0 }}>
                      <label style={styles.label}>General Order Notes</label>
                      <textarea
                        placeholder="e.g. Serve dessert at the end"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        rows={2}
                        style={{ width: '100%', marginTop: '4px', fontSize: '13px' }}
                      />
                    </div>
                  )}

                  {!isMobile && (
                    <div style={styles.cartSummary}>
                      <div style={{ marginBottom: 16 }}>
                        <label style={styles.label}>General Order Notes</label>
                        <textarea
                          placeholder="e.g. Serve dessert at the end"
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          rows={2}
                          style={{ width: '100%', marginTop: '6px', fontSize: '13px' }}
                        />
                      </div>

                      <div style={styles.subtotalRow}>
                        <span>Total Bill Amount:</span>
                        <strong style={{ fontSize: '20px', color: 'var(--primary)' }}>
                          Rs. {confirmedItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0) + cart.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0)}
                        </strong>
                      </div>

                      <div style={{ ...styles.actionBtnRow, gridTemplateColumns: '1fr 1.2fr 1.5fr' }}>
                        <button
                          onClick={() => setCurrentStep(2)}
                          style={styles.saveDraftBtn}
                        >
                          Back
                        </button>
                        <button
                          onClick={() => handleSubmitOrder(false)}
                          disabled={loading || cart.length === 0}
                          style={styles.saveDraftBtn}
                        >
                          Save Draft
                        </button>
                        <button
                          onClick={() => handleSubmitOrder(true)}
                          disabled={loading || cart.length === 0}
                          style={styles.confirmBtn}
                        >
                          {loading ? 'Sending...' : 'Kitchen Send'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isMobile && (
                <div style={styles.mobileBottomBar}>
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Bill Amount:</span>
                      <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
                        Rs. {confirmedItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0) + cart.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0)}
                      </strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px', width: '100%' }}>
                      <button
                        onClick={() => setCurrentStep(2)}
                        style={{ ...styles.backBtn, padding: '10px', fontSize: '12px' }}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => handleSubmitOrder(false)}
                        disabled={loading || cart.length === 0}
                        style={{ ...styles.backBtn, padding: '10px', fontSize: '12px', opacity: cart.length === 0 ? 0.5 : 1 }}
                      >
                        Save Draft
                      </button>
                      <button
                        onClick={() => handleSubmitOrder(true)}
                        disabled={loading || cart.length === 0}
                        style={{ ...styles.nextBtn, padding: '10px', fontSize: '12px', opacity: (loading || cart.length === 0) ? 0.5 : 1 }}
                      >
                        {loading ? 'Sending...' : 'Kitchen Send'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="responsive-pos-split">
          <div style={styles.leftColumn}>
            {!isOrdering ? (
              <div style={styles.panel} className="glass">
                <h2 style={styles.sectionHeading}>Dining Tables</h2>
                {loading && tables.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 24px', width: '100%', boxSizing: 'border-box' }}>
                    <RefreshCw size={24} className="spin" color="var(--primary)" />
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading dining tables...</p>
                  </div>
                ) : tables.length === 0 ? (
                  <div style={styles.emptyState}>No tables registered.</div>
                ) : (
                  <div style={styles.tablesGrid}>
                    {tables.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleTableSelect(t, true)}
                        style={{
                          ...styles.tableBtn,
                          borderColor: selectedTable?.id === t.id ? 'var(--primary)' : 'var(--border-color)',
                          backgroundColor: t.status === 'occupied' 
                            ? 'rgba(217, 119, 6, 0.08)' 
                            : t.status === 'reserved' 
                              ? 'rgba(79, 70, 229, 0.08)'
                              : 'rgba(0, 0, 0, 0.02)',
                          boxShadow: selectedTable?.id === t.id ? 'var(--shadow-glow)' : 'none',
                        }}
                      >
                        <span style={styles.tableNum}>{t.table_number}</span>
                        <span style={{
                          ...styles.tableStatusText,
                          color: t.status === 'occupied' ? 'var(--primary)' : 
                                 t.status === 'reserved' ? 'var(--secondary)' : 'var(--success)'
                        }}>
                          {t.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cap: {t.seating_capacity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              selectedTable && (
                <div className="glass" style={{ ...styles.panel, flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', height: '100%', minHeight: 0 }}>
                  <div style={styles.menuHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button 
                        onClick={handleCancelOrdering}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        className="glow-hover"
                      >
                        ← Back to Tables
                      </button>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Table {selectedTable.table_number} Menu</span>
                        <h2 style={{ ...styles.sectionHeading, marginBottom: 0 }}>Browse Restaurant Menu</h2>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={handleAddSelectedToCart}
                        disabled={Object.keys(selectedItemsMap).length === 0}
                        style={{
                          backgroundColor: Object.keys(selectedItemsMap).length === 0 ? 'var(--bg-surface-elevated)' : 'var(--primary)',
                          color: Object.keys(selectedItemsMap).length === 0 ? 'var(--text-muted)' : 'var(--bg-main)',
                          border: '1px solid ' + (Object.keys(selectedItemsMap).length === 0 ? 'var(--border-color)' : 'var(--primary)'),
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 16px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: Object.keys(selectedItemsMap).length === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'var(--transition-fast)',
                          boxShadow: Object.keys(selectedItemsMap).length === 0 ? 'none' : 'var(--shadow-glow)'
                        }}
                      >
                        <Plus size={16} />
                        Add Selected ({Object.keys(selectedItemsMap).length})
                      </button>
                      <div style={styles.searchBar}>
                        <Search size={16} color="var(--text-muted)" style={{ marginRight: 8 }} />
                        <input
                          type="text"
                          placeholder="Search menu..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={styles.searchInput}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={styles.categoriesContainer}>
                    <button
                      onClick={() => setSelectedCategoryId('all')}
                      style={{
                        ...styles.categoryTab,
                        backgroundColor: selectedCategoryId === 'all' ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                        color: selectedCategoryId === 'all' ? '#fff' : 'var(--text-main)',
                      }}
                    >
                      All Items
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategoryId(c.id)}
                        style={{
                          ...styles.categoryTab,
                          backgroundColor: selectedCategoryId === c.id ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                          color: selectedCategoryId === c.id ? '#fff' : 'var(--text-main)',
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  <div style={styles.menuGridContainer}>
                    {filteredMenuItems.length === 0 ? (
                      <div style={styles.emptyState}>No items match your search.</div>
                    ) : (
                      <div style={styles.menuItemsGrid}>
                        {filteredMenuItems.map((item) => {
                          const isSelected = selectedItemsMap[item.id] !== undefined;
                          return (
                            <div 
                              key={item.id} 
                              onClick={() => toggleItemSelection(item)}
                              style={{
                                ...styles.menuItemCard,
                                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-surface)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                height: '100%',
                                cursor: 'pointer'
                              }}
                              className="glow-hover"
                            >
                              <div>
                                <div style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  zIndex: 10,
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '4px',
                                  border: '2px solid ' + (isSelected ? 'var(--primary)' : 'var(--border-color)'),
                                  backgroundColor: isSelected ? 'var(--primary)' : 'rgba(0, 0, 0, 0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'var(--transition-fast)'
                                }}>
                                  {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                                </div>

                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.name} style={styles.itemImg} />
                                ) : (
                                  <div style={styles.itemNoImg}>
                                    <Image size={20} color="var(--text-muted)" />
                                  </div>
                                )}
                                <div style={styles.itemInfo}>
                                  <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{item.name}</h4>
                                  <span style={styles.itemPrice}>Rs. {item.price}</span>
                                </div>
                              </div>

                              {isSelected && (
                                <div 
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 12px',
                                    borderTop: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-surface-elevated)',
                                    gap: '8px',
                                    borderBottomLeftRadius: 'var(--radius-sm)',
                                    borderBottomRightRadius: 'var(--radius-sm)'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                                    <button 
                                      onClick={() => updateSelectionQty(item.id, selectedItemsMap[item.id] - 1)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--bg-surface)',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Minus size={10} />
                                    </button>
                                    <span style={{ fontSize: '12px', fontWeight: '700' }}>
                                      {selectedItemsMap[item.id]}
                                    </span>
                                    <button 
                                      onClick={() => updateSelectionQty(item.id, selectedItemsMap[item.id] + 1)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--bg-surface)',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Plus size={10} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          <div style={styles.rightColumn}>
            <div style={{ ...styles.panel, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }} className="glass">
              {selectedTable ? (
                !isOrdering ? (
                  renderTableDetails()
                ) : (
                  (activeOrder || isOrdering) ? (
                    <div style={styles.cartContainer}>
                      <div style={styles.cartHeader}>
                        <div>
                          <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-serif)', color: 'var(--text-main)' }}>Table {selectedTable.table_number} Order</h2>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status: {activeOrder ? activeOrder.status.toUpperCase() : 'NEW DRAFT'}</span>
                        </div>
                      </div>

                      <div style={styles.cartItemsList}>
                        {confirmedItems.length === 0 && cart.length === 0 ? (
                          <div style={styles.emptyCart}>
                            <ShoppingCart size={32} color="var(--border-color)" style={{ marginBottom: 8 }} />
                            <p>Your order card is empty.</p>
                            <p style={{ fontSize: '12px' }}>Tap menu items to add.</p>
                          </div>
                        ) : (
                          <>
                            {confirmedItems.map((item) => (
                              <div key={item.id} style={{ ...styles.cartItemRow, opacity: 0.85, backgroundColor: 'rgba(16, 185, 129, 0.02)', borderLeft: '3px solid var(--success)' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={styles.cartItemName}>
                                    {item.item_name}
                                    <span style={{
                                      marginLeft: 8,
                                      fontSize: '9px',
                                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                      color: 'var(--success)',
                                      padding: '2px 6px',
                                      borderRadius: 'var(--radius-full)',
                                      fontWeight: '700'
                                    }}>COOKING</span>
                                  </div>
                                  <div style={styles.cartItemPrice}>Rs. {item.price_at_order} each</div>
                                  {item.notes && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>* {item.notes}</div>}
                                </div>
                                <div style={styles.cartItemQuantityArea}>
                                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '12px' }}>Qty: {item.quantity}</span>
                                  <span style={styles.cartItemTotal}>Rs. {item.price_at_order * item.quantity}</span>
                                </div>
                              </div>
                            ))}

                            {cart.map((item) => (
                              <div key={item.id} style={{ ...styles.cartItemRow, borderLeft: '3px solid var(--primary)', backgroundColor: 'rgba(245, 158, 11, 0.01)' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={styles.cartItemName}>
                                    {item.item_name}
                                    <span style={{
                                      marginLeft: 8,
                                      fontSize: '9px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                      color: 'var(--primary)',
                                      padding: '2px 6px',
                                      borderRadius: 'var(--radius-full)',
                                      fontWeight: '700'
                                    }}>NEW</span>
                                  </div>
                                  <div style={styles.cartItemPrice}>Rs. {item.price_at_order} each</div>
                                  
                                  <input
                                    type="text"
                                    placeholder="Instructions (e.g. no spicy)"
                                    value={item.notes || ''}
                                    onChange={(e) => handleItemNotesChange(item.id, e.target.value)}
                                    style={styles.itemNoteInput}
                                  />
                                </div>

                                <div style={styles.cartItemQuantityArea}>
                                  <div style={styles.qtyControls}>
                                    <button 
                                      onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                                      style={styles.cartQtyBtn}
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <span style={{ width: '20px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>
                                      {item.quantity}
                                    </span>
                                    <button 
                                      onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                                      style={styles.cartQtyBtn}
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                  <span style={styles.cartItemTotal}>Rs. {item.price_at_order * item.quantity}</span>
                                  <button
                                    onClick={() => handleRemoveFromCart(item.id)}
                                    style={styles.cartDeleteBtn}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      <div style={styles.cartSummary}>
                        <div style={{ marginBottom: 16 }}>
                          <label style={styles.label}>General Order Notes</label>
                          <textarea
                            placeholder="e.g. Serve dessert at the end"
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            rows={2}
                            style={{ width: '100%', marginTop: '6px', fontSize: '13px' }}
                          />
                        </div>

                        <div style={styles.subtotalRow}>
                          <span>Total Bill Amount:</span>
                          <strong style={{ fontSize: '20px', color: 'var(--primary)' }}>
                            Rs. {confirmedItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0) + cart.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0)}
                          </strong>
                        </div>

                        <div style={{ ...styles.actionBtnRow, gridTemplateColumns: '1fr 1.2fr 1.5fr' }}>
                          <button
                            onClick={handleCancelOrdering}
                            style={styles.saveDraftBtn}
                          >
                            Back
                          </button>
                          <button
                            onClick={() => handleSubmitOrder(false)}
                            disabled={loading || cart.length === 0}
                            style={styles.saveDraftBtn}
                          >
                            Save Draft
                          </button>
                          <button
                            onClick={() => handleSubmitOrder(true)}
                            disabled={loading || cart.length === 0}
                            style={styles.confirmBtn}
                          >
                            {loading ? 'Confirming...' : 'Kitchen Send'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.emptyDetails}>
                      <Info size={40} color="var(--border-color)" style={{ marginBottom: 12 }} />
                      <h3>No Active Order</h3>
                      <button onClick={handleBeginOrdering} style={styles.startOrderBtn}>
                        Start Order
                      </button>
                    </div>
                  )
                )
              ) : (
                <div style={styles.emptyDetails}>
                  <Info size={40} color="var(--border-color)" style={{ marginBottom: 12 }} />
                  <h3>Select a Dining Table</h3>
                  <p style={{ marginTop: 8, fontSize: '13px' }}>Choose a table from the left panel to begin ordering.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toast: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: 'var(--success)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    alignItems: 'center',
    fontWeight: '600',
    zIndex: 999,
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    height: '100%',
    overflowY: 'hidden',
  },
  rightColumn: {
    height: '100%',
  },
  panel: {
    padding: '24px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeading: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-main)',
    marginBottom: '16px',
  },
  tablesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '12px',
  },
  tableBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '12px 6px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    color: 'var(--text-main)',
    transition: 'var(--transition-fast)',
  },
  tableNum: {
    fontSize: '15px',
    fontWeight: '600',
  },
  tableStatusText: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  menuHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    width: '200px',
  },
  searchInput: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    padding: 0,
    fontSize: '13px',
    width: '100%',
  },
  categoriesContainer: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '8px',
    flexShrink: 0,
  },
  categoryTab: {
    padding: '8px 14px',
    borderRadius: 'var(--radius-full)',
    border: 'none',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'var(--transition-fast)',
  },
  menuGridContainer: {
    flex: 1,
    overflowY: 'auto',
  },
  menuItemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '12px',
  },
  menuItemCard: {
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    transition: 'var(--transition-fast)',
  },
  itemImg: {
    width: '100%',
    height: '80px',
    objectFit: 'cover',
  },
  itemNoImg: {
    width: '100%',
    height: '80px',
    backgroundColor: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid var(--border-color)',
  },
  itemInfo: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    flex: 1,
    gap: '4px',
  },
  itemPrice: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--primary)',
  },
  emptyState: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13px',
    padding: '40px 0',
  },
  emptyDetails: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  startOrderBtn: {
    backgroundColor: 'var(--primary)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cartContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  cartItemsList: {
    flex: 1,
    overflowY: 'auto',
    margin: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingRight: '4px',
  },
  emptyCart: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  cartItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    gap: '16px',
  },
  cartItemName: {
    fontSize: '13px',
    fontWeight: '600',
  },
  cartItemPrice: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  itemNoteInput: {
    width: '100%',
    marginTop: '8px',
    padding: '6px 10px',
    fontSize: '11px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
  },
  cartItemQuantityArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
  },
  qtyControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  cartQtyBtn: {
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    cursor: 'pointer',
  },
  cartItemTotal: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--primary)',
  },
  cartDeleteBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0,
    marginTop: '2px',
    transition: 'var(--transition-fast)',
  },
  cartSummary: {
    borderTop: '1px solid var(--border-color)',
    paddingTop: '16px',
    flexShrink: 0,
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  subtotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '16px',
  },
  actionBtnRow: {
    display: 'grid',
    gap: '12px',
  },
  saveDraftBtn: {
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-main)',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: 'var(--success)',
    color: '#fff',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  mobileStepperHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '16px',
  },
  mobileStepperStep: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  stepNumber: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
  },
  tableDetailsPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '24px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
  },
  mobileBottomBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'var(--bg-surface)',
    borderTop: '1px solid var(--border-color)',
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
    boxShadow: '0 -4px 10px rgba(0, 0, 0, 0.05)',
  },
  mobileBottomInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  mobileBottomActions: {
    display: 'flex',
    gap: '10px',
  },
  backBtn: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-main)',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  nextBtn: {
    padding: '10px 20px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#fff',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  detailCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
    marginTop: '16px',
  },
};
