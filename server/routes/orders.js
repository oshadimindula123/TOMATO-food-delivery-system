import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Food from '../models/Food.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getApplicableCoupon } from '../utils/coupons.js';
import { sendOrderNotification } from '../utils/email.js';
const router = Router();
const statuses = ['Order Placed', 'Order Confirmed', 'Preparing', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Rejected', 'Cancelled', 'Delivery Failed'];
const makeNumber = () => `TOM-${Date.now().toString().slice(-8)}-${Math.floor(100 + Math.random() * 900)}`;

router.post('/', protect, asyncHandler(async (req, res) => {
  const { items, address, phone, name, couponCode } = req.body;
  if (!Array.isArray(items) || !items.length || items.length > 30) return res.status(400).json({ message: 'Your cart is empty or invalid.' });
  if (!address?.trim() || !phone?.trim() || !name?.trim()) return res.status(400).json({ message: 'Name, phone number and delivery address are required.' });
  const ids = items.map(i => i.foodId);
  if (ids.some(id => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: 'Invalid food item.' });
  const foods = await Food.find({ _id: { $in: ids }, isAvailable: true });
  const byId = new Map(foods.map(f => [String(f._id), f]));
  const snapshots = [];
  let subtotal = 0;
  for (const entry of items) {
    const food = byId.get(String(entry.foodId));
    const quantity = Number(entry.quantity);
    if (!food || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return res.status(400).json({ message: 'A cart item is unavailable or has an invalid quantity.' });
    const unitPrice = food.basePrice;
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    snapshots.push({ food: food._id, name: food.name, image: food.image, quantity, unitPrice, lineTotal });
  }
  const deliveryFee = Number(process.env.DELIVERY_FEE || 350);
  let coupon;
  let discount = 0;
  if (couponCode) {
    const applicable = await getApplicableCoupon(couponCode, subtotal);
    if (!applicable) return res.status(400).json({ message: 'This coupon is invalid, expired or does not meet its minimum order value.' });
    const couponFilter = { _id: applicable.coupon._id, isActive: true };
    const now = new Date();
    if (applicable.coupon.maxUses !== undefined) couponFilter.usedCount = { $lt: applicable.coupon.maxUses };
    if (applicable.coupon.startsAt) couponFilter.startsAt = { $lte: now };
    if (applicable.coupon.expiresAt) couponFilter.expiresAt = { $gte: now };
    coupon = await Coupon.findOneAndUpdate(couponFilter, { $inc: { usedCount: 1 } }, { new: true });
    if (!coupon) return res.status(409).json({ message: 'This coupon is no longer available. Please try another coupon.' });
    discount = applicable.discount;
  }
  let order;
  try {
    order = await Order.create({
      orderNumber: makeNumber(), customer: req.user._id, itemsSnapshot: snapshots,
      deliveryAddressSnapshot: { name: name.trim(), phone: phone.trim(), line1: address.trim(), city: req.body.city || '', instructions: req.body.instructions || '' },
      subtotal, deliveryFee, discount, totalAmount: subtotal + deliveryFee - discount,
      coupon: coupon?._id, couponCode: coupon?.code || '', paymentMethod: 'cash_on_delivery',
      statusHistory: [{ status: 'Order Placed', changedBy: req.user._id, note: 'Order submitted by customer' }]
    });
  } catch (error) {
    if (coupon) await Coupon.updateOne({ _id: coupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    throw error;
  }
  const customer = await User.findById(req.user._id).select('email');
  try {
    await sendOrderNotification(customer, order, 'TOMATO order received', 'We have received your order and will keep you updated.');
  } catch (error) {
    console.error(`Order email failed for ${order.orderNumber}:`, error.message);
  }
  const io = req.app.get('io');
  io?.to(`user:${req.user._id}`).emit('order:update', { orderId: String(order._id), orderNumber: order.orderNumber, orderStatus: order.orderStatus });
  res.status(201).json(order);
}));
router.get('/my-orders', protect, asyncHandler(async (req, res) => {
  res.json(await Order.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(100));
}));
router.get('/delivery/assigned', protect, allowRoles('delivery'), asyncHandler(async (req, res) => {
  res.json(await Order.find({ assignedDeliveryStaff: req.user._id, orderStatus: { $in: ['Ready for Pickup', 'Out for Delivery', 'Delivery Failed'] } })
    .sort({ createdAt: -1 }).limit(100));
}));
router.get('/admin/all', protect, allowRoles('admin'), asyncHandler(async (req, res) => {
  const filter = {};
  const status = String(req.query.status || '');
  if (status) {
    if (!statuses.includes(status)) return res.status(400).json({ message: 'Choose a valid order status.' });
    filter.orderStatus = status;
  }
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const matcher = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchingCustomers = await User.find({ role: 'customer', $or: [{ name: matcher }, { email: matcher }, { phone: matcher }] }).select('_id').limit(500);
    const matches = [
      { orderNumber: matcher },
      { 'deliveryAddressSnapshot.name': matcher },
      { 'deliveryAddressSnapshot.phone': matcher }
    ];
    if (matchingCustomers.length) matches.push({ customer: { $in: matchingCustomers.map(customer => customer._id) } });
    if (mongoose.isValidObjectId(search)) matches.push({ _id: search });
    filter.$or = matches;
  }
  res.json(await Order.find(filter).populate('customer', 'name email phone').populate('assignedDeliveryStaff', 'name phone').sort({ createdAt: -1 }).limit(500));
}));
router.patch('/:id/status', protect, allowRoles('admin', 'delivery'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (req.user.role === 'delivery' && String(order.assignedDeliveryStaff) !== String(req.user._id)) return res.status(403).json({ message: 'This order is not assigned to you.' });
  const next = req.body.status;
  if (!statuses.includes(next)) return res.status(400).json({ message: 'Invalid order status.' });
  const allowed = {
    'Order Placed': ['Order Confirmed', 'Rejected', 'Cancelled'],
    'Order Confirmed': ['Preparing', 'Cancelled'],
    'Preparing': ['Ready for Pickup', 'Out for Delivery', 'Cancelled'],
    'Ready for Pickup': ['Out for Delivery', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Delivery Failed', 'Cancelled'],
    'Delivery Failed': ['Out for Delivery', 'Cancelled']
  };
  if (!(allowed[order.orderStatus] || []).includes(next)) return res.status(400).json({ message: `Cannot change ${order.orderStatus} to ${next}.` });
  const previousStatus = order.orderStatus;
  order.orderStatus = next;
  if (next === 'Delivered' && order.paymentMethod === 'cash_on_delivery') order.paymentStatus = 'paid';
  order.statusHistory.push({ status: next, changedBy: req.user._id, note: req.body.note || '' });
  await order.save();
  if (['Cancelled', 'Rejected'].includes(next) && order.coupon && !['Cancelled', 'Rejected'].includes(previousStatus)) {
    await Coupon.updateOne({ _id: order.coupon, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }
  const customer = await User.findById(order.customer).select('email');
  try {
    await sendOrderNotification(customer, order, `TOMATO order update: ${next}`, `Your order status is now ${next}.`);
  } catch (error) {
    console.error(`Order update email failed for ${order.orderNumber}:`, error.message);
  }
  req.app.get('io')?.to(`user:${order.customer}`).emit('order:update', { orderId: String(order._id), orderNumber: order.orderNumber, orderStatus: next });
  res.json(order);
}));
router.get('/:id', protect, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (req.user.role !== 'admin' && String(order.customer) !== String(req.user._id) && !(req.user.role === 'delivery' && String(order.assignedDeliveryStaff) === String(req.user._id))) return res.status(403).json({ message: 'You cannot view this order.' });
  res.json(order);
}));
export default router;
