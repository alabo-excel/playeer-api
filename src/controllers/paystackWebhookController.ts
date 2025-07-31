import { Request, Response } from 'express';
import User from '../models/User';

// Handle Paystack webhook events
export const paystackWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Paystack sends events as JSON in req.body
    const event = req.body;

    // Verify Paystack signature
    const paystackSignature = req.headers['x-paystack-signature'];
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
    if (!paystackSignature || paystackSignature !== hash) {
      res.status(401).json({ success: false, message: 'Invalid Paystack signature' });
      return;
    }

    if (!event || !event.event) {
      res.status(400).json({ success: false, message: 'Invalid webhook event' });
      return;
    }

    // Handle subscription renewal
    if (event.event === 'subscription.create' || event.event === 'subscription.renew') {
      const subscriptionCode = event.data.subscription_code;
      const email = event.data.customer.email;
      const plan = event.data.plan.plan_code === process.env.PAYSTACK_MONTHLY_PLAN_CODE ? 'monthly' : 'yearly';
      // Find user by email
      const user = await User.findOne({ email });
      if (user) {
        // Set renewal date to next month/year
        const now = new Date();
        let renewalDate: Date | undefined;
        if (plan === 'monthly') {
          renewalDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        } else {
          renewalDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        }
        user.plan = plan;
        user.renewalDate = renewalDate;
        user.paystackSubscriptionId = subscriptionCode;
        await user.save();
      }
    }

    // Handle subscription disable/cancel
    if (event.event === 'subscription.disable' || event.event === 'subscription.cancel') {
      const subscriptionCode = event.data.subscription_code;
      // Find user by subscription code
      const user = await User.findOne({ paystackSubscriptionId: subscriptionCode });
      if (user) {
        user.plan = 'free';
        user.renewalDate = undefined;
        user.paystackSubscriptionId = undefined;
        await user.save();
      }
    }

    // Handle payment failure (optional)
    if (event.event === 'invoice.failed') {
      const subscriptionCode = event.data.subscription.subscription_code;
      const user = await User.findOne({ paystackSubscriptionId: subscriptionCode });
      if (user) {
        user.plan = 'free';
        user.renewalDate = undefined;
        user.paystackSubscriptionId = undefined;
        await user.save();
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error handling webhook', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
