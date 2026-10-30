import { useEffect, useMemo, useState } from 'react';
import { api, API, resolveImageUrl } from './api';
import { ShoppingBag, Search, MapPin, Clock3, ChevronRight, Plus, Minus, Trash2, UserRound, X, CheckCircle2, PackageCheck, Menu as MenuIcon, Leaf, Flame, ArrowRight, LogOut, ClipboardList } from 'lucide-react';
import { io } from 'socket.io-client';
import { AdminDashboard } from './AdminDashboard';
import { AdminLogin } from './AdminLogin';
import { DeliveryDashboard } from './Operations';
import './operations.css';

const money = value => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(value || 0);
const fallbackImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80';

function FoodImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUrl(src);
  return <img src={!failed && resolved ? resolved : fallbackImage} alt={alt} onError={() => setFailed(true)} loading="lazy" />;
}

export default function App() {
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [vegetarian, setVegetarian] = useState(false);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('tomato-cart') || '[]'); } catch { return []; } });
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [modal, setModal] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '', city: 'Colombo', instructions: '' });
  const [authMode, setAuthMode] = useState('login');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => { localStorage.setItem('tomato-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (hash === '#admin' || path === '/admin') setPage('admin');
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    window.addEventListener('popstate', checkHash);
    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('popstate', checkHash);
    };
  }, []);
  useEffect(() => { api('/foods/categories').then(setCategories).catch(e => setNotice(e.message)); api('/auth/me').then(d => setUser(d.user)).catch(() => {}); }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    if (vegetarian) params.set('vegetarian', 'true');
    api(`/foods?${params.toString()}`).then(d => setFoods(d.items || [])).catch(e => setNotice(e.message));
  }, [query, category, vegetarian]);
  useEffect(() => {
    if (!user) return;
    api('/orders/my-orders').then(setOrders).catch(() => {});
  }, [user, page]);
  useEffect(() => {
    if (!user || page !== 'tracking' || !activeOrder?._id) return;
    const socket = io(API, { withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('order:update', update => {
      if (update.orderId === activeOrder._id) {
        api(`/orders/${activeOrder._id}`).then(setActiveOrder).catch(() => {});
      }
    });
    return () => socket.disconnect();
  }, [user, page, activeOrder?._id]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.food.basePrice * item.quantity, 0);
  const deliveryFee = cart.length ? 350 : 0;
  const total = subtotal + deliveryFee - Math.min(subtotal, appliedCoupon?.discount || 0);
  const featured = useMemo(() => foods.filter(f => f.isFeatured).slice(0, 4), [foods]);
  useEffect(() => { if (appliedCoupon) setAppliedCoupon(null); }, [subtotal]);

  function addToCart(food) {
    setCart(old => {
      const found = old.find(item => item.food._id === food._id);
      return found ? old.map(item => item.food._id === food._id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item) : [...old, { food, quantity: 1 }];
    });
    setNotice(`${food.name} added to your bag`);
    setTimeout(() => setNotice(''), 2300);
  }
  function updateQuantity(id, delta) {
    setCart(old => old.map(item => item.food._id === id ? { ...item, quantity: item.quantity + delta } : item).filter(item => item.quantity > 0 && item.quantity <= 20));
  }
  async function submitAuth(e) {
    e.preventDefault(); setBusy(true);
    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/register';
      const data = await api(path, { method: 'POST', body: JSON.stringify(form) });
      setUser(data.user); setModal(''); setNotice(`Welcome${data.user.name ? `, ${data.user.name.split(' ')[0]}` : ''}!`);
      setForm(f => ({ ...f, password: '' }));
    } catch (e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    setUser(null); setPage('home'); setNotice('You have logged out.');
  }
  async function placeOrder(e) {
    e.preventDefault();
    if (!user) { setAuthMode('login'); setModal('auth'); setNotice('Please log in before placing an order.'); return; }
    if (!cart.length) return;
    setBusy(true);
    try {
      const order = await api('/orders', { method: 'POST', body: JSON.stringify({
        items: cart.map(item => ({ foodId: item.food._id, quantity: item.quantity })),
        name: form.name || user.name, phone: form.phone || user.phone || '',
        address: form.address, city: form.city, instructions: form.instructions,
        couponCode: appliedCoupon?.code
      }) });
      setCart([]); setAppliedCoupon(null); setActiveOrder(order); setPage('tracking'); setModal(''); setOrders(old => [order, ...old]);
      setNotice('Order placed successfully!');
    } catch (e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function openTracking(order) {
    try { const data = await api(`/orders/${order._id}`); setActiveOrder(data); setPage('tracking'); }
    catch (e) { setNotice(e.message); }
  }

  if (page === 'admin') {
    if (user?.role === 'admin') {
      return (
        <AdminDashboard
          user={user}
          onLogout={logout}
          onExit={() => { setPage('home'); window.location.hash = ''; }}
          onUnauthorized={async () => {
            await logout();
          }}
        />
      );
    }
    return (
      <AdminLogin
        currentUser={user}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setNotice(`Welcome back, ${loggedInUser.name}!`);
        }}
        onExit={() => { setPage('home'); window.location.hash = ''; }}
      />
    );
  }
  if (user?.role === 'delivery' && page === 'delivery') return <DeliveryDashboard onExit={() => setPage('home')} onLogout={logout}/>;
  const navItems = [['Home','home'],['Menu','menu'],['Offers','offers'],['My Orders','orders'],['Contact','contact'], ...(user?.role === 'admin' ? [['Admin','admin']] : []), ...(user?.role === 'delivery' ? [['Delivery','delivery']] : [])];
  return <div className="app-shell">
    <div className="topline"><span><MapPin size={13}/> Freshly prepared, delivered to your door</span><span className="topline-right"><Clock3 size={13}/> Daily 10:00 AM – 10:00 PM <b>•</b> Colombo & selected areas</span></div>
    <header className="header">
      <button className="brand" onClick={() => { setPage('home'); setCategory(''); }} aria-label="TOMATO home"><span className="brand-mark">t</span><span className="brand-name">TOMATO<span>.</span><small>FRESH FOOD. GOOD MOOD.</small></span></button>
      <nav className={mobileNav ? 'nav open' : 'nav'}>{navItems.map(([label, key]) => <button key={key} className={page === key ? 'nav-link active' : 'nav-link'} onClick={() => { setPage(key); setMobileNav(false); }}>{label}</button>)}</nav>
      <div className="header-actions"><button className="icon-button" onClick={() => setModal('auth')} title={user ? 'Account' : 'Login'}><UserRound size={19}/></button>{user && <button className="icon-button" onClick={logout} title="Log out"><LogOut size={17}/></button>}<button className="cart-button" onClick={() => setPage('cart')}><ShoppingBag size={18}/><span>Bag</span><b>{cartCount}</b></button><button className="mobile-toggle" onClick={() => setMobileNav(v => !v)}><MenuIcon/></button></div>
    </header>

    {cart.length > 0 && <CouponBox subtotal={subtotal} appliedCoupon={appliedCoupon} onApply={setAppliedCoupon}/>}
    {notice && <div className="toast" role="status"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}

    {page === 'home' && <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> GOOD FOOD, GOOD DAYS</div><h1>Cravings called.<br/><em>We’re on our way.</em></h1><p>Your favourites, freshly made and delivered with a little extra love.</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => setPage('menu')}>Explore menu <ArrowRight size={17}/></button><button className="btn btn-light" onClick={() => { setCategory('Pizza'); setPage('menu'); }}>Pizza favourites</button></div><div className="hero-points"><span><CheckCircle2 size={15}/> Freshly prepared</span><span><CheckCircle2 size={15}/> Easy ordering</span></div></div>
        <div className="hero-visual"><div className="hero-image"><FoodImage src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85" alt="Freshly prepared food"/></div><div className="floating-note"><span className="note-icon">✦</span><div><b>Made fresh</b><small>Just for you</small></div></div><div className="hero-stamp"><b>100%</b><span>CRAVE<br/>WORTHY</span></div></div>
      </section>
      <section className="section category-section"><div className="section-heading"><div><div className="eyebrow">WHAT ARE YOU IN THE MOOD FOR?</div><h2>Find your <em>favourite.</em></h2></div><button className="text-link" onClick={() => setPage('menu')}>View full menu <ChevronRight size={16}/></button></div><div className="category-grid">{categories.map((c, i) => <button key={c._id} className={`category-tile tile-${i % 5}`} onClick={() => { setCategory(c.slug); setPage('menu'); }}><span className="category-emoji">{['🍜','🍚','🍕','🍔','🍝','🍲','🥪','🍟','🥤','🍰'][i] || '🍴'}</span><b>{c.name}</b><small>{c.subcategories?.slice(0, 2).join(' · ') || 'Made fresh'}</small><span className="tile-arrow"><ArrowRight size={15}/></span></button>)}</div></section>
      <section className="section popular-section"><div className="section-heading"><div><div className="eyebrow">MADE WITH LOVE</div><h2>Popular <em>right now.</em></h2></div><button className="text-link" onClick={() => setPage('menu')}>See all dishes <ChevronRight size={16}/></button></div><div className="food-grid">{(featured.length ? featured : foods.slice(0, 4)).map(food => <FoodCard key={food._id} food={food} onAdd={addToCart}/>)}</div></section>
      <section className="promo-band"><div className="promo-icon">✳</div><div><span>YOUR NEXT FAVOURITE IS WAITING</span><h2>Good food. No fuss.</h2><p>Browse the menu, make it yours, and let TOMATO handle the rest.</p></div><button className="btn btn-dark" onClick={() => setPage('menu')}>Order something good <ArrowRight size={16}/></button></section>
    </main>}

    {page === 'menu' && <main className="page-content"><div className="page-intro"><div className="eyebrow">MADE FRESH, JUST FOR YOU</div><h1>Our <em>menu.</em></h1><p>Big cravings or little treats — there’s something for every mood.</p></div><div className="menu-tools"><label className="searchbox"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search dishes, ingredients..."/>{query && <button onClick={() => setQuery('')}><X size={15}/></button>}</label><label className="veg-filter"><input type="checkbox" checked={vegetarian} onChange={e => setVegetarian(e.target.checked)}/><Leaf size={16}/> Vegetarian</label></div><div className="filter-chips"><button className={!category ? 'chip selected' : 'chip'} onClick={() => setCategory('')}>All dishes</button>{categories.map(c => <button key={c._id} className={category === c.slug ? 'chip selected' : 'chip'} onClick={() => setCategory(category === c.slug ? '' : c.slug)}>{c.name}</button>)}</div>{foods.length ? <div className="food-grid">{foods.map(food => <FoodCard key={food._id} food={food} onAdd={addToCart}/>)}</div> : <div className="empty-state"><span>🍽️</span><h3>No dishes found</h3><p>Try another search or choose a different category.</p><button className="btn btn-primary" onClick={() => { setQuery(''); setCategory(''); setVegetarian(false); }}>Clear filters</button></div>}</main>}

    {page === 'cart' && <main className="page-content narrow"><div className="page-intro"><div className="eyebrow">ALMOST THERE</div><h1>Your <em>bag.</em></h1><p>Everything you need for a delicious moment.</p></div>{!cart.length ? <div className="empty-state"><ShoppingBag size={35}/><h3>Your bag is empty</h3><p>There’s a whole menu waiting for you.</p><button className="btn btn-primary" onClick={() => setPage('menu')}>Explore menu <ArrowRight size={16}/></button></div> : <div className="cart-layout"><div className="cart-items">{cart.map(item => <div className="cart-row" key={item.food._id}><div className="cart-thumb"><FoodImage src={item.food.image} alt={item.food.name}/></div><div className="cart-description"><b>{item.food.name}</b><small>{item.food.category?.name || item.food.subcategory || 'TOMATO favourite'}</small><strong>{money(item.food.basePrice)}</strong><div className="qty-control"><button onClick={() => updateQuantity(item.food._id, -1)}><Minus size={13}/></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.food._id, 1)}><Plus size={13}/></button></div></div><div className="cart-line-total"><b>{money(item.food.basePrice * item.quantity)}</b><button onClick={() => setCart(old => old.filter(x => x.food._id !== item.food._id))} aria-label="Remove item"><Trash2 size={16}/></button></div></div>)}</div><div className="checkout-card"><h3>Order summary</h3><div className="summary-line"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="summary-line"><span>Delivery</span><b>{money(deliveryFee)}</b></div><div className="summary-total"><span>Total</span><b>{money(total)}</b></div><button className="btn btn-primary full" onClick={() => { if (!user) { setAuthMode('login'); setModal('auth'); } else setModal('checkout'); }}>Continue to checkout <ArrowRight size={16}/></button><p className="secure-note">Cash on delivery · Secure checkout</p></div></div>}</main>}

    {page === 'orders' && <main className="page-content narrow"><div className="page-intro"><div className="eyebrow">YOUR TOMATO HISTORY</div><h1>My <em>orders.</em></h1><p>Every delicious decision, all in one place.</p></div>{!user ? <div className="empty-state"><UserRound size={32}/><h3>Log in to see your orders</h3><button className="btn btn-primary" onClick={() => setModal('auth')}>Log in / Register</button></div> : orders.length ? <div className="order-list">{orders.map(order => <button className="order-card" key={order._id} onClick={() => openTracking(order)}><div className="order-icon"><PackageCheck/></div><div className="order-main"><b>{order.orderNumber}</b><small>{new Date(order.createdAt).toLocaleString()} · {order.itemsSnapshot?.length || 0} item types</small><span className="status-pill">{order.orderStatus}</span></div><strong>{money(order.totalAmount)}</strong><ChevronRight/></button>)}</div> : <div className="empty-state"><ClipboardList size={34}/><h3>No orders yet</h3><p>Your next favourite meal is just a few clicks away.</p><button className="btn btn-primary" onClick={() => setPage('menu')}>Browse menu</button></div>}</main>}

    {page === 'tracking' && <main className="page-content narrow"><div className="page-intro"><div className="eyebrow">FROM OUR KITCHEN TO YOU</div><h1>Order <em>tracking.</em></h1></div>{activeOrder ? <div className="tracking-card"><div className="tracking-top"><div><span className="eyebrow">ORDER NUMBER</span><h2>{activeOrder.orderNumber}</h2></div><span className="status-pill">{activeOrder.orderStatus}</span></div><div className="timeline">{['Order Placed','Order Confirmed','Preparing','Ready for Pickup','Out for Delivery','Delivered'].map((status, i) => { const current = ['Order Placed','Order Confirmed','Preparing','Ready for Pickup','Out for Delivery','Delivered'].indexOf(activeOrder.orderStatus); const done = current >= i; return <div className={`timeline-step ${done ? 'done' : ''}`} key={status}><span className="timeline-dot">{done ? <CheckCircle2 size={16}/> : i + 1}</span><div><b>{status}</b><small>{activeOrder.statusHistory?.find(h => h.status === status) ? new Date(activeOrder.statusHistory.find(h => h.status === status).timestamp).toLocaleString() : done ? 'Completed' : 'Up next'}</small></div></div>; })}</div><div className="tracking-items">{activeOrder.itemsSnapshot?.map((item, i) => <div key={i}><span>{item.quantity} × {item.name}</span><b>{money(item.lineTotal)}</b></div>)}</div><div className="summary-total"><span>Total · Cash on delivery</span><b>{money(activeOrder.totalAmount)}</b></div><p className="delivery-address"><MapPin size={16}/> {activeOrder.deliveryAddressSnapshot?.line1}, {activeOrder.deliveryAddressSnapshot?.city}</p><button className="btn btn-light full" onClick={() => api(`/orders/${activeOrder._id}`).then(setActiveOrder).catch(e => setNotice(e.message))}>Refresh order status</button></div> : <div className="empty-state"><PackageCheck size={34}/><h3>Choose an order to track</h3><button className="btn btn-primary" onClick={() => setPage('orders')}>View my orders</button></div>}</main>}

    {page === 'offers' && <main className="page-content"><div className="page-intro"><div className="eyebrow">A LITTLE EXTRA JOY</div><h1>Good deals, <em>great meals.</em></h1><p>Keep an eye out for TOMATO specials and seasonal offers.</p></div><div className="offer-grid"><div className="offer-card offer-red"><span>THE TOMATO TREAT</span><h2>More flavour.<br/>More fun.</h2><p>Check back for our latest menu specials.</p><button className="btn btn-light" onClick={() => setPage('menu')}>Explore menu <ArrowRight size={16}/></button></div><div className="offer-card offer-cream"><span>MADE FOR YOUR MOOD</span><h2>Something good<br/>is cooking.</h2><p>Discover your new favourite from our freshly prepared menu.</p><button className="btn btn-primary" onClick={() => setPage('menu')}>Find your favourite <ArrowRight size={16}/></button></div></div></main>}

    {page === 'contact' && <main className="page-content narrow"><div className="page-intro"><div className="eyebrow">WE’RE HERE FOR YOU</div><h1>Say <em>hello.</em></h1><p>Questions about an order? We’d love to help.</p></div><div className="contact-card"><div><MapPin/><b>Serving Colombo & selected areas</b><p>Delivery availability is confirmed when your order is placed.</p></div><div><Clock3/><b>Opening hours</b><p>Every day · 10:00 AM – 10:00 PM</p></div><div><UserRound/><b>Customer care</b><p>Add your business phone and email here before launch.</p></div></div></main>}

    <footer className="footer"><div className="footer-main"><div className="footer-brand"><div className="brand brand-static"><span className="brand-mark">t</span><span className="brand-name">TOMATO<span>.</span><small>FRESH FOOD. GOOD MOOD.</small></span></div><p>Fresh food, easy ordering, reliable delivery. A little something good, whenever you need it.</p></div><div><b>Explore</b><button onClick={() => setPage('menu')}>Our menu</button><button onClick={() => setPage('offers')}>Special offers</button><button onClick={() => setPage('orders')}>My orders</button></div><div><b>Need help?</b><button onClick={() => setPage('contact')}>Contact us</button><button onClick={() => { setPage('admin'); window.location.hash = 'admin'; }}>Admin Portal</button><span>Delivery information</span><span>Privacy & terms</span></div><div className="footer-promise"><span>GOOD FOOD, GOOD MOOD.</span><h3>Made fresh.<br/><em>Made for you.</em></h3></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} TOMATO. All rights reserved.</span><span>Freshly prepared with care <span className="heart">♥</span></span></div></footer>

    {modal === 'auth' && <Modal onClose={() => setModal('')}><div className="modal-heading"><div className="eyebrow">WELCOME TO TOMATO</div><h2>{authMode === 'login' ? 'Good to see you.' : 'Let’s get you started.'}</h2><p>{authMode === 'login' ? 'Log in to continue your delicious journey.' : 'Create an account to place and track orders.'}</p></div><form className="form-stack" onSubmit={submitAuth}>{authMode === 'register' && <label>Full name<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Your name"/></label>}<label>Email address<input type="email" required value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="you@example.com"/></label>{authMode === 'register' && <label>Phone number<input value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="07X XXX XXXX"/></label>}<label>Password<input type="password" required minLength="8" value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="At least 8 characters"/></label><button className="btn btn-primary full" disabled={busy}>{busy ? 'Please wait...' : authMode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={16}/></button></form><p className="switch-auth">{authMode === 'login' ? 'New to TOMATO?' : 'Already have an account?'} <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Create an account' : 'Log in'}</button></p></Modal>}

    {modal === 'checkout' && <Modal onClose={() => setModal('')}><div className="modal-heading"><div className="eyebrow">ONE LAST THING</div><h2>Delivery <em>details.</em></h2><p>Where should we bring the good stuff?</p></div><form className="form-stack" onSubmit={placeOrder}><label>Full name<input required value={form.name || user?.name || ''} onChange={e => setForm({...form,name:e.target.value})}/></label><label>Contact number<input required value={form.phone || user?.phone || ''} onChange={e => setForm({...form,phone:e.target.value})} placeholder="07X XXX XXXX"/></label><label>Delivery address<input required value={form.address} onChange={e => setForm({...form,address:e.target.value})} placeholder="House number, street"/></label><label>City / area<input required value={form.city} onChange={e => setForm({...form,city:e.target.value})}/></label><label>Delivery instructions <small>(optional)</small><textarea value={form.instructions} onChange={e => setForm({...form,instructions:e.target.value})} placeholder="Landmark, gate colour, etc."/></label><div className="checkout-mini"><span>{cartCount} items · Cash on delivery</span><b>{money(total)}</b></div><button className="btn btn-primary full" disabled={busy}>{busy ? 'Placing order...' : 'Place order · ' + money(total)} <ArrowRight size={16}/></button></form></Modal>}
  </div>;
}

function FoodCard({ food, onAdd }) {
  const [showReviews, setShowReviews] = useState(false);
  return <article className="food-card">
    <div className="food-photo"><FoodImage src={food.image} alt={food.name}/><div className="food-badges">{food.isVegetarian && <span className="veg-badge"><Leaf size={12}/> Veg</span>}{food.isFeatured && <span className="popular-badge"><Flame size={12}/> Popular</span>}</div><button className="add-button" onClick={() => onAdd(food)} aria-label={`Add ${food.name} to cart`}><Plus size={19}/></button></div>
    <div className="food-info"><div className="food-category">{food.category?.name || food.subcategory || 'TOMATO SPECIAL'}</div><h3>{food.name}</h3><p>{food.description || 'Freshly prepared and full of flavour.'}</p><div className="food-card-bottom"><strong>{money(food.basePrice)}</strong><span><Clock3 size={13}/> 20–35 min</span></div><button className="review-link" onClick={() => setShowReviews(true)}>{food.ratingCount ? `★ ${Number(food.ratingAverage || 0).toFixed(1)} · ${food.ratingCount} reviews` : 'Rate this dish'}</button></div>
    {showReviews && <Modal onClose={() => setShowReviews(false)}><ReviewPanel food={food}/></Modal>}
  </article>;
}

function CouponBox({ subtotal, appliedCoupon, onApply }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function apply(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const coupon = await api('/coupons/validate', { method: 'POST', body: JSON.stringify({ code, subtotal }) });
      onApply(coupon);
      setMessage(`Coupon applied — save ${money(coupon.discount)}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return <form className="coupon-box" onSubmit={apply}>
    {appliedCoupon ? <><div><b>{appliedCoupon.code}</b><span>Save {money(appliedCoupon.discount)}</span></div><button type="button" className="text-link" onClick={() => { onApply(null); setMessage(''); }}>Remove</button></> :
      <><label htmlFor="coupon-code">Have a coupon?</label><input id="coupon-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Enter code" maxLength={30}/><button className="btn btn-light" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Apply'}</button></>}
    {message && <small role="status">{message}</small>}
  </form>;
}

function ReviewPanel({ food }) {
  const [reviews, setReviews] = useState([]);
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`/foods/${food._id}/reviews`).then(setReviews).catch(error => setMessage(error.message));
    api('/orders/my-orders').then(orders => setEligibleOrders(orders.filter(order => order.orderStatus === 'Delivered' && order.itemsSnapshot.some(item => item.food === food._id || item.food?._id === food._id))))
      .catch(() => setEligibleOrders([]));
  }, [food._id]);
  async function submitReview(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const review = await api(`/foods/${food._id}/reviews`, { method: 'POST', body: JSON.stringify({ orderId, rating: Number(rating), comment }) });
      setReviews(old => [review, ...old]);
      setEligibleOrders(old => old.filter(order => order._id !== orderId));
      setComment('');
      setMessage('Thanks for sharing your review.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="review-panel"><div className="eyebrow">CUSTOMER REVIEWS</div><h2>{food.name}</h2>
    {reviews.length ? <div className="review-list">{reviews.map(review => <article key={review._id}><b>{review.customer?.name || 'TOMATO customer'} · {'★'.repeat(review.rating)}</b><p>{review.comment || 'No written comment.'}</p><small>{new Date(review.createdAt).toLocaleDateString()}</small></article>)}</div> : <p>No reviews yet. Be the first to rate this dish after delivery.</p>}
    {eligibleOrders.length > 0 && <form className="form-stack" onSubmit={submitReview}><label>Delivered order<select required value={orderId} onChange={e => setOrderId(e.target.value)}><option value="">Choose an order</option>{eligibleOrders.map(order => <option key={order._id} value={order._id}>{order.orderNumber}</option>)}</select></label><label>Rating<select value={rating} onChange={e => setRating(e.target.value)}>{[5,4,3,2,1].map(score => <option key={score} value={score}>{score} stars</option>)}</select></label><label>Your review<textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={1000} placeholder="What did you think?"/></label><button className="btn btn-primary" disabled={busy || !orderId}>{busy ? 'Submitting…' : 'Submit review'}</button></form>}
    {message && <small role="status">{message}</small>}
  </div>;
}
function Modal({ children, onClose }) {
  useEffect(() => { const handle = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handle); document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', handle); document.body.style.overflow = ''; }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19}/></button>{children}</section></div>;
}
