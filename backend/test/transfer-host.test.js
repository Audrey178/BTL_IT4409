import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import RoomService from '../src/services/room.service.js';
import { User, Room, RoomMember } from '../src/models/index.js';

test('transferHost should move host to a joined participant', async (t) => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test' });

  // Create host and participant users
  const host = new User({ email: 'host@example.com', password_hash: 'password', full_name: 'Host' });
  const participant = new User({ email: 'p@example.com', password_hash: 'password', full_name: 'Participant' });
  await host.save();
  await participant.save();

  // Create room
  const room = new Room({ room_code: 'TST-ROOM-001', host_id: host._id, title: 'Test Room' });
  await room.save();

  // Add participant as joined
  const member = new RoomMember({ room_id: room._id, user_id: participant._id, status: 'joined', joined_at: new Date() });
  await member.save();

  // Call transferHost
  const res = await RoomService.transferHost(room.room_code, host._id.toString(), participant._id.toString());

  assert.equal(res.success, true);
  assert.equal(res.newHostId, participant._id.toString());

  // Verify in DB
  const updatedRoom = await Room.findById(room._id);
  assert.equal(updatedRoom.host_id.toString(), participant._id.toString());

  await mongoose.disconnect();
  await mongod.stop();
});
