import { v4 as uuidv4 } from 'uuid';

export const generateRoomCode = () => {
  // Format: abc-xyz-def
  const uuid = uuidv4().split('-')[0];
  const part1 = Math.random().toString(36).substring(2, 5);
  const part2 = Math.random().toString(36).substring(2, 5);
  const part3 = Math.random().toString(36).substring(2, 5);
  return `${part1}-${part2}-${part3}`;
};

export const generateSocketEventName = (namespace, action) => {
  return `${namespace}:${action}`;
};

export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  return Math.floor((endTime - startTime) / 1000); // in seconds
};

export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
};

export default {
  generateRoomCode,
  generateSocketEventName,
  calculateDuration,
  formatDuration,
};
