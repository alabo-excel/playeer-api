import { Request, Response, NextFunction } from 'express';
import { logRequestActivity } from '../controllers/activityController';

// Activity tracking middleware
export const trackActivity = (
    activityType: string,
    getDescription: (req: Request, res: Response) => string,
    getMetadata?: (req: Request, res: Response) => Record<string, any>
) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Store original send function
        const originalSend = res.send;

        // Override send function to capture response
        res.send = function (data: any) {
            // Only log if the response was successful (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const description = getDescription(req, res);
                const metadata = getMetadata ? getMetadata(req, res) : undefined;

                // Log activity asynchronously
                setImmediate(() => {
                    logRequestActivity(req, activityType as any, description, undefined, metadata);
                });
            }

            // Call original send function
            return originalSend.call(this, data);
        };

        next();
    };
};

// Pre-defined activity trackers for common actions
export const trackUserRegistration = trackActivity(
    'user_registration',
    (req) => `New user registered: ${req.body.email}`,
    (req) => ({ email: req.body.email, registrationMethod: 'email' })
);

export const trackUserLogin = trackActivity(
    'user_login',
    (req) => `User logged in: ${req.body.email || 'unknown'}`,
    (req) => ({ email: req.body.email, loginMethod: 'email' })
);

export const trackProfileUpdate = trackActivity(
    'profile_update',
    () => 'User updated their profile',
    (req) => ({ updatedFields: Object.keys(req.body) })
);

export const trackPasswordChange = trackActivity(
    'password_change',
    () => 'User changed their password'
);

export const trackSubscriptionAction = (action: string) => trackActivity(
    'subscription_' + action,
    (req) => `Subscription ${action}: ${req.params.userId || (req as any).user?.id}`,
    (req) => ({
        targetUserId: req.params.userId,
        actionType: action,
        requestBody: req.body
    })
);

export const trackHighlightUpload = trackActivity(
    'highlight_upload',
    () => 'User uploaded a new highlight video',
    (req) => ({ fileName: req.file?.originalname })
);

export const trackAdminAction = (action: string) => trackActivity(
    'admin_action',
    (req) => `Admin performed action: ${action}`,
    (req) => ({
        action,
        targetUserId: req.params.id || req.params.userId,
        requestBody: req.body
    })
);
