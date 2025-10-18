# Frontend Code Examples - Payment Integration

## Setup

### 1. Add Razorpay Script to HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>WorkBridg</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <!-- Your app -->
</body>
</html>
```

---

## Admin Dashboard

### Approve Project with Total Amount
```javascript
async function approveProject(projectId, totalAmount) {
  try {
    const response = await fetch(`/api/v1/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        status: 'in-progress',
        totalAmount: totalAmount  // REQUIRED!
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('Project approved and payment record created!');
      // Redirect or refresh
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (error) {
    console.error('Error approving project:', error);
    alert('Failed to approve project');
  }
}

// Usage
approveProject('64abc123...', 50000);
```

### Release Payment to Freelancer
```javascript
async function releasePayment(paymentId) {
  if (!confirm('Are you sure you want to release this payment?')) {
    return;
  }

  try {
    const response = await fetch('/api/v1/payments/release', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ paymentId })
    });

    const result = await response.json();

    if (result.success) {
      alert(`Payment released: ₹${result.data.releaseAmount}`);
      // Show instructions to manually transfer
      showManualTransferInstructions(result.data);
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (error) {
    console.error('Error releasing payment:', error);
  }
}

function showManualTransferInstructions(payment) {
  const instructions = `
    Payment Released Successfully!

    Freelancer: ${payment.freelancerId.fullName}
    Amount to Transfer: ₹${payment.releaseAmount}

    Please transfer this amount to the freelancer's bank account manually.
  `;
  alert(instructions);
}
```

### View All Payments
```javascript
async function fetchAllPayments() {
  try {
    const response = await fetch('/api/v1/payments/admin/all', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();

    if (result.success) {
      displayPayments(result.data);
    }
  } catch (error) {
    console.error('Error fetching payments:', error);
  }
}

function displayPayments(payments) {
  const tableBody = document.getElementById('payments-table');
  tableBody.innerHTML = '';

  payments.forEach(payment => {
    const row = `
      <tr>
        <td>${payment.projectId.title}</td>
        <td>${payment.clientId.fullName}</td>
        <td>${payment.freelancerId.fullName}</td>
        <td>₹${payment.totalAmount}</td>
        <td>${payment.overallStatus}</td>
        <td>
          ${payment.overallStatus === 'final_paid'
            ? `<button onclick="releasePayment('${payment._id}')">Release</button>`
            : '-'
          }
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });
}
```

---

## Client Dashboard

### Fetch Payment Details
```javascript
async function fetchPaymentDetails(projectId) {
  try {
    const response = await fetch(`/api/v1/payments/project/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();

    if (result.success) {
      displayPaymentInfo(result.data);
    } else {
      console.log('No payment record found yet');
    }
  } catch (error) {
    console.error('Error fetching payment:', error);
  }
}

function displayPaymentInfo(payment) {
  const paymentDiv = document.getElementById('payment-info');

  paymentDiv.innerHTML = `
    <h3>Payment Information</h3>
    <p><strong>Total Amount:</strong> ₹${payment.totalAmount}</p>
    <p><strong>Platform Fee:</strong> ₹${payment.platformFee}</p>

    <hr>

    <div class="payment-stage">
      <h4>Advance Payment (10%)</h4>
      <p>Amount: ₹${payment.advance.amount}</p>
      <p>Status: ${payment.advance.status}</p>

      ${payment.advance.status === 'pending' || payment.advance.status === 'created'
        ? `<button onclick="payAdvance('${payment._id}')">Pay Advance</button>`
        : `<span class="badge success">Paid ✓</span>`
      }
    </div>

    <hr>

    <div class="payment-stage">
      <h4>Final Payment (90%)</h4>
      <p>Amount: ₹${payment.final.amount}</p>
      <p>Status: ${payment.final.status}</p>

      ${payment.advance.status === 'paid' && payment.final.status !== 'paid'
        ? `<button onclick="payFinal('${payment._id}')">Pay Final Amount</button>`
        : payment.final.status === 'paid'
        ? `<span class="badge success">Paid ✓</span>`
        : `<span class="badge disabled">Pay advance first</span>`
      }
    </div>

    <hr>

    <p><strong>Overall Status:</strong> ${payment.overallStatus}</p>
  `;
}
```

### Pay Advance (10%)
```javascript
async function payAdvance(paymentId) {
  try {
    // Step 1: Create Razorpay order
    const orderResponse = await fetch('/api/v1/payments/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        paymentId: paymentId,
        paymentType: 'advance'
      })
    });

    const orderResult = await orderResponse.json();

    if (!orderResult.success) {
      alert(`Error: ${orderResult.message}`);
      return;
    }

    // Step 2: Open Razorpay checkout
    const options = {
      key: orderResult.data.keyId,
      amount: orderResult.data.amount * 100,
      currency: orderResult.data.currency,
      name: "WorkBridg",
      description: "Advance Payment (10%)",
      order_id: orderResult.data.orderId,
      handler: function (response) {
        verifyPayment(
          paymentId,
          'advance',
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature
        );
      },
      prefill: {
        name: localStorage.getItem('userName'),
        email: localStorage.getItem('userEmail')
      },
      theme: {
        color: "#3399cc"
      },
      modal: {
        ondismiss: function() {
          console.log('Payment cancelled by user');
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (error) {
    console.error('Error initiating payment:', error);
    alert('Failed to initiate payment');
  }
}
```

### Pay Final Amount (90%)
```javascript
async function payFinal(paymentId) {
  try {
    const orderResponse = await fetch('/api/v1/payments/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        paymentId: paymentId,
        paymentType: 'final'
      })
    });

    const orderResult = await orderResponse.json();

    if (!orderResult.success) {
      alert(`Error: ${orderResult.message}`);
      return;
    }

    const options = {
      key: orderResult.data.keyId,
      amount: orderResult.data.amount * 100,
      currency: orderResult.data.currency,
      name: "WorkBridg",
      description: "Final Payment (90%)",
      order_id: orderResult.data.orderId,
      handler: function (response) {
        verifyPayment(
          paymentId,
          'final',
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature
        );
      },
      prefill: {
        name: localStorage.getItem('userName'),
        email: localStorage.getItem('userEmail')
      },
      theme: {
        color: "#3399cc"
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (error) {
    console.error('Error initiating payment:', error);
  }
}
```

### Verify Payment
```javascript
async function verifyPayment(paymentId, paymentType, orderId, paymentIdRzp, signature) {
  try {
    const response = await fetch('/api/v1/payments/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        paymentId: paymentId,
        paymentType: paymentType,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentIdRzp,
        razorpaySignature: signature
      })
    });

    const result = await response.json();

    if (result.success) {
      alert(`${paymentType === 'advance' ? 'Advance' : 'Final'} payment successful!`);
      // Refresh payment details
      location.reload();
    } else {
      alert(`Payment verification failed: ${result.message}`);
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    alert('Payment verification failed');
  }
}
```

### View My Payments
```javascript
async function fetchMyPayments() {
  try {
    const response = await fetch('/api/v1/payments/user/my-payments', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();

    if (result.success) {
      displayMyPayments(result.data);
    }
  } catch (error) {
    console.error('Error fetching payments:', error);
  }
}

function displayMyPayments(payments) {
  const container = document.getElementById('my-payments');

  if (payments.length === 0) {
    container.innerHTML = '<p>No payments yet</p>';
    return;
  }

  container.innerHTML = payments.map(payment => `
    <div class="payment-card">
      <h4>${payment.projectId.title}</h4>
      <p>Total: ₹${payment.totalAmount}</p>
      <p>Status: ${payment.overallStatus}</p>
      <a href="/payment-details/${payment._id}">View Details</a>
    </div>
  `).join('');
}
```

---

## Freelancer Dashboard

### View Earnings
```javascript
async function fetchMyEarnings() {
  try {
    const response = await fetch('/api/v1/payments/user/my-payments', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();

    if (result.success) {
      displayEarnings(result.data);
    }
  } catch (error) {
    console.error('Error fetching earnings:', error);
  }
}

function displayEarnings(payments) {
  const earnings = {
    total: 0,
    pending: 0,
    released: 0
  };

  payments.forEach(payment => {
    const freelancerAmount = payment.totalAmount - payment.platformFee;

    earnings.total += freelancerAmount;

    if (payment.releaseStatus === 'released') {
      earnings.released += payment.releaseAmount;
    } else {
      earnings.pending += freelancerAmount;
    }
  });

  document.getElementById('earnings-summary').innerHTML = `
    <div class="earnings-card">
      <h3>Total Earnings</h3>
      <p class="amount">₹${earnings.total}</p>
    </div>

    <div class="earnings-card">
      <h3>Released</h3>
      <p class="amount success">₹${earnings.released}</p>
    </div>

    <div class="earnings-card">
      <h3>Pending</h3>
      <p class="amount warning">₹${earnings.pending}</p>
    </div>
  `;

  displayPaymentsList(payments);
}

function displayPaymentsList(payments) {
  const listContainer = document.getElementById('payments-list');

  listContainer.innerHTML = payments.map(payment => {
    const freelancerAmount = payment.totalAmount - payment.platformFee;

    return `
      <div class="payment-item">
        <h4>${payment.projectId.title}</h4>
        <p>Client: ${payment.clientId.fullName}</p>
        <p>Amount: ₹${freelancerAmount}</p>
        <p>Status:
          <span class="badge ${getStatusClass(payment.overallStatus)}">
            ${payment.overallStatus}
          </span>
        </p>
        ${payment.releaseStatus === 'released'
          ? `<p class="success">✓ Released: ₹${payment.releaseAmount}</p>`
          : `<p class="warning">⏳ Awaiting release</p>`
        }
      </div>
    `;
  }).join('');
}

function getStatusClass(status) {
  const statusMap = {
    'pending': 'warning',
    'advance_paid': 'info',
    'final_paid': 'primary',
    'released': 'success',
    'refunded': 'danger'
  };
  return statusMap[status] || 'default';
}
```

---

## React/Vue Components (Optional)

### React: Payment Button Component
```jsx
import React, { useState } from 'react';

function PaymentButton({ paymentId, paymentType, amount, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);

    try {
      // Create order
      const orderResponse = await fetch('/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ paymentId, paymentType })
      });

      const orderResult = await orderResponse.json();

      if (!orderResult.success) {
        alert(orderResult.message);
        setLoading(false);
        return;
      }

      // Open Razorpay
      const options = {
        key: orderResult.data.keyId,
        amount: orderResult.data.amount * 100,
        currency: 'INR',
        name: 'WorkBridg',
        description: `${paymentType} Payment`,
        order_id: orderResult.data.orderId,
        handler: async (response) => {
          // Verify payment
          const verifyResponse = await fetch('/api/v1/payments/verify-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              paymentId,
              paymentType,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })
          });

          const verifyResult = await verifyResponse.json();

          if (verifyResult.success) {
            onSuccess();
          }

          setLoading(false);
        },
        modal: {
          ondismiss: () => setLoading(false)
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed');
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="btn-payment"
    >
      {loading ? 'Processing...' : `Pay ₹${amount}`}
    </button>
  );
}

export default PaymentButton;
```

---

## Error Handling

### Generic Error Handler
```javascript
function handlePaymentError(error, context) {
  console.error(`Payment error [${context}]:`, error);

  let message = 'An error occurred. Please try again.';

  if (error.response) {
    message = error.response.data.message || message;
  } else if (error.message) {
    message = error.message;
  }

  // Show error to user
  alert(message);

  // Log to monitoring service (optional)
  if (window.Sentry) {
    window.Sentry.captureException(error);
  }
}

// Usage
try {
  await payAdvance(paymentId);
} catch (error) {
  handlePaymentError(error, 'advance-payment');
}
```

---

## Testing

### Mock Payment Flow (Development)
```javascript
// For testing UI without actual payment
function mockPaymentSuccess(paymentId, paymentType) {
  console.log(`Mock ${paymentType} payment for ${paymentId}`);

  // Simulate Razorpay response
  verifyPayment(
    paymentId,
    paymentType,
    'order_mock_123',
    'pay_mock_456',
    'mock_signature'
  );
}

// Use in development only
if (process.env.NODE_ENV === 'development') {
  window.mockPayment = mockPaymentSuccess;
}
```

---

## Additional Resources

- **Razorpay Docs:** https://razorpay.com/docs/
- **Backend API Docs:** See `PAYMENT_API_DOCUMENTATION.md`
- **Quick Start:** See `PAYMENT_QUICK_START.md`

---

**Note:** Replace all instances of `localStorage.getItem('token')` with your actual authentication token retrieval method.
