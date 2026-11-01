import { Router } from 'express';
import Food from '../models/Food.js';
import Category from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
router.get('/categories', asyncHandler(async (_req, res) => res.json(await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }))));
router.get('/featured', asyncHandler(async (_req, res) => res.json(await Food.find({ isAvailable: true, isFeatured: true }).populate('category', 'name slug').limit(8))));
router.get('/', asyncHandler(async (req, res) => {
  const filter = { isAvailable: true };
  if (req.query.category) {
    const category = await Category.findOne({ $or: [{ slug: req.query.category }, { _id: req.query.category.match(/^[0-9a-f]{24}$/i) ? req.query.category : null }] });
    if (category) filter.category = category._id;
    else filter.category = null;
  }
  if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };
  if (req.query.vegetarian === 'true') filter.isVegetarian = true;
  if (req.query.minPrice || req.query.maxPrice) filter.basePrice = { ...(req.query.minPrice ? { $gte: Number(req.query.minPrice) } : {}), ...(req.query.maxPrice ? { $lte: Number(req.query.maxPrice) } : {}) };
  const sortMap = { price_asc: { basePrice: 1 }, price_desc: { basePrice: -1 }, newest: { createdAt: -1 }, popular: { ratingCount: -1 } };
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 12));
  const [items, total] = await Promise.all([Food.find(filter).populate('category', 'name slug').sort(sortMap[req.query.sort] || { isFeatured: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit), Food.countDocuments(filter)]);
  res.json({ items, page, pages: Math.ceil(total / limit), total });
}));
router.get('/:id', asyncHandler(async (req, res) => {
  const item = await Food.findById(req.params.id).populate('category', 'name slug');
  if (!item || !item.isAvailable) return res.status(404).json({ message: 'Food item not found.' });
  res.json(item);
}));
export default router;
