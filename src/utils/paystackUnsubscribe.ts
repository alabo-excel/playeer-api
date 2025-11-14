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
    // Handle 404 errors gracefully - subscription might already be cancelled or doesn't exist
    if (err instanceof Error && 'response' in err) {
      const axiosErr = err as any;
      if (axiosErr.response?.status === 404) {
        console.warn(`Subscription ${subscriptionCode} not found on Paystack, treating as already cancelled`);
        return { success: true }; // Treat as success since the subscription is effectively cancelled
      }
    }
    return { success: false, error: err instanceof Error ? err.message : err };
  }
}
