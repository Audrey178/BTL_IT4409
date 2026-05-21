import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.MONGODB_MEMORY = 'true';
process.env.REDIS_MEMORY = 'true';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_32_chars_minimum';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_32_chars_minimum';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.ENABLE_SWAGGER = 'false';
process.env.LOG_LEVEL = 'silent';

let baseUrl;
let server;
let connectMongoDB;
let disconnectMongoDB;
let connectRedis;
let disconnectRedis;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
};

const registerUser = async (prefix = 'user') => {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const { response, body } = await request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'password123',
      full_name: 'Test User',
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.accessToken);
  assert.ok(body.refreshToken);
  return body;
};

describe('backend smoke and regression tests', () => {
  before(async () => {
    const dbModule = await import('../src/config/mongodb.js');
    const redisModule = await import('../src/config/redis.js');
    const appModule = await import('../src/app.js');

    connectMongoDB = dbModule.connectMongoDB;
    disconnectMongoDB = dbModule.disconnectMongoDB;
    connectRedis = redisModule.connectRedis;
    disconnectRedis = redisModule.disconnectRedis;

    await connectMongoDB();
    await connectRedis();

    server = http.createServer(appModule.default);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await disconnectRedis();
    await disconnectMongoDB();
  });

  test('health endpoint responds', async () => {
    const { response, body } = await request('/health');

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
  });

  test('logout revokes access and refresh tokens', async () => {
    const auth = await registerUser('logout');

    const meBefore = await request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${auth.accessToken}` },
    });
    assert.equal(meBefore.response.status, 200);

    const logout = await request('/api/v1/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ refresh_token: auth.refreshToken }),
    });
    assert.equal(logout.response.status, 200);
    assert.equal(logout.body.success, true);

    const meAfter = await request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${auth.accessToken}` },
    });
    assert.equal(meAfter.response.status, 401);

    const refreshAfter = await request('/api/v1/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: auth.refreshToken }),
    });
    assert.equal(refreshAfter.response.status, 401);
  });

  test('history query validation rejects unsafe pagination', async () => {
    const auth = await registerUser('history');
    const { response, body } = await request('/api/v1/history/rooms?limit=1000', {
      headers: { authorization: `Bearer ${auth.accessToken}` },
    });

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  });

  test('attendance check-in is idempotent while active', async () => {
    const auth = await registerUser('attendance');

    const roomCreate = await request('/api/v1/rooms', {
      method: 'POST',
      headers: { authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ title: 'Attendance Room' }),
    });
    assert.equal(roomCreate.response.status, 201);
    const roomCode = roomCreate.body.room.room_code;

    const join = await request(`/api/v1/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { authorization: `Bearer ${auth.accessToken}` },
    });
    assert.equal(join.response.status, 200);
    assert.equal(join.body.status, 'joined');

    const firstCheckIn = await request(`/api/v1/attendance/${roomCode}/check-in`, {
      method: 'POST',
      headers: { authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ method: 'manual' }),
    });
    assert.equal(firstCheckIn.response.status, 201);

    const secondCheckIn = await request(`/api/v1/attendance/${roomCode}/check-in`, {
      method: 'POST',
      headers: { authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ method: 'manual' }),
    });
    assert.equal(secondCheckIn.response.status, 201);
    assert.equal(secondCheckIn.body.attendanceLog._id, firstCheckIn.body.attendanceLog._id);
  });

  test('socket room approval requires the room host', async () => {
    const host = await registerUser('socket-host');
    const guest = await registerUser('socket-guest');
    const { handleApproveUser } = await import('../src/sockets/room.handler.js');
    const { RoomMember } = await import('../src/models/index.js');

    const roomCreate = await request('/api/v1/rooms', {
      method: 'POST',
      headers: { authorization: `Bearer ${host.accessToken}` },
      body: JSON.stringify({
        title: 'Approval Room',
        require_approval: true,
      }),
    });
    const roomCode = roomCreate.body.room.room_code;

    const join = await request(`/api/v1/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { authorization: `Bearer ${guest.accessToken}` },
    });
    assert.equal(join.body.status, 'pending');

    const emitted = [];
    const io = {
      sockets: {
        sockets: {
          get: () => socket,
        },
      },
    };
    const socket = {
      userId: guest.user._id,
      emit: (event, payload) => emitted.push({ event, payload }),
    };

    await handleApproveUser(io, socket, { roomCode, memberId: join.body.roomMember._id });

    const member = await RoomMember.findById(join.body.roomMember._id).lean();
    assert.equal(member.status, 'pending');
    assert.equal(emitted[0].event, 'error');
    assert.match(emitted[0].payload.message, /Only room host/);
  });

  test('WebRTC signaling requires both peers to be joined in the same room', async () => {
    const sender = await registerUser('webrtc-sender');
    const target = await registerUser('webrtc-target');
    const { handleWebRTCOffer } = await import('../src/sockets/webrtc.handler.js');

    const roomCreate = await request('/api/v1/rooms', {
      method: 'POST',
      headers: { authorization: `Bearer ${sender.accessToken}` },
      body: JSON.stringify({ title: 'WebRTC Room' }),
    });
    const roomCode = roomCreate.body.room.room_code;

    await request(`/api/v1/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sender.accessToken}` },
    });

    const emitted = [];
    const socket = {
      userId: sender.user._id,
      emit: (event, payload) => emitted.push({ event, payload }),
      to: () => ({
        emit: () => {
          throw new Error('Signal should not be forwarded');
        },
      }),
    };

    await handleWebRTCOffer(socket, {
      roomCode,
      to: target.user._id,
      offer: { type: 'offer', sdp: 'v=0' },
    });

    assert.equal(emitted[0].event, 'error');
    assert.match(emitted[0].payload.message, /same room/);
  });
});
