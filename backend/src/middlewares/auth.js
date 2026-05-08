import { HTTP_STATUS, ERROR_MESSAGES } from '../utils/constants.js';
import { verifyAccessToken } from '../utils/jwt.js';
import logger from '../utils/logger.js';
import { User } from '../models/index.js';

// JWT Authentication Middleware
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED,
      });
    }

    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.TOKEN_INVALID,
      });
    }

    // Fetch user from database to ensure it still exists
    const user = await User.findById(decoded.userId).select('-password_hash');
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    req.user = user;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED,
    });
  }
};

// Optional authentication (for routes that work with or without auth)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = verifyAccessToken(token);
      if (decoded) {
        const user = await User.findById(decoded.userId).select('-password_hash');
        if (user) {
          req.user = user;
          req.userId = decoded.userId;
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth error:', error);
    next();
  }
};

export default { authenticate, optionalAuth };
