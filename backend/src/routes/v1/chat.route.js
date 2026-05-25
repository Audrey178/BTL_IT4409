import express from 'express';
import chatController from '../../controllers/chat.controller.js';
import { authenticate } from '../../middlewares/auth.js';
import { messageValidation, paginationValidation, validate, validateQuery } from '../../utils/validators.js';

const router = express.Router();

router.use(authenticate);

router.get(
  '/rooms/:roomCode/messages',
  validateQuery(paginationValidation.chatHistory),
  chatController.getRoomMessages.bind(chatController)
);

router.post(
  '/rooms/:roomCode/messages',
  validate(messageValidation.send),
  chatController.sendRoomMessage.bind(chatController)
);

router.delete(
  '/rooms/:roomCode/messages/:messageId',
  chatController.deleteRoomMessage.bind(chatController)
);

export default router;
