import mongoose from 'mongoose';
import {
  Conversation,
  Message,
  MessageEdit,
  MessageReaction,
  MessageReceipt,
  MessageUserState,
  Room,
  RoomMember,
  ThreadUserState,
  User,
} from '../models/index.js';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  MESSAGE_REACTION,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
} from '../utils/constants.js';
import logger from '../utils/logger.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CONVERSATION_ROLE = {
  OWNER: 'owner',
  MEMBER: 'member',
};
const MESSAGE_REACTIONS = Object.values(MESSAGE_REACTION);
const MESSAGE_DELETE_PLACEHOLDER = 'This message was deleted';

const normalizeTitle = (title) => title?.trim() || null;

class ChatService {
  normalizeScopeType(scopeType) {
    return scopeType === 'room' ? 'room' : 'conversation';
  }

  async buildReplySnapshot(message) {
    if (!message) {
      return null;
    }

    return {
      message_id: message._id,
      sender_id: message.sender_id || null,
      sender_name: message.sender_name,
      content: message.content,
      type: message.type,
      timestamp: message.timestamp,
      conversation_id: message.conversation_id || null,
      room_id: message.room_id || null,
    };
  }

  async seedMessageReceipts(message, scopeType, scopeId, recipientIds = []) {
    if (!recipientIds.length) {
      return [];
    }

    const sentAt = message.timestamp || new Date();
    const receipts = recipientIds.map((userId) => ({
      message_id: message._id,
      scope_type: scopeType,
      scope_id: scopeId.toString(),
      user_id: userId,
      status: MESSAGE_STATUS.SENT,
      sent_at: sentAt,
      delivered_at: null,
      read_at: null,
    }));

    await MessageReceipt.insertMany(receipts, { ordered: false }).catch(() => []);
    return receipts;
  }

