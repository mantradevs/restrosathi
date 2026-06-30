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

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (supabase) {
      loadData();
    }
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

  const handleTableSelect = async (table: any) => {
    if (!supabase) return;
    setSelectedTable(table);
    setCart([]);
    setConfirmedItems([]);
    setActiveOrder(null);
    setActiveSession(null);
    setOrderNotes('');
    setSessionOrders([]);
    setPosRightTab('cart');

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

  const handleStartOrder = async () => {
    if (!supabase || !selectedTable) return;
    
    setLoading(true);
    try {
      let session = activeSession;

      // If no active session, create one and mark table occupied
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
        setSelectedTable({ ...selectedTable, status: 'occupied' });
      }

      // Check if an active order already exists in this session
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('session_id', session.id)
        .in('status', ['pending', 'confirmed'])
        .limit(1);

      if (existingOrders && existingOrders.length > 0) {
        showToast('Active order already exists for this session.');
        handleTableSelect(selectedTable);
        return;
      }

      // Create a new order in the session
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          table_id: selectedTable.id,
          session_id: session.id,
          status: 'pending',
          payment_status: 'unpaid',
          total_amount: 0,
          created_by: user.name,
          notes: ''
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      setActiveOrder(orderData);
      setCart([]);
      setConfirmedItems([]);
      setOrderNotes('');
      setPosRightTab('cart');
      loadData();
      
      // Refresh session orders
      const { data: allOrders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false });
      setSessionOrders(allOrders || []);

      showToast('New order started for ' + selectedTable.table_number);
    } catch (err: any) {
      showToast(err.message || 'Error initializing order', false);
    } finally {
      setLoading(false);
    }
  };

  // Cart operations (Only available if order status is pending!)
  const handleAddToCart = async (menuItem: any) => {
    if (!supabase || !selectedTable) return;

    let currentOrder = activeOrder;
    let currentSession = activeSession;

    // Retrieve/Ensure table session exists
    if (!currentSession) {
      setLoading(true);
      try {
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
        currentSession = sessionData;
        setActiveSession(currentSession);
        setSelectedTable({ ...selectedTable, status: 'occupied' });
      } catch (err: any) {
        showToast(err.message || 'Error starting session', false);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    // Double-check if an active order already exists in this session
    if (!currentOrder && currentSession) {
      setLoading(true);
      try {
        const { data: existingOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('session_id', currentSession.id)
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingOrders && existingOrders.length > 0) {
          currentOrder = existingOrders[0];
          setActiveOrder(currentOrder);

          // Load items
          const { data: itemsData } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', currentOrder.id);
          const dbItems = itemsData || [];
          const pending = dbItems.filter((it: any) => (it.status || 'confirmed') === 'pending');
          const confirmed = dbItems.filter((it: any) => (it.status || 'confirmed') === 'confirmed');
          setCart(pending);
          setConfirmedItems(confirmed);
        }
      } catch (err: any) {
        showToast(err.message || 'Error checking existing order', false);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    // If still no active order, let's create one!
    if (!currentOrder && currentSession) {
      setLoading(true);
      try {
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({
            table_id: selectedTable.id,
            session_id: currentSession.id,
            status: 'pending',
            payment_status: 'unpaid',
            total_amount: 0,
            created_by: user.name,
            notes: ''
          })
          .select()
          .single();
        if (orderErr) throw orderErr;

        currentOrder = orderData;
        setActiveOrder(currentOrder);
        setOrderNotes('');
        setPosRightTab('cart');
        loadData();

        // Refresh session orders list
        const { data: allOrders } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('session_id', currentSession.id)
          .order('created_at', { ascending: false });
        setSessionOrders(allOrders || []);
      } catch (err: any) {
        showToast(err.message || 'Error starting order', false);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    const existingCartItem = cart.find(item => item.menu_item_id === menuItem.id);
    if (existingCartItem) {
      setCart(cart.map(item => 
        item.menu_item_id === menuItem.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([
        ...cart,
        {
          id: `temp-${Date.now()}`,
          order_id: currentOrder!.id,
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          price_at_order: menuItem.price || 0,
          quantity: 1,
          notes: ''
        }
      ]);
    }
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
    if (!supabase || !activeOrder || !selectedTable) return;

    setLoading(true);
    try {
      // 1. Delete all current PENDING order items in DB for this order
      const { error: delErr } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', activeOrder.id)
        .eq('status', 'pending');
      if (delErr) throw delErr;

      // 2. Insert the new ones from cart
      const dbItems = cart.map(item => ({
        order_id: activeOrder.id,
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

      // 3. Recalculate total bill: sum of all confirmed items + current cart items
      const confirmedTotal = confirmedItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0);
      const cartTotal = cart.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0);
      const totalBill = confirmedTotal + cartTotal;

      // 4. Update the Order table (updating status if confirmed)
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
        .eq('id', activeOrder.id);
      
      if (updErr) throw updErr;

      if (isConfirm) {
        showToast('Order confirmed and sent to kitchen');
      } else {
        showToast('Draft saved successfully');
      }

      // Reload/Refresh the table details to sync state
      await handleTableSelect(selectedTable);
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

  return (
    <div className="responsive-pos-container">
      {/* Toast Alert */}
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

      <div className="responsive-pos-split">
        {/* LEFT COLUMN: Table Grid & Menu Selector */}
        <div style={styles.leftColumn}>
          {/* Tables Selection Grid */}
          <div style={styles.panel} className="glass">
            <h2 style={styles.sectionHeading}>Dining Tables</h2>
            <div style={styles.tablesGrid}>
              {tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTableSelect(t)}
                  style={{
                    ...styles.tableBtn,
                    borderColor: selectedTable?.id === t.id ? 'var(--primary)' : 'var(--border-color)',
                    backgroundColor: t.status === 'occupied' 
                      ? 'rgba(217, 119, 6, 0.08)' 
                      : t.status === 'reserved' 
                        ? 'rgba(79, 70, 229, 0.08)'
                        : 'rgba(0, 0, 0, 0.02)',
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
          </div>

          {/* Menu Items Browser */}
          {selectedTable && (
            <div className="glass" style={{ ...styles.panel, flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
              <div style={styles.menuHeader}>
                <h2 style={styles.sectionHeading}>Browse Restaurant Menu</h2>
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

              {/* Categories Tabs */}
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

              {/* Menu items list */}
              <div style={styles.menuGridContainer}>
                {filteredMenuItems.length === 0 ? (
                  <div style={styles.emptyState}>No items match your search.</div>
                ) : (
                  <div style={styles.menuItemsGrid}>
                    {filteredMenuItems.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleAddToCart(item)}
                        style={styles.menuItemCard}
                        className="glow-hover"
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} style={styles.itemImg} />
                        ) : (
                          <div style={styles.itemNoImg}>
                            <Image size={20} color="var(--text-muted)" />
                          </div>
                        )}
                        <div style={styles.itemInfo}>
                          <h4 style={{ fontSize: '13px', fontWeight: '600' }}>{item.name}</h4>
                          <span style={styles.itemPrice}>Rs. {item.price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active Cart / Order Panel */}
        <div style={styles.rightColumn}>
          <div style={{ ...styles.panel, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }} className="glass">
            {selectedTable ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                {/* Tabs Selector at the top of Right Column */}
                <div style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--border-color)',
                  marginBottom: '16px',
                  flexShrink: 0
                }}>
                  <button
                    onClick={() => setPosRightTab('cart')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: posRightTab === 'cart' ? '3px solid var(--primary)' : 'none',
                      color: posRightTab === 'cart' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    Active Cart
                  </button>
                  <button
                    onClick={() => setPosRightTab('history')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: posRightTab === 'history' ? '3px solid var(--primary)' : 'none',
                      color: posRightTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'var(--transition-fast)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    Session Orders
                    {sessionOrders.length > 0 && (
                      <span style={{
                        backgroundColor: posRightTab === 'history' ? 'var(--primary)' : 'var(--border-color)',
                        color: posRightTab === 'history' ? '#fff' : 'var(--text-muted)',
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontWeight: '700'
                      }}>
                        {sessionOrders.length}
                      </span>
                    )}
                  </button>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {posRightTab === 'cart' ? (
                    activeOrder ? (
                      <div style={styles.cartContainer}>
                        {/* Cart Header */}
                        <div style={styles.cartHeader}>
                          <div>
                            <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-serif)' }}>{selectedTable.table_number} Order</h2>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status: {activeOrder.status.toUpperCase()}</span>
                          </div>
                        </div>

                        {/* Items List */}
                        <div style={styles.cartItemsList}>
                          {confirmedItems.length === 0 && cart.length === 0 ? (
                            <div style={styles.emptyCart}>
                              <ShoppingCart size={32} color="var(--border-color)" style={{ marginBottom: 8 }} />
                              <p>Your order card is empty.</p>
                              <p style={{ fontSize: '12px' }}>Tap menu items to add.</p>
                            </div>
                          ) : (
                            <>
                              {/* 1. Confirmed items (Read-Only) */}
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

                              {/* 2. New pending/draft items (Editable) */}
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
                                    
                                    {/* Individual Item Note input */}
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

                        {/* Summary & Buttons */}
                        <div style={styles.cartSummary}>
                          {/* General Order Notes */}
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

                          {/* Dual Action Buttons (Save Draft vs Confirm Order) */}
                          <div style={styles.actionBtnRow}>
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
                              {loading ? 'Confirming...' : 'Confirm & Kitchen Send'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.startOrderView}>
                        <Clipboard size={48} color="var(--primary)" style={{ marginBottom: 16 }} />
                        <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-serif)', marginBottom: 8 }}>
                          {activeSession ? 'Add Another Order' : 'No Active Order'} — {selectedTable.table_number}
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: 20, textAlign: 'center' }}>
                          {activeSession 
                            ? `This table has ${sessionOrders.filter(o => o.status !== 'cancelled').length} order(s) in this session. Start a new order to add more items.`
                            : 'This table is currently available. Start an order to open the restaurant menu.'
                          }
                        </p>
                        <button onClick={handleStartOrder} style={styles.startOrderBtn} className="glow-hover">
                          {activeSession ? 'Start Additional Order' : 'Start New Order'}
                        </button>
                      </div>
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>
                          Session Orders for {selectedTable.table_number}
                        </h3>
                      </div>
                      
                      {sessionOrders.length === 0 ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 1,
                          color: 'var(--text-muted)',
                          fontSize: '13px',
                          padding: '40px 0'
                        }}>
                          <Clipboard size={32} color="var(--border-color)" style={{ marginBottom: 8 }} />
                          <p>No orders in this session yet.</p>
                        </div>
                      ) : (
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                          {sessionOrders.map((o) => (
                            <div 
                              key={o.id}
                              style={{
                                padding: '16px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-surface-elevated)',
                                border: '1px solid var(--border-color)',
                                fontSize: '13px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>Order #{o.id.slice(0, 8)}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                                    {new Date(o.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    backgroundColor: o.status === 'completed' ? 'rgba(16, 185, 129, 0.12)' :
                                                    o.status === 'confirmed' ? 'rgba(99, 102, 241, 0.12)' :
                                                    o.status === 'pending' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                    color: o.status === 'completed' ? 'var(--success)' :
                                           o.status === 'confirmed' ? 'var(--secondary)' :
                                           o.status === 'pending' ? 'var(--primary)' : 'var(--danger)',
                                    textTransform: 'uppercase'
                                  }}>
                                    {o.status}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Order items list breakdown */}
                              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                                {o.order_items && o.order_items.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {o.order_items.map((item: any) => (
                                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-main)' }}>{item.quantity}x {item.item_name}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>Rs. {item.price_at_order * item.quantity}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No items listed.</span>
                                )}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Billed Total</span>
                                <strong style={{ color: 'var(--primary)', fontSize: '14px' }}>Rs. {o.total_amount}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
  startOrderView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
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
  lockBanner: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    marginTop: '12px',
    fontWeight: '500',
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
    gridTemplateColumns: '1fr 1.3fr',
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
};
