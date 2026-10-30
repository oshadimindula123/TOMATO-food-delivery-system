import nodemailer from 'nodemailer';

const smtpConfigured = Boolean(process.env.EMAIL_HOST && process.env.EMAIL_FROM);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: process.env.EMAIL_USER ? {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      } : undefined
    })
  : null;

export async function sendOrderNotification(user, order, subject, message) {
  if (!transporter) return;
  if (!user?.email) throw new Error('Cannot send order notification: customer email is missing.');

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject,
    text: `${message}\n\nOrder ${order.orderNumber}\nTotal: LKR ${order.totalAmount}\nStatus: ${order.orderStatus}`
  });
}
