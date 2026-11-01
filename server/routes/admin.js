import { Router } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs/promises';
import Food from '../models/Food.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import ContactDetails, { defaultContactDetails } from '../models/ContactDetails.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { protect, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
router.use(protect, allowRoles('admin'));
const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype))
});
const handleImageUpload = (req, res, next) => imageUpload.single('image')(req, res, error => {
  if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: 'Image upload failed. Use an image no larger than 5 MB.' });
  next();
});
router.get('/dashboard', asyncHandler(async (_req, res) => {
  const [totalOrders, pendingOrders, sales, recentOrders, foodCount, customerCount] = await Promise.all([
    Order.countDocuments(), Order.countDocuments({ orderStatus: { $in: ['Order Placed', 'Order Confirmed', 'Preparing'] } }),
    Order.aggregate([{ $match: { paymentStatus: 'paid', orderStatus: { $nin: ['Cancelled', 'Rejected'] } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.find().sort({ createdAt: -1 }).limit(8).populate('customer', 'name'),
    Food.countDocuments(), User.countDocuments({ role: 'customer' })
  ]);
  res.json({ totalOrders, pendingOrders, paidRevenue: sales[0]?.total || 0, foodCount, customerCount, recentOrders });
}));
router.get('/contact', asyncHandler(async (_req, res) => {
  const details = await ContactDetails.findOne({ key: 'contact' }).lean();
  res.json({ ...defaultContactDetails, ...(details || {}) });
}));
router.patch('/contact', asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ message: 'Provide contact details as a JSON object.' });
  }
  const limits = {
    serviceArea: 160,
    availabilityNote: 240,
    openingHours: 160,
    customerCareNote: 240,
    phone: 40,
    email: 254
  };
  const patch = {};
  for (const [field, maxLength] of Object.entries(limits)) {
    if (req.body[field] === undefined) continue;
    if (typeof req.body[field] !== 'string') return res.status(400).json({ message: `${field} must be text.` });
    patch[field] = req.body[field].trim();
    if (patch[field].length > maxLength) return res.status(400).json({ message: `${field} must be ${maxLength} characters or fewer.` });
    if (['serviceArea', 'availabilityNote', 'openingHours', 'customerCareNote'].includes(field) && !patch[field]) {
      return res.status(400).json({ message: `${field} cannot be empty.` });
    }
  }
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'Provide at least one contact detail to update.' });
  if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) {
    return res.status(400).json({ message: 'Enter a valid contact email address.' });
  }
  const details = await ContactDetails.findOneAndUpdate(
    { key: 'contact' },
    { $set: patch, $setOnInsert: { key: 'contact' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  res.json({ ...defaultContactDetails, ...details });
}));
router.get('/foods', asyncHandler(async (req, res) => {
  const filter = {};
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');
  if (req.query.category) {
    if (!mongoose.isValidObjectId(req.query.category)) return res.status(400).json({ message: 'Choose a valid category.' });
    filter.category = req.query.category;
  }
  if (req.query.available === 'true' || req.query.available === 'false') filter.isAvailable = req.query.available === 'true';
  const foods = await Food.find(filter).populate('category', 'name slug').sort({ createdAt: -1 }).limit(1000);
  res.json(foods);
}));
router.get('/categories', asyncHandler(async (_req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
    Food.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
  ]);
  const countByCategory = new Map(counts.map(item => [String(item._id), item.count]));
  res.json(categories.map(category => ({ ...category, foodCount: countByCategory.get(String(category._id)) || 0 })));
}));
router.get('/reports', asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) return res.status(400).json({ message: 'Report range must be between 1 and 365 days.' });
  const since = new Date();
  since.setDate(since.getDate() - days);
  const match = { createdAt: { $gte: since } };
  const [dailyOrders, statusCounts, popularItems, totals] = await Promise.all([
    Order.aggregate([
      { $match: match },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        orders: { $sum: 1 },
        sales: { $sum: { $cond: [{ $in: ['$orderStatus', ['Cancelled', 'Rejected']] }, 0, '$totalAmount'] } }
      } },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$orderStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Order.aggregate([
      { $match: { ...match, orderStatus: { $nin: ['Cancelled', 'Rejected'] } } },
      { $unwind: '$itemsSnapshot' },
      { $group: { _id: '$itemsSnapshot.name', quantity: { $sum: '$itemsSnapshot.quantity' }, sales: { $sum: '$itemsSnapshot.lineTotal' } } },
      { $sort: { quantity: -1 } },
      { $limit: 10 }
    ]),
    Order.aggregate([{ $match: match }, { $group: {
      _id: null,
      orders: { $sum: 1 },
      sales: { $sum: { $cond: [{ $in: ['$orderStatus', ['Cancelled', 'Rejected']] }, 0, '$totalAmount'] } },
      discounts: { $sum: { $cond: [{ $in: ['$orderStatus', ['Cancelled', 'Rejected']] }, 0, '$discount'] } }
    } }])
  ]);
  res.json({ days, dailyOrders, statusCounts, popularItems, totals: totals[0] || { orders: 0, sales: 0, discounts: 0 } });
}));
router.post('/uploads', handleImageUpload, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Select a JPEG, PNG, WebP or AVIF image up to 5 MB.' });
  if (cloudinaryConfigured) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'tomato-food' }, (error, uploaded) => {
        if (error) reject(error);
        else if (!uploaded?.secure_url) reject(new Error('Cloudinary returned no uploaded image URL.'));
        else resolve(uploaded);
      });
      stream.end(req.file.buffer);
    });
    return res.status(201).json({ url: result.secure_url });
  }
  // Local disk storage fallback
  const ext = path.extname(req.file.originalname) || '.jpg';
  const filename = `food-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}${ext}`;
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), req.file.buffer);
  res.status(201).json({ url: `/uploads/${filename}` });
}));
router.post('/foods', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const { category, basePrice } = req.body;
  if (!name || basePrice === undefined || basePrice === '' || !mongoose.isValidObjectId(category) || !Number.isFinite(Number(basePrice)) || Number(basePrice) < 0) return res.status(400).json({ message: 'Name, valid category and non-negative price are required.' });
  if (!await Category.exists({ _id: category })) return res.status(400).json({ message: 'Choose an existing category.' });
  if (req.body.image && !isValidImageUrl(req.body.image)) return res.status(400).json({ message: 'Image must be an HTTP or HTTPS URL.' });
  const food = await Food.create({ ...req.body, name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`, basePrice: Number(basePrice) });
  res.status(201).json(food);
}));
router.patch('/foods/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid food item ID.' });
  const allowed = ['name','description','category','subcategory','image','basePrice','isVegetarian','isAvailable','isFeatured','tags','allergens'];
  const patch = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (patch.name !== undefined && !String(patch.name).trim()) return res.status(400).json({ message: 'Food name is required.' });
  if (patch.category !== undefined && (!mongoose.isValidObjectId(patch.category) || !await Category.exists({ _id: patch.category }))) return res.status(400).json({ message: 'Choose an existing category.' });
  if (patch.basePrice !== undefined && (!Number.isFinite(Number(patch.basePrice)) || Number(patch.basePrice) < 0)) return res.status(400).json({ message: 'Price must be non-negative.' });
  if (patch.image !== undefined && patch.image && !isValidImageUrl(patch.image)) return res.status(400).json({ message: 'Image must be an HTTP or HTTPS URL.' });
  if (patch.name !== undefined) patch.name = String(patch.name).trim();
  const food = await Food.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
  if (!food) return res.status(404).json({ message: 'Food item not found.' });
  res.json(food);
}));
router.delete('/foods/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid food item ID.' });
  const food = await Food.findByIdAndDelete(req.params.id);
  if (!food) return res.status(404).json({ message: 'Food item not found.' });
  await Review.deleteMany({ food: food._id });
  res.json({ message: 'Food item deleted.' });
}));
router.post('/categories', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ message: 'Category name must contain 1 to 100 characters.' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return res.status(400).json({ message: 'Category name must include a letter or number.' });
  res.status(201).json(await Category.create({ name, slug, description: req.body.description || '', subcategories: req.body.subcategories || [] }));
}));
router.patch('/categories/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid category ID.' });
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ message: 'Category name must contain 1 to 100 characters.' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return res.status(400).json({ message: 'Category name must include a letter or number.' });
  const patch = { name, slug };
  const category = await Category.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  res.json(category);
}));
router.delete('/categories/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid category ID.' });
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  const foodCount = await Food.countDocuments({ category: category._id });
  if (foodCount) return res.status(409).json({ message: `Reassign or delete the ${foodCount} food item${foodCount === 1 ? '' : 's'} in this category before deleting it.` });
  await category.deleteOne();
  res.json({ message: 'Category deleted.' });
}));
router.get('/customers', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim().slice(0, 100);
  const filter = { role: 'customer' };
  if (search) {
    const matcher = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: matcher }, { email: matcher }, { phone: matcher }];
  }
  const customers = await User.find(filter).select('name email phone createdAt').sort({ createdAt: -1 }).limit(500).lean();
  const ids = customers.map(customer => customer._id);
  const counts = ids.length ? await Order.aggregate([
    { $match: { customer: { $in: ids } } },
    { $group: { _id: '$customer', count: { $sum: 1 } } }
  ]) : [];
  const countByCustomer = new Map(counts.map(item => [String(item._id), item.count]));
  res.json(customers.map(customer => ({ ...customer, orderCount: countByCustomer.get(String(customer._id)) || 0 })));
}));
router.get('/customers/:id/orders', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid customer ID.' });
  const customer = await User.findOne({ _id: req.params.id, role: 'customer' }).select('_id');
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  res.json(await Order.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(300));
}));
router.get('/staff', asyncHandler(async (_req, res) => res.json(await User.find({ role: 'delivery' }).select('name email phone isActive createdAt').sort({ name: 1 }))));
router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  if (!['customer', 'delivery'].includes(req.body.role)) return res.status(400).json({ message: 'Role must be customer or delivery.' });
  const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true, runValidators: true }).select('name email phone role isActive');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json(user);
}));
router.patch('/staff/:id/active', asyncHandler(async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be true or false.' });
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'delivery' }, { isActive: req.body.isActive }, { new: true })
    .select('name email phone role isActive');
  if (!user) return res.status(404).json({ message: 'Delivery staff member not found.' });
  res.json(user);
}));
router.patch('/orders/:id/assign', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.body.deliveryStaffId)) return res.status(400).json({ message: 'Select a valid delivery staff member.' });
  const staff = await User.findOne({ _id: req.body.deliveryStaffId, role: 'delivery', isActive: true });
  if (!staff) return res.status(404).json({ message: 'Active delivery staff member not found.' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (!['Ready for Pickup', 'Out for Delivery', 'Delivery Failed'].includes(order.orderStatus)) {
    return res.status(409).json({ message: 'Delivery staff can be assigned when an order is ready for pickup.' });
  }
  order.assignedDeliveryStaff = staff._id;
  await order.save();
  req.app.get('io')?.to(`user:${staff._id}`).emit('order:update', { orderId: String(order._id), orderNumber: order.orderNumber, orderStatus: order.orderStatus });
  req.app.get('io')?.to(`user:${order.customer}`).emit('order:update', { orderId: String(order._id), orderNumber: order.orderNumber, orderStatus: order.orderStatus });
  res.json(await order.populate('assignedDeliveryStaff', 'name phone'));
}));
router.get('/coupons', asyncHandler(async (_req, res) => res.json(await Coupon.find().sort({ createdAt: -1 }).limit(300))));
router.post('/coupons', asyncHandler(async (req, res) => {
  const coupon = normalizeCoupon(req.body);
  if (coupon.error) return res.status(400).json({ message: coupon.error });
  res.status(201).json(await Coupon.create(coupon.value));
}));
router.patch('/coupons/:id', asyncHandler(async (req, res) => {
  const existing = await Coupon.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Coupon not found.' });
  const coupon = normalizeCoupon({ ...existing.toObject(), ...req.body }, true);
  if (coupon.error) return res.status(400).json({ message: coupon.error });
  const updated = await Coupon.findByIdAndUpdate(req.params.id, coupon.value, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: 'Coupon not found.' });
  res.json(updated);
}));
router.delete('/coupons/:id', asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!coupon) return res.status(404).json({ message: 'Coupon not found.' });
  res.json(coupon);
}));

function normalizeCoupon(input, partial = false) {
  const value = {};
  if (!partial || input.code !== undefined) {
    const code = String(input.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: 'Coupon code must be 3–30 letters, numbers, hyphens or underscores.' };
    value.code = code;
  }
  if (!partial || input.discountType !== undefined) {
    if (!['percentage', 'fixed'].includes(input.discountType)) return { error: 'Choose percentage or fixed discount.' };
    value.discountType = input.discountType;
  }
  if (!partial || input.discountValue !== undefined) {
    const amount = Number(input.discountValue);
    if (!Number.isFinite(amount) || amount <= 0 || (input.discountType === 'percentage' && amount > 100)) {
      return { error: 'Discount must be positive and percentage discounts cannot exceed 100%.' };
    }
    value.discountValue = amount;
  }
  for (const key of ['maxDiscount', 'minimumSubtotal', 'maxUses']) {
    if (input[key] === undefined && partial) continue;
    if (input[key] === undefined || input[key] === '' || input[key] === null) {
      value[key] = key === 'minimumSubtotal' ? 0 : undefined;
      continue;
    }
    const amount = Number(input[key]);
    if (!Number.isFinite(amount) || amount < (key === 'maxUses' ? 1 : 0) || (key === 'maxUses' && !Number.isInteger(amount))) {
      return { error: `${key} must be a valid non-negative value.` };
    }
    value[key] = amount;
  }
  for (const key of ['startsAt', 'expiresAt']) {
    if (input[key] === undefined && partial) continue;
    if (!input[key]) {
      value[key] = undefined;
      continue;
    }
    const date = new Date(input[key]);
    if (!Number.isFinite(date.getTime())) return { error: `${key} must be a valid date.` };
    value[key] = date;
  }
  if (value.startsAt && value.expiresAt && value.expiresAt <= value.startsAt) return { error: 'Coupon expiry must be after its start date.' };
  if (input.description !== undefined || !partial) value.description = String(input.description || '').trim().slice(0, 250);
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') return { error: 'isActive must be true or false.' };
    value.isActive = input.isActive;
  }
  return { value };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidImageUrl(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('/uploads/')) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export default router;
