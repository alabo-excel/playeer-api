import axios from 'axios';

export interface PaystackSubscriptionResult {
  success: boolean;
  subscriptionCode?: string;
  error?: any;
}

export async function createPaystackSubscription(email: string, plan: 'monthly' | 'yearly'):
  Promise<PaystackSubscriptionResult> {
  try {
    const paystackPlanCode = plan === 'monthly'
      ? process.env.PAYSTACK_MONTHLY_PLAN_CODE
      : process.env.PAYSTACK_YEARLY_PLAN_CODE;
    const paystackRes = await axios.post(
      'https://api.paystack.co/subscription',
      {
        customer: email,
        plan: paystackPlanCode
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (paystackRes.data && paystackRes.data.status) {
      return {
        success: true,
        subscriptionCode: paystackRes.data.data.subscription_code
      };
    } else {
      return {
        success: false,
        error: paystackRes.data
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : err
    };
  }
}
