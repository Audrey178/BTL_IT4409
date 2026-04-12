4 phần chính:

Lý do chọn công nghệ: Tại sao lại dùng MongoDB và Redis?

Sơ đồ cấu trúc dữ liệu (Ảnh ERD/Schema Diagram): Cái nhìn trực quan về các bảng và mối liên hệ.

Từ điển dữ liệu (Data Dictionary): Bảng giải thích chi tiết từng trường (field), kiểu dữ liệu, ràng buộc.

Thiết kế Caching/Realtime (Redis): Thể hiện tư duy hệ thống lớn.

PHẦN: THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN)

1. Lựa chọn Công nghệ & Kiến trúc lưu trữ
Hệ thống Meeting Project có đặc thù là yêu cầu xử lý thời gian thực (realtime) liên tục và lưu trữ các dạng dữ liệu phi cấu trúc (ví dụ: mảng vector khuôn mặt từ AI). Do đó, nhóm quyết định sử dụng kiến trúc lưu trữ đa tầng (Polyglot Persistence):

MongoDB (Persistent Database): Cơ sở dữ liệu NoSQL phù hợp để lưu trữ Document có cấu trúc linh hoạt (như cài đặt phòng họp, mảng Face Embeddings). Tốc độ đọc/ghi nhanh, dễ dàng mở rộng (scale) theo chiều ngang.

Redis (In-memory Data Store): Đóng vai trò làm bộ nhớ đệm tốc độ siêu cao. Dùng để lưu trữ các trạng thái "nóng" của hệ thống Realtime (Socket.IO) như: danh sách người dùng đang online, mapping giữa SocketID và UserID. Điều này giúp giảm tải tối đa các truy vấn không cần thiết xuống MongoDB.

2. Sơ đồ Cấu trúc Cơ sở dữ liệu (Schema Diagram)
(VỊ TRÍ CHÈN ẢNH MERMAID: Sơ đồ thực thể liên kết (ERD) của hệ thống)

