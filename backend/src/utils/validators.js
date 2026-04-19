import Joi from 'joi';
import logger from './logger.js';

/**
 * ============================================================================
 * VALIDATORS - Request Validation Schemas using Joi
 * ============================================================================
 * 
 * Kỹ năng: Định nghĩa các schema Joi để validate request từ client.
 * Mục đích: Đảm bảo dữ liệu đầu vào hợp lệ trước khi xử lý business logic.
 * 
 * Tác giả: Meeting Team
 */

// ============================================================================
// AUTH VALIDATORS
// ============================================================================

export const authValidation = {
  register: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({ 'string.email': 'Email must be valid' }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({ 'string.min': 'Password must be at least 6 characters' }),
    full_name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({ 
        'string.min': 'Full name must be at least 2 characters',
        'string.max': 'Full name cannot exceed 100 characters'
      }),
  }),

  login: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required(),
    password: Joi.string().required(),
  }),

  refreshToken: Joi.object({
    refresh_token: Joi.string().required(),
  }),
};

// ============================================================================
// ROOM VALIDATORS
// ============================================================================

export const roomValidation = {
  create: Joi.object({
    title: Joi.string()
      .min(3)
      .max(255)
      .trim()
      .required()
      .messages({ 
        'string.min': 'Room title must be at least 3 characters',
        'string.max': 'Room title cannot exceed 255 characters'
      }),
    description: Joi.string()
      .max(1000)
      .trim()
      .optional()
      .messages({ 'string.max': 'Description cannot exceed 1000 characters' }),
    settings: Joi.object({
      require_approval: Joi.boolean().optional(),
      allow_chat: Joi.boolean().optional(),
      max_participants: Joi.number()
        .min(2)
        .max(500)
        .optional()
        .default(100),
    }).optional(),
  }),

  update: Joi.object({
    title: Joi.string().min(3).max(255).trim().optional(),
    description: Joi.string().max(1000).trim().optional(),
    settings: Joi.object({
      require_approval: Joi.boolean().optional(),
      allow_chat: Joi.boolean().optional(),
      max_participants: Joi.number().min(2).max(500).optional(),
    }).optional(),
  }),

  join: Joi.object({
    room_code: Joi.string()
      .required()
      .messages({ 'any.required': 'Room code is required' }),
  }),
};

// ============================================================================
// ATTENDANCE VALIDATORS
// ============================================================================

export const attendanceValidation = {
  faceEmbeddings: Joi.object({
    descriptor: Joi.array()
      .items(Joi.number())
      .min(128)
      .max(512)
      .required()
      .messages({ 
        'array.min': 'Descriptor must have at least 128 dimensions',
        'array.max': 'Descriptor cannot exceed 512 dimensions'
      }),
  }),

  checkIn: Joi.object({
    confidence_score: Joi.number()
      .min(0)
      .max(1)
      .optional(),
    method: Joi.string()
      .valid('face_recognition', 'manual')
      .optional()
      .default('manual'),
  }),
};

// ============================================================================
// MESSAGE VALIDATORS
// ============================================================================

export const messageValidation = {
  send: Joi.object({
    content: Joi.string()
      .min(1)
      .max(5000)
      .trim()
      .required()
      .messages({
        'string.empty': 'Message cannot be empty',
        'string.max': 'Message cannot exceed 5000 characters'
      }),
    type: Joi.string()
      .valid('text', 'system', 'file')
      .default('text')
      .optional(),
  }),

  getMessages: Joi.object({
    page: Joi.number().min(1).default(1).optional(),
    limit: Joi.number().min(1).max(100).default(50).optional(),
  }),
};

// ============================================================================
// PAGINATION VALIDATORS
// ============================================================================

export const paginationValidation = {
  listRooms: Joi.object({
    page: Joi.number().min(1).default(1).optional(),
    limit: Joi.number().min(1).max(100).default(20).optional(),
    status: Joi.string()
      .valid('waiting', 'active', 'ended')
      .optional(),
  }),

  listEvents: Joi.object({
    page: Joi.number().min(1).default(1).optional(),
    limit: Joi.number().min(1).max(100).default(50).optional(),
  }),
};

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Middleware factory to validate request body
 * @param {Object} schema - Joi schema
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));
        logger.warn(`Validation failed: ${JSON.stringify(details)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: details,
        });
      }

      req.validated = value;
      next();
    } catch (err) {
      logger.error('Validation middleware error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal validation error',
      });
    }
  };
};

/**
 * Middleware to validate request query params
 * @param {Object} schema - Joi schema
 * @returns {Function} Express middleware
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.query, {
        stripUnknown: true,
      });

      if (error) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));
        return res.status(400).json({
          success: false,
          message: 'Query validation failed',
          errors: details,
        });
      }

      req.query = value;
      next();
    } catch (err) {
      logger.error('Query validation error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal validation error',
      });
    }
  };
};

export default {
  validate,
  validateQuery,
  authValidation,
  roomValidation,
  attendanceValidation,
  messageValidation,
  paginationValidation,
};
