const { redisClient } = require('../config/redis');

// Lưu trạng thái khi user kết nối
const saveSocketState = async (socketId, userId, roomCode = null) => {
    try {
        // Cấu trúc: Key là socket:12345, Value là chuỗi JSON {"userId":"...","roomCode":null}
        const stateData = JSON.stringify({ userId, roomCode });
        
        // Lưu vào Redis và tự động xóa sau 24h (86400 giây) để chống rác bộ nhớ
        await redisClient.set(`socket:${socketId}`, stateData, { EX: 86400 });
        console.log(`💾 Đã lưu State vào Redis: Socket [${socketId}] -> User [${userId}]`);
    } catch (error) {
        console.error('❌ Lỗi khi lưu Redis State:', error);
    }
};

// Xóa trạng thái khi user mất kết nối
const removeSocketState = async (socketId) => {
    try {
        await redisClient.del(`socket:${socketId}`);
        console.log(`🗑️ Đã xóa State trong Redis của Socket [${socketId}]`);
    } catch (error) {
        console.error('❌ Lỗi khi xóa Redis State:', error);
    }
};

// Lưu người dùng vào danh sách phòng
const addUserToRoom = async (roomCode, userId) => {
    try {
        // Dùng cấu trúc Set của Redis (sAdd) để lưu danh sách, tự động loại bỏ trùng lặp
        await redisClient.sAdd(`room:${roomCode}:members`, userId);
        console.log(`👥 Đã thêm User [${userId}] vào phòng [${roomCode}] trong Redis`);
    } catch (error) {
        console.error('❌ Lỗi thêm user vào phòng Redis:', error);
    }
};

// Cập nhật lại trạng thái Socket (để biết socket này đang ở phòng nào)
const updateSocketRoom = async (socketId, userId, roomCode) => {
    try {
        const stateData = JSON.stringify({ userId, roomCode });
        await redisClient.set(`socket:${socketId}`, stateData, { EX: 86400 });
    } catch (error) {
        console.error('❌ Lỗi cập nhật phòng cho Socket:', error);
    }
};

module.exports = { 
    saveSocketState, 
    removeSocketState, 
    addUserToRoom, 
    updateSocketRoom 
};