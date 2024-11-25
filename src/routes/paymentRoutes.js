// const express = require("express");
// const router = express.Router();
// const paymentController = require("../controllers/paymentController");
// const authMiddleware = require("../middlewares/authMiddleware");
// const authorizeRole = require("../middlewares/authorizeRole");

// router.post("/", authMiddleware, paymentController.createPayment);

// router.delete(
//   "/delete/:id",
//   authMiddleware,
//   authorizeRole("admin"),
//   paymentController.deletePayment
// );

// router.get(
//   "/",
//     authMiddleware,
//     authorizeRole("admin"),
//   paymentController.getAllPayments
// );

// router.get(
//   "/details/:payment_id",
//   //   authMiddleware,
//   //   authorizeRole("student"),
//   paymentController.getPaymentDetails
// );
// module.exports = router;



// routes/paymentRoutes.js

const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  handleWebhook,
  getAllPayments
} = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware'); // Ensure you have an auth middleware

// Apply authentication middleware to protect these routes except for webhook
router.post('/create-order', authMiddleware, createOrder);
router.post('/verify-payment', authMiddleware, verifyPayment);

// Webhook route should not be protected by auth middleware
router.post('/webhook', handleWebhook);
router.get('/allPayments',getAllPayments);

module.exports = router;
