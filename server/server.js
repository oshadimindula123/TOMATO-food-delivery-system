import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDB } from './config/db.js';
import jwt from 'jsonwebtoken';
import { clientCors } from './config/cors.js';

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, { cors: clientCors });
io.use((socket, next) => {
  try {
    // The browser sends the HTTP-only auth cookie with the Socket.IO handshake.
    const cookieHeader = socket.handshake.headers.cookie || '';
    const tokenFromCookie = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith('tomato_token='))?.slice('tomato_token='.length);
    const token = tokenFromCookie || socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    socket.user = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET);
    next();
  } catch { next(new Error('Invalid session')); }
});
io.on('connection', socket => {
  socket.join(`user:${socket.user.id}`);
});
app.set('io', io);
connectDB().then(() => server.listen(PORT, () => console.log(`TOMATO API running on port ${PORT}`))).catch(err => {
  console.error(err.message);
  process.exit(1);
});
