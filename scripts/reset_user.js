// Usage: node scripts/reset_user.js 10016069
// Requires MONGODB_URL in environment (or set in .env)

const mongoose = require('mongoose');
require('dotenv').config();

const employeeIdArg = process.argv[2];
if (!employeeIdArg) {
  console.error('Usage: node scripts/reset_user.js <employeeId>');
  process.exit(1);
}

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

  const emp = employeeIdArg.trim();
  console.log('Resetting staff with employeeId =', emp);

  const updated = await Staff.findOneAndUpdate(
    { employeeId: emp },
    {
      hasSpun: false,
      spinResult: null,
      spinResultGroup: null,
      hasBeenSpun: false,
      giftShared: 'No'
    },
    { new: true }
  );

  if (!updated) {
    console.error('No staff found with employeeId', emp);
    await mongoose.disconnect();
    process.exit(2);
  }

  console.log('Reset successful for:', updated.employeeId, updated.name);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
