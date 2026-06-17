import express from 'express';
import roomController from '../../controllers/room.controller.js';
import { validate } from '../../utils/validators.js';
import { roomValidation } from '../../utils/validators.js';
import { authenticate } from '../../middlewares/auth.js';

const router = express.Router();

// Apply authentication to all room routes
router.use(authenticate);

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create new room
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               require_approval:
 *                 type: boolean
 *                 default: false
 *               allow_chat:
 *                 type: boolean
 *                 default: true
 *               max_participants:
 *                 type: number
 *                 default: 100
 *     responses:
 *       201:
 *         description: Room created successfully
 */
router.post('/', validate(roomValidation.create), roomController.createRoom.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}:
 *   get:
 *     summary: Get room information
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room information retrieved
 */
router.get('/:roomCode', roomController.getRoomInfo.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/join:
 *   post:
 *     summary: Join room
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Join request sent
 */
router.post('/:roomCode/join', roomController.joinRoom.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/approve/{userId}:
 *   post:
 *     summary: Approve user to join (host only)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User approved
 */
router.post('/:roomCode/approve/:userId', roomController.approveUser.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/reject/{userId}:
 *   post:
 *     summary: Reject user (host only)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User rejected
 */
router.post('/:roomCode/reject/:userId', roomController.rejectUser.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/kick/{userId}:
 *   post:
 *     summary: Kick user from room (host only)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User kicked
 */
router.post('/:roomCode/kick/:userId', roomController.kickUser.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/end:
 *   put:
 *     summary: End room (host only)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room ended
 */
router.put('/:roomCode/end', roomController.endRoom.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/participants:
 *   get:
 *     summary: Get room participants
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Participants list
 */
router.get('/:roomCode/participants', roomController.getRoomParticipants.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/promote/{userId}:
 *   post:
 *     summary: Promote user to co-host (host only)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User promoted to co-host
 */
router.post('/:roomCode/promote/:userId', roomController.promoteUser.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/demote/{userId}:
 *   post:
 *     summary: Demote co-host to participant (host only)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User demoted from co-host
 */
router.post('/:roomCode/demote/:userId', roomController.demoteUser.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/disable-chat:
 *   post:
 *     summary: Disable chat (host or co-host)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat disabled
 */
router.post('/:roomCode/disable-chat', roomController.disableChat.bind(roomController));

/**
 * @swagger
 * /rooms/{roomCode}/enable-chat:
 *   post:
 *     summary: Enable chat (host or co-host)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat enabled
 */
router.post('/:roomCode/enable-chat', roomController.enableChat.bind(roomController));

export default router;