Đoạn mã gốc (dùng để render trên Mermaid):
erDiagram
    USERS ||--o{ ROOM_MEMBERS : "tham gia"
    USERS ||--o{ ATTENDANCE_LOGS : "điểm danh"
    USERS ||--o{ MESSAGES : "gửi"
    USERS ||--o{ ROOMS : "làm chủ (host)"
    
    ROOMS ||--o{ ROOM_MEMBERS : "chứa"
    ROOMS ||--o{ ATTENDANCE_LOGS : "lưu trữ"
    ROOMS ||--o{ MESSAGES : "lưu trữ"
    ROOMS ||--o{ MEETING_EVENTS : "ghi vết sự kiện"

    USERS {
        ObjectId _id PK
        String email UK "Index"
        String password_hash
        String full_name
        Array face_embeddings
    }

    ROOMS {
        ObjectId _id PK
        String room_code UK "Index"
        ObjectId host_id FK
        String status
        Object settings
    }

    ROOM_MEMBERS {
        ObjectId _id PK
        ObjectId room_id FK "Index"
        ObjectId user_id FK "Index"
        String status
        Date joined_at
    }

    ATTENDANCE_LOGS {
        ObjectId _id PK
        ObjectId room_id FK "Index"
        ObjectId user_id FK "Index"
        Number confidence_score
        Date check_in_time
        Date check_out_time
    }

    MESSAGES {
        ObjectId _id PK
        ObjectId room_id FK "Index"
        ObjectId sender_id FK
        String content
        Date timestamp "Index -1"
    }

. Từ điển Dữ liệu (Data Dictionary - MongoDB)
Hệ thống bao gồm 6 Collection chính. Dưới đây là đặc tả chi tiết cho từng cấu trúc dữ liệu.

3.1. Collection users (Quản lý Người dùng & Dữ liệu AI)
Lưu trữ thông tin tài khoản định danh và dữ liệu vector đặc trưng khuôn mặt dùng cho tính năng AI Attendance.
Tên trường (Field)Kiểu (Type)Ràng buộcMô tả chi tiết_idObjectIdKhóa chính (PK)Mã định danh tự sinh của MongoDBemailStringBắt buộc, Unique, IndexEmail đăng nhập của người dùngpassword_hashStringBắt buộcMật khẩu đã được mã hóa bcryptfull_nameStringBắt buộcHọ và tên hiển thịavatarStringMặc địnhĐường dẫn ảnh đại diệnface_embeddingsArray[Object]Mảng lưu trữ các vector khuôn mặt (trích xuất từ TensorFlow.js). Cho phép lưu nhiều góc mặt.roleStringEnum: ['user', 'admin']Phân quyền hệ thống

3.2. Collection rooms (Quản lý Phòng họp)Lưu trữ cấu hình và trạng thái của các phiên họp tĩnh.Tên trường (Field)Kiểu (Type)Ràng buộcMô tả chi tiết_idObjectIdKhóa chính (PK)room_codeStringBắt buộc, Unique, IndexMã phòng (VD: abc-xyz-def) dùng để sharehost_idObjectIdBắt buộc, Ref: usersNgười tạo/quản lý phòngtitleStringBắt buộcTên cuộc họpstatusStringEnum: ['waiting', 'active', 'ended']Trạng thái hiện tại của phòngsettingsObjectChứa các cờ cấu hình: require_approval (duyệt người vào), allow_chat

3.3. Collection room_members (Quản lý Phiên tham gia)Lưu trữ thông tin ai đang ở phòng nào để quản lý host control. Tạo Compound Index cho (room_id, user_id).Tên trường (Field)Kiểu (Type)Ràng buộcMô tả chi tiết_idObjectIdKhóa chính (PK)room_idObjectIdBắt buộc, Ref: roomsuser_idObjectIdBắt buộc, Ref: usersstatusStringEnum: ['pending', 'joined', 'kicked', 'left']Trạng thái tham gia (dùng cho tính năng Waiting Room)joined_atDateMặc định: Date.nowThời gian bắt đầu vào phòng

3.4. Collection attendance_logs (Nhật ký Điểm danh AI)Lưu trữ kết quả nhận diện khuôn mặt và tính toán thời lượng tham gia.Tên trường (Field)Kiểu (Type)Ràng buộcMô tả chi tiết_idObjectIdKhóa chính (PK)room_idObjectIdBắt buộc, Ref: roomsuser_idObjectIdBắt buộc, Ref: usersconfidence_scoreNumberĐiểm tự tin của mô hình AI khi so khớpcheck_in_timeDateMặc định: Date.nowThời điểm nhận diện thành côngcheck_out_timeDateNullableThời điểm người dùng rời phòng (để tính tổng thời lượng)methodStringEnum: ['face_recognition', 'manual']Phân biệt AI điểm danh hay Host tự tích

3.5. Collection messages (Lịch sử Chat Realtime)Áp dụng kỹ thuật Denormalization (Khử chuẩn hóa) để tối ưu hóa tốc độ đọc. Bảng lưu trực tiếp tên và avatar người gửi để khi truy vấn lịch sử không cần thao tác JOIN (Populate) phức tạp.Tên trường (Field)Kiểu (Type)Ràng buộcMô tả chi tiết_idObjectIdKhóa chính (PK)room_idObjectIdBắt buộc, Ref: roomssender_idObjectIdRef: usersCần thiết để đánh dấu "Tin nhắn của tôi"sender_nameStringKhử chuẩn hóaSnapshot tên người gửi lúc chatsender_avatarStringKhử chuẩn hóaSnapshot avatar người gửi lúc chatcontentStringBắt buộcNội dung tin nhắntimestampDateIndex: -1Sắp xếp giảm dần để lấy tin nhắn mới nhất

4. Thiết kế Cấu trúc Trạng thái (State Design - Redis)
Hệ thống yêu cầu phản hồi Realtime tính bằng mili-giây, việc truy vấn CSDL vật lý (MongoDB) để lấy danh sách người online là không khả thi. Thiết kế sử dụng Redis Key-Value để giải quyết bài toán này:

Truy xuất nhanh thông tin Socket:

Cấu trúc: String / Hash

Key: socket:{socketId}

Value: {"userId": "...", "roomCode": "..."}

Mục đích: Khi một client mất kết nối đột ngột (disconnect event), hệ thống lập tức tra cứu xem họ là ai, ở phòng nào để phát đi thông báo user_left cho những người còn lại.

Quản lý danh sách người dùng trong phòng:

Cấu trúc: Set (Đảm bảo không trùng lặp)

Key: room:{roomCode}:members

Value: [userId1, userId2, ...]

Mục đích: Trả về danh sách người tham gia (Participant List) gần như ngay lập tức cho Frontend.

Phân quyền Chủ phòng (Host Control):

Cấu trúc: String

Key: room:{roomCode}:host

Value: userId của người tạo phòng

Mục đích: Dùng làm middleware cache để xác thực nhanh quyền Mute, Kick, Duyệt người (Admit) mà không cần gọi xuống Database.