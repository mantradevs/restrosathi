'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { 
  Plus, Edit2, Trash2, Check, RefreshCw, ShoppingBag, 
  Layers, Users, DollarSign, Eye, XCircle, Info, Image, Clipboard, TrendingUp, BarChart2, Settings
} from 'lucide-react';
import KotPrintView, { BillPreviewModal } from './KotPrintView';

interface OwnerDashboardProps {
  user: { id: string; username: string; name: string; role: 'owner' | 'admin' | 'staff' };
}

export default function OwnerDashboard({ user }: OwnerDashboardProps) {
  // Navigation tabs - Analytics is default for Owner
  const [activeTab, setActiveTab] = useState<'analytics' | 'orders' | 'tables' | 'menu' | 'registry' | 'kot'>('analytics');

  // Common Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]); // Admin & Staff

  // KOT Format Settings State
  const [kotSettings, setKotSettings] = useState({
    restaurant_name: 'RestroSathi',
    header_text: 'KITCHEN ORDER TICKET',
    footer_text: 'Thank you! Visit again.',
    show_price: true
  });

  // Form States - User Registry
  const [registryName, setRegistryName] = useState('');
  const [registryUsername, setRegistryUsername] = useState('');
  const [registryPassword, setRegistryPassword] = useState('');
  const [registryRole, setRegistryRole] = useState<'admin' | 'staff'>('staff');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form States - Tables
  const [tableNumber, setTableNumber] = useState('');
  const [seatingCapacity, setSeatingCapacity] = useState('4');
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  // Form States - Categories & Menu
  const [newCategoryName, setNewCategoryName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [orderQueueFilter, setOrderQueueFilter] = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('confirmed');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Order Details / Edit Modal State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editOrderNotes, setEditOrderNotes] = useState('');
  const [printOrder, setPrintOrder] = useState<any | null>(null);
  const [printItems, setPrintItems] = useState<any[]>([]);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [billingTab, setBillingTab] = useState<'full' | 'split'>('full');
  const [splitSelectedItems, setSplitSelectedItems] = useState<Record<string, number>>({});

  // Analytics calculated data
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    completedOrders: 0,
    averageBill: 0,
    topItems: [] as { name: string; count: number; revenue: number }[],
    tableUsage: [] as { tableNumber: string; count: number; revenue: number }[]
  });

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (supabase) {
      fetchData();
      fetchKotSettings();
    }
  }, [activeTab]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab, orderQueueFilter]);

  const showToast = (message: string, isSuccess = true) => {
    if (isSuccess) {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      setError(message);
      setTimeout(() => setError(null), 4000);
    }
  };

  const fetchKotSettings = async () => {
    if (!supabase) return;
    try {
      const { data: kData, error: kErr } = await supabase
        .from('kot_settings')
        .select('*')
        .eq('id', 'default')
        .limit(1);
      
      if (!kErr && kData && kData.length > 0) {
        setKotSettings({
          restaurant_name: kData[0].restaurant_name,
          header_text: kData[0].header_text,
          footer_text: kData[0].footer_text,
          show_price: kData[0].show_price
        });
      }
    } catch (err) {
      console.error('Failed to load KOT settings:', err);
    }
  };

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Always fetch order, table, and menu data to calculate live metrics
      const { data: oData, error: oErr } = await supabase
        .from('orders')
        .select('*, restaurant_tables(table_number)')
        .order('created_at', { ascending: false });
      if (oErr) throw oErr;
      const fetchedOrders = oData || [];
      setOrders(fetchedOrders);

      const { data: tData, error: tErr } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number', { ascending: true });
      if (tErr) throw tErr;
      setTables(tData || []);

      const { data: cData, error: cErr } = await supabase
        .from('menu_categories')
        .select('*')
        .order('name', { ascending: true });
      if (cErr) throw cErr;
      setCategories(cData || []);

      const { data: mData, error: mErr } = await supabase
        .from('menu_items')
        .select('*, menu_categories(name)')
        .order('name', { ascending: true });
      if (mErr) throw mErr;
      setMenuItems(mData || []);

      if (activeTab === 'registry') {
        const { data: uData, error: uErr } = await supabase
          .from('restaurant_users')
          .select('*')
          .in('role', ['admin', 'staff'])
          .order('role', { ascending: true })
          .order('name', { ascending: true });
        if (uErr) throw uErr;
        setUsersList(uData || []);
      }

      if (activeTab === 'analytics') {
        // Fetch completed order items to calculate top items
        const { data: itemData, error: itemErr } = await supabase
          .from('order_items')
          .select('*, orders!inner(status, table_id)');
        
        if (itemErr) throw itemErr;
        calculateAnalytics(fetchedOrders, itemData || []);
      }

      if (activeTab === 'kot') {
        await fetchKotSettings();
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading records', false);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (allOrders: any[], allItems: any[]) => {
    const completed = allOrders.filter(o => o.status === 'completed');
    const revenue = completed.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const avg = completed.length > 0 ? Math.round(revenue / completed.length) : 0;

    // Calculate Top Items
    const itemMap: Record<string, { count: number; revenue: number }> = {};
    allItems.forEach(item => {
      if (item.orders && item.orders.status === 'completed') {
        if (!itemMap[item.item_name]) {
          itemMap[item.item_name] = { count: 0, revenue: 0 };
        }
        itemMap[item.item_name].count += item.quantity;
        itemMap[item.item_name].revenue += item.price_at_order * item.quantity;
      }
    });

    const topItems = Object.entries(itemMap)
      .map(([name, val]) => ({ name, count: val.count, revenue: val.revenue }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate Table Usage & Revenue
    const tableMap: Record<string, { count: number; revenue: number }> = {};
    allOrders.forEach(o => {
      if (o.status === 'completed') {
        const tableNum = o.restaurant_tables?.table_number || 'N/A';
        if (!tableMap[tableNum]) {
          tableMap[tableNum] = { count: 0, revenue: 0 };
        }
        tableMap[tableNum].count += 1;
        tableMap[tableNum].revenue += o.total_amount || 0;
      }
    });

    const tableUsage = Object.entries(tableMap)
      .map(([tableNumber, val]) => ({ tableNumber, count: val.count, revenue: val.revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    setAnalytics({
      totalRevenue: revenue,
      completedOrders: completed.length,
      averageBill: avg,
      topItems,
      tableUsage
    });
  };

  // KOT Settings Actions
  const handleSaveKotSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('kot_settings')
        .upsert({
          id: 'default',
          restaurant_name: kotSettings.restaurant_name,
          header_text: kotSettings.header_text || 'KITCHEN ORDER TICKET',
          footer_text: kotSettings.footer_text,
          show_price: kotSettings.show_price,
          updated_at: new Date().toISOString()
        });
      if (err) throw err;
      showToast('KOT print format settings updated successfully!');
    } catch (err: any) {
      showToast(err.message || 'Error saving KOT settings', false);
    } finally {
      setLoading(false);
    }
  };

  // User Registry Actions (Owner can add admins & staff)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!registryName || !registryUsername || !registryPassword) {
      showToast('Please fill all fields.', false);
      return;
    }

    setLoading(true);
    try {
      if (editingUserId) {
        const { error: err } = await supabase
          .from('restaurant_users')
          .update({
            name: registryName,
            username: registryUsername.trim().toLowerCase(),
            password: registryPassword,
            role: registryRole
          })
          .eq('id', editingUserId);
        if (err) throw err;
        showToast('User registry updated successfully');
      } else {
        const { error: err } = await supabase
          .from('restaurant_users')
          .insert({
            name: registryName,
            username: registryUsername.trim().toLowerCase(),
            password: registryPassword,
            role: registryRole
          });
        if (err) throw err;
        showToast('User created successfully');
      }

      setRegistryName('');
      setRegistryUsername('');
      setRegistryPassword('');
      setRegistryRole('staff');
      setEditingUserId(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error saving user details', false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (u: any) => {
    setEditingUserId(u.id);
    setRegistryName(u.name);
    setRegistryUsername(u.username);
    setRegistryPassword(u.password);
    setRegistryRole(u.role);
  };

  const handleDeleteUser = async (id: string) => {
    if (id === user.id) {
      showToast('You cannot delete your own profile!', false);
      return;
    }
    if (!supabase) return;
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('restaurant_users')
        .delete()
        .eq('id', id);
      if (err) throw err;
      showToast('User profile removed');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error removing user', false);
    } finally {
      setLoading(false);
    }
  };

  // Table Actions
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!tableNumber) return;

    setLoading(true);
    try {
      if (editingTableId) {
        const { error: err } = await supabase
          .from('restaurant_tables')
          .update({
            table_number: tableNumber,
            seating_capacity: parseInt(seatingCapacity, 10),
          })
          .eq('id', editingTableId);
        if (err) throw err;
        showToast('Table updated');
      } else {
        const { error: err } = await supabase
          .from('restaurant_tables')
          .insert({
            table_number: tableNumber,
            seating_capacity: parseInt(seatingCapacity, 10),
          });
        if (err) throw err;
        showToast('Table created');
      }

      setTableNumber('');
      setSeatingCapacity('4');
      setEditingTableId(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error saving table', false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTable = (t: any) => {
    setEditingTableId(t.id);
    setTableNumber(t.table_number);
    setSeatingCapacity(t.seating_capacity.toString());
  };

  const handleDeleteTable = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('restaurant_tables')
        .delete()
        .eq('id', id);
      if (err) throw err;
      showToast('Table deleted');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting table', false);
    } finally {
      setLoading(false);
    }
  };

  // Category & Menu Management Actions
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newCategoryName) return;
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('menu_categories')
        .insert({ name: newCategoryName.trim() });
      if (err) throw err;
      showToast('Category added successfully');
      setNewCategoryName('');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error creating category', false);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!itemName) return;

    setLoading(true);
    try {
      const priceVal = itemPrice ? parseFloat(itemPrice) : 0;
      const payload = {
        name: itemName,
        price: priceVal,
        image_url: itemImage.trim() || null,
        category_id: itemCategory || null,
        description: itemDescription,
      };

      if (editingMenuItemId) {
        const { error: err } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', editingMenuItemId);
        if (err) throw err;
        showToast('Menu item updated');
      } else {
        const { error: err } = await supabase
          .from('menu_items')
          .insert(payload);
        if (err) throw err;
        showToast('Menu item created');
      }

      setItemName('');
      setItemPrice('');
      setItemImage('');
      setItemCategory('');
      setItemDescription('');
      setEditingMenuItemId(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error saving menu item', false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMenuItem = (item: any) => {
    setEditingMenuItemId(item.id);
    setItemName(item.name);
    setItemPrice(item.price ? item.price.toString() : '');
    setItemImage(item.image_url || '');
    setItemCategory(item.category_id || '');
    setItemDescription(item.description || '');
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);
      if (err) throw err;
      showToast('Menu item deleted');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting menu item', false);
    } finally {
      setLoading(false);
    }
  };

  // Order Details
  const handleViewOrder = async (order: any) => {
    if (!supabase) return;
    setDetailsLoading(true);
    setSelectedOrder(order);
    setSelectedOrderItems([]); // Clear previous order items immediately
    setEditOrderNotes(order.notes || '');
    setIsEditingOrder(false);
    setBillingTab('full');
    setSplitSelectedItems({});

    try {
      const { data, error: err } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
      if (err) throw err;
      setSelectedOrderItems(data || []);
    } catch (err: any) {
      showToast(err.message || 'Error fetching order items', false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          confirmed_by: user.name,
        })
        .eq('id', orderId);
      if (err) throw err;
      showToast('Order confirmed');
      fetchData();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: 'confirmed', confirmed_by: user.name });
      }
    } catch (err: any) {
      showToast(err.message || 'Error confirming order', false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: 'completed' | 'cancelled' | 'pending') => {
    if (!supabase) return;
    setLoading(true);
    try {
      const orderToUpdate = orders.find(o => o.id === orderId);
      
      const updatePayload: any = { status: newStatus };
      if (newStatus === 'completed') {
        updatePayload.payment_status = 'paid';
      }

      const { error: err } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId);
      if (err) throw err;

      // Check if all orders in the session are settled (paid or cancelled)
      if (orderToUpdate?.session_id && (newStatus === 'completed' || newStatus === 'cancelled')) {
        const { data: sessionOrders } = await supabase
          .from('orders')
          .select('id, status, payment_status')
          .eq('session_id', orderToUpdate.session_id);

        const allSettled = sessionOrders?.every(
          o => o.id === orderId || o.payment_status === 'paid' || o.status === 'cancelled'
        );

        if (allSettled) {
          // Close the session and free the table
          await supabase
            .from('table_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user.name })
            .eq('id', orderToUpdate.session_id);

          await supabase
            .from('restaurant_tables')
            .update({ status: 'available' })
            .eq('id', orderToUpdate.table_id);

          showToast('All orders settled — table is now available!');
        } else {
          showToast(`Order marked as ${newStatus}. Other orders still pending on this table.`);
        }
      } else if (orderToUpdate && !orderToUpdate.session_id && (newStatus === 'completed' || newStatus === 'cancelled')) {
        // Legacy orders without session — free table directly
        await supabase
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('id', orderToUpdate.table_id);
        showToast(`Order status updated to ${newStatus}`);
      } else {
        showToast(`Order status updated to ${newStatus}`);
      }

      fetchData();
      setSelectedOrder(null);
    } catch (err: any) {
      showToast(err.message || 'Error updating order status', false);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdateOrderStatus = async (orderIds: string[], newStatus: 'completed' | 'cancelled') => {
    if (!supabase || orderIds.length === 0) return;
    setLoading(true);
    try {
      const updatePayload: any = { status: newStatus };
      if (newStatus === 'completed') {
        updatePayload.payment_status = 'paid';
      }

      // 1. Perform bulk update of all selected orders
      const { error: err } = await supabase
        .from('orders')
        .update(updatePayload)
        .in('id', orderIds);
      
      if (err) throw err;

      // 2. Resolve sessions and tables for the updated orders
      const updatedOrders = orders.filter(o => orderIds.includes(o.id));
      const sessionIds = Array.from(new Set(updatedOrders.map(o => o.session_id).filter(Boolean)));
      const tableIdsWithoutSession = Array.from(new Set(updatedOrders.filter(o => !o.session_id).map(o => o.table_id).filter(Boolean)));

      if (tableIdsWithoutSession.length > 0) {
        await supabase
          .from('restaurant_tables')
          .update({ status: 'available' })
          .in('id', tableIdsWithoutSession);
      }

      for (const sessId of sessionIds) {
        const { data: sessionOrders } = await supabase
          .from('orders')
          .select('id, status, payment_status, table_id')
          .eq('session_id', sessId);

        const allSettled = sessionOrders?.every(
          o => o.payment_status === 'paid' || o.status === 'cancelled'
        );

        if (allSettled && sessionOrders && sessionOrders.length > 0) {
          const tableId = sessionOrders[0].table_id;
          await supabase
            .from('table_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user.name })
            .eq('id', sessId);

          await supabase
            .from('restaurant_tables')
            .update({ status: 'available' })
            .eq('id', tableId);
        }
      }

      showToast(`Successfully updated ${orderIds.length} orders to ${newStatus}`);
      setSelectedOrder(null);
      setSelectedOrderIds([]);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error updating orders', false);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSplitPayment = async () => {
    if (!supabase || !selectedOrder || selectedOrderItems.length === 0) return;

    // Check if any items are selected
    const selectedItemIds = Object.keys(splitSelectedItems);
    const hasSelection = selectedItemIds.some(id => splitSelectedItems[id] > 0);
    if (!hasSelection) {
      showToast('Please select at least one item and quantity to pay.', false);
      return;
    }

    setLoading(true);
    try {
      // 1. Create a new "Split Paid Order"
      const splitTotal = selectedItemIds.reduce((sum, itemId) => {
        const item = selectedOrderItems.find(it => it.id === itemId);
        if (!item) return sum;
        const qtyToPay = Math.min(item.quantity, splitSelectedItems[itemId] || 0);
        return sum + (item.price_at_order * qtyToPay);
      }, 0);

      // Create new completed order
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          table_id: selectedOrder.table_id,
          session_id: selectedOrder.session_id,
          status: 'completed',
          payment_status: 'paid',
          total_amount: splitTotal,
          created_by: selectedOrder.created_by,
          confirmed_by: selectedOrder.confirmed_by || user.name,
          notes: `Split payment from Order #${selectedOrder.id.slice(0, 8)}`
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Process each item
      for (const itemId of selectedItemIds) {
        const item = selectedOrderItems.find(it => it.id === itemId);
        if (!item) continue;
        const qtyToPay = Math.min(item.quantity, splitSelectedItems[itemId] || 0);
        if (qtyToPay <= 0) continue;

        // Insert into the new completed order
        const { error: insErr } = await supabase
          .from('order_items')
          .insert({
            order_id: newOrder.id,
            menu_item_id: item.menu_item_id,
            item_name: item.item_name,
            quantity: qtyToPay,
            price_at_order: item.price_at_order,
            notes: item.notes,
            status: 'confirmed'
          });
        if (insErr) throw insErr;

        // Update the original order's item
        const remainingQty = item.quantity - qtyToPay;
        if (remainingQty <= 0) {
          // Delete from original order
          const { error: delErr } = await supabase
            .from('order_items')
            .delete()
            .eq('id', item.id);
          if (delErr) throw delErr;
        } else {
          // Update quantity in original order
          const { error: updErr } = await supabase
            .from('order_items')
            .update({ quantity: remainingQty })
            .eq('id', item.id);
          if (updErr) throw updErr;
        }
      }

      // 3. Recalculate and update the original active order total
      const newActiveTotal = selectedOrder.total_amount - splitTotal;
      
      // If no items remain in the original active order, we complete it!
      const remainingItemsCount = selectedOrderItems.reduce((count, item) => {
        const qtyToPay = Math.min(item.quantity, splitSelectedItems[item.id] || 0);
        return count + (item.quantity - qtyToPay);
      }, 0);

      if (remainingItemsCount <= 0) {
        // Complete the original active order
        const { error: updErr } = await supabase
          .from('orders')
          .update({
            total_amount: 0,
            status: 'completed',
            payment_status: 'paid'
          })
          .eq('id', selectedOrder.id);
        if (updErr) throw updErr;

        // Close the session and free the table since everything is paid!
        if (selectedOrder.session_id) {
          await supabase
            .from('table_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user.name })
            .eq('id', selectedOrder.session_id);

          await supabase
            .from('restaurant_tables')
            .update({ status: 'available' })
            .eq('id', selectedOrder.table_id);

          showToast('All items paid! Table is now available.');
        }
        setSelectedOrder(null);
      } else {
        // Update original order with remaining amount
        const { error: updErr } = await supabase
          .from('orders')
          .update({ total_amount: newActiveTotal })
          .eq('id', selectedOrder.id);
        if (updErr) throw updErr;

        showToast(`Processed split payment of Rs. ${splitTotal}. Remaining items stay on the table.`);
        
        // Reload current order details
        await handleViewOrder({ ...selectedOrder, total_amount: newActiveTotal });
      }

      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error processing split payment', false);
    } finally {
      setLoading(false);
    }
  };

  // Edit order items
  const handleQuantityChange = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setSelectedOrderItems(selectedOrderItems.filter(item => item.id !== itemId));
    } else {
      setSelectedOrderItems(selectedOrderItems.map(item => 
        item.id === itemId ? { ...item, quantity: newQty } : item
      ));
    }
  };

  const handleAddItemToOrder = (menuItem: any) => {
    const exists = selectedOrderItems.find(item => item.menu_item_id === menuItem.id);
    if (exists) {
      setSelectedOrderItems(selectedOrderItems.map(item => 
        item.menu_item_id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setSelectedOrderItems([
        ...selectedOrderItems,
        {
          id: `temp-${Date.now()}-${Math.random()}`,
          order_id: selectedOrder.id,
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          price_at_order: menuItem.price || 0,
          quantity: 1,
          notes: ''
        }
      ]);
    }
  };

  const handleSaveModifiedOrder = async () => {
    if (!supabase || !selectedOrder) return;
    setLoading(true);
    try {
      const { error: delErr } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', selectedOrder.id);
      if (delErr) throw delErr;

      const cleanItems = selectedOrderItems.map(({ id, ...rest }) => ({
        order_id: rest.order_id,
        menu_item_id: rest.menu_item_id,
        item_name: rest.item_name,
        price_at_order: rest.price_at_order,
        quantity: rest.quantity,
        notes: rest.notes || null,
      }));

      if (cleanItems.length > 0) {
        const { error: insErr } = await supabase
          .from('order_items')
          .insert(cleanItems);
        if (insErr) throw insErr;
      }

      const totalAmount = selectedOrderItems.reduce((total, item) => total + (item.price_at_order * item.quantity), 0);

      const { error: updErr } = await supabase
        .from('orders')
        .update({
          total_amount: totalAmount,
          notes: editOrderNotes
        })
        .eq('id', selectedOrder.id);
      if (updErr) throw updErr;

      showToast('Order successfully modified');
      setIsEditingOrder(false);
      
      const updatedOrder = { ...selectedOrder, total_amount: totalAmount, notes: editOrderNotes };
      setSelectedOrder(updatedOrder);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error modifying order', false);
    } finally {
      setLoading(false);
    }
  };

  const triggerPrintKOT = (order: any, items: any[]) => {
    setPrintOrder(order);
    setPrintItems(items);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handlePreviewBill = (order: any, items: any[]) => {
    setPrintOrder(order);
    setPrintItems(items);
    setShowBillPreview(true);
  };

  const handlePrintFromPreview = () => {
    setShowBillPreview(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const filteredOrders = orders.filter(o => o.status === orderQueueFilter);

  return (
    <div style={styles.container}>
      {/* Toast Alert */}
      {successMessage && (
        <div style={styles.toast} className="animate-fade-in">
          <Check size={18} style={{ marginRight: 8 }} />
          {successMessage}
        </div>
      )}

      {error && (
        <div style={{ ...styles.toast, backgroundColor: 'var(--danger)' }} className="animate-fade-in">
          <XCircle size={18} style={{ marginRight: 8 }} />
          {error}
        </div>
      )}

      {/* Dashboard Screen View wrapped in no-print */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
        {/* Tabs Selector */}
        <nav style={styles.tabsContainer} className="glass">
        <button 
          onClick={() => setActiveTab('analytics')}
          style={{
            ...styles.tabButton, 
            color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : 'none',
          }}
        >
          <BarChart2 size={18} />
          KPI Analytics
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          style={{
            ...styles.tabButton, 
            color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'orders' ? '2px solid var(--primary)' : 'none',
          }}
        >
          <ShoppingBag size={18} />
          Active Orders
        </button>
        <button 
          onClick={() => setActiveTab('tables')}
          style={{
            ...styles.tabButton, 
            color: activeTab === 'tables' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'tables' ? '2px solid var(--primary)' : 'none',
          }}
        >
          <Layers size={18} />
          Tables
        </button>
        <button 
          onClick={() => setActiveTab('menu')}
          style={{
            ...styles.tabButton, 
            color: activeTab === 'menu' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'menu' ? '2px solid var(--primary)' : 'none',
          }}
        >
          <Clipboard size={18} />
          Menu Creator
        </button>
        <button 
          onClick={() => setActiveTab('registry')}
          style={{
            ...styles.tabButton, 
            color: activeTab === 'registry' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'registry' ? '2px solid var(--primary)' : 'none',
          }}
        >
          <Users size={18} />
          User Registry
        </button>
        <button 
          onClick={() => setActiveTab('kot')}
          style={{
            ...styles.tabButton, 
            color: activeTab === 'kot' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'kot' ? '2px solid var(--primary)' : 'none',
          }}
        >
          <Settings size={18} />
          KOT Settings
        </button>
      </nav>

      {/* Main Tab Render Grid */}
      <div style={styles.tabContent} className="animate-fade-in">
        
        {/* KPI ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* KPI Cards Grid */}
            <div style={styles.kpiGrid}>
              <div style={styles.kpiCard} className="glass">
                <span style={styles.kpiLabel}>Total Completed Revenue</span>
                <strong style={styles.kpiValue}>Rs. {analytics.totalRevenue}</strong>
                <TrendingUp size={24} color="var(--success)" style={{ marginTop: '8px' }} />
              </div>
              <div style={styles.kpiCard} className="glass">
                <span style={styles.kpiLabel}>Billed Orders</span>
                <strong style={styles.kpiValue}>{analytics.completedOrders}</strong>
              </div>
              <div style={styles.kpiCard} className="glass">
                <span style={styles.kpiLabel}>Average Order Ticket</span>
                <strong style={styles.kpiValue}>Rs. {analytics.averageBill}</strong>
              </div>
            </div>

            {/* Top Items & Tables Revenue analysis splits */}
            <div className="responsive-admin-split">
              <div style={styles.panel} className="glass">
                <h2 style={styles.panelTitle}>Top-Selling Menu Items</h2>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {analytics.topItems.length === 0 ? (
                    <div style={styles.emptyState}>No selling data available.</div>
                  ) : (
                    analytics.topItems.map((item, idx) => (
                      <div key={idx} style={styles.analyticRow}>
                        <div>
                          <strong>#{idx + 1}</strong> <span style={{ marginLeft: 8 }}>{item.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div><strong>{item.count} sold</strong></div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rs. {item.revenue} Revenue</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={styles.panel} className="glass">
                <h2 style={styles.panelTitle}>Table Performance Revenue</h2>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {analytics.tableUsage.length === 0 ? (
                    <div style={styles.emptyState}>No billing records yet.</div>
                  ) : (
                    analytics.tableUsage.map((table, idx) => (
                      <div key={idx} style={styles.analyticRow}>
                        <div>
                          <strong>{table.tableNumber}</strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div><strong>Rs. {table.revenue}</strong></div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{table.count} checkouts</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="responsive-admin-split">
            <div style={styles.panel} className="glass">
              <div style={styles.panelHeader}>
                <h2 style={styles.panelTitle}>Live Orders Queue</h2>
                <button onClick={fetchData} style={styles.refreshBtn} title="Refresh">
                  <RefreshCw size={16} className={loading ? 'spin' : ''} />
                </button>
              </div>

              {/* Order Status Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', flexWrap: 'wrap' }}>
                {(['confirmed', 'pending', 'completed', 'cancelled'] as const).map((status) => {
                  const count = orders.filter(o => o.status === status).length;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setOrderQueueFilter(status)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        backgroundColor: orderQueueFilter === status ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                        color: orderQueueFilter === status ? '#fff' : 'var(--text-muted)',
                        textTransform: 'capitalize',
                        transition: 'var(--transition-fast)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {status}
                      <span style={{
                        fontSize: '10px',
                        backgroundColor: orderQueueFilter === status ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)',
                        color: orderQueueFilter === status ? '#fff' : 'var(--text-main)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: '700'
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 ? (
                <div style={styles.emptyState}>No {orderQueueFilter} orders.</div>
              ) : (
                <>
                  {/* Select All and Bulk Actions Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrderIds(filteredOrders.map(o => o.id));
                          } else {
                            setSelectedOrderIds([]);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      Select All ({filteredOrders.length})
                    </label>
                    
                    {selectedOrderIds.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleBulkUpdateOrderStatus(selectedOrderIds, 'completed')}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--success)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Complete Selected ({selectedOrderIds.length})
                        </button>
                        <button
                          onClick={() => handleBulkUpdateOrderStatus(selectedOrderIds, 'cancelled')}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            color: 'var(--danger)',
                            border: '1px solid var(--danger)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel Selected ({selectedOrderIds.length})
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={styles.orderListContainer}>
                    {filteredOrders.map((o) => (
                      <div 
                        key={o.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          border: '1px solid var(--border-color)',
                          borderColor: selectedOrder?.id === o.id ? 'var(--primary)' : 'var(--border-color)',
                          backgroundColor: selectedOrder?.id === o.id ? 'var(--bg-surface-elevated)' : 'transparent',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 14px',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                        }}
                        onClick={() => handleViewOrder(o)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(o.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderIds([...selectedOrderIds, o.id]);
                            } else {
                              setSelectedOrderIds(selectedOrderIds.filter(id => id !== o.id));
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={styles.orderRowMeta}>
                            <strong style={{ fontSize: '15px' }}>{o.restaurant_tables?.table_number || 'N/A'}</strong>
                            <span style={styles.orderTime}>{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          <div style={styles.orderRowDetails}>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Server: {o.created_by}</span>
                            <strong style={{ color: 'var(--primary)' }}>Rs. {o.total_amount}</strong>
                          </div>

                          <div style={styles.orderRowStatus}>
                            <span style={{
                              ...styles.orderBadge,
                              backgroundColor: o.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' :
                                               o.status === 'confirmed' ? 'rgba(99, 102, 241, 0.15)' :
                                               o.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: o.status === 'pending' ? 'var(--primary)' :
                                     o.status === 'confirmed' ? 'var(--secondary)' :
                                     o.status === 'completed' ? 'var(--success)' : 'var(--danger)',
                            }}>
                              {o.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ORDER DETAILS PANEL */}
            <div style={styles.panel} className="glass">
              {selectedOrder ? (
                detailsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
                    <RefreshCw size={24} className="spin" color="var(--primary)" />
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading order details...</p>
                  </div>
                ) : (
                  <div style={styles.orderDetailsView}>
                  <div style={styles.detailsHeader}>
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px' }}>
                        {selectedOrder.restaurant_tables?.table_number} Details
                      </h2>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Order ID: #{selectedOrder.id.slice(0, 8)}</span>
                    </div>

                    <div style={styles.detailsActions}>
                      <button 
                        onClick={() => handlePreviewBill(selectedOrder, selectedOrderItems)}
                        style={{ ...styles.printBtn, backgroundColor: 'var(--secondary)' }}
                      >
                        👁️ Preview Bill
                      </button>
                      <button 
                        onClick={() => triggerPrintKOT(selectedOrder, selectedOrderItems)}
                        style={styles.printBtn}
                      >
                        🖨️ Print KOT
                      </button>
                    </div>
                  </div>

                  <div style={styles.detailsInfo}>
                    <div><strong>Server:</strong> {selectedOrder.created_by}</div>
                    <div><strong>Time:</strong> {new Date(selectedOrder.created_at).toLocaleTimeString()}</div>
                    {selectedOrder.confirmed_by && (
                      <div><strong>Confirmed by:</strong> {selectedOrder.confirmed_by}</div>
                    )}
                    <div><strong>Status:</strong> {selectedOrder.status.toUpperCase()}</div>
                    <div><strong>Payment:</strong> <span style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '10px',
                      fontWeight: '700',
                      backgroundColor: (selectedOrder.payment_status || 'unpaid') === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color: (selectedOrder.payment_status || 'unpaid') === 'paid' ? 'var(--success)' : 'var(--primary)',
                    }}>{(selectedOrder.payment_status || 'UNPAID').toUpperCase()}</span></div>
                  </div>

                  {/* Bill Type Selector Tabs */}
                  {!isEditingOrder && selectedOrder.status === 'confirmed' && (
                    <div style={{
                      display: 'flex',
                      borderBottom: '1px solid var(--border-color)',
                      marginBottom: '16px'
                    }}>
                      <button
                        onClick={() => setBillingTab('full')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: billingTab === 'full' ? '3px solid var(--primary)' : 'none',
                          color: billingTab === 'full' ? 'var(--primary)' : 'var(--text-muted)',
                          fontWeight: '600',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        💳 Full Bill Payment
                      </button>
                      <button
                        onClick={() => setBillingTab('split')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: billingTab === 'split' ? '3px solid var(--primary)' : 'none',
                          color: billingTab === 'split' ? 'var(--primary)' : 'var(--text-muted)',
                          fontWeight: '600',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        🥞 Split Billing
                      </button>
                    </div>
                  )}

                  <div style={styles.itemsSection}>
                    <h3 style={styles.sectionTitle}>
                      {billingTab === 'split' ? 'Select Items to Pay' : 'Ordered Items'}
                    </h3>
                    
                    {billingTab === 'split' && !isEditingOrder && selectedOrder.status === 'confirmed' ? (
                      <div style={styles.itemsList}>
                        {selectedOrderItems.map((item) => {
                          const currentSelectedQty = splitSelectedItems[item.id] || 0;
                          return (
                            <div key={item.id} style={{ ...styles.itemRow, paddingTop: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                              <div style={{ flex: 1 }}>
                                <strong>{item.item_name}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  Rs. {item.price_at_order} each (Total: Rs. {item.price_at_order * item.quantity})
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  onClick={() => setSplitSelectedItems({
                                    ...splitSelectedItems,
                                    [item.id]: Math.max(0, currentSelectedQty - 1)
                                  })}
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-surface)' }}
                                >-</button>
                                <span style={{ width: '32px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>
                                  {currentSelectedQty} / {item.quantity}
                                </span>
                                <button
                                  onClick={() => setSplitSelectedItems({
                                    ...splitSelectedItems,
                                    [item.id]: Math.min(item.quantity, currentSelectedQty + 1)
                                  })}
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-surface)' }}
                                >+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={styles.itemsList}>
                        {selectedOrderItems.map((item) => (
                          <div key={item.id} style={styles.itemRow}>
                            <div>
                              <strong>{item.quantity}x</strong> {item.item_name}
                              {item.notes && <div style={styles.itemNoteText}>* {item.notes}</div>}
                            </div>
                            <div>Rs. {item.price_at_order * item.quantity}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add-ons/Override Section during Edit */}
                    {isEditingOrder && (
                      <div style={styles.editOrderOverlay}>
                        <h4 style={{ color: 'var(--primary)', marginBottom: '12px', fontSize: '14px' }}>Modify Order Items</h4>
                        <div style={styles.modifyList}>
                          {selectedOrderItems.map((item) => (
                            <div key={item.id} style={styles.modifyItemRow}>
                              <span style={{ fontSize: '13px' }}>{item.item_name}</span>
                              <div style={styles.qtyControl}>
                                <button 
                                  onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                  style={styles.qtyBtn}
                                >-</button>
                                <span style={{ width: '24px', textAlign: 'center' }}>{item.quantity}</span>
                                <button 
                                  onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                  style={styles.qtyBtn}
                                >+</button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <h4 style={{ color: 'var(--primary)', marginTop: '20px', marginBottom: '12px', fontSize: '14px' }}>Add Items</h4>
                        <div style={styles.quickAddGrid}>
                          {menuItems.filter(i => i.is_available).map((item) => (
                            <button 
                              key={item.id} 
                              onClick={() => handleAddItemToOrder(item)}
                              style={styles.quickAddItemBtn}
                            >
                              <Plus size={12} style={{ marginRight: 4 }} />
                              {item.name} (Rs. {item.price})
                            </button>
                          ))}
                        </div>

                        <div style={{ marginTop: '16px' }}>
                          <label style={{ ...styles.label, marginBottom: '6px' }}>Edit Instructions</label>
                          <textarea
                            style={{ width: '100%', height: '60px' }}
                            value={editOrderNotes}
                            onChange={(e) => setEditOrderNotes(e.target.value)}
                            placeholder="Add customer requirements..."
                          />
                        </div>

                        <div style={styles.editActionRow}>
                          <button onClick={() => setIsEditingOrder(false)} style={styles.cancelBtn}>Cancel</button>
                          <button onClick={handleSaveModifiedOrder} style={styles.confirmActionBtn} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={styles.totalRow}>
                      <span>Total Amount:</span>
                      <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>Rs. {selectedOrder.total_amount}</strong>
                    </div>

                    {selectedOrder.notes && !isEditingOrder && (
                      <div style={styles.notesBox}>
                        <strong>Instructions:</strong>
                        <p style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>{selectedOrder.notes}</p>
                      </div>
                    )}
                  </div>

                  {!isEditingOrder && (
                    <div style={styles.actionFooter}>
                      {billingTab === 'split' && selectedOrder.status === 'confirmed' ? (
                        <>
                          <div style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--secondary-light)', border: '1px solid var(--secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', boxSizing: 'border-box' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600' }}>Split Payment Subtotal:</span>
                            <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
                              Rs. {Object.keys(splitSelectedItems).reduce((sum, itemId) => {
                                const item = selectedOrderItems.find(it => it.id === itemId);
                                if (!item) return sum;
                                return sum + (item.price_at_order * (splitSelectedItems[itemId] || 0));
                              }, 0)}
                            </strong>
                          </div>
                          <button
                            onClick={handleProcessSplitPayment}
                            disabled={loading || Object.keys(splitSelectedItems).reduce((sum, k) => sum + (splitSelectedItems[k] || 0), 0) === 0}
                            style={{ ...styles.actionBtnLarge, backgroundColor: 'var(--primary)', color: '#fff', width: '100%', marginBottom: '12px' }}
                          >
                            {loading ? 'Processing...' : 'Process Split Payment'}
                          </button>
                        </>
                      ) : (
                        <>
                          {selectedOrder.status === 'pending' && (
                            <button 
                              onClick={() => handleConfirmOrder(selectedOrder.id)}
                              style={{ ...styles.actionBtnLarge, backgroundColor: 'var(--primary)', color: '#fff' }}
                              disabled={loading}
                            >
                              {loading ? 'Confirming...' : 'Confirm Order'}
                            </button>
                          )}
                          
                          {selectedOrder.status === 'confirmed' && (
                            <button 
                              onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'completed')}
                              style={{ ...styles.actionBtnLarge, backgroundColor: 'var(--success)', color: '#fff' }}
                              disabled={loading}
                            >
                              {loading ? 'Completing...' : 'Mark Completed / Paid'}
                            </button>
                          )}
                        </>
                      )}

                      <button 
                        onClick={() => setIsEditingOrder(true)}
                        style={{ ...styles.actionBtnLarge, backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                        disabled={loading}
                      >
                        Modify Order Items
                      </button>

                      {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'completed' && (
                        <button 
                          onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'cancelled')}
                          style={{ ...styles.actionBtnLarge, backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                          disabled={loading}
                        >
                          {loading ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) ) : (
                <div style={styles.emptyDetails}>
                  <Info size={36} color="var(--border-color)" style={{ marginBottom: 12 }} />
                  <p>Select a live order to perform changes, confirm, cancel, or checkout.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TABLES TAB */}
        {activeTab === 'tables' && (
          <div className="responsive-two-column">
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>{editingTableId ? 'Edit Table Settings' : 'Add New Dining Table'}</h2>
              <form onSubmit={handleSaveTable} style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Table Number / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Table 6"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Seat Capacity</label>
                  <select
                    value={seatingCapacity}
                    onChange={(e) => setSeatingCapacity(e.target.value)}
                  >
                    <option value="2">2 Seater</option>
                    <option value="4">4 Seater</option>
                    <option value="6">6 Seater</option>
                    <option value="8">8 Seater</option>
                    <option value="12">12 Seater</option>
                  </select>
                </div>
                <div style={styles.formBtnGroup}>
                  {editingTableId && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingTableId(null);
                        setTableNumber('');
                        setSeatingCapacity('4');
                      }}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" style={styles.saveBtn} disabled={loading}>
                    {loading ? 'Saving...' : (editingTableId ? 'Save Changes' : 'Create Table')}
                  </button>
                </div>
              </form>
            </div>

            {/* List */}
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>Active Tables</h2>
              {loading && tables.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px' }}>
                  <RefreshCw size={24} className="spin" color="var(--primary)" />
                  <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading dining tables...</p>
                </div>
              ) : tables.length === 0 ? (
                <div style={styles.emptyState}>No tables registered.</div>
              ) : (
                <div style={styles.gridContainer}>
                  {tables.map((t) => (
                    <div key={t.id} style={styles.tableCard}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{t.table_number}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Capacity: {t.seating_capacity} seats
                        </p>
                      </div>
                      <div style={styles.cardActions}>
                        <button onClick={() => handleEditTable(t)} style={styles.iconBtnEdit} title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteTable(t.id)} style={styles.iconBtnDelete} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MENU TAB */}
        {activeTab === 'menu' && (
          <div className="responsive-two-column">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={styles.panel} className="glass">
                <h2 style={styles.panelTitle}>Add Menu Category</h2>
                <form onSubmit={handleSaveCategory} style={styles.formInline}>
                  <input
                    type="text"
                    placeholder="e.g. Soups"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    required
                    style={{ flex: 1 }}
                  />
                  <button type="submit" style={styles.saveBtnInline} disabled={loading}>
                    {loading ? 'Adding...' : 'Add Category'}
                  </button>
                </form>
              </div>

              <div style={styles.panel} className="glass">
                <h2 style={styles.panelTitle}>{editingMenuItemId ? 'Edit Item Details' : 'Add Menu Item'}</h2>
                <form onSubmit={handleSaveMenuItem} style={styles.form}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Item Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Paneer Tikka"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.inputRowGrid}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Price (Optional)</label>
                      <input
                        type="number"
                        placeholder="Price in Rs"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Category</label>
                      <select
                        value={itemCategory}
                        onChange={(e) => setItemCategory(e.target.value)}
                      >
                        <option value="">None</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Image URL (Optional)</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={itemImage}
                      onChange={(e) => setItemImage(e.target.value)}
                    />
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Description</label>
                    <textarea
                      placeholder="Ingredients / Spicy level..."
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div style={styles.formBtnGroup}>
                    {editingMenuItemId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingMenuItemId(null);
                          setItemName('');
                          setItemPrice('');
                          setItemImage('');
                          setItemCategory('');
                          setItemDescription('');
                        }}
                        style={styles.cancelBtn}
                      >
                        Cancel
                      </button>
                    )}
                    <button type="submit" style={styles.saveBtn} disabled={loading}>
                      {loading ? 'Saving...' : (editingMenuItemId ? 'Save Item' : 'Create Item')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>Menu Offerings</h2>
              {menuItems.length === 0 ? (
                <div style={styles.emptyState}>No items in menu.</div>
              ) : (
                <div style={styles.menuItemsListGrid}>
                  {menuItems.map((item) => (
                    <div key={item.id} style={styles.menuCard}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={styles.menuCardImg} />
                      ) : (
                        <div style={styles.menuCardNoImg}>
                          <Image size={24} color="var(--border-color)" />
                        </div>
                      )}
                      <div style={styles.menuCardInfo}>
                        <div style={styles.menuCardHeader}>
                          <h4 style={{ fontSize: '15px', fontWeight: '600' }}>{item.name}</h4>
                          <span style={styles.menuCardPrice}>Rs. {item.price}</span>
                        </div>
                        <span style={styles.menuCardCategory}>
                          {item.menu_categories?.name || 'Uncategorized'}
                        </span>
                        <p style={styles.menuCardDesc}>{item.description || 'No description'}</p>
                        <div style={styles.menuCardFooter}>
                          <button onClick={() => handleEditMenuItem(item)} style={styles.iconBtnEdit} title="Edit">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => handleDeleteMenuItem(item.id)} style={styles.iconBtnDelete} title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* USER REGISTRY TAB (Owner only dashboard feature) */}
        {activeTab === 'registry' && (
          <div className="responsive-two-column">
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>{editingUserId ? 'Edit Credentials' : 'Register New User Profile'}</h2>
              <form onSubmit={handleSaveUser} style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Display Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sam Bahadur"
                    value={registryName}
                    onChange={(e) => setRegistryName(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Username</label>
                  <input
                    type="text"
                    placeholder="e.g. sambahadur"
                    value={registryUsername}
                    onChange={(e) => setRegistryUsername(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Password</label>
                  <input
                    type="password"
                    placeholder="Set secret password"
                    value={registryPassword}
                    onChange={(e) => setRegistryPassword(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Account Role Access</label>
                  <select
                    value={registryRole}
                    onChange={(e: any) => setRegistryRole(e.target.value)}
                  >
                    <option value="staff">Staff Member</option>
                    <option value="admin">Restaurant Admin</option>
                  </select>
                </div>
                <div style={styles.formBtnGroup}>
                  {editingUserId && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingUserId(null);
                        setRegistryName('');
                        setRegistryUsername('');
                        setRegistryPassword('');
                        setRegistryRole('staff');
                      }}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" style={styles.saveBtn} disabled={loading}>
                    {loading ? 'Saving...' : (editingUserId ? 'Update User' : 'Register User')}
                  </button>
                </div>
              </form>
            </div>

            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>Active Accounts List</h2>
              {usersList.length === 0 ? (
                <div style={styles.emptyState}>No staff or admins registered.</div>
              ) : (
                <div style={styles.gridContainer}>
                  {usersList.map((u) => (
                    <div key={u.id} style={styles.staffCard}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{u.name}</h3>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '700',
                            backgroundColor: u.role === 'admin' ? 'rgba(79, 70, 229, 0.1)' : 'rgba(0,0,0,0.05)',
                            color: u.role === 'admin' ? 'var(--secondary)' : 'var(--text-muted)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>{u.role}</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Username: <code>{u.username}</code>
                        </p>
                      </div>
                      <div style={styles.cardActions}>
                        <button onClick={() => handleEditUser(u)} style={styles.iconBtnEdit} title="Edit settings">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteUser(u.id)} style={styles.iconBtnDelete} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* KOT PRINT SETTINGS TAB */}
        {activeTab === 'kot' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>KOT Receipt Format Settings</h2>
              <form onSubmit={handleSaveKotSettings} style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Restaurant / Outlet Name</label>
                  <input
                    type="text"
                    placeholder="e.g. RestroSathi Fine Dine"
                    value={kotSettings.restaurant_name}
                    onChange={(e) => setKotSettings({ ...kotSettings, restaurant_name: e.target.value })}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>KOT Receipt Header Caption</label>
                  <input
                    type="text"
                    placeholder="e.g. KITCHEN ORDER TICKET"
                    value={kotSettings.header_text}
                    onChange={(e) => setKotSettings({ ...kotSettings, header_text: e.target.value })}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>KOT Receipt Footer Message</label>
                  <input
                    type="text"
                    placeholder="e.g. Thank you! Visit again."
                    value={kotSettings.footer_text}
                    onChange={(e) => setKotSettings({ ...kotSettings, footer_text: e.target.value })}
                    required
                  />
                </div>
                
                <div style={{ ...styles.inputGroup, flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="checkbox"
                    id="owner_show_price"
                    checked={kotSettings.show_price}
                    onChange={(e) => setKotSettings({ ...kotSettings, show_price: e.target.checked })}
                    style={{ width: 'auto', cursor: 'pointer' }}
                  />
                  <label htmlFor="owner_show_price" style={{ ...styles.label, marginBottom: 0, cursor: 'pointer' }}>
                    Show Prices and Bill Totals on Kitchen Order Ticket (KOT)
                  </label>
                </div>

                <div style={styles.formBtnGroup}>
                  <button type="submit" style={styles.saveBtn} disabled={loading}>
                    {loading ? 'Saving...' : 'Save KOT Format'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Hidden KOT Print Area */}
      <KotPrintView 
        order={printOrder} 
        items={printItems} 
        tableNumber={printOrder?.restaurant_tables?.table_number || ''} 
        settings={kotSettings}
      />

      {/* Bill Preview Modal */}
      <BillPreviewModal
        show={showBillPreview}
        onClose={() => setShowBillPreview(false)}
        onPrint={handlePrintFromPreview}
      >
        <KotPrintView
          order={printOrder}
          items={printItems}
          tableNumber={printOrder?.restaurant_tables?.table_number || ''}
          settings={kotSettings}
          previewMode={true}
        />
      </BillPreviewModal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    width: '100%',
  },
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
  tabsContainer: {
    display: 'flex',
    gap: '8px',
    padding: '4px 16px',
    borderRadius: 'var(--radius-md)',
    overflowX: 'auto',
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    whiteSpace: 'nowrap',
  },
  tabContent: {
    minHeight: '400px',
  },
  panel: {
    padding: '24px',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-color)',
  },
  panelTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-main)',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  },
  emptyState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '48px',
    color: 'var(--text-muted)',
    fontSize: '14px',
    border: '1px dashed var(--border-color)',
    borderRadius: 'var(--radius-sm)',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },
  tableCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    padding: '16px',
    borderRadius: 'var(--radius-sm)',
  },
  cardActions: {
    display: 'flex',
    gap: '6px',
  },
  iconBtnEdit: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    border: '1px solid rgba(79, 70, 229, 0.2)',
    color: 'var(--secondary)',
    cursor: 'pointer',
  },
  iconBtnDelete: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: 'var(--danger)',
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formInline: {
    display: 'flex',
    gap: '12px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  inputRowGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  formBtnGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  cancelBtn: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
  },
  saveBtnInline: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
  },
  menuItemsListGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  },
  menuCard: {
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  menuCardImg: {
    width: '100%',
    height: '120px',
    objectFit: 'cover',
  },
  menuCardNoImg: {
    width: '100%',
    height: '120px',
    backgroundColor: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid var(--border-color)',
  },
  menuCardInfo: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  menuCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  menuCardPrice: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--primary)',
  },
  menuCardCategory: {
    alignSelf: 'flex-start',
    fontSize: '11px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: 'var(--text-muted)',
    marginTop: '6px',
    textTransform: 'uppercase',
  },
  menuCardDesc: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '8px',
    lineHeight: '1.4',
    flex: 1,
  },
  menuCardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border-color)',
  },
  staffCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    padding: '16px',
    borderRadius: 'var(--radius-sm)',
  },
  orderListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '600px',
    overflowY: 'auto',
  },
  orderRow: {
    padding: '14px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  orderRowMeta: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  orderTime: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  orderRowDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderRowStatus: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  orderBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
  },
  emptyDetails: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    padding: '48px',
    color: 'var(--text-muted)',
    fontSize: '14px',
    textAlign: 'center',
  },
  orderDetailsView: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  detailsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border-color)',
  },
  printBtn: {
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#fff',
    border: 'none',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  detailsInfo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    fontSize: '13px',
    backgroundColor: 'var(--bg-surface-elevated)',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
  },
  itemsSection: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-muted)',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-color)',
  },
  itemNoteText: {
    fontSize: '11px',
    fontStyle: 'italic',
    color: 'var(--primary)',
    marginTop: '2px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-color)',
    fontSize: '16px',
    fontWeight: '600',
  },
  notesBox: {
    backgroundColor: 'rgba(217, 119, 6, 0.05)',
    border: '1px solid rgba(217, 119, 6, 0.15)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px',
    fontSize: '13px',
  },
  actionFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid var(--border-color)',
  },
  actionBtnLarge: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    textAlign: 'center',
  },
  editOrderOverlay: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
    marginTop: '12px',
  },
  modifyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  modifyItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
  },
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  qtyBtn: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    cursor: 'pointer',
  },
  quickAddGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  quickAddItemBtn: {
    padding: '6px 10px',
    fontSize: '11px',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    color: 'var(--text-main)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  editActionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  confirmActionBtn: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
  },

  // KPI Analytics Styles
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '24px',
  },
  kpiCard: {
    padding: '24px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-sm)',
  },
  kpiLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--text-main)',
    marginTop: '6px',
  },
  analyticRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
  },
};
