import Coupon from '../models/Coupon.js';

export async function getApplicableCoupon(code, subtotal) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return null;

  const coupon = await Coupon.findOne({ code: normalizedCode, isActive: true });
  const now = new Date();
  if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now)) {
    return null;
  }
  if (coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) return null;
  if (subtotal < coupon.minimumSubtotal) return null;

  const discount = coupon.discountType === 'percentage'
    ? subtotal * coupon.discountValue / 100
    : coupon.discountValue;
  const maximum = coupon.maxDiscount !== undefined ? coupon.maxDiscount : subtotal;
  return {
    coupon,
    discount: Math.min(subtotal, discount, maximum)
  };
}
