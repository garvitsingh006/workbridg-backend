# Payment System API Documentation

## Overview

This backend implements a **two-stage payment system** using **Razorpay** with manual escrow management for the WorkBridg platform. The payment flow consists of:

1. **Advance Payment (10%)** - Paid when project starts
2. **Final Payment (90%)** - Paid when project completes
3. **Manual Release** - Admin manually releases funds to freelancer

---

## Payment Workflow

### Step 1: Admin Approves Project → Payment Record Created

When an admin marks a project as `"in-progress"`, a payment record is **automatically created**.

**Backend Action (Automatic):**
- Creates Payment document in database
- Calculates advance (10%) and final (90%) amounts
- Platform fee set to 10% of total
- Links payment to project

**Frontend Impact:**
- After admin updates project status to `"in-progress"`, fetch payment details
- Display payment information to client

---

### Step 2: Client Pays Advance (10%)

**Endpoint:** `POST /api/v1/payments/create-order`

**Request Body:**
```json
{
  "paymentId": "64abc123...",
  "paymentType": "advance"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order_ABC123",
    "amount": 5000,
    "currency": "INR",
    "keyId": "rzp_test_...",
    "paymentType": "advance"
  },
  "message": "Razorpay order created successfully"
}
```

**Frontend Implementation:**

```javascript
// 1. Create Razorpay Order
const response = await fetch('/api/v1/payments/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    paymentId: "64abc123...",
    paymentType: "advance"
  })
});

const { data } = await response.json();

// 2. Open Razorpay Checkout
const options = {
  key: data.keyId,
  amount: data.amount * 100,
  currency: data.currency,
  name: "WorkBridg",
  description: "Advance Payment",
  order_id: data.orderId,
  handler: function (response) {
    // Payment successful
    verifyPayment({
      paymentId: "64abc123...",
      paymentType: "advance",
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature
    });
  },
  prefill: {
    name: "Client Name",
    email: "client@example.com"
  },
  theme: {
    color: "#3399cc"
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

---

### Step 3: Verify Payment

**Endpoint:** `POST /api/v1/payments/verify-payment`

**Request Body:**
```json
{
  "paymentId": "64abc123...",
  "paymentType": "advance",
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "overallStatus": "advance_paid",
    "advance": {
      "status": "paid",
      "amount": 5000,
      "paymentId": "pay_XYZ789"
    },
    "final": {
      "status": "pending",
      "amount": 45000
    }
  },
  "message": "Payment verified successfully"
}
```

**Frontend Implementation:**

```javascript
async function verifyPayment(paymentData) {
  const response = await fetch('/api/v1/payments/verify-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(paymentData)
  });

  const result = await response.json();

  if (result.success) {
    // Show success message
    alert('Advance payment successful!');
    // Refresh payment status
    fetchPaymentDetails();
  }
}
```

---

### Step 4: Freelancer Completes Work

Freelancer marks project as completed. Client reviews the work.

---

### Step 5: Client Pays Final Payment (90%)

**Same as Step 2 & 3, but with `paymentType: "final"`**

```javascript
// Create final payment order
const response = await fetch('/api/v1/payments/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    paymentId: "64abc123...",
    paymentType: "final"
  })
});
```

---

### Step 6: Admin Releases Payment to Freelancer

**Endpoint:** `POST /api/v1/payments/release`

**Request Body:**
```json
{
  "paymentId": "64abc123..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overallStatus": "released",
    "releaseStatus": "released",
    "releaseAmount": 45000
  },
  "message": "Payment of ₹45000 released to freelancer"
}
```

**Note:** This is a **manual admin action**. The admin then transfers the money to the freelancer's bank account manually.

---

## API Endpoints Reference

### 1. Create Payment Record (Automatic - called by backend)

**Endpoint:** `POST /api/v1/payments/create-record`

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "projectId": "64abc123...",
  "totalAmount": 50000,
  "platformFeePercentage": 10
}
```

---

### 2. Create Razorpay Order

**Endpoint:** `POST /api/v1/payments/create-order`

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "paymentId": "64abc123...",
  "paymentType": "advance" // or "final"
}
```

---

### 3. Verify Payment

**Endpoint:** `POST /api/v1/payments/verify-payment`

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "paymentId": "64abc123...",
  "paymentType": "advance",
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash"
}
```

---

### 4. Get Payment by Project ID

