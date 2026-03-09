import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { validateAuth } from '../middleware/validate';

const router = Router();

// POST /api/auth/register
router.post('/register', validateAuth, register);

// POST /api/auth/login
router.post('/login', validateAuth, login);

export default router;
