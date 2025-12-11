// Detect if running on 0.0.0.0 or production
const API_URL = window.location.hostname === '0.0.0.0' || window.location.hostname === '127.0.0.1'
    ? 'http://0.0.0.0:3000/api'
    : `${window.location.origin}/api`;

let currentPage = 1;
let totalPages = 1;

// Load data on page load
window.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadStaffTable();
    restoreStaffManagementSectionState();
    
    // Add search input listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            loadStaffTable(1, query);
        });
    }
});

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalStaff').textContent = data.stats.totalStaff;
            document.getElementById('spunCount').textContent = data.stats.spunCount;
            document.getElementById('giftsShared').textContent = data.stats.giftsShared;
            document.getElementById('remaining').textContent = data.stats.remaining;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadStaffTable(page = 1, search = '') {
    try {
        const params = new URLSearchParams({ page, search });
        const response = await fetch(`${API_URL}/admin/staff?${params}`);
        const data = await response.json();
        
        if (data.success) {
            currentPage = data.currentPage;
            totalPages = data.pages;
            
            const tbody = document.getElementById('staffTableBody');
            tbody.innerHTML = '';
            
            if (data.staff.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data">No spin records yet</td></tr>';
            } else {
                data.staff.forEach((staff, index) => {
                    const row = document.createElement('tr');
                    const serialNumber = (currentPage - 1) * 25 + index + 1;
                    
                    row.innerHTML = `
                        <td>${serialNumber}</td>
                        <td>${staff.name}</td>
                        <td>${staff.department || 'N/A'}</td>
                        <td>${staff.spinResult || 'N/A'}</td>
                        <td>${staff.spinResultDept || 'N/A'}</td>
                        <td>${formatGroup(staff.spinResultGroup)}</td>
                        <td>
                            <select class="gift-status-select" 
                                    onchange="updateGiftStatus('${staff._id}', this.value)">
                                <option value="No" ${staff.giftShared === 'No' ? 'selected' : ''}>No</option>
                                <option value="Yes" ${staff.giftShared === 'Yes' ? 'selected' : ''}>Yes</option>
                            </select>
                        </td>
                        <td>
                            <button class="btn-reset" disabled style="opacity: 0.5; cursor: not-allowed;">
                                Reset
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
            
            updatePaginationControls();
        }
    } catch (error) {
        console.error('Error loading staff table:', error);
    }
}

function formatGroup(group) {
    if (!group) return 'N/A';
    const groupMap = {
        'dairies': 'Dairies Plant',
        'swan': 'Swan Plant',
        'snacks1': 'Snacks Group 1',
        'snacks2': 'Snacks Group 2'
    };
    return groupMap[group] || group;
}

function updatePaginationControls() {
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

function changePage(direction) {
    const newPage = currentPage + direction;
    const searchInput = document.getElementById('searchInput');
    const query = searchInput ? searchInput.value.trim() : '';
    if (newPage >= 1 && newPage <= totalPages) {
        loadStaffTable(newPage, query);
    }
}

async function updateGiftStatus(staffId, status) {
    try {
        const response = await fetch(`${API_URL}/admin/gift-status/${staffId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ giftShared: status })
        });

        const data = await response.json();
        
        if (data.success) {
            loadStats(); // Refresh stats
        } else {
            alert('Error updating gift status');
        }
    } catch (error) {
        console.error('Error updating gift status:', error);
        alert('Connection error. Please try again.');
    }
}

async function uploadFile(group) {
    const fileInput = document.getElementById(`${group}File`);
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file first');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const uploadMessage = document.getElementById('uploadMessage');
        uploadMessage.textContent = 'Uploading...';
        uploadMessage.style.color = '#667eea';

        const response = await fetch(`${API_URL}/upload/${group}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            uploadMessage.textContent = data.message;
            uploadMessage.style.color = '#165b33';
            fileInput.value = '';
            
            // Refresh stats and table
            loadStats();
            loadStaffTable();
        } else {
            uploadMessage.textContent = `Error: ${data.message}`;
            uploadMessage.style.color = '#c41e3a';
        }
    } catch (error) {
        console.error('Upload error:', error);
        document.getElementById('uploadMessage').textContent = 'Upload failed. Please try again.';
        document.getElementById('uploadMessage').style.color = '#c41e3a';
    }
}

// Toggle upload section collapse
function toggleStaffManagementSection() {
    const content = document.getElementById('staffManagementContent');
    const icon = document.getElementById('staffManagementCollapseIcon');
    
    content.classList.toggle('collapsed');
    icon.classList.toggle('collapsed');
    
    // Save state to localStorage
    const isCollapsed = content.classList.contains('collapsed');
    localStorage.setItem('staffManagementSectionCollapsed', isCollapsed);
}

// Restore collapse state on page load
function restoreStaffManagementSectionState() {
    const isCollapsed = localStorage.getItem('staffManagementSectionCollapsed') === 'true';
    
    if (isCollapsed) {
        const content = document.getElementById('staffManagementContent');
        const icon = document.getElementById('staffManagementCollapseIcon');
        
        content.classList.add('collapsed');
        icon.classList.add('collapsed');
    }
}

// Generate one-time ID for staff without Employee ID
async function generateOneTimeId() {
    const name = document.getElementById('staffNameInput').value.trim();
    const department = document.getElementById('staffDepartmentInput').value.trim();
    const group = document.getElementById('staffGroupSelect').value;
    const message = document.getElementById('generateIdMessage');
    const card = document.getElementById('generatedIdCard');
    const idDisplay = document.getElementById('generatedIdDisplay');

    if (!name || !department || !group) {
        message.textContent = 'Please fill in all fields';
        message.style.color = '#c41e3a';
        card.style.display = 'none';
        return;
    }

    try {
        message.textContent = 'Generating ID...';
        message.style.color = '#667eea';

        const response = await fetch(`${API_URL}/admin/generate-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, department, group })
        });

        const data = await response.json();

        if (data.success) {
            message.textContent = 'One-Time ID generated successfully!';
            message.style.color = '#165b33';
            idDisplay.textContent = data.oneTimeId;
            card.style.display = 'block';
            
            // Clear inputs
            document.getElementById('staffNameInput').value = '';
            document.getElementById('staffDepartmentInput').value = '';
            document.getElementById('staffGroupSelect').value = '';
            
            // Refresh stats
            loadStats();
        } else {
            message.textContent = `Error: ${data.message}`;
            message.style.color = '#c41e3a';
            card.style.display = 'none';
        }
    } catch (error) {
        console.error('Generate ID error:', error);
        message.textContent = 'Connection error. Please try again.';
        message.style.color = '#c41e3a';
        card.style.display = 'none';
    }
}

