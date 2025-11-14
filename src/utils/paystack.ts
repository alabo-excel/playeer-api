import axios from 'axios';

export interface PaystackSubscriptionResult {
  success: boolean;
  subscriptionCode?: string;
  error?: any;
}

export interface PaystackPlanResult {
  success: boolean;
  planCode?: string;
  planData?: any;
  error?: any;
}

export interface PaystackPlanData {
  name: string;
  interval: 'daily' | 'weekly' | 'monthly' | 'annually';
  amount: number; // Amount in kobo (multiply by 100)
  currency?: string;
  description?: string;
  invoice_limit?: number;
  send_invoices?: boolean;
  send_sms?: boolean;
}

// Create a plan on Paystack
export async function createPaystackPlan(planData: PaystackPlanData): Promise<PaystackPlanResult> {
  try {
    const paystackRes = await axios.post(
      'https://api.paystack.co/plan',
      {
        name: planData.name,
        interval: planData.interval,
        amount: planData.amount, // Amount should be in kobo
        currency: planData.currency || 'NGN',
        description: planData.description || `${planData.name} subscription plan`,
        invoice_limit: planData.invoice_limit,
        send_invoices: planData.send_invoices || true,
        send_sms: planData.send_sms || false
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
        planCode: paystackRes.data.data.plan_code,
        planData: paystackRes.data.data
      };
    } else {
      return {
        success: false,
        error: paystackRes.data
      };
    }
  } catch (err) {
    console.error('Paystack plan creation error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : err
    };
  }
}

// Update a plan on Paystack
export async function updatePaystackPlan(planCode: string, updateData: Partial<PaystackPlanData>): Promise<PaystackPlanResult> {
  try {
    const paystackRes = await axios.put(
      `https://api.paystack.co/plan/${planCode}`,
      updateData,
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
        planCode: paystackRes.data.data.plan_code,
        planData: paystackRes.data.data
      };
    } else {
      return {
        success: false,
        error: paystackRes.data
      };
    }
  } catch (err) {
    console.error('Paystack plan update error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : err
    };
  }
}

// Get plan details from Paystack
export async function getPaystackPlan(planCode: string): Promise<PaystackPlanResult> {
  try {
    const paystackRes = await axios.get(
      `https://api.paystack.co/plan/${planCode}`,
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
        planCode: paystackRes.data.data.plan_code,
        planData: paystackRes.data.data
      };
    } else {
      return {
        success: false,
        error: paystackRes.data
      };
    }
  } catch (err) {
    console.error('Paystack plan fetch error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : err
    };
  }
}

// Delete/disable a plan on Paystack (Paystack doesn't allow deletion, only deactivation)
export async function deactivatePaystackPlan(planCode: string): Promise<PaystackPlanResult> {
  try {
    // Paystack doesn't have a direct delete endpoint, but we can update the plan to inactive
    const paystackRes = await axios.put(
      `https://api.paystack.co/plan/${planCode}`,
      { name: `INACTIVE_${Date.now()}_${planCode}` }, // Rename to indicate inactive
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
        planCode: paystackRes.data.data.plan_code,
        planData: paystackRes.data.data
      };
    } else {
      return {
        success: false,
        error: paystackRes.data
      };
    }
  } catch (err) {
    console.error('Paystack plan deactivation error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : err
    };
  }
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