**Endpoint:** `GET /api/v1/payments/project/:projectId`

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "projectId": {
      "_id": "64def456...",
      "title": "Website Development"
    },
    "clientId": {
      "_id": "64ghi789...",
      "fullName": "John Doe"
    },
    "freelancerId": {
      "_id": "64jkl012...",
      "fullName": "Jane Smith"
    },
    "totalAmount": 50000,
    "platformFee": 5000,
    "advance": {
      "amount": 5000,
      "status": "paid"
    },
    "final": {
      "amount": 45000,
      "status": "pending"
    },
    "overallStatus": "advance_paid",
    "releaseStatus": "not_released"
  }
}
```

---

### 5. Get Payment by Payment ID

**Endpoint:** `GET /api/v1/payments/:paymentId`

**Headers:**
- `Authorization: Bearer <token>`

---

### 6. Get User's Payments

**Endpoint:** `GET /api/v1/payments/user/my-payments`

**Headers:**
- `Authorization: Bearer <token>`

**Response:** Array of payment objects for the logged-in user (client or freelancer)

---

### 7. Release Payment (Admin Only)

**Endpoint:** `POST /api/v1/payments/release`

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "paymentId": "64abc123..."
}
```

**Requirements:**
- User must be admin
- Both advance and final payments must be completed
- Payment not already released

---

### 8. Refund Payment (Admin Only)

**Endpoint:** `POST /api/v1/payments/refund`

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "paymentId": "64abc123..."
}
```

**Requirements:**
- User must be admin
- Payment must not be already released
- Can be used in dispute situations

---

### 9. Get All Payments (Admin Only)

**Endpoint:** `GET /api/v1/payments/admin/all`

**Headers:**
- `Authorization: Bearer <token>`

**Response:** Array of all payment records

---

## Payment Status Values

### Overall Status
- `"pending"` - Payment record created, no payments made
- `"advance_paid"` - 10% advance paid
- `"final_paid"` - All payments completed (100%)
- `"released"` - Funds released to freelancer
- `"refunded"` - Refunded to client

### Stage Status (advance/final)
- `"pending"` - Not initiated
- `"created"` - Razorpay order created
- `"paid"` - Payment successful
- `"failed"` - Payment failed

### Release Status
- `"not_released"` - Funds held in escrow
- `"released"` - Paid to freelancer
- `"refunded"` - Refunded to client

---

## Payment Model Schema

```javascript
{
  projectId: ObjectId,
  clientId: ObjectId,
  freelancerId: ObjectId,
  totalAmount: Number,
  platformFee: Number,

  advance: {
    orderId: String,
    paymentId: String,
    signature: String,
    amount: Number,
    status: "pending" | "created" | "paid" | "failed"
  },

  final: {
    orderId: String,
    paymentId: String,
    signature: String,
    amount: Number,
    status: "pending" | "created" | "paid" | "failed"
  },

  releaseAmount: Number,
  releaseStatus: "not_released" | "released" | "refunded",
  overallStatus: "pending" | "advance_paid" | "final_paid" | "released" | "refunded",

  createdAt: Date,
  updatedAt: Date
}
```

---

## Frontend Integration Checklist

### Setup
- [ ] Include Razorpay checkout script in HTML:
  ```html
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  ```

### For Client Dashboard
- [ ] Fetch payment details after project starts
- [ ] Display advance and final payment amounts
- [ ] Show payment status (pending/paid)
- [ ] Implement "Pay Advance" button
- [ ] Implement "Pay Final Payment" button
- [ ] Handle Razorpay checkout flow
- [ ] Verify payments after successful transaction

### For Freelancer Dashboard
- [ ] Display payment status
- [ ] Show when advance is paid
- [ ] Show when final payment is paid
- [ ] Display release status

### For Admin Dashboard
- [ ] When updating project to "in-progress", include `totalAmount` in request
- [ ] View all payments
- [ ] Release payments to freelancers
- [ ] Handle refunds if needed

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error message here"
}
```

Common errors:
- `400` - Validation errors, missing fields
- `403` - Authorization errors (wrong role)
- `404` - Payment/Project not found
- `500` - Server errors

---

## Important Notes

1. **Razorpay Credentials**: Add your Razorpay API keys in `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```

2. **Test Mode**: Use Razorpay test keys for development

3. **Manual Escrow**: This system uses manual escrow. After both payments are complete, admin manually transfers funds to freelancer

4. **Platform Fee**: Currently set to 10% of total amount

5. **Payment Split**:
   - Advance: 10% of total
   - Final: 90% of total

6. **Security**: All payment endpoints require authentication via JWT token

---

## Testing Flow

1. Admin approves project (status → "in-progress") with totalAmount
2. Backend creates payment record automatically
3. Client fetches payment details
4. Client pays advance (10%)
5. System verifies advance payment
6. Freelancer completes work
7. Client pays final payment (90%)
8. System verifies final payment
9. Admin releases payment to freelancer
10. Admin manually transfers funds outside system

---

## Questions?

For any issues or questions about the payment API, contact the backend team.
