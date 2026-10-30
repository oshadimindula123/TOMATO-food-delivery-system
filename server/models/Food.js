import mongoose from 'mongoose';
const foodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subcategory: { type: String, default: '' },
  image: { type: String, default: '' },
  basePrice: { type: Number, required: true, min: 0 },
  isVegetarian: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  tags: [{ type: String }],
  allergens: [{ type: String }],
  ratingAverage: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 }
}, { timestamps: true });
foodSchema.index({ name: 'text', description: 'text', tags: 'text' });
export default mongoose.model('Food', foodSchema);
