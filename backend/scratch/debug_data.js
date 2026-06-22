import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectMongoDB } from '../src/config/mongodb.js';
import { Room, RoomMember, Message, Recording } from '../src/models/index.js';
import chatService from '../src/services/chat.service.js';
import roomService from '../src/services/room.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  console.log("Connecting DB...");
  await connectMongoDB();
  
  console.log("\n=== RECORDINGS ===");
  const recordings = await Recording.find().populate('room_id').lean();
  console.log(`Found ${recordings.length} recordings.`);
  
  for (const rec of recordings) {
    const room = rec.room_id;
    console.log(`Recording ID: ${rec._id}, Title: ${rec.title}`);
    if (room) {
      console.log(`  Room Code: ${room.room_code}, Status: ${room.status}, Host ID: ${room.host_id}`);
      
      // Test roomService.getRoomMembersHistory
      try {
        const histRes = await roomService.getRoomMembersHistory(room.room_code);
        console.log(`  roomService.getRoomMembersHistory: success = ${histRes.success}, participants = ${histRes.participants?.length}`);
        for (const p of histRes.participants || []) {
          console.log(`    Participant: ${p.fullName}, Status: ${p.status}, Duration: ${p.duration}s`);
        }
      } catch (e) {
        console.log(`  roomService.getRoomMembersHistory failed: ${e.message}`);
      }
      
      // Check messages
      const msgCount = await Message.countDocuments({ room_id: room._id });
      console.log(`  Messages count: ${msgCount}`);
      
      // Test chatService.getRoomMessages
      if (room.host_id) {
        try {
          const res = await chatService.getRoomMessages(room.room_code, room.host_id, { limit: 10 });
          console.log(`  chatService.getRoomMessages (Host): success = ${res.success}, messages = ${res.messages?.length}`);
        } catch (e) {
          console.log(`  chatService.getRoomMessages (Host) failed: ${e.message}`);
        }
      }
    } else {
      console.log(`  (No associated room document found!)`);
    }
    console.log("-----------------------------------------");
  }

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch(console.error);
