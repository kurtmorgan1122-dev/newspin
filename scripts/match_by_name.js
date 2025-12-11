// Usage: node scripts/match_by_name.js "Spinner Name" "Spun Name"
// Example: node scripts/match_by_name.js "LUCKY GOODNESS" "TOM UBONG"
// Requires MONGODB_URL in environment (or set in .env)

const mongoose = require('mongoose');
require('dotenv').config();

const spinnerNameArg = process.argv[2];
const spunNameArg = process.argv[3];

if (!spinnerNameArg || !spunNameArg) {
  console.error('Usage: node scripts/match_by_name.js "Spinner Name" "Spun Name"');
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

  const spinnerName = spinnerNameArg.trim().toUpperCase();
  const spunName = spunNameArg.trim().toUpperCase();

  console.log(`Finding spinner: ${spinnerName}`);
  const spinner = await Staff.findOne({ name: spinnerName });
  console.log(`Finding spun: ${spunName}`);
  const spun = await Staff.findOne({ name: spunName });

  if (!spinner) {
    console.error('Spinner not found:', spinnerName);
    await mongoose.disconnect();
    process.exit(2);
  }
  if (!spun) {
    console.error('Spun user not found:', spunName);
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
