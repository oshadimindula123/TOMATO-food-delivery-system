import { Router } from 'express';
import ContactDetails, { defaultContactDetails } from '../models/ContactDetails.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const details = await ContactDetails.findOne({ key: 'contact' }).lean();
  res.json({ ...defaultContactDetails, ...(details || {}) });
}));

export default router;
