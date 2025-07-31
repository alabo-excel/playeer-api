import axios from 'axios';

export interface PaystackUnsubscribeResult {
  success: boolean;
  error?: any;
}

export async function unsubscribePaystackSubscription(subscriptionCode: string): Promise<PaystackUnsubscribeResult> {
  try {
    const res = await axios.post(
      `https://api.paystack.co/subscription/disable`,
      {
        code: subscriptionCode,
        token: process.env.PAYSTACK_SECRET_KEY
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (res.data && res.data.status) {
      return { success: true };
    } else {
      return { success: false, error: res.data };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : err };
  }
}
