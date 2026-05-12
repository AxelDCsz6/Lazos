import { Router } from 'express';
import { generateCode, joinLazo, getLazos, waterLazo, deleteLazo } from '../controllers/lazosController';
import { getMessages, sendMessage, sendMediaMessage } from '../controllers/messagesController';
import { toggleReaction } from '../controllers/reactionsController';
import { authMiddleware } from '../middleware/auth';
import { uploadMessageMedia } from '../middleware/upload';

const router = Router();

router.post('/generate',                              authMiddleware, generateCode);
router.post('/join',                                  authMiddleware, joinLazo);
router.get('/',                                       authMiddleware, getLazos);
router.get('/:id/messages',                           authMiddleware, getMessages);
router.post('/:id/messages',                          authMiddleware, sendMessage);
router.post('/:id/messages/media',                    authMiddleware, uploadMessageMedia, sendMediaMessage);
router.post('/:id/regar',                             authMiddleware, waterLazo);
router.delete('/:id',                                 authMiddleware, deleteLazo);
router.post('/:id/messages/:messageId/react',         authMiddleware, toggleReaction);

export default router;
