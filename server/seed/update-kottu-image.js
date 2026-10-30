import 'dotenv/config';
import mongoose from 'mongoose';
import Food from '../models/Food.js';
import { connectDB } from '../config/db.js';

async function updateKottu() {
  await connectDB();
  console.log('Connected to MongoDB.');

  const res = await Food.updateMany(
    {
      $or: [
        { image: { $regex: 'photo-1601050690597' } },
        { name: { $regex: 'kottu', $options: 'i' } }
      ]
    },
    { $set: { image: '/uploads/kottu.png' } }
  );

  console.log(`Matched ${res.matchedCount} food item(s), updated ${res.modifiedCount} item(s) to use /uploads/kottu.png.`);
  await mongoose.disconnect();
}

updateKottu().catch(err => {
  console.error('Error updating Kottu image:', err.message);
  process.exit(1);
});
