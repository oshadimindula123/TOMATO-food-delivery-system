import { Router } from 'express';
import mongoose from 'mongoose';
import Food from '../models/Food.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router({ mergeParams: true });

router.get('/:foodId/reviews', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.foodId)) return res.status(400).json({ message: 'Invalid food item.' });
  res.json(await Review.find({ food: req.params.foodId }).populate('customer', 'name').sort({ createdAt: -1 }).limit(50));
}));

router.post('/:foodId/reviews', protect, asyncHandler(async (req, res) => {
  const { orderId, rating, comment = '' } = req.body;
  if (!mongoose.isValidObjectId(req.params.foodId) || !mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: 'A valid food item and delivered order are required.' });
  }
  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5 || typeof comment !== 'string' || comment.trim().length > 1000) {
    return res.status(400).json({ message: 'Rating must be 1–5 and the review must be 1000 characters or fewer.' });
  }
  const order = await Order.findOne({
    _id: orderId,
    customer: req.user._id,
    orderStatus: 'Delivered',
    'itemsSnapshot.food': req.params.foodId
  });
  if (!order) return res.status(403).json({ message: 'You can review this item after it has been delivered to you.' });
  const food = await Food.findById(req.params.foodId);
  if (!food) return res.status(404).json({ message: 'Food item not found.' });

  let review;
  try {
    review = await Review.create({
      food: food._id,
      customer: req.user._id,
      order: order._id,
      rating: score,
      comment: comment.trim()
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'You have already reviewed this item for that order.' });
    throw error;
  }
  const [summary] = await Review.aggregate([
    { $match: { food: food._id } },
    { $group: { _id: '$food', average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  food.ratingAverage = Math.round(summary.average * 10) / 10;
  food.ratingCount = summary.count;
  await food.save();
  res.status(201).json(await review.populate('customer', 'name'));
}));

export default router;
