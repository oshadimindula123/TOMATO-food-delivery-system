import mongoose from 'mongoose';

export const defaultContactDetails = {
  serviceArea: 'Colombo & selected areas',
  availabilityNote: 'Delivery availability is confirmed when your order is placed.',
  openingHours: 'Every day · 10:00 AM – 10:00 PM',
  customerCareNote: 'Questions about an order? We’d love to help.',
  phone: '',
  email: ''
};

const contactDetailsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'contact' },
  serviceArea: { type: String, required: true, trim: true, maxlength: 160, default: defaultContactDetails.serviceArea },
  availabilityNote: { type: String, required: true, trim: true, maxlength: 240, default: defaultContactDetails.availabilityNote },
  openingHours: { type: String, required: true, trim: true, maxlength: 160, default: defaultContactDetails.openingHours },
  customerCareNote: { type: String, required: true, trim: true, maxlength: 240, default: defaultContactDetails.customerCareNote },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' }
}, { timestamps: true });

export default mongoose.model('ContactDetails', contactDetailsSchema);
