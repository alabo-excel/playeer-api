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

// Get customer subscriptions from Paystack
export async function getCustomerSubscriptions(customerEmail: string): Promise<any> {
  try {
    const response = await axios.get(
      `https://api.paystack.co/subscription?customer=${customerEmail}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.status) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        error: response.data
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.response?.data || err.message || err
    };
  }
}

// Disable/cancel a subscription on Paystack
export async function disablePaystackSubscription(subscriptionCode: string): Promise<any> {
  try {
    const response = await axios.post(
      'https://api.paystack.co/subscription/disable',
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

    if (response.data && response.data.status) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        error: response.data
      };
    }
  } catch (err: any) {
    // Handle 404 errors gracefully - subscription might already be cancelled
    if (err.response?.status === 404) {
      console.warn(`Subscription ${subscriptionCode} not found on Paystack, treating as already cancelled`);
      return { success: true }; // Treat as success since the subscription is effectively cancelled
    }

    return {
      success: false,
      error: err.response?.data || err.message || err
    };
  }
}

export async function createPaystackSubscription(
  email: string,
  plan: 'monthly' | 'yearly',
  customPlanCode?: string
): Promise<PaystackSubscriptionResult> {
  // Declare at function scope so it's accessible in catch block
  let paystackPlanCode: string | undefined;

  try {
    // Use custom plan code if provided, otherwise fall back to environment variables
    paystackPlanCode = customPlanCode;

    // if (!paystackPlanCode) {
    //   paystackPlanCode = plan === 'monthly'
    //     ? process.env.PAYSTACK_MONTHLY_PLAN_CODE
    //     : process.env.PAYSTACK_YEARLY_PLAN_CODE;
    // }

    if (!paystackPlanCode) {
      console.error(`No Paystack plan code available for plan: ${plan}`);
      return {
        success: false,
        error: `Paystack plan code not configured for ${plan} plan`
      };
    }

    console.log(`Creating Paystack subscription for email: ${email}, plan: ${plan}, planCode: ${paystackPlanCode}`);

    // First, check if customer has existing subscriptions
    console.log('Checking for existing customer subscriptions...');
    const existingSubscriptions = await getCustomerSubscriptions(email);

    if (existingSubscriptions.success && existingSubscriptions.data?.length > 0) {
      console.log(`Found ${existingSubscriptions.data.length} existing subscriptions`);

      // Filter for subscriptions on the same plan
      const samePlanSubscriptions = existingSubscriptions.data.filter(
        (sub: any) => sub.plan?.plan_code === paystackPlanCode &&
          (sub.status === 'active' || sub.status === 'non-renewing')
      );

      if (samePlanSubscriptions.length > 0) {
        console.log(`Found ${samePlanSubscriptions.length} subscriptions on the same plan, cancelling them first`);

        // Cancel all existing subscriptions on the same plan
        for (const subscription of samePlanSubscriptions) {
          console.log(`Cancelling existing subscription: ${subscription.subscription_code} (status: ${subscription.status})`);
          const cancelResult = await disablePaystackSubscription(subscription.subscription_code);
          if (cancelResult.success) {
            console.log(`Successfully cancelled subscription: ${subscription.subscription_code}`);
          } else {
            console.warn(`Failed to cancel subscription ${subscription.subscription_code}:`, cancelResult.error);
          }
        }

        // Wait a bit for Paystack to process the cancellations
        console.log('Waiting for Paystack to process cancellations...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // First, try to create/get the customer
    let customerCode = email;
    try {
      const customerRes = await axios.post(
        'https://api.paystack.co/customer',
        {
          email: email
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (customerRes.data && customerRes.data.status) {
        customerCode = customerRes.data.data.customer_code;
        console.log(`Customer created/found with code: ${customerCode}`);
      }
    } catch (customerErr: any) {
      // If customer already exists, that's fine, we can still use the email
      if (customerErr.response?.status === 400) {
        console.log(`Customer with email ${email} already exists, proceeding with email`);
      } else {
        console.error('Error creating customer:', customerErr.response?.data || customerErr.message);
      }
    }

    console.log('Attempting to create new subscription...');
    const paystackRes = await axios.post(
      'https://api.paystack.co/subscription',
      {
        customer: customerCode,
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
      console.log('Paystack subscription created successfully:', paystackRes.data.data.subscription_code);
      return {
        success: true,
        subscriptionCode: paystackRes.data.data.subscription_code
      };
    } else {
      console.error('Paystack subscription creation failed:', paystackRes.data);
      return {
        success: false,
        error: paystackRes.data
      };
    }
  } catch (err: any) {
    // If we still get duplicate subscription error, try to handle it by fetching existing subscriptions
    if (err.response?.data?.code === 'duplicate_subscription') {
      console.log('Got duplicate subscription error, trying to find and use existing subscription...');

      try {
        const existingSubscriptions = await getCustomerSubscriptions(email);
        if (existingSubscriptions.success && existingSubscriptions.data?.length > 0) {
          // Find active subscription on the target plan using the dynamic plan code
          const activeSubscription = existingSubscriptions.data.find(
            (sub: any) => sub.plan?.plan_code === paystackPlanCode && sub.status === 'active'
          );

          if (activeSubscription) {
            console.log('Found existing active subscription, using it:', activeSubscription.subscription_code);
            return {
              success: true,
              subscriptionCode: activeSubscription.subscription_code
            };
          }
        }
      } catch (fetchErr) {
        console.error('Error fetching existing subscriptions:', fetchErr);
      }
    }

    console.error('Paystack subscription error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
    return {
      success: false,
      error: err.response?.data || err.message || err
    };
  }
}
