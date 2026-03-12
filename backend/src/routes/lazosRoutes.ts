import { Router } from 'express';
import { generateCode, joinLazo, getLazos } from '../controllers/lazosController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/generate', authMiddleware, generateCode);
router.post('/join',     authMiddleware, joinLazo);
router.get('/',          authMiddleware, getLazos);

export default router;
