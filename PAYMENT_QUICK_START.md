# Payment System - Quick Start Guide

## What Changed?

### 1. **New Payment Model** (`src/models/payment.model.js`)
- Complete rewrite to support two-stage payments (advance + final)
- Tracks Razorpay order IDs, payment IDs, and signatures
- Manages escrow and release status

### 2. **New Payment Controller** (`src/controllers/payment.controller.js`)
- Handles Razorpay order creation
- Verifies payment signatures
- Manages payment release and refunds

### 3. **New Payment Routes** (`src/routes/payment.route.js`)
- All routes prefixed with `/api/v1/payments`
- Includes admin-only routes for release/refund

### 4. **Updated Project Controller** (`src/controllers/project.controller.js`)
- **AUTO-CREATES PAYMENT** when admin sets project status to "in-progress"
- Requires `totalAmount` field in request body when starting project

### 5. **Environment Variables** (`.env`)
- Added `RAZORPAY_KEY_ID`
- Added `RAZORPAY_KEY_SECRET`

---

## Payment Flow Summary

```
ADMIN APPROVES PROJECT (status → "in-progress")
   ↓
Backend automatically creates Payment record
   ↓
CLIENT PAYS 10% ADVANCE
   ↓
Freelancer works on project
   ↓
CLIENT PAYS 90% FINAL PAYMENT
   ↓
ADMIN RELEASES FUNDS
   ↓
Admin manually transfers money to freelancer
```

---

## Key API Endpoints for Frontend

### 1. Get Payment for a Project
```
GET /api/v1/payments/project/:projectId
Authorization: Bearer <token>
```

### 2. Create Payment Order (Advance or Final)
```
POST /api/v1/payments/create-order
Authorization: Bearer <token>

Body:
{
  "paymentId": "64abc...",
  "paymentType": "advance"  // or "final"
}
```

### 3. Verify Payment After Razorpay Success
```
POST /api/v1/payments/verify-payment
Authorization: Bearer <token>

Body:
{
  "paymentId": "64abc...",
  "paymentType": "advance",
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash"
}
```

### 4. Admin Releases Payment
```
POST /api/v1/payments/release
Authorization: Bearer <token>

Body:
{
  "paymentId": "64abc..."
}
```

---

## What Frontend Needs to Do

### For Admin
When updating project to "in-progress", **include totalAmount**:

```javascript
PUT /api/v1/projects/:projectId

{
  "status": "in-progress",
  "totalAmount": 50000  // ← REQUIRED!
}
```

### For Client
1. Fetch payment details after project starts
2. Show "Pay Advance (10%)" button
3. When clicked:
   - Call `/create-order` with `paymentType: "advance"`
   - Open Razorpay checkout with returned `orderId`
   - After success, call `/verify-payment`
4. Repeat for final payment with `paymentType: "final"`

### Razorpay Integration
Include in HTML:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Example checkout:
```javascript
const options = {
  key: data.keyId,
  amount: data.amount * 100,
  currency: "INR",
  order_id: data.orderId,
  handler: function (response) {
    // Call verify-payment endpoint
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

---

## Payment Status Guide

| Status | Meaning |
|--------|---------|
| `pending` | Payment record created, no money paid |
| `advance_paid` | 10% advance paid by client |
| `final_paid` | All 100% paid, ready for release |
| `released` | Admin released funds to freelancer |
| `refunded` | Refunded to client (in case of dispute) |

---

## Configuration

### Step 1: Add Razorpay Credentials
Update `.env` file:
```
RAZORPAY_KEY_ID=rzp_test_XXXXXX
RAZORPAY_KEY_SECRET=XXXXXX
```

Get these from: https://dashboard.razorpay.com/app/keys

### Step 2: Install Dependencies
```bash
npm install razorpay
```

### Step 3: Start Server
```bash
npm run dev
```

---

## Testing

### Test Mode
Use Razorpay test keys for development. Test cards:
- **Success:** 4111 1111 1111 1111
- **Failure:** 4000 0000 0000 0002

### Test Flow
1. Create project as client
2. Admin approves with totalAmount
3. Client pays advance
4. Client pays final
5. Admin releases payment

---

## Notes

- **Platform fee**: Fixed at 10% of total amount that client will pay, which means that the total amount client has to pay will be 10% more than that of what the client and freelancer have decided to be the project payment.
- **Advance split**: 10% of total
- **Final split**: 90% of total
- **Manual escrow**: Admin manually transfers after release
- **All endpoints require authentication**

---

## Full Documentation

See `PAYMENT_API_DOCUMENTATION.md` for complete API reference and detailed examples.
