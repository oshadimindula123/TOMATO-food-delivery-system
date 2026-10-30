import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getApplicableCoupon } from '../utils/coupons.js';

const router = Router();

router.post('/validate', asyncHandler(async (req, res) => {
  const subtotal = Number(req.body.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return res.status(400).json({ message: 'A valid order subtotal is required.' });
  }
  const result = await getApplicableCoupon(req.body.code, subtotal);
  if (!result) return res.status(400).json({ message: 'This coupon is invalid, expired or does not meet its minimum order value.' });
  res.json({
    code: result.coupon.code,
    description: result.coupon.description,
    discount: result.discount
  });
}));

export default router;
