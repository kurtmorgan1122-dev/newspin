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
  name: { type: String, required: true, uppercase: true },
  department: { type: String, required: true },
  group: { type: String, required: true }, // dairies, swan, snacks1, snacks2
  hasSpun: { type: Boolean, default: false },
  spinResult: { type: String, default: null },
  spinResultGroup: { type: String, default: null },
  giftShared: { type: String, default: 'No' },
  hasBeenSpun: { type: Boolean, default: false }
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

      if (!nameValue || !deptValue) {
        console.log('Missing data in row:', row);
        return null;
      }

      return {
        name: String(nameValue).toUpperCase().trim(),
        department: String(deptValue).trim(),
        group: group
      };
    }).filter(item => item !== null); // Remove any null entries

    // Remove duplicates and insert
    let successCount = 0;
    for (const staff of staffData) {
      if (staff && staff.name && staff.department) {
        await Staff.findOneAndUpdate(
          { name: staff.name, department: staff.department },
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

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { name, department } = req.body;
    const staff = await Staff.findOne({ 
      name: name.toUpperCase().trim(), 
      department: department 
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found in this department' });
    }

    if (staff.hasSpun) {
      return res.status(400).json({ success: false, message: 'You have already spun!' });
    }

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

// Spin endpoint
app.post('/api/spin', async (req, res) => {
  try {
    const { staffId } = req.body;
    
    const spinner = await Staff.findById(staffId);
    if (!spinner) {
      return res.status(404).json({ success: false, message: 'Staff not found in this department' });
    }

    if (spinner.hasSpun) {
      return res.status(400).json({ success: false, message: 'Already spun' });
    }

    // Get available staff in the SAME GROUP (not yet spun by anyone)
    const availableStaff = await Staff.find({ 
      hasBeenSpun: false,
      group: spinner.group, // Only same group
      _id: { $ne: staffId } // Exclude self
    });

    if (availableStaff.length === 0) {
      return res.status(400).json({ success: false, message: 'No available staff in your group to spin' });
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
      spinResult: spunStaff.name 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Get all staff
app.get('/api/admin/staff', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const skip = (page - 1) * limit;

    const total = await Staff.countDocuments({ hasSpun: true });
    const staff = await Staff.find({ hasSpun: true })
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 });

    res.json({ 
      success: true, 
      staff, 
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server (with sockets) running on port ${PORT}`);
});