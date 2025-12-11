// Usage: node scripts/assign_spin.js <spinnerEmployeeId> <spunEmployeeId>
// Requires MONGODB_URL in environment (or set in .env)

const mongoose = require('mongoose');
require('dotenv').config();

const spinnerId = process.argv[2];
const spunId = process.argv[3];

if (!spinnerId || !spunId) {
  console.error('Usage: node scripts/assign_spin.js <spinnerEmployeeId> <spunEmployeeId>');
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

  const spinnerEmp = spinnerId.trim();
  const spunEmp = spunId.trim();

  console.log(`Assigning spin: ${spinnerEmp} -> ${spunEmp}`);

  const spinner = await Staff.findOne({ employeeId: spinnerEmp });
  const spun = await Staff.findOne({ employeeId: spunEmp });

  if (!spinner) {
    console.error('Spinner not found:', spinnerEmp);
    await mongoose.disconnect();
    process.exit(2);
  }
  if (!spun) {
    console.error('Spun user not found:', spunEmp);
    await mongoose.disconnect();
    process.exit(3);
  }

  // Apply assignment
  spinner.hasSpun = true;
  spinner.spinResult = spun.name;
  spinner.spinResultGroup = spun.group;
  spinner.giftShared = 'No';
  await spinner.save();

  spun.hasBeenSpun = true;
  await spun.save();

  console.log('Assignment successful:');
  console.log(' Spinner:', spinner.employeeId, '-', spinner.name);
  console.log(' Spun:', spun.employeeId, '-', spun.name);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
