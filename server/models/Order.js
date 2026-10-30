import mongoose from 'mongoose';
const itemSchema = new mongoose.Schema({
  food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  name: { type: String, required: true },
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  notes: { type: String, default: '' }
}, { _id: false });
const historySchema = new mongoose.Schema({
  status: String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  note: String
}, { _id: false });
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  itemsSnapshot: [itemSchema],
  deliveryAddressSnapshot: {
    name: String, phone: String, line1: String, city: String, instructions: String
  },
  subtotal: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, default: 350, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  couponCode: { type: String, default: '' },
  paymentMethod: { type: String, enum: ['cash_on_delivery'], default: 'cash_on_delivery' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  orderStatus: { type: String, enum: ['Order Placed', 'Order Confirmed', 'Preparing', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Rejected', 'Cancelled', 'Delivery Failed'], default: 'Order Placed' },
  assignedDeliveryStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  estimatedDeliveryAt: Date,
  statusHistory: [historySchema],
  cancellationReason: String
}, { timestamps: true });
export default mongoose.model('Order', orderSchema);
