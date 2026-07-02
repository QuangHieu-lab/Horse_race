import { Router } from 'express';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as paymentService from '../services/payment.service.js';

export const paymentRouter = Router();

paymentRouter.post('/payos/webhook', asyncHandler(async (req, res) => {
  const result = await paymentService.handlePayosWebhook(req.body);
  res.json({
    code: result.code,
    desc: result.message,
  });
}));

paymentRouter.get('/payos/return', asyncHandler(async (req, res) => {
  const orderCode = Number(req.query.orderCode);
  if (Number.isFinite(orderCode)) {
    await paymentService.confirmPayosPayment(orderCode, req.query);
  }
  if (env.payos.frontendReturnUrl) {
    const url = new URL(env.payos.frontendReturnUrl);
    url.searchParams.set('payment', 'success');
    if (Number.isFinite(orderCode)) url.searchParams.set('orderCode', String(orderCode));
    res.redirect(url.toString());
    return;
  }
  res.json({ ok: true, orderCode: Number.isFinite(orderCode) ? orderCode : null });
}));

paymentRouter.get('/payos/cancel', asyncHandler(async (req, res) => {
  const orderCode = Number(req.query.orderCode);
  if (Number.isFinite(orderCode)) {
    await paymentService.markPayosCancelled(orderCode);
  }
  if (env.payos.frontendReturnUrl) {
    const url = new URL(env.payos.frontendReturnUrl);
    url.searchParams.set('payment', 'cancelled');
    if (Number.isFinite(orderCode)) url.searchParams.set('orderCode', String(orderCode));
    res.redirect(url.toString());
    return;
  }
  res.json({ ok: true, cancelled: true, orderCode: Number.isFinite(orderCode) ? orderCode : null });
}));
