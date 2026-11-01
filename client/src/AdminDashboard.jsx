import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  ClipboardList,
  Users,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Eye,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle2,
  Menu,
  Clock,
  MapPin,
  Phone,
  Mail,
  Store,
  DollarSign,
  Leaf,
  Flame,
  ArrowRight
} from 'lucide-react';
import { api, resolveImageUrl } from './api';

const money = (value) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0
  }).format(value || 0);

const emptyFood = {
  name: '',
  description: '',
  category: '',
  basePrice: '',
  image: '',
  isAvailable: true,
  isVegetarian: false
};

// Valid status transitions
const statusTransitions = {
  'Order Placed': ['Order Confirmed', 'Cancelled'],
  'Order Confirmed': ['Preparing', 'Cancelled'],
  'Preparing': ['Out for Delivery', 'Cancelled'],
  'Ready for Pickup': ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Cancelled'],
  'Delivered': [],
  'Cancelled': [],
  'Rejected': []
};

// Display labels for backend status strings
const statusDisplayMap = {
  'Order Placed': 'Pending',
  'Order Confirmed': 'Confirmed',
  'Preparing': 'Preparing',
  'Ready for Pickup': 'Ready for Pickup',
  'Out for Delivery': 'Out for Delivery',
  'Delivered': 'Delivered',
  'Cancelled': 'Cancelled',
  'Rejected': 'Rejected',
  'Delivery Failed': 'Delivery Failed'
};

function formatStatus(status) {
  return statusDisplayMap[status] || status;
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Order Placed':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Order Confirmed':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Preparing':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Ready for Pickup':
    case 'Out for Delivery':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Delivered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled':
    case 'Rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'foods', label: 'Manage Foods', icon: UtensilsCrossed },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'orders', label: 'Manage Orders', icon: ClipboardList },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'contact', label: 'Contact details', icon: Store }
];

const defaultContactDetails = {
  serviceArea: 'Colombo & selected areas',
  availabilityNote: 'Delivery availability is confirmed when your order is placed.',
  openingHours: 'Every day · 10:00 AM – 10:00 PM',
  customerCareNote: 'Questions about an order? We’d love to help.',
  phone: '',
  email: ''
};

