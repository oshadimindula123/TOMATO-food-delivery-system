import { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { api } from './api';

const money = value => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(value || 0);
const transitions = {
  'Ready for Pickup': ['Out for Delivery'],
  'Out for Delivery': ['Delivered', 'Delivery Failed'],
  'Delivery Failed': ['Out for Delivery', 'Cancelled']
};

function DeliveryOrders({ orders, onStatus }) {
  return <div className="ops-order-list">{orders.map(order => <article className="ops-order" key={order._id}>
    <div className="ops-order-heading"><div><b>{order.orderNumber}</b><small>{order.deliveryAddressSnapshot?.name} · {order.deliveryAddressSnapshot?.phone} · {order.deliveryAddressSnapshot?.line1}, {order.deliveryAddressSnapshot?.city}</small></div><span className="status-pill">{order.orderStatus}</span></div>
    <div className="ops-order-items">{order.itemsSnapshot.map((item, index) => <span key={index}>{item.quantity} × {item.name}</span>)}</div>
    <div className="ops-order-footer"><b>{money(order.totalAmount)} · Cash on delivery</b><div className="ops-order-actions">{(transitions[order.orderStatus] || []).map(status => <button key={status} className="ops-small-button" onClick={() => onStatus(order, status)}>{status}</button>)}</div></div>
  </article>)}</div>;
}

export function DeliveryDashboard({ onExit, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setOrders(await api('/orders/delivery/assigned'));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function update(order, status) {
    try {
      await api(`/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <div className="ops-shell">
    <header className="ops-header"><button className="ops-brand" onClick={onExit}><span className="brand-mark">t</span><span>TOMATO<small>DELIVERY</small></span></button><div><button className="ops-quiet" onClick={onExit}><ArrowLeft size={16}/> Storefront</button><button className="ops-quiet" onClick={onLogout}><LogOut size={16}/> Log out</button></div></header>
    <main className="ops-main ops-delivery-main">
      <div className="ops-title-row"><div><div className="eyebrow">YOUR ASSIGNED ROUTE</div><h1><Truck size={28}/> Delivery orders</h1></div><button className="ops-quiet" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
      {error && <div className="ops-alert" role="alert">{error}</div>}
      {loading ? <div className="ops-loading">Loading assigned orders…</div> : orders.length ? <DeliveryOrders orders={orders} onStatus={update}/> : <section className="ops-card ops-empty"><PackageCheck size={30}/><h2>No assigned orders</h2><p>New delivery assignments will appear here.</p></section>}
    </main>
  </div>;
}
