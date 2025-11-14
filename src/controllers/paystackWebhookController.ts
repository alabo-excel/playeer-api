import { Request, Response } from 'express';
import User from '../models/User';
import crypto from 'crypto';

export const paystackWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      res
        .status(500)
        .json({ success: false, message: 'Server configuration error' });
      return;
    }

    // Get raw body for signature verification
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body);
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      res.status(401).json({ success: false, message: 'Missing signature' });
      return;
    }

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    if (signature !== hash) {
      console.error('Invalid webhook signature');
      res.status(401).json({ success: false, message: 'Invalid signature' });
      return;
    }

    const event = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;

    // Respond to Paystack immediately
    res.status(200).json({ success: true });

    // Process event in background
    switch (event.event) {
      case 'charge.success': {
        const { subscription_code, customer, plan } = event.data;

        if (!customer?.email) {
          console.error('Missing customer email in webhook data');
          break;
        }

        const user = await User.findOne({
          email: customer.email.toLowerCase(),
        });
        if (!user) {
          console.error(`User not found for email: ${customer.email}`);
          break;
        }

        try {
          const now = new Date();
          let renewalDate: Date;

          if (plan.plan_code === process.env.PAYSTACK_MONTHLY_PLAN_CODE) {
            renewalDate = new Date(now);
            renewalDate.setMonth(renewalDate.getMonth() + 1);
            user.plan = 'monthly';
          } else {
            renewalDate = new Date(now);
            renewalDate.setFullYear(renewalDate.getFullYear() + 1);
            user.plan = 'yearly';
          }

          user.renewalDate = renewalDate;
          user.paystackSubscriptionId = subscription_code;
          await user.save();

          console.log(`Subscription activated for user: ${customer.email}`);
        } catch (error) {
          console.error('Error updating user subscription:', error);
        }
        break;
      }

      case 'subscription.not_renew':
      case 'subscription.disable': {
        const { subscription_code } = event.data;

        if (!subscription_code) {
          console.error('Missing subscription_code in webhook data');
          break;
        }

        try {
          const user = await User.findOne({
            paystackSubscriptionId: subscription_code,
          });

          if (user) {
            user.plan = 'free';
            user.renewalDate = undefined;
            user.paystackSubscriptionId = undefined;
            await user.save();
            console.log(`Subscription cancelled for user: ${user.email}`);
          } else {
            console.error(
              `User not found for subscription: ${subscription_code}`,
            );
          }
        } catch (error) {
          console.error('Error cancelling subscription:', error);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const { subscription } = event.data;

        if (!subscription?.subscription_code) {
          console.error('Missing subscription data in payment failed webhook');
          break;
        }

        try {
          const user = await User.findOne({
            paystackSubscriptionId: subscription.subscription_code,
          });

          if (user) {
            console.log(`Payment failed for user: ${user.email}`);

            // Move user to free plan when payment fails
            user.plan = 'free';
            user.renewalDate = undefined;
            user.paystackSubscriptionId = undefined;
            await user.save();

            console.log(`User ${user.email} moved to free plan due to payment failure`);
          } else {
            console.error(
              `User not found for failed payment: ${subscription.subscription_code}`,
            );
          }
        } catch (error) {
          console.error('Error handling payment failure:', error);
        }
        break;
      }

      case 'invoice.create':
        console.log('Upcoming billing cycle:', event.data);
        break;

      case 'invoice.update':
        console.log('Invoice updated:', event.data);
        break;

      default:
        console.log('Unhandled event:', event.event);
    }
  } catch (error) {
    console.error('Webhook error:', error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, message: 'Error handling webhook' });
    }
  }
};
