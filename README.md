# TOMATO — MERN Food Delivery Website

A runnable full-stack starter for the TOMATO food delivery project, based on the supplied project brief.

## Included in this ZIP
- React + Vite customer storefront with responsive TOMATO styling
- Express REST API and MongoDB/Mongoose models
- JWT authentication with bcrypt and HTTP-only cookie
- Role middleware for customer/admin/delivery roles
- Database-backed food and category listing, search and category filtering
- Cart UI, checkout, order creation, order history and status tracking
- Admin APIs for food/category management and order status updates
- Coupon validation and checkout discounts, verified delivered-order reviews and ratings
- Admin dashboard for foods, categories, orders, and customer history
- Optional Cloudinary image uploads and SMTP order notifications
- Socket.IO infrastructure for order status events
- Seed script with Sri Lankan food categories and sample LKR menu items
- `.env.example` and setup instructions

## Important scope note
This is a functional MVP, not a production-ready deployment. Cash on Delivery is the supported payment method; online payment processing is intentionally not enabled. Cloudinary uploads and SMTP email are optional and remain inactive until configured. Review authorization, admin access and all deployment settings before accepting real customer orders.

## Requirements
- Node.js 20+
- MongoDB local instance or MongoDB Atlas connection string

## 1. Setup
Open a terminal in the project root:

```bash
npm install
npm run install:all
```

Copy `server/.env.example` to `server/.env` and set `MONGO_URI` and a long random `JWT_SECRET`.

## 2. Seed menu data
```bash
npm run seed
```
The seed command is safe to rerun: it adds missing demo records without deleting existing menu data.

## 3. Start the app
```bash
npm run dev
```
Frontend: http://localhost:5173  
API health: http://localhost:5000/api/health

The root command runs both client and server. If port 5173 is already in use, Vite automatically selects another local port; the development API allows localhost ports 5173–5199. If you prefer separate terminals:
```bash
npm run dev --workspace server
npm run dev --workspace client
```

## First administrator
Register a normal account through the site, then set that user's `role` to `admin` in your development MongoDB database. Never expose an admin password in source code.

Sign in with the same account after changing its role. The admin dashboard and all `/api/admin` endpoints are restricted to users with the `admin` role. Food and order details are stored in MongoDB; a category cannot be deleted while food items still use it.

## Environment variables
See `server/.env.example`. `VITE_API_URL` is optional; it defaults to `http://localhost:5000`.

- Cloudinary uploads require `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
- Order emails require `EMAIL_HOST` and `EMAIL_FROM`; configure `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, and `EMAIL_PASS` for your SMTP provider.
- Keep provider credentials in `server/.env`; never put them in the frontend or share them in chat.
- Coupon creation, delivery assignment, account roles, and reports are available from the Admin page after an account is given the `admin` role.
- Update the public Contact page from Admin → Contact details. Phone and email are optional; service area, delivery note, opening hours, and customer-care message can also be edited.
- A customer account can be promoted to delivery staff from Admin → Customers & staff. Delivery users see assigned orders after signing in.

## Security notes
- Configure `CLIENT_URL` to the real frontend origin before deployment.
- Use HTTPS in production and set cookie security options appropriately.
- Keep `.env` out of Git.
- Online payments are not implemented. Do not treat a client-side payment confirmation as proof of payment.
- Review and test all authorization rules before real customer use.