export function AdminDashboard({ user, onLogout, onExit, onUnauthorized }) {
  const [section, setSection] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [contactDetails, setContactDetails] = useState(defaultContactDetails);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals & Forms
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [foodForm, setFoodForm] = useState(emptyFood);
  const [editingFood, setEditingFood] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'food'|'category', item }
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);

  // Filters & Search
  const [foodSearch, setFoodSearch] = useState('');
  const [foodCategoryFilter, setFoodCategoryFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const fileInputRef = useRef(null);

  async function loadAllData() {
    setLoading(true);
    setError('');
    try {
      const [dash, foodList, categoryList, orderList, customerList, contact] = await Promise.all([
        api('/admin/dashboard'),
        api('/admin/foods'),
        api('/admin/categories'),
        api('/orders/admin/all'),
        api('/admin/customers'),
        api('/admin/contact')
      ]);
      setDashboardData(dash);
      setFoods(foodList);
      setCategories(categoryList);
      setOrders(orderList);
      setCustomers(customerList);
      setContactDetails(contact);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
      if (err.status === 401 || err.status === 403) {
        if (onUnauthorized) onUnauthorized();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  function notify(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  }

  function handleAuthError(err) {
    setError(err.message || 'Operation failed.');
    if (err.status === 401 || err.status === 403) {
      if (onUnauthorized) onUnauthorized();
    }

    async function handleSaveContactDetails(e) {
      e.preventDefault();
      setSaving(true);
      setError('');
      try {
        const saved = await api('/admin/contact', {
          method: 'PATCH',
          body: JSON.stringify(contactDetails)
        });
        setContactDetails(saved);
        notify('Contact details saved and published to the storefront.');
      } catch (err) {
        handleAuthError(err);
      } finally {
        setSaving(false);
      }
    }
  }

  // --- Food Operations ---
  function openAddFood() {
    setEditingFood(null);
    setFoodForm(emptyFood);
    setError('');
    setFoodModalOpen(true);
  }

  function openEditFood(food) {
    setEditingFood(food);
    setFoodForm({
      name: food.name || '',
      description: food.description || '',
      category: food.category?._id || '',
      basePrice: String(food.basePrice ?? ''),
      image: food.image || '',
      isAvailable: food.isAvailable !== false,
      isVegetarian: Boolean(food.isVegetarian)
    });
    setError('');
    setFoodModalOpen(true);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      setError('Please upload a JPEG, PNG, WebP or AVIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file must be less than 5 MB.');
      return;
    }

    setUploadingImage(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api('/admin/uploads', {
        method: 'POST',
        body: formData
      });
      if (res?.url) {
        setFoodForm((prev) => ({ ...prev, image: res.url }));
        notify('Image uploaded successfully.');
      }
    } catch (err) {
      setError(err.message || 'Image upload failed. You can paste an image URL instead.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveFood(e) {
    e.preventDefault();
    if (!foodForm.name.trim()) {
      setError('Food name is required.');
      return;
    }
    if (!foodForm.category) {
      setError('Please select a food category.');
      return;
    }
    const price = Number(foodForm.basePrice);
    if (isNaN(price) || price < 0) {
      setError('Please enter a valid price (0 or greater).');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: foodForm.name.trim(),
        description: foodForm.description.trim(),
        category: foodForm.category,
        basePrice: price,
        image: foodForm.image.trim(),
        isAvailable: foodForm.isAvailable,
        isVegetarian: foodForm.isVegetarian
      };

      if (editingFood) {
        await api(`/admin/foods/${editingFood._id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        notify(`"${payload.name}" updated successfully.`);
      } else {
        await api('/admin/foods', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        notify(`"${payload.name}" added to menu.`);
      }

      setFoodModalOpen(false);
      setFoodForm(emptyFood);
      setEditingFood(null);
      await loadAllData();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleFoodAvailability(food) {
    setSaving(true);
    try {
      await api(`/admin/foods/${food._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !food.isAvailable })
      });
      notify(`"${food.name}" is now ${food.isAvailable ? 'Unavailable' : 'Available'}.`);
      await loadAllData();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFood(food) {
    setSaving(true);
    setError('');
    try {
      await api(`/admin/foods/${food._id}`, { method: 'DELETE' });
      notify(`"${food.name}" deleted successfully.`);
      setDeleteConfirm(null);
      await loadAllData();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSaving(false);
    }
  }

  // --- Category Operations ---
  function openAddCategory() {
    setEditingCategory(null);
    setCategoryNameInput('');
    setError('');
    setCategoryModalOpen(true);
  }

  function openEditCategory(cat) {
    setEditingCategory(cat);
    setCategoryNameInput(cat.name || '');
    setError('');
    setCategoryModalOpen(true);
  }

  async function handleSaveCategory(e) {
    e.preventDefault();
    const name = categoryNameInput.trim();
    if (!name) {
      setError('Category name cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingCategory) {
        await api(`/admin/categories/${editingCategory._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name })
        });
        notify(`Category "${name}" updated.`);
      } else {
        await api('/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name })
        });
        notify(`Category "${name}" created.`);
      }
      setCategoryModalOpen(false);
      setCategoryNameInput('');
      setEditingCategory(null);
      await loadAllData();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(category) {
    if (category.foodCount > 0) {
      setError(`Cannot delete "${category.name}": It currently has ${category.foodCount} food item(s). Reassign or delete them first.`);
      setDeleteConfirm(null);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api(`/admin/categories/${category._id}`, { method: 'DELETE' });
      notify(`Category "${category.name}" deleted.`);
      setDeleteConfirm(null);
      await loadAllData();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSaving(false);
    }
  }

  // --- Order Operations ---
  async function handleUpdateOrderStatus(order, nextStatus) {
    if (!nextStatus || nextStatus === order.orderStatus) return;

    setSaving(true);
    setError('');
    try {
      await api(`/orders/${order._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      notify(`Order ${order.orderNumber} updated to ${formatStatus(nextStatus)}.`);

      // Update selected order modal if open
      if (selectedOrder && selectedOrder._id === order._id) {
        setSelectedOrder((prev) => ({ ...prev, orderStatus: nextStatus }));
      }
      await loadAllData();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSaving(false);
    }
  }

  // --- Customer Operations ---
  async function openCustomerHistory(customer) {
    setSelectedCustomer(customer);
    setCustomerOrders([]);
    setCustomerOrdersLoading(true);
    try {
      const orders = await api(`/admin/customers/${customer._id}/orders`);
      setCustomerOrders(orders || []);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setCustomerOrdersLoading(false);
    }
  }

  // --- Filtered Views ---
  const filteredFoods = useMemo(() => {
    const term = foodSearch.trim().toLowerCase();
    return foods.filter((f) => {
      const matchesSearch = !term || f.name.toLowerCase().includes(term);
      const matchesCategory = !foodCategoryFilter || f.category?._id === foodCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [foods, foodSearch, foodCategoryFilter]);

  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesStatus = !orderStatusFilter || o.orderStatus === orderStatusFilter;
      const matchesSearch =
        !term ||
        o.orderNumber?.toLowerCase().includes(term) ||
        o.customer?.name?.toLowerCase().includes(term) ||
        o.deliveryAddressSnapshot?.name?.toLowerCase().includes(term) ||
        o.deliveryAddressSnapshot?.phone?.includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    return customers.filter((c) => {
      return (
        !term ||
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term)
      );
    });
  }, [customers, customerSearch]);

  const currentTitle = navItems.find((n) => n.id === section)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 text-white rounded-xl flex items-center justify-center font-extrabold text-xl shadow-sm -rotate-6">
              t
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-gray-900 block leading-none">
                TOMATO<span className="text-red-600">.</span>
              </span>
              <span className="text-[9px] tracking-widest font-bold text-gray-400 uppercase mt-0.5 block">
                Admin Panel
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto" aria-label="Admin Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} className={active ? 'text-white' : 'text-gray-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom User & Logout Section */}
        <div className="p-4 border-t border-gray-100 space-y-2">
          {onExit && (
            <button
              onClick={onExit}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Store size={16} className="text-gray-400" />
              <span>Customer Storefront</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-500 hover:text-gray-700 p-1.5 -ml-1 rounded-lg hover:bg-gray-100"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{currentTitle}</h1>
              <p className="text-xs text-gray-400 hidden sm:block">TOMATO Restaurant Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAllData}
              disabled={loading}
              title="Refresh all data"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin text-red-600' : ''} />
            </button>

            {onExit && (
              <button
                onClick={onExit}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-colors"
              >
                <Store size={14} />
                <span>Storefront</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                {user?.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <span className="font-semibold text-gray-800 block leading-tight">
                  {user?.name || 'Administrator'}
                </span>
                <span className="text-[10px] text-gray-400">Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Notification Banners */}
        {error && (
          <div className="mx-4 sm:mx-8 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700 shadow-sm" role="alert">
            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-700">
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="mx-4 sm:mx-8 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-sm text-emerald-800 shadow-sm" role="status">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{success}</div>
            <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-700">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content Body */}
        <main className="p-4 sm:p-8 flex-1">
          {loading && !dashboardData ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Loading restaurant data...</p>
            </div>
          ) : (
            <>
              {/* SECTION: DASHBOARD */}
              {section === 'dashboard' && (
                <div className="space-y-8">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Total Foods */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Total Foods
                        </p>
                        <h3 className="text-2xl font-black text-gray-900 mt-1">
                          {dashboardData?.foodCount ?? foods.length}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Active menu items</p>
                      </div>
                      <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                        <UtensilsCrossed size={22} />
                      </div>
                    </div>

                    {/* Total Orders */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Total Orders
                        </p>
                        <h3 className="text-2xl font-black text-gray-900 mt-1">
                          {dashboardData?.totalOrders ?? orders.length}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Lifetime orders placed</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <ClipboardList size={22} />
                      </div>
                    </div>

                    {/* Pending Orders */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Pending Orders
                        </p>
                        <h3 className="text-2xl font-black text-amber-600 mt-1">
                          {dashboardData?.pendingOrders ??
                            orders.filter((o) =>
                              ['Order Placed', 'Order Confirmed', 'Preparing'].includes(
                                o.orderStatus
                              )
                            ).length}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Awaiting fulfillment</p>
                      </div>
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <Clock size={22} />
                      </div>
                    </div>

                    {/* Total Customers */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Total Customers
                        </p>
                        <h3 className="text-2xl font-black text-emerald-600 mt-1">
                          {dashboardData?.customerCount ?? customers.length}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Registered accounts</p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <Users size={22} />
                      </div>
                    </div>
                  </div>

                  {/* Recent Orders Section */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4.5 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-gray-900">Recent Orders</h2>
                        <p className="text-xs text-gray-400">Latest activity from your customers</p>
                      </div>
                      <button
                        onClick={() => setSection('orders')}
                        className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <span>View all orders</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/75 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-3.5">Order ID</th>
                            <th className="px-6 py-3.5">Customer Name</th>
                            <th className="px-6 py-3.5">Order Date</th>
                            <th className="px-6 py-3.5">Total Amount</th>
                            <th className="px-6 py-3.5">Order Status</th>
                            <th className="px-6 py-3.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(dashboardData?.recentOrders?.length ? dashboardData.recentOrders : orders.slice(0, 8)).map(
                            (order) => (
                              <tr key={order._id} className="hover:bg-gray-50/60 transition-colors">
                                <td className="px-6 py-4 font-mono font-bold text-gray-900">
                                  {order.orderNumber}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-800">
                                  {order.customer?.name ||
                                    order.deliveryAddressSnapshot?.name ||
                                    'Customer'}
                                </td>
                                <td className="px-6 py-4 text-gray-500 text-xs">
                                  {new Date(order.createdAt).toLocaleDateString()}{' '}
                                  <span className="text-gray-400">
                                    {new Date(order.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-semibold text-gray-900">
                                  {money(order.totalAmount)}
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                                      order.orderStatus
                                    )}`}
                                  >
                                    {formatStatus(order.orderStatus)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => setSelectedOrder(order)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                                  >
                                    <Eye size={13} />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            )
                          )}
                          {(!dashboardData?.recentOrders?.length && !orders.length) && (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-gray-400">
                                <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
                                <p className="font-semibold text-gray-600">No orders placed yet</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Customer orders will appear here in real-time.
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: MANAGE FOODS */}
              {section === 'foods' && (
                <div className="space-y-6">
                  {/* Top Bar with Search, Category Filter, and Add Button */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          value={foodSearch}
                          onChange={(e) => setFoodSearch(e.target.value)}
                          placeholder="Search foods by name..."
                          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                        {foodSearch && (
                          <button
                            onClick={() => setFoodSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <select
                        value={foodCategoryFilter}
                        onChange={(e) => setFoodCategoryFilter(e.target.value)}
                        className="py-2 px-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">All Categories</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={openAddFood}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors shrink-0"
                    >
                      <Plus size={17} />
                      <span>Add New Food</span>
                    </button>
                  </div>

                  {/* Foods Table */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/75 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-3.5">Food Item</th>
                            <th className="px-6 py-3.5">Category</th>
                            <th className="px-6 py-3.5">Price (LKR)</th>
                            <th className="px-6 py-3.5">Availability</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredFoods.map((food) => (
                            <tr key={food._id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                    {food.image ? (
                                      <img
                                        src={resolveImageUrl(food.image)}
                                        alt={food.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <UtensilsCrossed size={18} className="text-gray-300" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-gray-900">{food.name}</span>
                                      {food.isVegetarian && (
                                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.2 rounded">
                                          Veg
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-1 max-w-sm mt-0.5">
                                      {food.description || 'No description added'}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                  {food.category?.name || 'Uncategorized'}
                                </span>
                              </td>

                              <td className="px-6 py-4 font-bold text-gray-900">
                                {money(food.basePrice)}
                              </td>

                              <td className="px-6 py-4">
                                <button
                                  type="button"
                                  onClick={() => handleToggleFoodAvailability(food)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                                    food.isAvailable
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                  }`}
                                  title="Click to toggle availability"
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      food.isAvailable ? 'bg-emerald-600' : 'bg-gray-400'
                                    }`}
                                  />
                                  <span>{food.isAvailable ? 'Available' : 'Unavailable'}</span>
                                </button>
                              </td>

                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    onClick={() => openEditFood(food)}
                                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Edit food item"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm({ type: 'food', item: food })}
                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Delete food item"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {!filteredFoods.length && (
                            <tr>
                              <td colSpan={5} className="text-center py-12 text-gray-400">
                                <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-40" />
                                <p className="font-semibold text-gray-600">No food items found</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Try adjusting your search or add a new menu item.
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: CATEGORIES */}
              {section === 'categories' && (
                <div className="space-y-6">
                  {/* Category Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Food Categories</h2>
                      <p className="text-xs text-gray-400">
                        Organize your menu into structured food categories
                      </p>
                    </div>
                    <button
                      onClick={openAddCategory}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
                    >
                      <Plus size={17} />
                      <span>Add Category</span>
                    </button>
                  </div>

                  {/* Categories Table */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/75 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-3.5">Category Name</th>
                            <th className="px-6 py-3.5">Food Items Count</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {categories.map((cat) => (
                            <tr key={cat._id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-bold text-gray-900">{cat.name}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                  {cat.foodCount || 0} items
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    onClick={() => openEditCategory(cat)}
                                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Edit category"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setDeleteConfirm({ type: 'category', item: cat })
                                    }
                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Delete category"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {!categories.length && (
                            <tr>
                              <td colSpan={3} className="text-center py-12 text-gray-400">
                                <Layers size={32} className="mx-auto mb-2 opacity-40" />
                                <p className="font-semibold text-gray-600">No categories found</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Add your first menu category to get started.
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: MANAGE ORDERS */}
              {section === 'orders' && (
                <div className="space-y-6">
                  {/* Orders Toolbar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          placeholder="Search order ID or customer..."
                          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        {orderSearch && (
                          <button
                            onClick={() => setOrderSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <select
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                        className="py-2 px-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">All Statuses</option>
                        <option value="Order Placed">Pending</option>
                        <option value="Order Confirmed">Confirmed</option>
                        <option value="Preparing">Preparing</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/75 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-3.5">Order ID</th>
                            <th className="px-6 py-3.5">Customer</th>
                            <th className="px-6 py-3.5">Order Date</th>
                            <th className="px-6 py-3.5">Food Items</th>
                            <th className="px-6 py-3.5">Total Amount</th>
                            <th className="px-6 py-3.5">Payment</th>
                            <th className="px-6 py-3.5">Order Status</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredOrders.map((order) => {
                            const validNextStatuses = statusTransitions[order.orderStatus] || [];
                            const isTerminal = ['Delivered', 'Cancelled', 'Rejected'].includes(
                              order.orderStatus
                            );

                            return (
                              <tr key={order._id} className="hover:bg-gray-50/60 transition-colors">
                                <td className="px-6 py-4 font-mono font-bold text-gray-900">
                                  {order.orderNumber}
                                </td>

                                <td className="px-6 py-4">
                                  <div className="font-semibold text-gray-900">
                                    {order.customer?.name ||
                                      order.deliveryAddressSnapshot?.name ||
                                      'Customer'}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {order.deliveryAddressSnapshot?.phone ||
                                      order.customer?.phone ||
                                      '—'}
                                  </div>
                                </td>

                                <td className="px-6 py-4 text-xs text-gray-500">
                                  {new Date(order.createdAt).toLocaleDateString()}{' '}
                                  <span className="text-gray-400">
                                    {new Date(order.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </td>

                                <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                                  <p className="line-clamp-2">
                                    {order.itemsSnapshot
                                      ?.map((item) => `${item.quantity} × ${item.name}`)
                                      .join(', ') || '—'}
                                  </p>
                                </td>

                                <td className="px-6 py-4 font-bold text-gray-900">
                                  {money(order.totalAmount)}
                                </td>

                                <td className="px-6 py-4 text-xs">
                                  <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                    {order.paymentMethod === 'cash_on_delivery'
                                      ? 'Cash on Delivery'
                                      : order.paymentMethod}
                                  </span>
                                </td>

                                <td className="px-6 py-4">
                                  {isTerminal ? (
                                    <span
                                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                                        order.orderStatus
                                      )}`}
                                    >
                                      {formatStatus(order.orderStatus)}
                                    </span>
                                  ) : (
                                    <select
                                      value={order.orderStatus}
                                      onChange={(e) =>
                                        handleUpdateOrderStatus(order, e.target.value)
                                      }
                                      disabled={saving}
                                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer ${getStatusBadgeClass(
                                        order.orderStatus
                                      )}`}
                                    >
                                      <option value={order.orderStatus}>
                                        {formatStatus(order.orderStatus)}
                                      </option>
                                      {validNextStatuses.map((st) => (
                                        <option key={st} value={st}>
                                          → {formatStatus(st)}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>

                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => setSelectedOrder(order)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                                  >
                                    <Eye size={13} />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {!filteredOrders.length && (
                            <tr>
                              <td colSpan={8} className="text-center py-12 text-gray-400">
                                <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
                                <p className="font-semibold text-gray-600">No orders match filter</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Try clearing the search or status filter.
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: CUSTOMERS */}
              {section === 'customers' && (
                <div className="space-y-6">
                  {/* Customers Toolbar */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search name, email, or phone..."
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      {customerSearch && (
                        <button
                          onClick={() => setCustomerSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customers Table */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/75 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-3.5">Customer Name</th>
                            <th className="px-6 py-3.5">Email</th>
                            <th className="px-6 py-3.5">Contact Number</th>
                            <th className="px-6 py-3.5">Registration Date</th>
                            <th className="px-6 py-3.5">Total Orders</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredCustomers.map((c) => (
                            <tr key={c._id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center">
                                    {c.name ? c.name[0].toUpperCase() : 'U'}
                                  </div>
                                  <span className="font-bold text-gray-900">{c.name}</span>
                                </div>
                              </td>

                              <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                                {c.email}
                              </td>

                              <td className="px-6 py-4 text-gray-600 text-xs">
                                {c.phone || '—'}
                              </td>

                              <td className="px-6 py-4 text-xs text-gray-500">
                                {new Date(c.createdAt).toLocaleDateString()}
                              </td>

                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                  {c.orderCount || 0} orders
                                </span>
                              </td>

                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => openCustomerHistory(c)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                                >
                                  <ClipboardList size={13} />
                                  <span>Order History</span>
                                </button>
                              </td>
                            </tr>
                          ))}

                          {!filteredCustomers.length && (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-gray-400">
                                <Users size={32} className="mx-auto mb-2 opacity-40" />
                                <p className="font-semibold text-gray-600">No customers found</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Customer accounts registered on TOMATO will appear here.
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {section === 'contact' && (
                <form onSubmit={handleSaveContactDetails} className="max-w-3xl space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-7">
                    <div className="mb-6">
                      <h2 className="text-base font-bold text-gray-900">Storefront contact page</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Update the details customers see under Contact. Changes are published when you save.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                        Service area
                        <input
                          required
                          maxLength={160}
                          value={contactDetails.serviceArea}
                          onChange={(e) => setContactDetails({ ...contactDetails, serviceArea: e.target.value })}
                          placeholder="Colombo and nearby areas"
                          className="w-full px-3.5 py-2.5 text-sm font-normal bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                        Opening hours
                        <input
                          required
                          maxLength={160}
                          value={contactDetails.openingHours}
                          onChange={(e) => setContactDetails({ ...contactDetails, openingHours: e.target.value })}
                          placeholder="Every day, 10:00 AM – 10:00 PM"
                          className="w-full px-3.5 py-2.5 text-sm font-normal bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                        Business phone
                        <input
                          type="tel"
                          maxLength={40}
                          value={contactDetails.phone}
                          onChange={(e) => setContactDetails({ ...contactDetails, phone: e.target.value })}
                          placeholder="07X XXX XXXX"
                          className="w-full px-3.5 py-2.5 text-sm font-normal bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                        Business email
                        <input
                          type="email"
                          maxLength={254}
                          value={contactDetails.email}
                          onChange={(e) => setContactDetails({ ...contactDetails, email: e.target.value })}
                          placeholder="hello@example.com"
                          className="w-full px-3.5 py-2.5 text-sm font-normal bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-gray-700 sm:col-span-2">
                        Delivery availability note
                        <textarea
                          required
                          maxLength={240}
                          rows={2}
                          value={contactDetails.availabilityNote}
                          onChange={(e) => setContactDetails({ ...contactDetails, availabilityNote: e.target.value })}
                          placeholder="Delivery availability is confirmed when your order is placed."
                          className="w-full px-3.5 py-2.5 text-sm font-normal bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-gray-700 sm:col-span-2">
                        Customer care message
                        <textarea
                          required
                          maxLength={240}
                          rows={2}
                          value={contactDetails.customerCareNote}
                          onChange={(e) => setContactDetails({ ...contactDetails, customerCareNote: e.target.value })}
                          placeholder="Questions about an order? We’d love to help."
                          className="w-full px-3.5 py-2.5 text-sm font-normal bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
                        />
                      </label>
                    </div>
                    <div className="mt-6 flex justify-end border-t border-gray-100 pt-5">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save contact details'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          )}
        </main>
      </div>

      {/* --- MODALS --- */}

      {/* ADD / EDIT FOOD MODAL */}
      {foodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingFood ? 'Edit Food Item' : 'Add New Food Item'}
              </h3>
              <button
                onClick={() => setFoodModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFood} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Food Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  placeholder="e.g. Chicken Kottu"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={foodForm.category}
                    onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Price (LKR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={foodForm.basePrice}
                    onChange={(e) => setFoodForm({ ...foodForm, basePrice: e.target.value })}
                    placeholder="e.g. 1250"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Food Image
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={foodForm.image}
                      onChange={(e) => setFoodForm({ ...foodForm, image: e.target.value })}
                      placeholder="Paste image URL (https://...)"
                      className="flex-1 px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg transition-colors shrink-0"
                    >
                      <Upload size={14} />
                      <span>{uploadingImage ? 'Uploading...' : 'Upload'}</span>
                    </button>
                  </div>

                  {foodForm.image && (
                    <div className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <img
                        src={resolveImageUrl(foodForm.image)}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-md"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="text-xs text-gray-500 truncate flex-1">
                        {foodForm.image}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFoodForm({ ...foodForm, image: '' })}
                        className="text-gray-400 hover:text-rose-600 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={foodForm.description}
                  onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                  placeholder="Describe ingredients, flavours, serving details..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={foodForm.isAvailable}
                    onChange={(e) =>
                      setFoodForm({ ...foodForm, isAvailable: e.target.checked })
                    }
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <span>Available to order</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={foodForm.isVegetarian}
                    onChange={(e) =>
                      setFoodForm({ ...foodForm, isVegetarian: e.target.checked })
                    }
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="flex items-center gap-1">
                    <Leaf size={13} className="text-emerald-600" />
                    <span>Vegetarian dish</span>
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setFoodModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingFood ? 'Save Changes' : 'Add Food'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT CATEGORY MODAL */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={categoryNameInput}
                  onChange={(e) => setCategoryNameInput(e.target.value)}
                  placeholder="e.g. Kottu, Pizza, Desserts"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              Delete {deleteConfirm.type === 'food' ? 'Food Item' : 'Category'}?
            </h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              Are you sure you want to permanently delete{' '}
              <strong className="text-gray-800 font-semibold">
                "{deleteConfirm.item?.name}"
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.type === 'food') handleDeleteFood(deleteConfirm.item);
                  else handleDeleteCategory(deleteConfirm.item);
                }}
                disabled={saving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-gray-200 relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <span className="text-xs font-mono font-bold text-gray-500 uppercase">
                  Order Details
                </span>
                <h3 className="text-lg font-mono font-bold text-gray-900">
                  {selectedOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="py-4 space-y-5 text-sm">
              {/* Order Status Ribbon */}
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Current Status
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(
                      selectedOrder.orderStatus
                    )}`}
                  >
                    {formatStatus(selectedOrder.orderStatus)}
                  </span>
                </div>
              </div>

              {/* Customer & Delivery Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Customer Name</span>
                  <span className="font-bold text-gray-800 text-sm">
                    {selectedOrder.customer?.name ||
                      selectedOrder.deliveryAddressSnapshot?.name ||
                      'Customer'}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block mb-0.5">Contact Number</span>
                  <span className="font-bold text-gray-800">
                    {selectedOrder.deliveryAddressSnapshot?.phone ||
                      selectedOrder.customer?.phone ||
                      '—'}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-gray-400 block mb-0.5">Delivery Address</span>
                  <span className="font-medium text-gray-800">
                    {[
                      selectedOrder.deliveryAddressSnapshot?.line1,
                      selectedOrder.deliveryAddressSnapshot?.city
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </span>
                  {selectedOrder.deliveryAddressSnapshot?.instructions && (
                    <span className="text-[11px] text-gray-500 block mt-0.5 italic">
                      Instructions: "{selectedOrder.deliveryAddressSnapshot.instructions}"
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-gray-400 block mb-0.5">Order Placed</span>
                  <span className="font-medium text-gray-800">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block mb-0.5">Payment Method</span>
                  <span className="font-bold text-gray-800">
                    {selectedOrder.paymentMethod === 'cash_on_delivery'
                      ? 'Cash on Delivery'
                      : selectedOrder.paymentMethod}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Ordered Items
                </h4>
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                  {(selectedOrder.itemsSnapshot || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <span className="font-bold text-gray-800">
                          {item.quantity} × {item.name}
                        </span>
                        <span className="text-gray-400 block text-[11px]">
                          {money(item.unitPrice)} each
                        </span>
                      </div>
                      <span className="font-bold text-gray-900">{money(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Financial Breakdown */}
              <div className="space-y-1.5 pt-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-800">
                    {money(selectedOrder.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-gray-800">
                    {money(selectedOrder.deliveryFee)}
                  </span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount {selectedOrder.couponCode ? `(${selectedOrder.couponCode})` : ''}</span>
                    <span>-{money(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200 text-sm font-bold text-gray-900">
                  <span>Total Amount</span>
                  <span className="text-red-600 text-base">{money(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              {/* Quick Status Update in Details Modal */}
              {(statusTransitions[selectedOrder.orderStatus]?.length > 0) && (
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Update Status:</span>
                  <div className="flex gap-2">
                    {statusTransitions[selectedOrder.orderStatus].map((nextSt) => (
                      <button
                        key={nextSt}
                        onClick={() => handleUpdateOrderStatus(selectedOrder, nextSt)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition-colors"
                      >
                        Mark {formatStatus(nextSt)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER ORDER HISTORY MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-gray-200 relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Customer Profile
                </span>
                <h3 className="text-lg font-bold text-gray-900">{selectedCustomer.name}</h3>
                <p className="text-xs text-gray-500">
                  {selectedCustomer.email} · {selectedCustomer.phone || 'No phone recorded'}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="py-4">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                Order History ({customerOrders.length})
              </h4>

              {customerOrdersLoading ? (
                <div className="py-12 text-center text-gray-400">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Loading customer orders...</p>
                </div>
              ) : customerOrders.length ? (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {customerOrders.map((ord) => (
                    <div
                      key={ord._id}
                      className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900">
                            {ord.orderNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(
                              ord.orderStatus
                            )}`}
                          >
                            {formatStatus(ord.orderStatus)}
                          </span>
                        </div>
                        <p className="text-gray-400 mt-1">
                          {new Date(ord.createdAt).toLocaleDateString()} ·{' '}
                          {ord.itemsSnapshot?.length || 0} item type(s)
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-gray-900 block text-sm">
                          {money(ord.totalAmount)}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedOrder(ord);
                          }}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 mt-0.5 inline-block"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardList size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold text-gray-600">No orders placed yet</p>
                  <p className="text-[11px] text-gray-400">
                    This customer has not placed any orders.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
