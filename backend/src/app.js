const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const authRoutes = require('./routes/v1/auth.route');

const app = express();

// Middleware cơ bản
app.use(cors());
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Meeting Project API',
            version: '1.0.0',
            description: 'Tài liệu API Backend cho Hệ thống Streaming và Xử lý ảnh realtime',
        },
        servers: [
            {
                url: 'http://localhost:5000/api/v1',
                description: 'Local server'
            }
        ],
    },
    // Đường dẫn để Swagger tìm các file chứa chú thích API
    apis: ['./src/routes/v1/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Đường dẫn Test hệ thống
app.get('/', (req, res) => {
    res.json({ message: 'Meeting Project API is running!' });
});

module.exports = app; // Xuất app ra để server.js dùng