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

const removeUserFromRoom = async (roomCode, userId) => {
    try {
        // Lệnh sRem (Set Remove) sẽ tìm và xóa user khỏi tập hợp
        await redisClient.sRem(`room:${roomCode}:members`, userId);
        console.log(`🚪 Đã xóa User [${userId}] khỏi phòng [${roomCode}] trong Redis`);
    } catch (error) {
        console.error('❌ Lỗi xóa user khỏi phòng Redis:', error);
    }
};

const deleteRoomData = async (roomCode) => {
    try {
        await redisClient.del(`room:${roomCode}:members`);
        console.log(`🧹 Đã dọn dẹp sạch dữ liệu phòng [${roomCode}] trong Redis`);
    } catch (error) {
        console.error('❌ Lỗi dọn dẹp phòng Redis:', error);
    }
};

const updateMediaState = async (socketId, audio, video) => {
    try {
        // 1. Lấy dữ liệu hiện tại của Socket này ra
        const stateData = await redisClient.get(`socket:${socketId}`);
        if (stateData) {
            const state = JSON.parse(stateData);
            
            // 2. Cập nhật thêm thông tin Audio/Video
            state.audio = audio;
            state.video = video;
            
            // 3. Lưu ngược trở lại vào Redis
            await redisClient.set(`socket:${socketId}`, JSON.stringify(state), { EX: 86400 });
            console.log(`🎛️ Cập nhật thiết bị Socket [${socketId}]: Audio=${audio}, Video=${video}`);
        }
    } catch (error) {
        console.error('❌ Lỗi cập nhật trạng thái thiết bị trong Redis:', error);
    }
};

module.exports = { 
    saveSocketState, 
    removeSocketState, 
    addUserToRoom, 
    updateSocketRoom,
    removeUserFromRoom,
    deleteRoomData,
    updateMediaState
};