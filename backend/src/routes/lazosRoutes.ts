import { Router } from 'express';
import { generateCode, joinLazo, getLazos, waterLazo } from '../controllers/lazosController';
import { getMessages, sendMessage } from '../controllers/messagesController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/generate',          authMiddleware, generateCode);
router.post('/join',              authMiddleware, joinLazo);
router.get('/',                   authMiddleware, getLazos);
router.get('/:id/messages',       authMiddleware, getMessages);
router.post('/:id/messages',      authMiddleware, sendMessage);
router.post('/:id/regar',         authMiddleware, waterLazo);

export default router;
