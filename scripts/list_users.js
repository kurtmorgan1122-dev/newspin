// Usage: node scripts/list_users.js
// Requires MONGODB_URL in environment (or set in .env)

const mongoose = require('mongoose');
require('dotenv').config();

const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) {
  console.error('MONGODB_URL environment variable not set');
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

  const staffSchema = new mongoose.Schema({
    employeeId: String,
    name: String,
    department: String,
    group: String,
    hasSpun: Boolean,
    spinResult: String,
    spinResultGroup: String,
    giftShared: String,
    hasBeenSpun: Boolean,
    isOneTimeId: Boolean,
    oneTimeRemaining: Number
  });

  const Staff = mongoose.model('StaffScript', staffSchema, 'staffs');

  // Search for users with "Adetutu" or "Yakub" in their name
  const results = await Staff.find({
    $or: [
      { name: /adetutu/i },
      { name: /yakub/i }
    ]
  }).limit(20);

  console.log(`Found ${results.length} matching users:`);
  results.forEach(staff => {
    console.log(`  ${staff.employeeId} - ${staff.name}`);
  });

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
