// Usage: node scripts/set_one_time.js <employeeId> <remaining>
// Requires MONGODB_URL in environment or .env

const mongoose = require('mongoose');
require('dotenv').config();

const employeeIdArg = process.argv[2];
const remainingArg = process.argv[3];
if (!employeeIdArg || typeof remainingArg === 'undefined') {
  console.error('Usage: node scripts/set_one_time.js <employeeId> <remaining>');
  process.exit(1);
}

const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) {
  console.error('MONGODB_URL environment variable not set');
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

  const staffSchema = new mongoose.Schema({}, { strict: false });
  const Staff = mongoose.model('StaffSetOneTime', staffSchema, 'staffs');

  const emp = employeeIdArg.trim();
  const remaining = Number(remainingArg);

  console.log(`Setting isOneTimeId=true and oneTimeRemaining=${remaining} for employeeId=${emp}`);

  const updated = await Staff.findOneAndUpdate(
    { employeeId: emp },
    { $set: { isOneTimeId: true, oneTimeRemaining: remaining } },
    { new: true }
  );

  if (!updated) {
    console.error('No staff found with employeeId', emp);
    await mongoose.disconnect();
    process.exit(2);
  }

  console.log('Updated staff:', {
    employeeId: updated.employeeId,
    name: updated.name,
    isOneTimeId: updated.isOneTimeId,
    oneTimeRemaining: updated.oneTimeRemaining
  });

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