  async upsertThreadUserState(scopeType, scopeId, userId, payload) {
    await ThreadUserState.updateOne(
      {
        scope_type: scopeType,
        scope_id: scopeId.toString(),
        user_id: userId,
      },
      {
        $set: {
          ...payload,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );
  }

  async excludeHiddenMessages(messages, userId) {
    if (!messages.length) {
      return messages;
    }

    const hiddenStates = await MessageUserState.find({
      user_id: userId,
      message_id: { $in: messages.map((message) => message._id) },
      hidden_at: { $ne: null },
    }).lean();
    const hiddenIds = new Set(hiddenStates.map((state) => state.message_id.toString()));
    return messages.filter((message) => !hiddenIds.has(message._id.toString()));
  }

  async saveMessage(roomCode, senderId, senderName, data) {
    try {
      const { content, type = MESSAGE_TYPE.TEXT, senderAvatar = null } = data;
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const recipientIds = await this.getRecipientIds(room._id, senderId);
      const message = new Message({
        room_id: room._id,
        sender_id: senderId,
        sender_name: senderName,
        sender_avatar: senderAvatar,
        type,
        content,
        status: recipientIds.length > 0 ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.READ,
        delivery: recipientIds.map((userId) => ({
          user_id: userId,
          status: MESSAGE_STATUS.SENT,
        })),
        timestamp: new Date(),
      });

      await message.save();
      return { success: true, message: this.mapMessage(message) };
    } catch (error) {
      logger.error('Save message error:', error);
      throw error;
    }
  }

  async sendRoomMessage(roomCode, user, data) {
    try {
      const room = await this.getAccessibleRoom(roomCode, user._id, {
        requireChatEnabled: true,
        requireJoined: true,
      });

      const content = data.content?.trim();
      const recipientIds = await this.getRecipientIds(room._id, user._id);
      const replyMessage = data.replyToMessageId
        ? await this.getMessageByIdForUser(data.replyToMessageId, user._id, { roomId: room._id })
        : null;
      const message = new Message({
        room_id: room._id,
        sender_id: user._id,
        sender_name: user.full_name,
        sender_avatar: user.avatar || null,
        type: data.type || MESSAGE_TYPE.TEXT,
        content: content.substring(0, 5000),
        client_id: data.clientId || null,
        reply_to_message_id: replyMessage?._id || null,
        reply_snapshot: await this.buildReplySnapshot(replyMessage),
        status: recipientIds.length > 0 ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.READ,
        delivery: recipientIds.map((userId) => ({
          user_id: userId,
          status: MESSAGE_STATUS.SENT,
        })),
        timestamp: new Date(),
      });

      await message.save();
      await this.seedMessageReceipts(message, 'room', room.room_code, recipientIds);
      return { success: true, message: this.mapMessage(message, user._id) };
    } catch (error) {
      logger.error('Send room message error:', error);
      throw error;
    }
  }

  async getConversations(userId) {
    try {
      const conversations = await Conversation.find({
        member_ids: userId,
        deleted_at: null,
      })
        .sort({ updated_at: -1 })
        .populate('member_ids', '_id full_name avatar email')
        .lean();

      return {
        success: true,
        conversations: await Promise.all(
          conversations.map((conversation) => this.mapConversation(conversation, userId))
        ),
      };
    } catch (error) {
      logger.error('Get conversations error:', error);
      throw error;
    }
  }

  async searchUsersByEmail(email, requesterId) {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const users = await User.find({
        _id: { $ne: requesterId },
        email: { $regex: `^${escapeRegex(normalizedEmail)}` },
      })
        .select('_id full_name email avatar')
        .limit(10)
        .lean();

      return {
        success: true,
        users: users.map((user) => ({
          userId: user._id.toString(),
          fullName: user.full_name,
          email: user.email,
          avatar: user.avatar || null,
        })),
      };
    } catch (error) {
      logger.error('Search users by email error:', error);
      throw error;
    }
  }

  async createOrGetDirectConversation(currentUserId, payload) {
    try {
      const targetUser = await this.resolveTargetUser(payload, currentUserId);

      if (!targetUser) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      if (targetUser._id.toString() === currentUserId.toString()) {
        const error = new Error('Cannot create a conversation with yourself');
        error.statusCode = HTTP_STATUS.UNPROCESSABLE;
        throw error;
      }

      const memberIds = [currentUserId.toString(), targetUser._id.toString()].sort();
      let conversation = await Conversation.findOne({
        type: 'direct',
        member_ids: { $all: memberIds, $size: 2 },
      })
        .populate('member_ids', '_id full_name avatar email')
        .lean();

      if (!conversation) {
        const created = await Conversation.create({
          type: 'direct',
          member_ids: memberIds,
          member_roles: memberIds.map((memberId) => ({
            user_id: memberId,
            role: CONVERSATION_ROLE.MEMBER,
            nickname: null,
          })),
          created_by: currentUserId,
          updated_at: new Date(),
        });
        conversation = await Conversation.findById(created._id)
          .populate('member_ids', '_id full_name avatar email')
          .lean();
      }

      return {
        success: true,
        conversation: await this.mapConversation(conversation, currentUserId),
      };
    } catch (error) {
      logger.error('Create or get direct conversation error:', error);
      throw error;
    }
  }

  async sendConversationMessage(conversationId, user, data) {
    try {
      const conversation = await this.getAccessibleConversation(conversationId, user._id);
      const content = data.content?.trim();
      const recipientIds = conversation.member_ids
        .map((memberId) => memberId.toString())
        .filter((memberId) => memberId !== user._id.toString());
      const replyMessage = data.replyToMessageId
        ? await this.getMessageByIdForUser(data.replyToMessageId, user._id, { conversationId: conversation._id })
        : null;

      const message = new Message({
        conversation_id: conversation._id,
        sender_id: user._id,
        sender_name: user.full_name,
        sender_avatar: user.avatar || null,
        type: data.type || MESSAGE_TYPE.TEXT,
        content: content.substring(0, 5000),
        client_id: data.clientId || null,
        reply_to_message_id: replyMessage?._id || null,
        reply_snapshot: await this.buildReplySnapshot(replyMessage),
        status: recipientIds.length > 0 ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.READ,
        delivery: recipientIds.map((memberId) => ({
          user_id: memberId,
          status: MESSAGE_STATUS.SENT,
        })),
        timestamp: new Date(),
      });

      await message.save();
      await this.seedMessageReceipts(message, 'conversation', conversation._id, recipientIds);
      await Conversation.updateOne(
        { _id: conversation._id },
        {
          last_message_id: message._id,
          updated_at: new Date(),
        }
      );

      return {
        success: true,
        message: this.mapMessage(message, user._id),
      };
    } catch (error) {
      logger.error('Send conversation message error:', error);
      throw error;
    }
  }

  async addConversationMember(conversationId, currentUserId, payload) {
    try {
      const actor = await User.findById(currentUserId).select('_id full_name avatar email').lean();
      if (!actor) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const conversation = await this.getAccessibleConversation(conversationId, currentUserId);
      const targetUsers = await this.resolveTargetUsers(payload, currentUserId);
      if (targetUsers.length === 0) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const existingMemberIds = new Set(conversation.member_ids.map((memberId) => memberId.toString()));
      const duplicateUser = targetUsers.find((user) => existingMemberIds.has(user._id.toString()));
      if (duplicateUser) {
        const error = new Error('User is already in this conversation');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      if (conversation.type === 'direct') {
        const title = normalizeTitle(payload.title);
        if (!title || title.length < 3 || title.length > 100) {
          const error = new Error('Group title must be between 3 and 100 characters');
          error.statusCode = HTTP_STATUS.BAD_REQUEST;
          throw error;
        }

        const nextMemberIds = [...new Set([
          ...conversation.member_ids.map((memberId) => memberId.toString()),
          ...targetUsers.map((user) => user._id.toString()),
        ])];

        const created = await Conversation.create({
          type: 'group',
          title,
          owner_id: currentUserId,
          member_ids: nextMemberIds,
          member_roles: nextMemberIds.map((memberId) => ({
            user_id: memberId,
            role: memberId === currentUserId.toString() ? CONVERSATION_ROLE.OWNER : CONVERSATION_ROLE.MEMBER,
            nickname: null,
          })),
          created_by: currentUserId,
          updated_at: new Date(),
        });

        const groupConversation = await Conversation.findById(created._id)
          .populate('member_ids', '_id full_name avatar email');

        const otherNames = groupConversation.member_ids
          .filter((member) => member._id.toString() !== currentUserId.toString())
          .map((member) => member.full_name)
          .join(', ');

        const systemMessage = await this.createSystemMessage(
          { conversationId: created._id.toString(), userId: currentUserId },
          `${actor.full_name} created group "${title}" with ${otherNames}`
        );

        return {
          success: true,
          conversation: await this.mapConversation(groupConversation, currentUserId),
          systemMessage,
        };
      }

      this.assertConversationOwner(conversation, currentUserId);

      const nextMemberIds = [
        ...conversation.member_ids.map((memberId) => memberId.toString()),
        ...targetUsers.map((user) => user._id.toString()),
      ];
      const nextMemberRoles = [
        ...this.getConversationMemberRoles(conversation),
        ...targetUsers.map((user) => ({
          user_id: user._id,
          role: CONVERSATION_ROLE.MEMBER,
          nickname: null,
        })),
      ];

      await Conversation.updateOne(
        { _id: conversation._id },
        {
          member_ids: nextMemberIds,
          member_roles: nextMemberRoles,
          updated_at: new Date(),
        }
      );

      const updatedConversation = await Conversation.findById(conversation._id)
        .populate('member_ids', '_id full_name avatar email');

      const systemMessage = await this.createSystemMessage(
        { conversationId: conversation._id.toString(), userId: currentUserId },
        `${actor.full_name} added ${targetUsers.map((user) => user.full_name).join(', ')}`
      );

      return {
        success: true,
        conversation: await this.mapConversation(updatedConversation, currentUserId),
        systemMessage,
      };
    } catch (error) {
      logger.error('Add conversation member error:', error);
      throw error;
    }
  }

  async updateConversation(conversationId, currentUserId, payload) {
    try {
      const conversation = await this.getAccessibleConversation(conversationId, currentUserId);
      this.assertConversationOwner(conversation, currentUserId);

      const title = normalizeTitle(payload.title);
      if (!title || title.length < 3 || title.length > 100) {
        const error = new Error('Group title must be between 3 and 100 characters');
        error.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw error;
      }

      const actor = await User.findById(currentUserId).select('full_name').lean();

      await Conversation.updateOne(
        { _id: conversation._id },
        { title, updated_at: new Date() }
      );

      const updatedConversation = await Conversation.findById(conversation._id)
        .populate('member_ids', '_id full_name avatar email');

      const systemMessage = await this.createSystemMessage(
        { conversationId: conversation._id.toString(), userId: currentUserId },
        `${actor?.full_name || 'Someone'} renamed the group to "${title}"`
      );

      return {
        success: true,
        conversation: await this.mapConversation(updatedConversation, currentUserId),
        systemMessage,
      };
    } catch (error) {
      logger.error('Update conversation error:', error);
      throw error;
    }
  }

  async updateConversationMember(conversationId, currentUserId, targetUserId, payload) {
    try {
      const conversation = await this.getAccessibleConversation(conversationId, currentUserId);
      this.assertConversationOwner(conversation, currentUserId);

      const memberRoles = this.getConversationMemberRoles(conversation);
      const targetMember = memberRoles.find((member) => member.user_id.toString() === targetUserId.toString());
      if (!targetMember) {
        const error = new Error('Conversation member not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const nickname = normalizeTitle(payload.nickname);
      const nextMemberRoles = memberRoles.map((member) =>
        member.user_id.toString() === targetUserId.toString()
          ? { ...member, nickname }
          : member
      );

      await Conversation.updateOne(
        { _id: conversation._id },
        { member_roles: nextMemberRoles, updated_at: new Date() }
      );

      const actor = await User.findById(currentUserId).select('full_name').lean();
      const target = await User.findById(targetUserId).select('full_name').lean();
      const updatedConversation = await Conversation.findById(conversation._id)
        .populate('member_ids', '_id full_name avatar email');

      const systemMessage = await this.createSystemMessage(
        { conversationId: conversation._id.toString(), userId: currentUserId },
        `${actor?.full_name || 'Someone'} changed ${target?.full_name || 'a member'}'s nickname`
      );

      return {
        success: true,
        conversation: await this.mapConversation(updatedConversation, currentUserId),
        systemMessage,
      };
    } catch (error) {
      logger.error('Update conversation member error:', error);
      throw error;
    }
  }

  async removeConversationMember(conversationId, currentUserId, targetUserId) {
    try {
      const conversation = await this.getAccessibleConversation(conversationId, currentUserId);
      this.assertConversationOwner(conversation, currentUserId);

      if (targetUserId.toString() === currentUserId.toString()) {
        const error = new Error('Owner cannot remove themself from the group');
        error.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw error;
      }

      const nextMemberIds = conversation.member_ids
        .map((memberId) => memberId.toString())
        .filter((memberId) => memberId !== targetUserId.toString());
      if (nextMemberIds.length === conversation.member_ids.length) {
        const error = new Error('Conversation member not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const nextMemberRoles = this.getConversationMemberRoles(conversation)
        .filter((member) => member.user_id.toString() !== targetUserId.toString());

      await Conversation.updateOne(
        { _id: conversation._id },
        {
          member_ids: nextMemberIds,
          member_roles: nextMemberRoles,
          updated_at: new Date(),
        }
      );

      const actor = await User.findById(currentUserId).select('full_name').lean();
      const target = await User.findById(targetUserId).select('full_name').lean();
      const updatedConversation = await Conversation.findById(conversation._id)
        .populate('member_ids', '_id full_name avatar email');

      const systemMessage = await this.createSystemMessage(
        { conversationId: conversation._id.toString(), userId: currentUserId },
        `${actor?.full_name || 'Someone'} removed ${target?.full_name || 'a member'}`
      );

      return {
        success: true,
        conversation: await this.mapConversation(updatedConversation, currentUserId),
        systemMessage,
      };
    } catch (error) {
      logger.error('Remove conversation member error:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId, currentUserId) {
    try {
      const conversation = await this.getAccessibleConversation(conversationId, currentUserId);
      this.assertConversationOwner(conversation, currentUserId);

      await Conversation.updateOne(
        { _id: conversation._id },
        { deleted_at: new Date(), updated_at: new Date() }
      );

      return {
        success: true,
        conversationId: conversation._id.toString(),
      };
    } catch (error) {
      logger.error('Delete conversation error:', error);
      throw error;
    }
  }

  async getConversationMessages(conversationId, userId, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      const skip = (page - 1) * limit;
      const conversation = await this.getAccessibleConversation(conversationId, userId);

      const messages = await Message.find({ conversation_id: conversation._id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      const visibleMessages = await this.excludeHiddenMessages(messages, userId);
      const total = await Message.countDocuments({ conversation_id: conversation._id });

      return {
        success: true,
        conversation: await this.mapConversation(conversation, userId),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        messages: await Promise.all(
          visibleMessages.reverse().map((message) => this.mapMessage(message, userId))
        ),
      };
    } catch (error) {
      logger.error('Get conversation messages error:', error);
      throw error;
    }
  }

  async markConversationMessagesDelivered(conversationId, userId) {
    try {
      const conversation = await this.getAccessibleConversation(conversationId, userId);
      return this.markMessagesDeliveredByFilter(
        {
          conversation_id: conversation._id,
          sender_id: { $ne: userId },
          'delivery.user_id': userId,
        },
        userId
      );
    } catch (error) {
      logger.error('Mark conversation messages delivered error:', error);
      throw error;
    }
  }

  async markConversationMessagesRead(conversationId, userId, messageIds = []) {
    try {
      const conversation = await this.getAccessibleConversation(conversationId, userId);
      return this.markMessagesReadByFilter(
        {
          conversation_id: conversation._id,
          sender_id: { $ne: userId },
          'delivery.user_id': userId,
        },
        userId,
        messageIds
      );
    } catch (error) {
      logger.error('Mark conversation messages read error:', error);
      throw error;
    }
  }

  async getChatHistory(roomCode, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      const skip = (page - 1) * limit;
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const messages = await Message.find({ room_id: room._id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      const total = await Message.countDocuments({ room_id: room._id });

      return {
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        messages: messages.reverse().map((message) => this.mapMessage(message)),
      };
    } catch (error) {
      logger.error('Get chat history error:', error);
      throw error;
    }
  }

  async getRoomMessages(roomCode, userId, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      const skip = (page - 1) * limit;
      const room = await this.getAccessibleRoom(roomCode, userId);

      const messages = await Message.find({ room_id: room._id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      const visibleMessages = await this.excludeHiddenMessages(messages, userId);

      const total = await Message.countDocuments({ room_id: room._id });

      return {
        success: true,
        room: {
          roomCode: room.room_code,
          title: room.title,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        messages: await Promise.all(
          visibleMessages.reverse().map((message) => this.mapMessage(message, userId))
        ),
      };
    } catch (error) {
      logger.error('Get room messages error:', error);
      throw error;
    }
  }

  async markRoomMessagesDelivered(roomCode, userId) {
    try {
      const room = await this.getAccessibleRoom(roomCode, userId, { requireJoined: true });
      return this.markMessagesDeliveredByFilter(
        {
          room_id: room._id,
          sender_id: { $ne: userId },
          'delivery.user_id': userId,
        },
        userId
      );
    } catch (error) {
      logger.error('Mark room messages delivered error:', error);
      throw error;
    }
  }

  async markRoomMessagesRead(roomCode, userId, messageIds = []) {
    try {
      const room = await this.getAccessibleRoom(roomCode, userId, { requireJoined: true });
      return this.markMessagesReadByFilter(
        {
          room_id: room._id,
          sender_id: { $ne: userId },
          'delivery.user_id': userId,
        },
        userId,
        messageIds
      );
    } catch (error) {
      logger.error('Mark room messages read error:', error);
      throw error;
    }
  }

  async createSystemMessage(scope, description, metadata = {}) {
    try {
      const messageData = {
        sender_id: null,
        sender_name: 'System',
        sender_avatar: null,
        type: MESSAGE_TYPE.SYSTEM,
        content: description,
        status: MESSAGE_STATUS.READ,
        system_event: metadata.systemEvent || null,
        timestamp: new Date(),
      };

      if (scope.roomCode) {
        const room = await Room.findOne({ room_code: scope.roomCode.toUpperCase() });
        if (!room) {
          const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
          error.statusCode = HTTP_STATUS.NOT_FOUND;
          throw error;
        }
        messageData.room_id = room._id;
      } else if (scope.conversationId) {
        const conversation = await this.getAccessibleConversation(scope.conversationId, scope.userId);
        messageData.conversation_id = conversation._id;
      } else {
        const error = new Error('Message scope is required');
        error.statusCode = HTTP_STATUS.UNPROCESSABLE;
        throw error;
      }

      const message = new Message(messageData);
      await message.save();

      if (messageData.conversation_id) {
        await Conversation.updateOne(
          { _id: messageData.conversation_id },
          { last_message_id: message._id, updated_at: new Date() }
        );
      }

      return this.mapMessage(message, scope.userId || null);
    } catch (error) {
      logger.error('Create system message error:', error);
      throw error;
    }
  }

  async getMessageByIdForUser(messageId, userId, constraints = {}) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      const error = new Error('Invalid message ID');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      const error = new Error('Message not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    if (constraints.conversationId && message.conversation_id?.toString() !== constraints.conversationId.toString()) {
      const error = new Error('Message not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    if (constraints.roomId && message.room_id?.toString() !== constraints.roomId.toString()) {
      const error = new Error('Message not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    if (message.conversation_id) {
      await this.getAccessibleConversation(message.conversation_id.toString(), userId);
    } else if (message.room_id) {
      const room = await Room.findById(message.room_id).select('room_code').lean();
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }
      await this.getAccessibleRoom(room.room_code, userId);
    }

    return message;
  }

  async updateMessage(messageId, userId, payload) {
    try {
      const message = await this.getMessageByIdForUser(messageId, userId);
      if (message.type !== MESSAGE_TYPE.TEXT || !message.sender_id || message.sender_id.toString() !== userId.toString()) {
        const error = new Error('Only the sender can edit this message');
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      if (message.deleted_for_everyone_at) {
        const error = new Error('Deleted messages cannot be edited');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      if (message.version !== payload.expectedVersion) {
        const error = new Error('Message version conflict');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      const nextContent = payload.content.trim().substring(0, 5000);
      const nextVersion = message.version + 1;
      const previousContent = message.content;

      message.content = nextContent;
      message.version = nextVersion;
      message.edited_at = new Date();
      message.edited_by = userId;
      message.edit_count = (message.edit_count || 0) + 1;

      await Promise.all([
        message.save(),
        MessageEdit.create({
          message_id: message._id,
          editor_id: userId,
          from_version: nextVersion - 1,
          to_version: nextVersion,
          previous_content: previousContent,
          new_content: nextContent,
          edited_at: new Date(),
          client_mutation_id: payload.clientMutationId || null,
        }),
      ]);

      return {
        success: true,
        message: this.mapMessage(message, userId),
      };
    } catch (error) {
      logger.error('Update message error:', error);
      throw error;
    }
  }

  async deleteMessage(messageId, userId, payload = {}) {
    try {
      const message = await this.getMessageByIdForUser(messageId, userId, payload);
      if (payload.mode === 'for_me') {
        await MessageUserState.updateOne(
          { message_id: message._id, user_id: userId },
          {
            $set: {
              hidden_at: new Date(),
              hidden_reason: 'delete_for_me',
            },
          },
          { upsert: true }
        );

        return {
          success: true,
          hidden: true,
          messageId: message._id.toString(),
          hiddenAt: new Date().toISOString(),
          scope: this.getScopeFromMessage(message),
        };
      }

      let canDeleteForEveryone = message.sender_id?.toString() === userId.toString();
      if (message.room_id && !canDeleteForEveryone) {
        const room = await Room.findById(message.room_id).select('host_id room_code').lean();
        canDeleteForEveryone = room?.host_id?.toString() === userId.toString();
      }

      if (!canDeleteForEveryone) {
        const error = new Error('Unauthorized to delete this message');
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      if (message.deleted_for_everyone_at) {
        const error = new Error('Message has already been deleted');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      if (payload.expectedVersion && message.version !== payload.expectedVersion) {
        const error = new Error('Message version conflict');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      message.content = MESSAGE_DELETE_PLACEHOLDER;
      message.deleted_for_everyone_at = new Date();
      message.deleted_by = userId;
      message.delete_reason = 'deleted_by_user';
      message.version += 1;

      await message.save();

      return {
        success: true,
        message: this.mapMessage(message, userId),
        deletedMessageId: message._id.toString(),
        scope: this.getScopeFromMessage(message),
      };
    } catch (error) {
      logger.error('Delete message error:', error);
      throw error;
    }
  }

  async forwardMessage(messageId, user, payload) {
    try {
      const sourceMessage = await this.getMessageByIdForUser(messageId, user._id);
      if (sourceMessage.deleted_for_everyone_at) {
        const error = new Error('Deleted messages cannot be forwarded');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      if (payload.targetType === 'conversation') {
        const conversation = await this.getAccessibleConversation(payload.targetId, user._id);
        const recipientIds = conversation.member_ids
          .map((memberId) => memberId.toString())
          .filter((memberId) => memberId !== user._id.toString());
        const message = new Message({
          conversation_id: conversation._id,
          sender_id: user._id,
          sender_name: user.full_name,
          sender_avatar: user.avatar || null,
          type: sourceMessage.type,
          content: sourceMessage.content,
          client_id: payload.clientId,
          status: recipientIds.length > 0 ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.READ,
          delivery: recipientIds.map((memberId) => ({
            user_id: memberId,
            status: MESSAGE_STATUS.SENT,
          })),
          forwarded_from: await this.buildReplySnapshot(sourceMessage),
          timestamp: new Date(),
        });

        await message.save();
        await this.seedMessageReceipts(message, 'conversation', conversation._id, recipientIds);
        await Conversation.updateOne(
          { _id: conversation._id },
          { last_message_id: message._id, updated_at: new Date() }
        );

        return { success: true, message: this.mapMessage(message, user._id) };
      }

      const room = await this.getAccessibleRoom(payload.targetId, user._id, {
        requireChatEnabled: true,
        requireJoined: true,
      });
      const recipientIds = await this.getRecipientIds(room._id, user._id);
      const message = new Message({
        room_id: room._id,
        sender_id: user._id,
        sender_name: user.full_name,
        sender_avatar: user.avatar || null,
        type: sourceMessage.type,
        content: sourceMessage.content,
        client_id: payload.clientId,
        status: recipientIds.length > 0 ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.READ,
        delivery: recipientIds.map((memberId) => ({
          user_id: memberId,
          status: MESSAGE_STATUS.SENT,
        })),
        forwarded_from: await this.buildReplySnapshot(sourceMessage),
        timestamp: new Date(),
      });

      await message.save();
      await this.seedMessageReceipts(message, 'room', room.room_code, recipientIds);
      return { success: true, message: this.mapMessage(message, user._id) };
    } catch (error) {
      logger.error('Forward message error:', error);
      throw error;
    }
  }

  async updateReceiptState(userId, payload) {
    const scopeType = this.normalizeScopeType(payload.scopeType);
    if (scopeType === 'conversation') {
      if (payload.status === MESSAGE_STATUS.READ) {
        return this.markConversationMessagesRead(payload.scopeId, userId, payload.messageIds || []);
      }
      return this.markConversationMessagesDelivered(payload.scopeId, userId);
    }

    if (payload.status === MESSAGE_STATUS.READ) {
      return this.markRoomMessagesRead(payload.scopeId, userId, payload.messageIds || []);
    }
    return this.markRoomMessagesDelivered(payload.scopeId, userId);
  }

  async listMessageEdits(messageId, userId, options = {}) {
    const message = await this.getMessageByIdForUser(messageId, userId);
    const edits = await MessageEdit.find({ message_id: message._id })
      .sort({ edited_at: -1 })
      .limit(options.limit || 50)
      .lean();

    return {
      success: true,
      edits: edits.map((entry) => ({
        editId: entry._id.toString(),
        messageId: entry.message_id.toString(),
        editorId: entry.editor_id.toString(),
        fromVersion: entry.from_version,
        toVersion: entry.to_version,
        previousContent: entry.previous_content,
        newContent: entry.new_content,
        editedAt: entry.edited_at,
      })),
    };
  }

  async listMessageReactions(messageId, userId, options = {}) {
    const message = await this.getMessageByIdForUser(messageId, userId);
    const query = { message_id: message._id };
    if (options.emoji) {
      query.emoji = options.emoji;
    }

    const reactions = await MessageReaction.find(query)
      .populate('user_id', '_id full_name avatar email')
      .sort({ reacted_at: -1 })
      .limit(options.limit || 50)
      .lean();

    return {
      success: true,
      reactions: reactions.map((entry) => ({
        reactionId: entry._id.toString(),
        emoji: entry.emoji,
        reactedAt: entry.reacted_at,
        userId: entry.user_id?._id?.toString?.() || entry.user_id?.toString?.(),
        userName: entry.user_id?.full_name || '',
        userAvatar: entry.user_id?.avatar || null,
        userEmail: entry.user_id?.email || '',
      })),
    };
  }

  async syncReactionCounts(messageId) {
    const counts = await MessageReaction.aggregate([
      { $match: { message_id: new mongoose.Types.ObjectId(messageId) } },
      { $group: { _id: '$emoji', count: { $sum: 1 } } },
    ]);

    const reactionCounts = counts
      .filter((entry) => MESSAGE_REACTIONS.includes(entry._id))
      .map((entry) => ({ emoji: entry._id, count: entry.count }))
      .sort((left, right) => left.emoji.localeCompare(right.emoji));

    await Message.updateOne(
      { _id: messageId },
      { $set: { reaction_counts: reactionCounts } }
    );

    return reactionCounts;
  }

  async addReaction(messageId, userId, emoji, clientMutationId = null) {
    if (!MESSAGE_REACTIONS.includes(emoji)) {
      const error = new Error('Unsupported reaction');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const message = await this.getMessageByIdForUser(messageId, userId);
    if (message.deleted_for_everyone_at) {
      const error = new Error('Deleted messages cannot be reacted to');
      error.statusCode = HTTP_STATUS.CONFLICT;
      throw error;
    }

    const existing = await MessageReaction.findOne({
      message_id: message._id,
      user_id: userId,
      emoji,
    });

    if (!existing) {
      await MessageReaction.create({
        message_id: message._id,
        user_id: userId,
        emoji,
        reacted_at: new Date(),
        client_mutation_id: clientMutationId,
      });
    }

    message.reaction_counts = await this.syncReactionCounts(message._id);
    return {
      success: true,
      message: this.mapMessage({ ...message.toObject(), reaction_counts: message.reaction_counts }, userId),
      emoji,
    };
  }

  async removeReaction(messageId, userId, emoji) {
    if (!MESSAGE_REACTIONS.includes(emoji)) {
      const error = new Error('Unsupported reaction');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const message = await this.getMessageByIdForUser(messageId, userId);
    await MessageReaction.deleteOne({
      message_id: message._id,
      user_id: userId,
      emoji,
    });

    message.reaction_counts = await this.syncReactionCounts(message._id);
    return {
      success: true,
      message: this.mapMessage({ ...message.toObject(), reaction_counts: message.reaction_counts }, userId),
      emoji,
    };
  }

  async deleteRoomMessage(roomCode, messageId, userId) {
    const room = await this.getAccessibleRoom(roomCode, userId);
    return this.deleteMessage(messageId, userId, {
      mode: 'for_everyone',
      roomId: room._id,
    });
  }

  async clearRoomMessages(roomCode, hostId) {
    try {
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      if (room.host_id.toString() !== hostId.toString()) {
        const error = new Error(ERROR_MESSAGES.NOT_HOST);
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      const result = await Message.deleteMany({ room_id: room._id });
      return {
        success: true,
        message: `${result.deletedCount} messages cleared`,
      };
    } catch (error) {
      logger.error('Clear room messages error:', error);
      throw error;
    }
  }

  async getAccessibleRoom(roomCode, userId, options = {}) {
    const normalizedCode = roomCode ? roomCode.toUpperCase() : '';
    const room = await Room.findOne({ room_code: normalizedCode });
    if (!room) {
      const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    if (options.requireChatEnabled && room.settings?.allow_chat === false) {
      const error = new Error('Chat is disabled for this room');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }

    const isHost = room.host_id.toString() === userId.toString();
    const allowedStatuses = options.requireJoined ? ['joined'] : ['joined', 'left', 'pending'];
    const isMember = await RoomMember.exists({
      room_id: room._id,
      user_id: userId,
      status: { $in: allowedStatuses },
    });

    if (!isHost && !isMember) {
      const error = new Error('Unauthorized to access room chat');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }

    return room;
  }

  async getAccessibleConversation(conversationId, userId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error('Invalid conversation ID');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      member_ids: userId,
      deleted_at: null,
    });

    if (!conversation) {
      const error = new Error('Conversation not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    return conversation;
  }

  async resolveTargetUser(payload, requesterId) {
    let targetUser = null;
    if (payload.userId && mongoose.Types.ObjectId.isValid(payload.userId)) {
      targetUser = await User.findById(payload.userId).select('_id full_name email avatar').lean();
    } else if (payload.email) {
      targetUser = await User.findOne({ email: payload.email.trim().toLowerCase() })
        .select('_id full_name email avatar')
        .lean();
    }

    if (targetUser?._id?.toString() === requesterId.toString()) {
      const error = new Error('Cannot create a conversation with yourself');
      error.statusCode = HTTP_STATUS.UNPROCESSABLE;
      throw error;
    }

    return targetUser;
  }

  async resolveTargetUsers(payload, requesterId) {
    if (Array.isArray(payload.userIds) && payload.userIds.length > 0) {
      const uniqueIds = [...new Set(payload.userIds.filter((value) => mongoose.Types.ObjectId.isValid(value)).map((value) => value.toString()))];
      if (uniqueIds.some((id) => id === requesterId.toString())) {
        const error = new Error('Cannot create a conversation with yourself');
        error.statusCode = HTTP_STATUS.UNPROCESSABLE;
        throw error;
      }

      const users = await User.find({ _id: { $in: uniqueIds } })
        .select('_id full_name email avatar')
        .lean();

      if (users.length !== uniqueIds.length) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      return uniqueIds
        .map((id) => users.find((user) => user._id.toString() === id))
        .filter(Boolean);
    }

    const user = await this.resolveTargetUser(payload, requesterId);
    return user ? [user] : [];
  }

  getConversationMemberRoles(conversation) {
    if (conversation.member_roles?.length) {
      return conversation.member_roles.map((member) => ({
        user_id: member.user_id,
        role: member.role || CONVERSATION_ROLE.MEMBER,
        nickname: member.nickname || null,
      }));
    }

    return (conversation.member_ids || []).map((memberId) => ({
      user_id: memberId,
      role:
        conversation.owner_id && conversation.owner_id.toString() === memberId.toString()
          ? CONVERSATION_ROLE.OWNER
          : CONVERSATION_ROLE.MEMBER,
      nickname: null,
    }));
  }

  getConversationRole(conversation, userId) {
    if (conversation.type !== 'group') {
      return CONVERSATION_ROLE.MEMBER;
    }

    const entry = this.getConversationMemberRoles(conversation)
      .find((member) => member.user_id.toString() === userId.toString());
    return entry?.role || CONVERSATION_ROLE.MEMBER;
  }

  assertConversationOwner(conversation, userId) {
    if (conversation.type !== 'group' || this.getConversationRole(conversation, userId) !== CONVERSATION_ROLE.OWNER) {
      const error = new Error('Only the group owner can perform this action');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }
  }

  async getRecipientIds(roomId, senderId) {
    const joinedMembers = await RoomMember.find({
      room_id: roomId,
      status: 'joined',
      user_id: { $ne: senderId },
    }).distinct('user_id');

    const room = await Room.findById(roomId).select('host_id').lean();
    const recipientIds = joinedMembers.map((id) => id.toString());
    if (room?.host_id?.toString() !== senderId.toString()) {
      recipientIds.push(room.host_id.toString());
    }

    return [...new Set(recipientIds)];
  }

  getScopeFromMessage(message) {
    if (message.conversation_id) {
      return {
        scopeType: 'conversation',
        scopeId: message.conversation_id.toString(),
      };
    }

    return {
      scopeType: 'room',
      scopeId: message.room_id?.toString?.() || null,
    };
  }

  async markMessagesDeliveredByFilter(query, userId) {
    const messages = await Message.find(query);
    const updatedIds = [];

    for (const message of messages) {
      let changed = false;
      message.delivery = message.delivery.map((entry) => {
        if (entry.user_id?.toString() !== userId.toString()) {
          return entry;
        }
        if (entry.status === MESSAGE_STATUS.SENT) {
          changed = true;
          return {
            ...entry.toObject(),
            status: MESSAGE_STATUS.DELIVERED,
            delivered_at: entry.delivered_at || new Date(),
          };
        }
        return entry;
      });

      if (changed) {
        message.status = this.computeAggregateStatus(message.delivery);
        await message.save();
        const { scopeType, scopeId } = this.getScopeFromMessage(message);
        await MessageReceipt.updateOne(
          { message_id: message._id, user_id: userId },
          {
            $set: {
              scope_type: scopeType,
              scope_id: scopeId,
              status: MESSAGE_STATUS.DELIVERED,
              delivered_at: new Date(),
            },
            $setOnInsert: {
              sent_at: message.timestamp || new Date(),
            },
          },
          { upsert: true }
        );
        await this.upsertThreadUserState(scopeType, scopeId, userId, {
          last_delivered_message_id: message._id,
          last_delivered_at: new Date(),
        });
        updatedIds.push(message._id.toString());
      }
    }

    return { success: true, updatedMessageIds: updatedIds };
  }

  async markMessagesReadByFilter(baseQuery, userId, messageIds = []) {
    const query = { ...baseQuery };
    if (messageIds.length > 0) {
      query._id = {
        $in: messageIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const messages = await Message.find(query);
    const updates = [];

    for (const message of messages) {
      let changed = false;
      message.delivery = message.delivery.map((entry) => {
        if (entry.user_id?.toString() !== userId.toString()) {
          return entry;
        }
        if (entry.status !== MESSAGE_STATUS.READ) {
          changed = true;
          return {
            ...entry.toObject(),
            status: MESSAGE_STATUS.READ,
            delivered_at: entry.delivered_at || new Date(),
            read_at: new Date(),
          };
        }
        return entry;
      });

      if (changed) {
        message.status = this.computeAggregateStatus(message.delivery);
        await message.save();
        const { scopeType, scopeId } = this.getScopeFromMessage(message);
        await MessageReceipt.updateOne(
          { message_id: message._id, user_id: userId },
          {
            $set: {
              scope_type: scopeType,
              scope_id: scopeId,
              status: MESSAGE_STATUS.READ,
              delivered_at: new Date(),
              read_at: new Date(),
            },
            $setOnInsert: {
              sent_at: message.timestamp || new Date(),
            },
          },
          { upsert: true }
        );
        await this.upsertThreadUserState(scopeType, scopeId, userId, {
          last_delivered_message_id: message._id,
          last_delivered_at: new Date(),
          last_read_message_id: message._id,
          last_read_at: new Date(),
        });
        updates.push(await this.mapMessage(message, userId));
      }
    }

    return { success: true, messages: updates };
  }

  computeAggregateStatus(deliveryEntries = []) {
    if (deliveryEntries.length === 0) {
      return MESSAGE_STATUS.READ;
    }
    if (deliveryEntries.every((entry) => entry.status === MESSAGE_STATUS.READ)) {
      return MESSAGE_STATUS.READ;
    }
    if (deliveryEntries.every((entry) => entry.status === MESSAGE_STATUS.READ || entry.status === MESSAGE_STATUS.DELIVERED)) {
      return MESSAGE_STATUS.DELIVERED;
    }
    return MESSAGE_STATUS.SENT;
  }

  async countUnreadMessages(roomId, userId) {
    return Message.countDocuments({
      room_id: roomId,
      sender_id: { $ne: userId },
      delivery: {
        $elemMatch: {
          user_id: userId,
          status: { $ne: MESSAGE_STATUS.READ },
        },
      },
    });
  }

  async countUnreadConversationMessages(conversationId, userId) {
    return Message.countDocuments({
      conversation_id: conversationId,
      sender_id: { $ne: userId },
      delivery: {
        $elemMatch: {
          user_id: userId,
          status: { $ne: MESSAGE_STATUS.READ },
        },
      },
    });
  }

  async mapConversation(conversation, viewerId) {
    const raw = typeof conversation.toJSON === 'function' ? conversation.toJSON() : conversation;
    const memberRoles = this.getConversationMemberRoles(raw);
    const roleByUserId = new Map(
      memberRoles.map((member) => [member.user_id.toString(), member])
    );
    const members = (raw.member_ids || []).map((member) => ({
      id: member._id?.toString?.() || member.toString(),
      fullName: member.full_name,
      avatar: member.avatar || null,
      email: member.email || '',
      role: roleByUserId.get(member._id?.toString?.() || member.toString())?.role || CONVERSATION_ROLE.MEMBER,
      nickname: roleByUserId.get(member._id?.toString?.() || member.toString())?.nickname || null,
    }));
    const participants = members.filter((member) => member.id !== viewerId.toString());
    const latestCandidates = raw.last_message_id
      ? [await Message.findById(raw.last_message_id).lean()]
      : await Message.find({ conversation_id: raw._id }).sort({ timestamp: -1 }).limit(20).lean();
    const latestVisible = (await this.excludeHiddenMessages(latestCandidates.filter(Boolean), viewerId))[0] || null;
    const latestMessage = latestVisible ? this.mapMessage(latestVisible, viewerId) : null;
    const displayParticipants = participants.map((member) => member.nickname || member.fullName);
    const ownerId = raw.owner_id?.toString?.() || null;
    const currentUserRole = this.getConversationRole(raw, viewerId);

    return {
      conversationId: raw._id.toString(),
      type: raw.type || 'direct',
      ownerId,
      currentUserRole,
      title:
        raw.type === 'group'
          ? raw.title || displayParticipants.join(', ') || 'Group conversation'
          : displayParticipants[0] || raw.title || 'Direct message',
      description: participants[0]?.email || '',
      latestMessage,
      participants,
      participantCount: members.length,
      host:
        members.find((member) => member.id === ownerId) ||
        participants[0] ||
        members[0] ||
        null,
      unreadCount: await this.countUnreadConversationMessages(raw._id, viewerId),
    };
  }

  mapMessage(message, viewerId = null) {
    const raw = typeof message.toJSON === 'function' ? message.toJSON() : message;
    const delivery = (raw.delivery || []).map((entry) => ({
      userId: entry.user_id?.toString?.() || entry.user_id?.toString?.(),
      status: entry.status,
      deliveredAt: entry.delivered_at || null,
      readAt: entry.read_at || null,
    }));
    const ownReceipt = viewerId ? delivery.find((entry) => entry.userId === viewerId.toString()) : null;

    return {
      ...raw,
      messageId: raw._id?.toString(),
      conversationId: raw.conversation_id?.toString?.() || null,
      senderId: raw.sender_id?.toString(),
      senderName: raw.sender_name,
      senderAvatar: raw.sender_avatar,
      clientId: raw.client_id || null,
      version: raw.version || 1,
      status: raw.status || MESSAGE_STATUS.SENT,
      delivery,
      ownReceipt,
      editedAt: raw.edited_at || null,
      editedBy: raw.edited_by?.toString?.() || null,
      editCount: raw.edit_count || 0,
      isEdited: Boolean(raw.edited_at),
      deletedForEveryoneAt: raw.deleted_for_everyone_at || null,
      deletedBy: raw.deleted_by?.toString?.() || null,
      deleteReason: raw.delete_reason || null,
      replyTo: raw.reply_snapshot
        ? {
            messageId: raw.reply_snapshot.message_id?.toString?.() || null,
            senderId: raw.reply_snapshot.sender_id?.toString?.() || null,
            senderName: raw.reply_snapshot.sender_name || 'Unknown',
            content: raw.reply_snapshot.content || '',
            type: raw.reply_snapshot.type || MESSAGE_TYPE.TEXT,
            timestamp: raw.reply_snapshot.timestamp || null,
          }
        : null,
      forwardedFrom: raw.forwarded_from
        ? {
            messageId: raw.forwarded_from.message_id?.toString?.() || null,
            conversationId: raw.forwarded_from.conversation_id?.toString?.() || null,
            roomId: raw.forwarded_from.room_id?.toString?.() || null,
            senderId: raw.forwarded_from.sender_id?.toString?.() || null,
            senderName: raw.forwarded_from.sender_name || 'Unknown',
            timestamp: raw.forwarded_from.timestamp || null,
          }
        : null,
      reactionCounts: (raw.reaction_counts || []).map((entry) => ({
        emoji: entry.emoji,
        count: entry.count,
      })),
      systemEvent: raw.system_event
        ? {
            ...raw.system_event,
            callId: raw.system_event.call_id?.toString?.() || null,
            callerId: raw.system_event.caller_id?.toString?.() || null,
            receiverIds: (raw.system_event.receiver_ids || []).map((id) => id.toString()),
          }
        : null,
    };
  }
}

export default new ChatService();
