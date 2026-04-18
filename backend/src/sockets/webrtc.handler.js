module.exports = (io, socket) => {
    
    // 1. Nhận lời mời kết nối (Offer) từ người A và chuyển cho những người khác trong phòng
    socket.on('webrtc:offer', (payload) => {
        const { roomCode, offer } = payload;
        
        // Cầm "thư" ném cho cả phòng
        socket.to(roomCode).emit('webrtc:offer', {
            senderId: socket.userId, // Báo cho họ biết ai gửi
            offer: offer
        });
        
        console.log(`📡 User [${socket.userId}] gửi Offer tới phòng [${roomCode}]`);
    });

    // 2. Nhận lời phản hồi (Answer) từ người B và chuyển lại
    socket.on('webrtc:answer', (payload) => {
        const { roomCode, answer } = payload;
        
        socket.to(roomCode).emit('webrtc:answer', {
            senderId: socket.userId,
            answer: answer
        });
        
        console.log(`📩 User [${socket.userId}] gửi Answer tới phòng [${roomCode}]`);
    });

    // 3. Trao đổi đường đi mạng (ICE Candidate) để 2 máy tính tìm thấy nhau trên internet
    socket.on('webrtc:ice_candidate', (payload) => {
        const { roomCode, candidate } = payload;
        
        socket.to(roomCode).emit('webrtc:ice_candidate', {
            senderId: socket.userId,
            candidate: candidate
        });
    });

};