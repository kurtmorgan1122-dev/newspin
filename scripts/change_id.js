// Usage: node scripts/change_id.js "Adetutu Yakub" 10016132
// Requires MONGODB_URL in environment (or set in .env)

const mongoose = require('mongoose');
require('dotenv').config();

const nameArg = process.argv[2];
const newEmployeeIdArg = process.argv[3];

if (!nameArg || !newEmployeeIdArg) {
  console.error('Usage: node scripts/change_id.js <name> <newEmployeeId>');
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

  const name = nameArg.trim().toUpperCase();
  const newEmployeeId = newEmployeeIdArg.trim();

  console.log('Searching for staff with name =', name);

  // First find the user
  const staff = await Staff.findOne({ name: name });

  if (!staff) {
    console.error('No staff found with name', nameArg);
    await mongoose.disconnect();
    process.exit(2);
  }

  console.log('Found staff:', staff.employeeId, staff.name);
  const oldEmployeeId = staff.employeeId;

  // Update the employee ID
  const updated = await Staff.findOneAndUpdate(
    { name: name },
    { employeeId: newEmployeeId },
    { new: true }
  );

  console.log('ID change successful:');
  console.log('  Name:', updated.name);
  console.log('  Old ID:', oldEmployeeId);
  console.log('  New ID:', updated.employeeId);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
