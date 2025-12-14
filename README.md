# UFL Christmas Secret Santa Spinner 🎄🎅

A beautiful and interactive Christmas Secret Santa spinner application for UFL's Christmas celebration.

## Features

- 🎁 Beautiful animated spinner with Christmas theme
- 👥 Bulk staff upload via Excel files
- 🔐 Secure login system with name suggestions
- 📊 Admin dashboard with real-time statistics
- 🎯 One-time spin per person
- 📋 Gift tracking system
- 📱 Fully responsive design

## Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account (already configured)
- Modern web browser

## Installation

1. **Create project folder structure:**
```
ufl-spinner/
├── server.js
├── package.json
├── public/
│   ├── spinner.html
│   ├── admin.html
│   ├── style.css
│   ├── spinner.js
│   ├── admin.js
│   └── uac-picture.png (your company logo)
```

2. **Install dependencies:**
```bash
npm install
```

3. **Add your company logo:**
   - Place your `uac-picture.png` file in the `public/` folder

4. **Start the server:**
```bash
npm start
```

5. **Access the application:**
   - Spinner page: `http://0.0.0.0:3000/spinner.html`
   - Admin portal: `http://0.0.0.0:3000/admin.html`
   - Remind Me portal: `http://0.0.0.0:3000/RemindMe.html`

## Excel File Format

Your Excel files should have these columns:
- **S/N** - Serial number
- **Name (Surname First)** - Full name in UPPERCASE
- **Department** - Department name

Example:
| S/N | Name (Surname First) | Department |
|-----|---------------------|------------|
| 1   | DOE JOHN           | IT         |
| 2   | SMITH JANE         | HR         |

## Admin Portal Usage

1. **Upload Staff Data:**
   - Select Excel file for each plant group
   - Click the upload button for the respective group
   - Four groups: Dairies, Swan, Snacks Group 1, Snacks Group 2

2. **Monitor Spins:**
   - View all completed spins in the table
   - Track gift sharing status
   - Use pagination to navigate through records

3. **Update Gift Status:**
   - Use dropdown in the table to mark gifts as shared
   - Statistics update automatically

## Spinner Page Usage

1. **Login:**
   - Type your name (autocomplete suggestions appear)
   - Select your department from dropdown
   - Click "Let's Go!"

2. **Spin:**
   - Click "Yes, I'm Ready!" when prompted
   - Click the spinner to start
   - Wait 15 seconds for the result
   - View your Secret Santa match

3. **One-Time Use:**
   - Each person can only spin once
   - Each name can only be spun once
   - Logout after viewing result

## Technical Details

- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas
- **Frontend:** HTML, CSS, JavaScript
- **Excel Processing:** xlsx library
- **File Upload:** multer

## Security Notes

- Names are stored in UPPERCASE for consistency
- Login validation against database
- One spin per person enforcement
- No duplicate spin results

## Troubleshooting

**"Staff not found in this department" error:**
- Ensure name is spelled exactly as uploaded
- Check department matches database entry
- Names are case-insensitive during search

**Upload fails:**
- Verify Excel file format matches template
- Check file is .xlsx or .xls format
- Ensure all required columns are present

**Spinner not loading:**
- Check MongoDB connection
- Verify all dependencies installed
- Check browser console for errors

## Support

For issues or questions, contact your IT administrator.

## Credits

Created for UFL Christmas Celebration 2025 🎄