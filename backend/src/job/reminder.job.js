const cron = require('node-cron');
const Room = require('../models/room.model');
const { sendEmail } = require('../config/email.config');

const startCronJobs = () => {
    // Biểu thức '* * * * *' nghĩa là: Chạy hàm này MỖI PHÚT 1 LẦN
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            // Lấy mốc thời gian 15 phút tính từ hiện tại
            const next15Mins = new Date(now.getTime() + 15 * 60000);

            // Tìm các phòng: Đang chờ, Lịch hẹn rơi vào khoảng 15p tới, và Chưa gửi nhắc nhở
            const upcomingRooms = await Room.find({
                status: 'waiting',
                scheduled_at: { $lte: next15Mins, $gte: now },
                reminder_sent: false
            }).populate('host_id', 'email full_name'); // Nối bảng để lấy email của Chủ phòng

            if (upcomingRooms.length > 0) {
                console.log(`🤖 Trợ lý CronJob tìm thấy ${upcomingRooms.length} cuộc họp sắp bắt đầu.`);
            }

            // Lặp qua từng phòng để gửi email
            for (const room of upcomingRooms) {
                const hostEmail = room.host_id.email;
                const hostName = room.host_id.full_name;
                
                const timeString = new Date(room.scheduled_at).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

                const subject = `[Nhắc nhở] Cuộc họp "${room.title}" sắp bắt đầu!`;
                const htmlContent = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
                        <h2 style="color: #ff9800;">⏰ Sắp đến giờ họp rồi!</h2>
                        <p>Chào <b>${hostName}</b>,</p>
                        <p>Cuộc họp <b>${room.title}</b> do bạn làm chủ trì sẽ bắt đầu lúc <b>${timeString}</b> (trong vòng chưa đầy 15 phút nữa).</p>
                        <p>Mã phòng của bạn là: <b style="color: #d9534f; font-size: 16px;">${room.room_code}</b></p>
                        <p>Hãy chuẩn bị tài liệu và truy cập hệ thống để mở phòng chờ đón khách mời nhé!</p>
                        <hr/>
                        <p style="font-size: 12px; color: #888;">Hệ thống nhắc nhở tự động - Đồ án Tốt nghiệp</p>
                    </div>
                `;

                // Tiến hành gửi email
                const isSent = await sendEmail(hostEmail, subject, htmlContent);

                // Nếu gửi thành công, đánh dấu lại để phút sau không gửi nữa
                if (isSent) {
                    room.reminder_sent = true;
                    await room.save();
                    console.log(`✅ Đã nhắc nhở Host [${hostEmail}] về phòng [${room.room_code}]`);
                }
            }

        } catch (error) {
            console.error('❌ Lỗi trong quá trình chạy CronJob nhắc nhở:', error.message);
        }
    });

    console.log('🤖 Trợ lý CronJob đã được kích hoạt và đang tuần tra!');
};

module.exports = { startCronJobs };