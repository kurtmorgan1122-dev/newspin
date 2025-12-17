const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Root route - redirect to spinner page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spinner.html'));
});

// Create HTTP server and attach Socket.IO
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// MongoDB Connection
const mongoUrl = process.env.MONGODB_URL;

if (!mongoUrl) {
  console.error('MONGODB_URL environment variable is not set');
  process.exit(1);
}


mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// Staff Schema
const staffSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true }, // New field
  name: { type: String, required: true, uppercase: true },
  department: { type: String, required: true },
  group: { type: String, required: true }, // dairies, swan, snacks1, snacks2
  hasSpun: { type: Boolean, default: false },
  spinResult: { type: String, default: null },
  spinResultGroup: { type: String, default: null },
  giftShared: { type: String, default: 'No' },
  hasBeenSpun: { type: Boolean, default: false },
  // For accounts created via the admin one-time ID generator
  isOneTimeId: { type: Boolean, default: false },
  oneTimeRemaining: { type: Number, default: 0 }
});

const Staff = mongoose.model('Staff', staffSchema);

// Upload Excel endpoint
app.post('/api/upload/:group', upload.single('file'), async (req, res) => {
  try {
    const group = req.params.group;
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log('Excel columns found:', Object.keys(data[0] || {}));
    console.log('First row sample:', data[0]);

    const staffData = data.map(row => {
      // Try different possible column names for flexibility
      const employeeIdValue = row['Employee ID'] || 
                              row['EmployeeID'] || 
                              row['employee_id'] ||
                              row['ID'] ||
                              row['ID Number'];
      
      const nameValue = row['Name (Surname First)'] || 
                        row['Name'] || 
                        row['NAME'] || 
                        row['name'] ||
                        row['Full Name'] ||
                        row['FULL NAME'];
      
      const deptValue = row['Department'] || 
                        row['DEPARTMENT'] || 
                        row['department'] ||
                        row['Dept'];

      if (!employeeIdValue || !nameValue || !deptValue) {
        console.log('Missing data in row:', row);
        return null;
      }

      return {
        employeeId: String(employeeIdValue).trim(),
        name: String(nameValue).toUpperCase().trim(),
        department: String(deptValue).toUpperCase().trim(),
        group: group
      };
    }).filter(item => item !== null); // Remove any null entries

    // Remove duplicates and insert
    let successCount = 0;
    for (const staff of staffData) {
      if (staff && staff.employeeId && staff.name && staff.department) {
        await Staff.findOneAndUpdate(
          { employeeId: staff.employeeId },
          staff,
          { upsert: true, new: true }
        );
        successCount++;
      }
    }

    res.json({ success: true, message: `${successCount} staff members uploaded successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Lookup employee by ID to auto-fill name and department
app.get('/api/lookup-employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const staff = await Staff.findOne({ employeeId: employeeId.trim() });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Employee ID not found' });
    }

    // Also return spin status and one-time ID metadata so the client can
    // disable login for users who already spun (unless they have a one-time extra use).
    res.json({ 
      success: true, 
      name: staff.name, 
      department: staff.department,
      hasSpun: !!staff.hasSpun,
      isOneTimeId: !!staff.isOneTimeId,
      oneTimeRemaining: typeof staff.oneTimeRemaining === 'number' ? staff.oneTimeRemaining : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remind Me endpoint - Get spin result for a staff member
app.get('/api/remind-me/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const staff = await Staff.findOne({ employeeId: employeeId.trim() });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff ID not found' });
    }

    if (!staff.hasSpun) {
      return res.status(400).json({ success: false, message: 'You have not spun yet' });
    }

    // Get the department of the spun person
    const spunStaff = await Staff.findOne({ name: staff.spinResult });
    const spinResultDept = spunStaff ? spunStaff.department : 'N/A';

    res.json({ 
      success: true, 
      spinResult: {
        spinResultName: staff.spinResult,
        spinResultDept: spinResultDept,
        spinResultGroup: staff.spinResultGroup
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { employeeId } = req.body;
    const staff = await Staff.findOne({ employeeId: employeeId.trim() });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Employee ID not found' });
    }

    // Allow login for everyone (including those who have already spun).
    // Do not leak prior-spin state here — the client should treat the interaction as a fresh spin.
    res.json({ success: true, staff: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search names endpoint
app.get('/api/search-names', async (req, res) => {
  try {
    const { query } = req.query;
    const regex = new RegExp(query, 'i');
    const staff = await Staff.find({ name: regex }).limit(10);
    res.json({ success: true, names: staff.map(s => s.name) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get departments endpoint
app.get('/api/departments', async (req, res) => {
  try {
    const departments = await Staff.distinct('department');
    res.json({ success: true, departments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate one-time ID for staff without Employee ID
app.post('/api/admin/generate-id', async (req, res) => {
  try {
    const { name, department, group } = req.body;

    if (!name || !department || !group) {
      return res.status(400).json({ success: false, message: 'Name, department, and group are required' });
    }

    // Generate an 8-digit numeric one-time ID and ensure uniqueness
    let oneTimeId;
    // Create a numeric ID in range [10000000, 99999999]
    do {
      oneTimeId = (Math.floor(10000000 + Math.random() * 90000000)).toString();
    } while (await Staff.findOne({ employeeId: oneTimeId }));

    // Create or update staff with the generated ID and mark as one-time
    const normalizedDept = department.trim().toUpperCase();

    const staff = await Staff.findOneAndUpdate(
      { name: name.toUpperCase().trim(), department: normalizedDept },
      {
        name: name.toUpperCase().trim(),
        department: normalizedDept,
        group: group,
        employeeId: oneTimeId,
        isOneTimeId: true,
        oneTimeRemaining: 1
      },
      { upsert: true, new: true }
    );

    res.json({ 
      success: true, 
      message: 'One-time ID generated successfully',
      oneTimeId: oneTimeId,
      staff: staff
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Normalize existing department values to uppercase (one-time run)
app.post('/api/admin/normalize-departments', async (req, res) => {
  try {
    const staffs = await Staff.find({});
    let updated = 0;
    for (const s of staffs) {
      const norm = s.department ? s.department.toUpperCase().trim() : '';
      if (s.department !== norm) {
        s.department = norm;
        await s.save();
        updated++;
      }
    }

    res.json({ success: true, message: `Normalized ${updated} staff department(s) to uppercase` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Spin endpoint
app.post('/api/spin', async (req, res) => {
  try {
    const { staffId } = req.body;
    const spinner = await Staff.findById(staffId);
    if (!spinner) {
      return res.status(404).json({ success: false, message: 'Staff not found in this department' });
    }

    // Handle repeat-spin cases: normally we refuse repeat spins, but allow
    // one extra replay for accounts created with a one-time ID (if remaining).
    if (spinner.hasSpun) {
      if (spinner.isOneTimeId && spinner.oneTimeRemaining > 0) {
        // Consume one remaining extra use and return the same assigned result
        await Staff.findByIdAndUpdate(spinner._id, { $inc: { oneTimeRemaining: -1 } });

        const spunStaff = await Staff.findOne({ name: spinner.spinResult });
        const result = spunStaff
          ? { name: spunStaff.name, department: spunStaff.department, group: spunStaff.group }
          : { name: spinner.spinResult || 'N/A', department: 'N/A', group: spinner.spinResultGroup || 'N/A' };

        try {
          io.emit('spinReplay', {
            spinnerId: spinner._id,
            spinnerName: spinner.name,
            spunName: result.name,
            spunGroup: result.group
          });
        } catch (e) {
          console.error('Socket emit error (replay):', e.message);
        }

        return res.json({ success: true, spinResult: result });
      }

      return res.status(400).json({ success: false, message: 'You have already spun. Each person may spin only once.' });
    }

    // Check for hardcoded assignments
    let hardcodedSpunStaff = null;
    if (spinner.employeeId === '10005126') {
      hardcodedSpunStaff = await Staff.findOne({ employeeId: '10016065' });
    } else if (spinner.employeeId === '10005529') {
      hardcodedSpunStaff = await Staff.findOne({ employeeId: '10016067' });
    }

    if (hardcodedSpunStaff) {
      // Update both records for hardcoded assignment
      spinner.hasSpun = true;
      spinner.spinResult = hardcodedSpunStaff.name;
      spinner.spinResultGroup = hardcodedSpunStaff.group;
      await spinner.save();

      hardcodedSpunStaff.hasBeenSpun = true;
      await hardcodedSpunStaff.save();

      // Emit socket event so admin clients can refresh automatically
      try {
        io.emit('spinComplete', {
          spinnerId: spinner._id,
          spinnerName: spinner.name,
          spunName: hardcodedSpunStaff.name,
          spunGroup: hardcodedSpunStaff.group
        });
      } catch (e) {
        console.error('Socket emit error:', e.message);
      }

      return res.json({ 
        success: true, 
        spinResult: {
          name: hardcodedSpunStaff.name,
          department: hardcodedSpunStaff.department,
          group: hardcodedSpunStaff.group === 'snacks1' || hardcodedSpunStaff.group === 'snacks2' 
            ? 'Snacks Plant' 
            : hardcodedSpunStaff.group === 'swan' 
            ? 'SWAN Plant' 
            : hardcodedSpunStaff.group === 'dairies' 
            ? 'Dairies Plant' 
            : hardcodedSpunStaff.group
        }
      });
    }

    // First, try to get staff who have already spun (waiting list: hasSpun: true, hasBeenSpun: false)
    // from the same group, preferring different department
    let availableStaff = await Staff.find({ 
      hasSpun: true,
      hasBeenSpun: false,
      group: spinner.group,
      _id: { $ne: staffId },
      department: { $ne: spinner.department } // Prefer different department
    });

    // If no one from different department, try same department
    if (availableStaff.length === 0) {
      availableStaff = await Staff.find({ 
        hasSpun: true,
        hasBeenSpun: false,
        group: spinner.group,
        _id: { $ne: staffId },
        department: spinner.department // Same department
      });
    }

    // If still no one in waiting list, fall back to unspun staff from same group
    if (availableStaff.length === 0) {
      availableStaff = await Staff.find({ 
        hasBeenSpun: false,
        group: spinner.group,
        _id: { $ne: staffId }
      });
    }

    if (availableStaff.length === 0) {
      return res.status(400).json({ success: false, message: 'No available staff to spin' });
    }

    // Randomly select one
    const randomIndex = Math.floor(Math.random() * availableStaff.length);
    const spunStaff = availableStaff[randomIndex];

    // Update both records
    spinner.hasSpun = true;
    spinner.spinResult = spunStaff.name;
    spinner.spinResultGroup = spunStaff.group;
    await spinner.save();

    spunStaff.hasBeenSpun = true;
    await spunStaff.save();

    // Emit socket event so admin clients can refresh automatically
    try {
      io.emit('spinComplete', {
        spinnerId: spinner._id,
        spinnerName: spinner.name,
        spunName: spunStaff.name,
        spunGroup: spunStaff.group
      });
    } catch (e) {
      console.error('Socket emit error:', e.message);
    }

    res.json({ 
  success: true, 
  spinResult: {
    name: spunStaff.name,
    department: spunStaff.department,
    group: spunStaff.group === 'snacks1' || spunStaff.group === 'snacks2' 
      ? 'Snacks Plant' 
      : spunStaff.group === 'swan' 
      ? 'SWAN Plant' 
      : spunStaff.group === 'dairies' 
      ? 'Dairies Plant' 
      : spunStaff.group
  }
});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Get all staff
app.get('/api/admin/staff', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = 25;
    const skip = (page - 1) * limit;

    // Build filter: hasSpun: true, and optionally filter by name or spinResult
    const filter = { hasSpun: true };
    if (search.trim()) {
      // Split search into individual words for flexible matching
      const searchWords = search.trim().toUpperCase().split(/\s+/);
      
      // Create regex patterns for each word (case-insensitive)
      const wordPatterns = searchWords.map(word => new RegExp(word, 'i'));
      
      // Match if ALL words are found anywhere in the name or spinResult
      filter.$or = [
        {
          name: {
            $regex: wordPatterns.map(p => `(?=.*${p.source})`).join(''),
            $options: 'i'
          }
        },
        {
          spinResult: {
            $regex: wordPatterns.map(p => `(?=.*${p.source})`).join(''),
            $options: 'i'
          }
        }
      ];
    }

    const total = await Staff.countDocuments(filter);
    const staff = await Staff.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 });

    // Enrich staff data with department of spinResult (spun staff)
    const enrichedStaff = await Promise.all(staff.map(async (s) => {
      const spunStaff = await Staff.findOne({ name: s.spinResult });
      return {
        ...s.toObject(),
        spinResultDept: spunStaff ? spunStaff.department : null
      };
    }));

    res.json({ 
      success: true, 
      staff: enrichedStaff, 
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Update gift status
app.put('/api/admin/gift-status/:id', async (req, res) => {
  try {
    const { giftShared } = req.body;
    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { giftShared },
      { new: true }
    );
    res.json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Get stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalStaff = await Staff.countDocuments();
    const spunCount = await Staff.countDocuments({ hasSpun: true });
    const giftsShared = await Staff.countDocuments({ giftShared: 'Yes' });

    res.json({ 
      success: true, 
      stats: {
        totalStaff,
        spunCount,
        giftsShared,
        remaining: totalStaff - spunCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Reset spin
app.post('/api/admin/reset-spin/:id', async (req, res) => {
  try {
    const { spunName } = req.body;
    
    // Reset the spinner (person who spun)
    const spinner = await Staff.findByIdAndUpdate(
      req.params.id,
      { 
        hasSpun: false,
        spinResult: null,
        spinResultGroup: null,
        giftShared: 'No'
      },
      { new: true }
    );

    if (!spinner) {
      return res.status(404).json({ success: false, message: 'Spinner not found' });
    }

    // Reset the person who was spun (if exists)
    if (spunName && spunName !== 'N/A') {
      await Staff.findOneAndUpdate(
        { name: spunName },
        { hasBeenSpun: false }
      );
    }

    res.json({ success: true, message: 'Spin reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: End-to-End Validation - Get all staff with spin status
app.get('/api/admin/validation', async (req, res) => {
  try {
    const staff = await Staff.find({})
      .select('name department group spinResult hasBeenSpun hasSpun')
      .sort({ name: 1 });
    
    res.json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Reset all hasBeenSpun to false (for testing)
app.post('/api/admin/reset-been-spun', async (req, res) => {
  try {
    await Staff.updateMany({}, { hasBeenSpun: false });
    
    io.emit('staffUpdated', { action: 'resetBeenSpun' });

    res.json({ 
      success: true, 
      message: 'All staff hasBeenSpun status reset to false'
    });
  } catch (error) {
    console.error('Error in reset-been-spun:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Fix unmatched staff - Revert their spins and randomly re-match them together (within same group)
app.post('/api/admin/fix-unmatched', async (req, res) => {
  try {
    // Find all staff who spun but haven't been spun
    const unmatchedStaff = await Staff.find({ 
      hasSpun: true, 
      hasBeenSpun: false 
    });

    console.log(`Found ${unmatchedStaff.length} unmatched staff`);

    if (unmatchedStaff.length === 0) {
      return res.json({ success: true, message: 'No unmatched staff to fix' });
    }

    const unmatchedIds = unmatchedStaff.map(s => s._id);

    // Step 1: For each unmatched person, revert the person they spun
    for (const unmatched of unmatchedStaff) {
      if (unmatched.spinResult && unmatched.spinResult !== 'N/A') {
        await Staff.updateOne(
          { name: unmatched.spinResult },
          { hasBeenSpun: false }
        );
      }
    }

    console.log('Reverted previous spin assignments');

    // Step 2: Clear their current spin results
    await Staff.updateMany(
      { _id: { $in: unmatchedIds } },
      { spinResult: null, spinResultGroup: null }
    );

    console.log('Cleared spin results');

    // Step 3: Refetch unmatched staff to get fresh data
    const refreshedUnmatched = await Staff.find({ 
      _id: { $in: unmatchedIds }
    });

    // Step 4: Group unmatched staff by their group
    const groupedByGroup = {};
    refreshedUnmatched.forEach(staff => {
      if (!groupedByGroup[staff.group]) {
        groupedByGroup[staff.group] = [];
      }
      groupedByGroup[staff.group].push(staff);
    });

    console.log('Grouped unmatched staff by group:', Object.keys(groupedByGroup));

    // Step 5: For each group, shuffle and create circular matching within that group
    const bulkOps = [];

    for (const group in groupedByGroup) {
      const groupStaff = groupedByGroup[group];
      const shuffled = [...groupStaff].sort(() => Math.random() - 0.5);

      console.log(`Processing group '${group}' with ${shuffled.length} staff`);

      // Create circular matching within this group
      for (let i = 0; i < shuffled.length; i++) {
        const currentPerson = shuffled[i];
        const targetIndex = (i + 1) % shuffled.length;
        const targetPerson = shuffled[targetIndex];

        // Update current person's spin result
        bulkOps.push({
          updateOne: {
            filter: { _id: currentPerson._id },
            update: { 
              $set: {
                spinResult: targetPerson.name,
                spinResultGroup: targetPerson.group
              }
            }
          }
        });

        // Mark target person as hasBeenSpun
        bulkOps.push({
          updateOne: {
            filter: { _id: targetPerson._id },
            update: { $set: { hasBeenSpun: true } }
          }
        });
      }
    }

    // Execute all updates at once
    if (bulkOps.length > 0) {
      await Staff.bulkWrite(bulkOps);
    }

    console.log('Successfully updated all staff within their groups');

    // Emit socket event to update admin
    io.emit('staffUpdated', { action: 'fixUnmatched', count: refreshedUnmatched.length });

    res.json({ 
      success: true, 
      message: `Successfully re-matched ${refreshedUnmatched.length} unmatched staff members within their respective groups`
    });
  } catch (error) {
    console.error('Error in fix-unmatched:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Reset a specific user by employeeId (for testing)
app.post('/api/admin/reset-user/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const staff = await Staff.findOneAndUpdate(
      { employeeId: employeeId.trim() },
      {
        hasSpun: false,
        spinResult: null,
        spinResultGroup: null,
        hasBeenSpun: false,
        giftShared: 'No'
      },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    io.emit('staffUpdated', { action: 'resetUser', employeeId: staff.employeeId });

    res.json({ success: true, message: 'Staff reset for testing', staff });
  } catch (error) {
    console.error('Error in reset-user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Broadcast a re-login event to all connected admin clients
app.post('/api/admin/broadcast-relogin', async (req, res) => {
  try {
    io.emit('requireAdminLogin');
    res.json({ success: true, message: 'Broadcast sent' });
  } catch (error) {
    console.error('Error broadcasting relogin:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server (with sockets) running on port ${PORT}`);
});
