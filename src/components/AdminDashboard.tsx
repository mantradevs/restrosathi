'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { 
  Plus, Edit2, Trash2, Check, RefreshCw, ShoppingBag, 
  Layers, Users, Calendar, DollarSign, Eye, XCircle, Info, Image, Clipboard, Settings,
  ShoppingCart
} from 'lucide-react';
import KotPrintView, { BillPreviewModal } from './KotPrintView';
import StaffDashboard from './StaffDashboard';

interface AdminDashboardProps {
  user: { id: string; username: string; name: string; role: 'owner' | 'admin' | 'staff' };
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'orders' | 'tables' | 'menu' | 'staff' | 'kot' | 'pos'>('orders');

  // Common Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // KOT Format Settings State
  const [kotSettings, setKotSettings] = useState({
    restaurant_name: 'RestroSathi',
    header_text: 'KITCHEN ORDER TICKET',
    footer_text: 'Thank you! Visit again.',
    show_price: true
  });

  // Form States - Staff
  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

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
  const [selectedCreatorCategory, setSelectedCreatorCategory] = useState<string>('all');
  const [orderQueueFilter, setOrderQueueFilter] = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('confirmed');

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
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState('');

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (supabase) {
      fetchData();
      fetchKotSettings();
    }
  }, [activeTab]);

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
      if (activeTab === 'orders') {
        const { data: oData, error: oErr } = await supabase
          .from('orders')
          .select('*, restaurant_tables(table_number)')
          .order('created_at', { ascending: false });
        if (oErr) throw oErr;
        setOrders(oData || []);
      } else if (activeTab === 'tables') {
        const { data: tData, error: tErr } = await supabase
          .from('restaurant_tables')
          .select('*')
          .order('table_number', { ascending: true });
        if (tErr) throw tErr;
        setTables(tData || []);
      } else if (activeTab === 'menu') {
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
      } else if (activeTab === 'staff') {
        const { data: sData, error: sErr } = await supabase
          .from('restaurant_users')
          .select('*')
          .eq('role', 'staff')
          .order('name', { ascending: true });
        if (sErr) throw sErr;
        setStaffList(sData || []);
      } else if (activeTab === 'kot') {
        await fetchKotSettings();
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading data', false);
    } finally {
      setLoading(false);
    }
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

  // Staff Management Actions
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!staffName || !staffUsername || !staffPassword) {
      showToast('Please fill all staff fields.', false);
      return;
    }

    try {
      if (editingStaffId) {
        // Update
        const { error: err } = await supabase
          .from('restaurant_users')
          .update({
            name: staffName,
            username: staffUsername.trim().toLowerCase(),
            password: staffPassword,
          })
          .eq('id', editingStaffId);
        if (err) throw err;
        showToast('Staff member updated successfully');
      } else {
        // Create
        const { error: err } = await supabase
          .from('restaurant_users')
          .insert({
            name: staffName,
            username: staffUsername.trim().toLowerCase(),
            password: staffPassword,
            role: 'staff',
          });
        if (err) throw err;
        showToast('Staff member created successfully');
      }

      setStaffName('');
      setStaffUsername('');
      setStaffPassword('');
      setEditingStaffId(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error saving staff member', false);
    }
  };

  const handleEditStaff = (staff: any) => {
    setEditingStaffId(staff.id);
    setStaffName(staff.name);
    setStaffUsername(staff.username);
    setStaffPassword(staff.password);
  };

  const handleDeleteStaff = async (id: string) => {
    if (!supabase) return;
    try {
      const { error: err } = await supabase
        .from('restaurant_users')
        .delete()
        .eq('id', id);
      if (err) throw err;
      showToast('Staff deleted successfully');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting staff member', false);
    }
  };

  // Table Management Actions
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!tableNumber) {
      showToast('Please enter a table number.', false);
      return;
    }

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
        showToast('Table updated successfully');
      } else {
        const { error: err } = await supabase
          .from('restaurant_tables')
          .insert({
            table_number: tableNumber,
            seating_capacity: parseInt(seatingCapacity, 10),
            status: 'available'
          });
        if (err) throw err;
        showToast('Table added successfully');
      }

      setTableNumber('');
      setSeatingCapacity('4');
      setEditingTableId(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error saving table', false);
    }
  };

  const handleEditTable = (table: any) => {
    setEditingTableId(table.id);
    setTableNumber(table.table_number);
    setSeatingCapacity(table.seating_capacity.toString());
  };

  const handleDeleteTable = async (id: string) => {
    if (!supabase) return;
    try {
      const { error: err } = await supabase
        .from('restaurant_tables')
        .delete()
        .eq('id', id);
      if (err) throw err;
      showToast('Table deleted successfully');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting table', false);
    }
  };

  // Category & Menu Management Actions
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size should be less than 10MB', false);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const img = window.document.createElement('img');
        img.src = reader.result;
        img.onload = () => {
          const canvas = window.document.createElement('canvas');
          const MAX_WIDTH = 500;
          const MAX_HEIGHT = 500;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setItemImage(compressedBase64);
            showToast('Image loaded and compressed successfully');
          } else {
            setItemImage(reader.result as string);
            showToast('Image loaded successfully');
          }
        };
      }
    };
    reader.readAsDataURL(file);
    // Reset file input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newCategoryName) return;
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
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!itemName) {
      showToast('Item Name is required.', false);
      return;
    }

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
        showToast('Menu item updated successfully');
      } else {
        const { error: err } = await supabase
          .from('menu_items')
          .insert(payload);
        if (err) throw err;
        showToast('Menu item added successfully');
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
    try {
      const { error: err } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);
      if (err) throw err;
      showToast('Menu item deleted successfully');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting menu item', false);
    }
  };

  // Order Operations
  const handleViewOrder = async (order: any) => {
    if (!supabase) return;
    setSelectedOrder(order);
    
    // Parse notes for discount
    let dType: 'none' | 'percentage' | 'amount' = 'none';
    let dVal = '';
    let parsedNotes = order.notes || '';
    if (order.notes) {
      try {
        const trimmed = order.notes.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const parsed = JSON.parse(trimmed);
          dType = parsed.discount_type || 'none';
          dVal = parsed.discount_value ? parsed.discount_value.toString() : '';
          parsedNotes = parsed.notes || '';
        }
      } catch (e) {}
    }
    setDiscountType(dType);
    setDiscountValue(dVal);
    setEditOrderNotes(parsedNotes);
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
    }
  };

  const serializeOrderNotes = (notesText: string, type: string, val: number, amt: number) => {
    if (type === 'none') return notesText;
    return JSON.stringify({
      discount_type: type,
      discount_value: val,
      discount_amount: amt,
      notes: notesText
    });
  };

  const handleApplyDiscount = async () => {
    if (!supabase || !selectedOrder) return;

    // Calculate subtotal of current order items
    const subtotal = selectedOrderItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0);
    
    let appliedDiscountAmt = 0;
    const val = parseFloat(discountValue) || 0;

    if (discountType === 'percentage') {
      if (val < 0 || val > 100) {
        showToast('Discount percentage must be between 0 and 100', false);
        return;
      }
      appliedDiscountAmt = Math.round((subtotal * val) / 100);
    } else if (discountType === 'amount') {
      if (val < 0 || val > subtotal) {
        showToast('Discount amount cannot exceed the order subtotal', false);
        return;
      }
      appliedDiscountAmt = val;
    }

    const finalAmount = Math.max(0, subtotal - appliedDiscountAmt);

    setLoading(true);
    try {
      const serializedNotes = serializeOrderNotes(
        editOrderNotes,
        discountType,
        val,
        appliedDiscountAmt
      );

      const { error: err } = await supabase
        .from('orders')
        .update({
          total_amount: finalAmount,
          notes: serializedNotes
        })
        .eq('id', selectedOrder.id);

      if (err) throw err;

      showToast('Discount applied successfully');
      
      const updatedOrder = {
        ...selectedOrder,
        total_amount: finalAmount,
        notes: serializedNotes
      };
      setSelectedOrder(updatedOrder);
      
      // Update in orders list
      setOrders(orders.map(o => o.id === selectedOrder.id ? updatedOrder : o));
    } catch (err: any) {
      showToast(err.message || 'Error applying discount', false);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    if (!supabase) return;
    try {
      const { error: err } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          confirmed_by: user.name,
        })
        .eq('id', orderId);
      if (err) throw err;
      
      showToast('Order confirmed successfully');
      
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'confirmed', confirmed_by: user.name } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: 'confirmed', confirmed_by: user.name });
      }
    } catch (err: any) {
      showToast(err.message || 'Error confirming order', false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: 'completed' | 'cancelled' | 'pending') => {
    if (!supabase) return;
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
      const remainingItems = selectedOrderItems.map(item => {
        const qtyToPay = Math.min(item.quantity, splitSelectedItems[item.id] || 0);
        return {
          ...item,
          quantity: item.quantity - qtyToPay
        };
      }).filter(item => item.quantity > 0);

      const newSubtotal = remainingItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0);

      let newDiscountAmt = 0;
      let newSerializedNotes = selectedOrder.notes || '';
      
      // Parse and recalculate the active discount for remaining items
      if (selectedOrder.notes) {
        try {
          const trimmed = selectedOrder.notes.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const parsed = JSON.parse(trimmed);
            const dType = parsed.discount_type || 'none';
            const dVal = Number(parsed.discount_value) || 0;
            
            if (dType === 'percentage') {
              newDiscountAmt = Math.round((newSubtotal * dVal) / 100);
            } else if (dType === 'amount') {
              newDiscountAmt = Math.min(newSubtotal, dVal);
            }
            newSerializedNotes = JSON.stringify({
              ...parsed,
              discount_amount: newDiscountAmt
            });
          }
        } catch (e) {}
      }

      const newActiveTotal = Math.max(0, newSubtotal - newDiscountAmt);
      
      // If no items remain in the original active order, we complete it!
      const remainingItemsCount = remainingItems.reduce((count, item) => count + item.quantity, 0);

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
        // Update original order with remaining amount and discount notes
        const { error: updErr } = await supabase
          .from('orders')
          .update({ 
            total_amount: newActiveTotal,
            notes: newSerializedNotes
          })
          .eq('id', selectedOrder.id);
        if (updErr) throw updErr;

        showToast(`Processed split payment of Rs. ${splitTotal}. Remaining items stay on the table.`);
        
        // Reload current order details
        await handleViewOrder({ ...selectedOrder, total_amount: newActiveTotal, notes: newSerializedNotes });
      }

      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error processing split payment', false);
    } finally {
      setLoading(false);
    }
  };

  // Editing order items (Admin override capability)
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

      // Recalculate discount if active
      const newSubtotal = selectedOrderItems.reduce((total, item) => total + (item.price_at_order * item.quantity), 0);
      let newDiscountAmt = 0;
      const val = parseFloat(discountValue) || 0;
      if (discountType === 'percentage') {
        newDiscountAmt = Math.round((newSubtotal * val) / 100);
      } else if (discountType === 'amount') {
        newDiscountAmt = Math.min(newSubtotal, val);
      }
      const finalAmount = Math.max(0, newSubtotal - newDiscountAmt);
      const serializedNotes = serializeOrderNotes(editOrderNotes, discountType, val, newDiscountAmt);

      const { error: updErr } = await supabase
        .from('orders')
        .update({
          total_amount: finalAmount,
          notes: serializedNotes
        })
        .eq('id', selectedOrder.id);
      if (updErr) throw updErr;

      showToast('Order successfully updated');
      setIsEditingOrder(false);
      
      const updatedOrder = { ...selectedOrder, total_amount: finalAmount, notes: serializedNotes };
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

  const filteredMenuItems = selectedCreatorCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category_id === selectedCreatorCategory);

  const filteredOrders = orders.filter(o => o.status === orderQueueFilter);

  return (
    <div style={styles.container}>
      {/* Toast Messages */}
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
          onClick={() => setActiveTab('pos')}
          style={{
            ...styles.tabButton, 
            color: activeTab === 'pos' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'pos' ? '2px solid var(--primary)' : 'none',
          }}
        >
          <ShoppingCart size={18} />
          Take Order (POS)
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
          onClick={() => setActiveTab('staff')}
          style={{
            ...styles.tabButton, 
            color: activeTab === 'staff' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'staff' ? '2px solid var(--primary)' : 'none',
          }}
        >
          <Users size={18} />
          Staff Registry
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
        {/* ORDERS TAB */}
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
                <div style={styles.orderListContainer}>
                  {filteredOrders.map((o) => (
                    <div 
                      key={o.id} 
                      onClick={() => handleViewOrder(o)}
                      style={{
                        ...styles.orderRow,
                        borderColor: selectedOrder?.id === o.id ? 'var(--primary)' : 'var(--border-color)',
                        backgroundColor: selectedOrder?.id === o.id ? 'var(--bg-surface-elevated)' : 'transparent',
                      }}
                    >
                      <div style={styles.orderRowMeta}>
                        <strong style={{ fontSize: '15px' }}>{o.restaurant_tables?.table_number || 'N/A'}</strong>
                        <span style={styles.orderTime}>{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      
                      <div style={styles.orderRowDetails}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Created by: {o.created_by}</span>
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
                  ))}
                </div>
              )}
            </div>

            {/* ORDER DETAILS PANEL */}
            <div style={styles.panel} className="glass">
              {selectedOrder ? (
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
                    <div><strong>Placed by:</strong> {selectedOrder.created_by}</div>
                    <div><strong>Time Placed:</strong> {new Date(selectedOrder.created_at).toLocaleTimeString()}</div>
                    {selectedOrder.confirmed_by && (
                      <div><strong>Confirmed by:</strong> {selectedOrder.confirmed_by}</div>
                    )}
                    <div><strong>Current Status:</strong> {selectedOrder.status.toUpperCase()}</div>
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
                            <div key={item.id} style={{ ...styles.itemRow, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
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

                        {/* Searchable menu list to add items */}
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
                          <label style={{ ...styles.label, marginBottom: '6px' }}>Edit Special Instructions</label>
                          <textarea
                            style={{ width: '100%', height: '60px' }}
                            value={editOrderNotes}
                            onChange={(e) => setEditOrderNotes(e.target.value)}
                            placeholder="Allergy details, spiciness, etc."
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

                    {/* Discount Input UI */}
                    {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && !isEditingOrder && (
                      <div style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-color)',
                        marginTop: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🏷️ Order Discount
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            value={discountType}
                            onChange={(e) => {
                              const val = e.target.value as 'none' | 'percentage' | 'amount';
                              setDiscountType(val);
                              if (val === 'none') setDiscountValue('');
                            }}
                            style={{
                              flex: '0 0 120px',
                              padding: '6px',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              height: '34px',
                              fontSize: '13px',
                              outline: 'none'
                            }}
                          >
                            <option value="none">No Discount</option>
                            <option value="percentage">Percentage (%)</option>
                            <option value="amount">Amount (Rs.)</option>
                          </select>

                          {discountType !== 'none' && (
                            <input
                              type="number"
                              placeholder={discountType === 'percentage' ? '%' : 'Amount'}
                              value={discountValue}
                              onChange={(e) => setDiscountValue(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--text-main)',
                                height: '34px',
                                fontSize: '13px',
                                outline: 'none'
                              }}
                            />
                          )}

                          <button
                            onClick={handleApplyDiscount}
                            disabled={loading}
                            style={{
                              padding: '8px 14px',
                              backgroundColor: 'var(--primary)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              height: '34px',
                              transition: 'opacity 0.2s'
                            }}
                            className="glow-hover"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Subtotal, Discount & Total Area */}
                    {discountType !== 'none' && !isEditingOrder ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)' }}>
                          <span>Subtotal:</span>
                          <span>Rs. {selectedOrderItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--primary)' }}>
                          <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Flat'}):</span>
                          <span>- Rs. {
                            // Find discount amount
                            (() => {
                              let amt = 0;
                              if (selectedOrder.notes) {
                                try {
                                  const parsed = JSON.parse(selectedOrder.notes);
                                  amt = parsed.discount_amount || 0;
                                } catch (e) {}
                              }
                              return amt;
                            })()
                          }</span>
                        </div>
                        <div style={{ ...styles.totalRow, marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                          <span>Total Amount:</span>
                          <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>Rs. {selectedOrder.total_amount}</strong>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.totalRow}>
                        <span>Total Amount:</span>
                        <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>Rs. {selectedOrder.total_amount}</strong>
                      </div>
                    )}

                    {selectedOrder.notes && !isEditingOrder && (
                      <div style={styles.notesBox}>
                        <strong>Special Instructions:</strong>
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
                            >
                              Confirm Order
                            </button>
                          )}
                          
                          {selectedOrder.status === 'confirmed' && (
                            <button 
                              onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'completed')}
                              style={{ ...styles.actionBtnLarge, backgroundColor: 'var(--success)', color: '#fff' }}
                            >
                              Mark Completed / Paid
                            </button>
                          )}
                        </>
                      )}

                      <button 
                        onClick={() => setIsEditingOrder(true)}
                        style={{ ...styles.actionBtnLarge, backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                      >
                        Modify Order Items
                      </button>

                      {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'completed' && (
                        <button 
                          onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'cancelled')}
                          style={{ ...styles.actionBtnLarge, backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={styles.emptyDetails}>
                  <Info size={36} color="var(--border-color)" style={{ marginBottom: 12 }} />
                  <p>Select an order from the queue to view details and perform actions</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* POS TAB */}
        {activeTab === 'pos' && (
          <div style={{ width: '100%' }}>
            <StaffDashboard user={user} />
          </div>
        )}

        {/* TABLES TAB */}
        {activeTab === 'tables' && (
          <div className="responsive-two-column">
            {/* Table Creator Form */}
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>{editingTableId ? 'Edit Table Info' : 'Register New Dining Table'}</h2>
              <form onSubmit={handleSaveTable} style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Table Number / Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Table 10 or VIP Room 2"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Seating Capacity</label>
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
                  <button type="submit" style={styles.saveBtn}>
                    {editingTableId ? 'Update Table' : 'Add Table'}
                  </button>
                </div>
              </form>
            </div>

            {/* Tables Grid */}
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>Active Tables</h2>
              {tables.length === 0 ? (
                <div style={styles.emptyState}>No tables registered yet.</div>
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

        {/* MENU CREATOR TAB */}
        {activeTab === 'menu' && (
          <div className="responsive-two-column">
            {/* Category & Menu Item Forms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Category form */}
              <div style={styles.panel} className="glass">
                <h2 style={styles.panelTitle}>Create Menu Category</h2>
                <form onSubmit={handleSaveCategory} style={styles.formInline}>
                  <input
                    type="text"
                    placeholder="e.g. Starters, Dessert"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    required
                    style={{ flex: 1 }}
                  />
                  <button type="submit" style={styles.saveBtnInline}>
                    Add Category
                  </button>
                </form>
              </div>

              {/* Menu Item Form */}
              <div style={styles.panel} className="glass">
                <h2 style={styles.panelTitle}>{editingMenuItemId ? 'Edit Menu Item' : 'Create Menu Item'}</h2>
                <form onSubmit={handleSaveMenuItem} style={styles.form}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Item Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Chicken Alfredo"
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
                        placeholder="e.g. 450"
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
                        <option value="">No Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Item Image (URL or Upload)</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/photo-... or data:image..."
                        value={itemImage}
                        onChange={(e) => setItemImage(e.target.value)}
                        style={{ flex: 1, minWidth: '200px' }}
                      />
                      <label style={{
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-main)',
                      }}>
                        <Image size={16} color="var(--primary)" />
                        Upload
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          style={{ display: 'none' }} 
                        />
                      </label>
                    </div>
                    {itemImage && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={itemImage} 
                          alt="Preview" 
                          style={{ width: '50px', height: '50px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setItemImage('')} 
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'transparent',
                            color: 'var(--danger)',
                            border: '1px solid var(--danger)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          Remove Image
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Description</label>
                    <textarea
                      placeholder="Short description of ingredients/portions"
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
                    <button type="submit" style={styles.saveBtn}>
                      {editingMenuItemId ? 'Update Item' : 'Add Menu Item'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Menu Items List */}
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>Menu Offerings</h2>
              
              {/* Category Filter for Menu Creator */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCreatorCategory('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    backgroundColor: selectedCreatorCategory === 'all' ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                    color: selectedCreatorCategory === 'all' ? '#fff' : 'var(--text-muted)',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  All Items
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCreatorCategory(c.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backgroundColor: selectedCreatorCategory === c.id ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                      color: selectedCreatorCategory === c.id ? '#fff' : 'var(--text-muted)',
                      transition: 'var(--transition-fast)',
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {filteredMenuItems.length === 0 ? (
                <div style={styles.emptyState}>No menu items found in this category.</div>
              ) : (
                <div style={styles.menuItemsListGrid}>
                  {filteredMenuItems.map((item) => (
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
                          <span style={styles.menuCardPrice}>
                            {item.price > 0 ? `Rs. ${item.price}` : 'Free/Optional'}
                          </span>
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

        {/* STAFF REGISTRY TAB */}
        {activeTab === 'staff' && (
          <div className="responsive-two-column">
            {/* Create Staff Form */}
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>{editingStaffId ? 'Edit Staff Credentials' : 'Register New Staff Member'}</h2>
              <form onSubmit={handleSaveStaff} style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Username</label>
                  <input
                    type="text"
                    placeholder="e.g. johndoe"
                    value={staffUsername}
                    onChange={(e) => setStaffUsername(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Password</label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.formBtnGroup}>
                  {editingStaffId && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingStaffId(null);
                        setStaffName('');
                        setStaffUsername('');
                        setStaffPassword('');
                      }}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" style={styles.saveBtn}>
                    {editingStaffId ? 'Update Credentials' : 'Create Staff Member'}
                  </button>
                </div>
              </form>
            </div>

            {/* Staff List */}
            <div style={styles.panel} className="glass">
              <h2 style={styles.panelTitle}>Active Staff Members</h2>
              {staffList.length === 0 ? (
                <div style={styles.emptyState}>No staff members registered yet.</div>
              ) : (
                <div style={styles.gridContainer}>
                  {staffList.map((s) => (
                    <div key={s.id} style={styles.staffCard}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{s.name}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Username: <code>{s.username}</code>
                        </p>
                      </div>
                      <div style={styles.cardActions}>
                        <button onClick={() => handleEditStaff(s)} style={styles.iconBtnEdit} title="Edit credentials">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteStaff(s.id)} style={styles.iconBtnDelete} title="Delete">
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
                    id="show_price"
                    checked={kotSettings.show_price}
                    onChange={(e) => setKotSettings({ ...kotSettings, show_price: e.target.checked })}
                    style={{ width: 'auto', cursor: 'pointer' }}
                  />
                  <label htmlFor="show_price" style={{ ...styles.label, marginBottom: 0, cursor: 'pointer' }}>
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
};
