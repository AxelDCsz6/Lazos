import { Router } from 'express';
import { register, login, updateFcmToken, refresh, sendTestNotification } from '../controllers/authController';
import { validateAuth } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', validateAuth, register);

// POST /api/auth/login
router.post('/login', validateAuth, login);

// POST /api/auth/refresh
router.post('/refresh', refresh);

// PUT /api/auth/fcm-token
router.put('/fcm-token', authMiddleware, updateFcmToken);

// POST /api/auth/test-notification (debug)
router.post('/test-notification', authMiddleware, sendTestNotification);

export default router;
