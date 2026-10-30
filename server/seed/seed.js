import 'dotenv/config';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Food from '../models/Food.js';
import { connectDB } from '../config/db.js';

const categories = [
  { name: 'Kottu', subcategories: ['Chicken', 'Egg', 'Vegetable', 'Cheese Chicken', 'Seafood', 'Mixed', 'Special'] },
  { name: 'Rice & Curries', subcategories: ['Egg', 'Fish', 'Chicken', 'Prawns', 'Cuttlefish', 'Pork', 'Vegetable'] },
  { name: 'Pizza', subcategories: ['Chicken', 'Seafood', 'Cheese', 'Vegetable', 'BBQ Chicken'] },
  { name: 'Burgers', subcategories: ['Chicken', 'Beef', 'Fish', 'Cheese', 'Vegetable'] },
  { name: 'Pasta', subcategories: ['Chicken', 'Seafood', 'Mushroom', 'Tomato', 'Vegetable'] },
  { name: 'Noodles', subcategories: ['Chicken', 'Seafood', 'Vegetable', 'Mixed'] },
  { name: 'Submarines & Sandwiches', subcategories: ['Chicken', 'Cheese', 'Seafood', 'Club'] },
  { name: 'Appetizers & Sides', subcategories: ['Fries', 'Wings', 'Garlic Bread', 'Onion Rings', 'Nuggets', 'Salads'] },
  { name: 'Beverages', subcategories: ['Soft Drinks', 'Fresh Juices', 'Iced Coffee', 'Milkshakes', 'Water'] },
  { name: 'Desserts', subcategories: ['Cake', 'Ice Cream', 'Brownies', 'Cheesecake'] }
];
const menu = [
  ['Chicken Kottu','Kottu','Chicken',1250,false,'chicken kottu sri lankan food'],
  ['Egg Kottu','Kottu','Egg',950,false,'egg kottu sri lankan food'],
  ['Vegetable Kottu','Kottu','Vegetable',850,true,'vegetable kottu'],
  ['Cheese Chicken Kottu','Kottu','Cheese Chicken',1450,false,'cheese chicken kottu'],
  ['Seafood Kottu','Kottu','Seafood',1650,false,'seafood kottu'],
  ['Chicken Fried Rice','Rice & Curries','Chicken',1200,false,'chicken fried rice'],
  ['Egg Fried Rice','Rice & Curries','Egg',900,false,'egg fried rice'],
  ['Prawn Rice','Rice & Curries','Prawns',1550,false,'prawn fried rice'],
  ['Rice and Curry Meal','Rice & Curries','Vegetable',850,true,'sri lankan rice curry'],
  ['Margherita Pizza','Pizza','Cheese',1800,true,'margherita pizza'],
  ['BBQ Chicken Pizza','Pizza','BBQ Chicken',2450,false,'bbq chicken pizza'],
  ['Seafood Pizza','Pizza','Seafood',2650,false,'seafood pizza'],
  ['Chicken Burger','Burgers','Chicken',1100,false,'chicken burger'],
  ['Cheese Burger','Burgers','Cheese',1250,false,'cheese burger'],
  ['Chicken Pasta','Pasta','Chicken',1450,false,'chicken pasta'],
  ['Seafood Noodles','Noodles','Seafood',1550,false,'seafood noodles'],
  ['Chicken Submarine','Submarines & Sandwiches','Chicken',1350,false,'chicken submarine sandwich'],
  ['French Fries','Appetizers & Sides','Fries',550,true,'french fries'],
  ['Chicken Wings','Appetizers & Sides','Wings',850,false,'crispy chicken wings'],
  ['Fresh Orange Juice','Beverages','Fresh Juices',450,true,'fresh orange juice'],
  ['Chocolate Brownie','Desserts','Brownies',500,true,'chocolate brownie']
];
const pics = {
  'Kottu':'/uploads/kottu.png',
  'Rice & Curries':'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
  'Pizza':'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
  'Burgers':'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  'Pasta':'https://images.unsplash.com/photo- pasta?auto=format&fit=crop&w=900&q=80',
  'Noodles':'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
  'Submarines & Sandwiches':'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=900&q=80',
  'Appetizers & Sides':'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80',
  'Beverages':'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80',
  'Desserts':'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80'
};
async function seed() {
  await connectDB();
  const created = await Promise.all(categories.map((c, i) => {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return Category.findOneAndUpdate({ slug }, { $setOnInsert: {
      ...c, slug, sortOrder: i, description: `Freshly prepared ${c.name.toLowerCase()} from TOMATO.`
    } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }));
  const catMap = new Map(created.map(c => [c.name, c]));
  const docs = menu.map(([name, cat, subcategory, basePrice, isVegetarian, tag], i) => ({
    name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + i,
    description: `Delicious ${name.toLowerCase()}, freshly prepared to order with quality ingredients.`,
    category: catMap.get(cat)._id, subcategory, basePrice, isVegetarian,
    isAvailable: true, isFeatured: i < 8, tags: [tag],
    image: pics[cat] && !pics[cat].includes('photo- pasta') ? pics[cat] : 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80'
  }));
  await Promise.all(docs.map(food => Food.updateOne({ slug: food.slug }, { $setOnInsert: food }, { upsert: true })));
  
  // Replace old samosa photo in database with the new kottu photo
  const updateResult = await Food.updateMany(
    {
      $or: [
        { image: { $regex: 'photo-1601050690597' } },
        { name: { $regex: 'kottu', $options: 'i' } }
      ]
    },
    { $set: { image: '/uploads/kottu.png' } }
  );
  if (updateResult.modifiedCount > 0) {
    console.log(`Updated ${updateResult.modifiedCount} Kottu food item(s) to use /uploads/kottu.png.`);
  }

  console.log(`Ensured ${created.length} categories and ${docs.length} food items are present.`);
  await mongoose.disconnect();
}
seed().catch(err => { console.error(err); process.exit(1); });
