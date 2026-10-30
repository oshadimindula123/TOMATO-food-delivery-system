import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', maxlength: 1000, trim: true }
}, { timestamps: true });

reviewSchema.index({ food: 1, customer: 1, order: 1 }, { unique: true });
export default mongoose.model('Review', reviewSchema);
