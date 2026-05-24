const Room = require('../models/room.model');
const Message = require('../models/message.model');
const Attendance = require('../models/attendance.model');

const { deleteRoomData } = require('../services/redis.service'); 
const { sendEmail } = require('../config/email.config');

// Hàm tạo chuỗi ngẫu nhiên (VD: abc-def-ghi)
const generateRoomCode = () => {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}-${s4()}-${s4()}`;
};

const createRoom = async (req, res) => {
    try {
        // Lấy ID của người tạo từ cái thẻ tên mà Middleware vừa gắn vào lúc nãy
        const hostId = req.user.id;
        const { require_approval, allow_chat } = req.body;

        const newRoom = new Room({
            room_code: generateRoomCode(),
            host_id: hostId,
            settings: {
                require_approval: require_approval || false,
                allow_chat: allow_chat !== undefined ? allow_chat : true
            }
        });

        await newRoom.save();

        res.status(201).json({
            message: 'Tạo phòng thành công!',
            room_code: newRoom.room_code,
            room: newRoom
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi tạo phòng', error: error.message });
    }
};

// ==========================================
// API: KẾT THÚC PHÒNG HỌP
// ==========================================
const endRoom = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const userId = req.user.id; // Lấy từ verifyToken

        // 1. Kiểm tra phòng và quyền Chủ phòng
        const room = await Room.findOne({ room_code: roomCode });
        if (!room) {
            return res.status(404).json({ message: 'Không tìm thấy phòng!' });
        }
        if (room.host_id.toString() !== userId) {
            return res.status(403).json({ message: 'Chỉ chủ phòng mới có quyền kết thúc cuộc họp!' });
        }
        if (room.status === 'ended') {
            return res.status(400).json({ message: 'Phòng này đã kết thúc từ trước rồi.' });
        }

        // 2. Đổi trạng thái trong MongoDB
        room.status = 'ended';
        await room.save();

        // 3. Dọn rác trong Redis
        await deleteRoomData(roomCode);

        // 4. Lấy cái 'io' mà ta đã bơm vào app ở Thao tác 1
        const io = req.app.get('io');

        // Báo tử cho cả phòng biết
        io.to(roomCode).emit('room:ended', { 
            message: 'Cuộc họp đã bị kết thúc bởi chủ phòng.' 
        });

        // Tuyệt chiêu cuối: Rút phích cắm tất cả mọi người đang ở trong phòng này
        io.in(roomCode).disconnectSockets();

        res.status(200).json({ message: 'Đã kết thúc cuộc họp và giải tán tất cả thành viên!' });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi kết thúc phòng', error: error.message });
    }
};

// ==========================================
// API: LẤY LỊCH SỬ TIN NHẮN CỦA PHÒNG
// ==========================================
const getChatHistory = async (req, res) => {
    try {
        const { roomCode } = req.params;

        // Tìm tất cả tin nhắn thuộc về roomCode này
        // .sort({ createdAt: 1 }) nghĩa là sắp xếp theo thời gian: Cũ nhất xếp trước, mới nhất xếp sau
        const messages = await Message.find({ room_code: roomCode })
            .sort({ createdAt: 1 });

        res.status(200).json({
            message: 'Lấy lịch sử tin nhắn thành công!',
            total_messages: messages.length,
            data: messages
        });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy lịch sử chat', error: error.message });
    }
};

// ==========================================
// API: XUẤT BÁO CÁO ĐIỂM DANH
// ==========================================
const getAttendanceReport = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const userId = req.user.id;

        // BẢO MẬT: Phải kiểm tra xem người gọi API có đúng là Chủ phòng không?
        const room = await Room.findOne({ room_code: roomCode });
        if (!room) return res.status(404).json({ message: 'Phòng không tồn tại!' });
        
        if (room.host_id.toString() !== userId) {
            return res.status(403).json({ message: 'Chỉ Chủ phòng mới được xem báo cáo điểm danh!' });
        }

        // Lấy danh sách điểm danh và NỐI BẢNG (populate) để lấy thêm tên, email của người đó
        const report = await Attendance.find({ room_code: roomCode })
            .populate('user_id', 'full_name email student_id') // Chọn các trường muốn hiển thị
            .sort({ check_in_time: 1 }); // Xếp theo thứ tự ai điểm danh trước lên trước

        res.status(200).json({
            message: 'Truy xuất báo cáo thành công',
            total_attended: report.length,
            data: report
        });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy báo cáo điểm danh', error: error.message });
    }
};

const scheduleRoom = async (req, res) => {
    try {
        const hostId = req.user.id; // Lấy ID của người tạo từ token đã xác thực
        const { title, scheduled_at, require_approval, allow_chat } = req.body;

        // 1. Kiểm tra nếu người dùng quên gửi mốc thời gian lên lịch
        if (!scheduled_at) {
            return res.status(400).json({ message: 'Vui lòng chọn thời gian để lên lịch cuộc họp!' });
        }

        // Kiểm tra xem thời gian đặt lịch có phải trong quá khứ không
        const scheduledDate = new Date(scheduled_at);
        if (scheduledDate < new Date()) {
            return res.status(400).json({ message: 'Thời gian lên lịch không được ở trong quá khứ!' });
        }

        // 2. Tiến hành đúc căn phòng lên lịch mới
        const newScheduledRoom = new Room({
            room_code: generateRoomCode(),
            host_id: hostId,
            title: title || 'Cuộc họp không tên',
            scheduled_at: scheduledDate,
            status: 'waiting', // Trạng thái chờ cho đến khi chủ phòng bấm Start
            settings: {
                require_approval: require_approval || false,
                allow_chat: allow_chat !== undefined ? allow_chat : true
            }
        });

        await newScheduledRoom.save();

        res.status(201).json({
            message: 'Lên lịch cuộc họp thành công!',
            room_code: newScheduledRoom.room_code,
            data: newScheduledRoom
        });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi hệ thống khi lên lịch cuộc họp', error: error.message });
    }
};

// ==========================================
// API: GỬI EMAIL MỜI THAM GIA CUỘC HỌP
// ==========================================
const sendInvites = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const { emails } = req.body; // Mảng chứa các địa chỉ email khách mời
        const userId = req.user.id;

        // 1. Kiểm tra đầu vào
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ message: 'Vui lòng cung cấp danh sách email hợp lệ!' });
        }

        // 2. Kiểm tra quyền sở hữu phòng
        const room = await Room.findOne({ room_code: roomCode });
        if (!room) return res.status(404).json({ message: 'Không tìm thấy phòng!' });
        
        if (room.host_id.toString() !== userId) {
            return res.status(403).json({ message: 'Chỉ chủ phòng mới được gửi lời mời!' });
        }

        // 3. Xử lý hiển thị thời gian (Format)
        const timeString = room.scheduled_at 
            ? new Date(room.scheduled_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) 
            : 'Tham gia ngay lập tức';

        // 4. Thiết kế Giao diện Email (HTML Template)
        const subject = `[Thư mời] ${room.title || 'Tham gia cuộc họp trực tuyến'}`;
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
                <h2 style="color: #4CAF50; text-align: center;">Lời mời tham gia cuộc họp</h2>
                <p>Xin chào,</p>
                <p>Bạn đã được mời tham gia một cuộc họp trực tuyến. Dưới đây là thông tin chi tiết:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Chủ đề:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${room.title || 'Cuộc họp không tên'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Thời gian:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${timeString}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Mã phòng:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd; font-size: 18px; color: #d9534f;"><b>${roomCode}</b></td>
                    </tr>
                </table>
                <p style="text-align: center; margin-top: 30px;">
                    <a href="http://localhost:3000/join/${roomCode}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Truy cập hệ thống</a>
                </p>
                <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">Hệ thống họp trực tuyến - Đồ án Tốt nghiệp</p>
            </div>
        `;

        // 5. Gửi email thông qua trạm phát (Nodemailer hỗ trợ truyền mảng email trực tiếp)
        const isSent = await sendEmail(emails, subject, htmlContent);

        if (isSent) {
            res.status(200).json({ message: `Đã gửi thư mời thành công đến ${emails.length} người!` });
        } else {
            res.status(500).json({ message: 'Có lỗi xảy ra trong quá trình phát thư.' });
        }

    } catch (error) {
        res.status(500).json({ message: 'Lỗi hệ thống khi gửi thư mời', error: error.message });
    }
};


module.exports = { createRoom, endRoom, getChatHistory, getAttendanceReport, scheduleRoom, sendInvites };