// Restore collapse state on page load
function restoreUploadSectionState() {
    const isCollapsed = localStorage.getItem('uploadSectionCollapsed') === 'true';
    
    if (isCollapsed) {
        const content = document.getElementById('uploadContent');
        const icon = document.getElementById('uploadCollapseIcon');
        
        content.classList.add('collapsed');
        icon.classList.add('collapsed');
    }
}

// Restore generate ID section state on page load
function restoreGenerateIdSectionState() {
    const isCollapsed = localStorage.getItem('generateIdSectionCollapsed') === 'true';
    
    if (isCollapsed) {
        const content = document.getElementById('generateIdContent');
        const icon = document.getElementById('generateIdCollapseIcon');
        
        content.classList.add('collapsed');
        icon.classList.add('collapsed');
    }
}

// Reset spin for a user
async function resetSpin(spinnerId, spunName) {
    if (!confirm('Are you sure you want to reset this spin? This will allow both users to spin again.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/reset-spin/${spinnerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spunName })
        });

        const data = await response.json();

        if (data.success) {
            alert('Spin reset successfully!');
            loadStats();
            loadStaffTable(currentPage);
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Reset error:', error);
        alert('Connection error. Please try again.');
    }
}

// Socket listener: refresh admin view when a spin completes
if (window.__io) {
    window.__io.on('spinComplete', (data) => {
        console.log('Received spinComplete:', data);
        // Refresh stats and current table page
        loadStats();
        // Reload the current page to include the newly completed spin
        loadStaffTable(currentPage);
    });
} else {
    // Try to connect if socket wasn't created in HTML
    try {
        const socket = io();
        socket.on('spinComplete', (data) => {
            console.log('Received spinComplete (fallback):', data);
            loadStats();
            loadStaffTable(currentPage);
        });
    } catch (e) {
        console.warn('Socket.IO not available for admin real-time updates');
    }
}