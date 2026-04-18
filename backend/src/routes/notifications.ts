import { Router } from 'express';
import type { Request, Response } from 'express';

export function createAPIRoutes(notificationsArray: any[], accessRequestsArray: any[]): Router {
    const router = Router();

    // Log all requests to this router
    router.use((req: Request, res: Response, next: any) => {
        console.log(`  📍 Router received: ${req.method} ${req.path}`);
        next();
    });

    // TEST: Simple test route via router
    router.get('/test-via-router', (req: Request, res: Response) => {
        console.log('  ✓ /test-via-router handler called');
        res.json({ test: 'via-router', works: true });
    });

    // Get notifications for a user
    router.get('/notifications/:userId', (req: Request, res: Response) => {
        console.log(`  ✓ /notifications/:userId handler called with userId=${req.params['userId']}`);
        const notifs = notificationsArray.filter(n => n.userId === req.params['userId']);
        res.json({ notifications: notifs });
    });

    // Mark notification as read
    router.put('/notifications/:notificationId/read', (req: Request, res: Response) => {
        console.log(`  ✓ /notifications/:notificationId/read handler called`);
        const notif = notificationsArray.find(n => n.notificationId === req.params['notificationId']);
        if (!notif) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        notif.status = 'READ';
        res.json(notif);
    });

    return router;
}
