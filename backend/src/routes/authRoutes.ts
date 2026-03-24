import { Router } from 'express';
import { register, login, updateFcmToken } from '../controllers/authController';
import { validateAuth } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', validateAuth, register);

// POST /api/auth/login
router.post('/login', validateAuth, login);

// PUT /api/auth/fcm-token
router.put('/fcm-token', authMiddleware, updateFcmToken);

export default router;
