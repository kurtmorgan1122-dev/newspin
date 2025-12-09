// Detect if running on 0.0.0.0 or production
const API_URL = window.location.hostname === '0.0.0.0' || window.location.hostname === '127.0.0.1'
    ? 'http://0.0.0.0:3000/api'
    : `${window.location.origin}/api`;

let currentStaff = null;

// Load departments on page load
window.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    // Show how-to overlay on login screen each time the page loads
    const howtoOverlay = document.getElementById('howtoOverlay');
    if (howtoOverlay) howtoOverlay.classList.remove('hidden');
});

async function loadDepartments() {
    try {
        const response = await fetch(`${API_URL}/departments`);
        const data = await response.json();
        
        const select = document.getElementById('departmentSelect');
        data.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

function setupEventListeners() {
    const employeeIdInput = document.getElementById('employeeIdInput');
    const nameInput = document.getElementById('nameInput');
    const departmentInput = document.getElementById('departmentInput');
    const loginBtn = document.getElementById('loginBtn');
    const readyBtn = document.getElementById('readyBtn');
    const spinner = document.getElementById('spinner');
    const logoutBtn = document.getElementById('logoutBtn');
    const errorElement = document.getElementById('loginError');

    // Employee ID input with instant auto-fill on input (not blur)
    employeeIdInput.addEventListener('input', async (e) => {
        const employeeId = e.target.value.trim();
        
        if (!employeeId) {
            nameInput.value = '';
            departmentInput.value = '';
            errorElement.textContent = '';
            return;
        }

        try {
            const response = await fetch(`${API_URL}/lookup-employee/${encodeURIComponent(employeeId)}`);
            const data = await response.json();

            if (data.success) {
                nameInput.value = data.name;
                departmentInput.value = data.department;
                errorElement.textContent = '';
            } else {
                nameInput.value = '';
                departmentInput.value = '';
                errorElement.textContent = data.message || 'Employee ID not found';
            }
        } catch (error) {
            console.error('Error looking up employee:', error);
            errorElement.textContent = 'Error looking up Employee ID';
        }
    });

    // Name input with suggestions (deprecated, kept for reference)
    nameInput.addEventListener('input', async (e) => {
        // Auto-filled field, no suggestions needed
    });

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.form-group')) {
            const suggestionsDivs = document.querySelectorAll('.suggestions');
            suggestionsDivs.forEach(div => div.style.display = 'none');
        }
    });

    // How-to overlay close button
    const howtoClose = document.getElementById('howtoClose');
    if (howtoClose) {
        howtoClose.addEventListener('click', (e) => {
            const overlay = document.getElementById('howtoOverlay');
            if (overlay) overlay.style.display = 'none';
        });
    }

    // Login button
    loginBtn.addEventListener('click', handleLogin);

    // Ready button
    readyBtn.addEventListener('click', () => {
        document.getElementById('readyOverlay').classList.add('hidden');
        document.getElementById('spinnerSection').classList.remove('hidden');
        document.getElementById('welcomeText').textContent = 
            `Welcome ${currentStaff.name}! Click the spinner to discover your Secret Santa match! 🎁`;
    });

    // Spinner click
    spinner.addEventListener('click', handleSpin);

    // Logout button
    logoutBtn.addEventListener('click', () => {
        location.reload();
    });
}

async function handleLogin() {
    const employeeId = document.getElementById('employeeIdInput').value.trim();
    const name = document.getElementById('nameInput').value.trim();
    const department = document.getElementById('departmentInput').value.trim();
    const errorElement = document.getElementById('loginError');

    if (!employeeId || !name || !department) {
        errorElement.textContent = 'Please enter your Employee ID and verify auto-filled fields';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId })
        });

        const data = await response.json();

        if (data.success) {
            currentStaff = data.staff;
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('readyOverlay').classList.remove('hidden');
        } else {
            errorElement.textContent = data.message;
        }
    } catch (error) {
        errorElement.textContent = 'Connection error. Please try again.';
        console.error('Login error:', error);
    }
}

let isSpinning = false;

async function handleSpin() {
    if (isSpinning) return;
    
    isSpinning = true;
    const spinner = document.getElementById('spinner');
    const wheel = spinner.querySelector('.spinner-wheel');
    const statusText = document.getElementById('statusText');
    const anticipateText = document.getElementById('anticipateText');

    statusText.textContent = 'Spinning... 🎄';
    
    // Fast spin for 6 seconds, then slow down for 4 seconds
    const baseRotations = 200; // Fast rotations for first 6 seconds
    const randomExtra = Math.floor(Math.random() * 100);
    const fastRotations = baseRotations + randomExtra;
    const fastDegrees = fastRotations * 360;

    spinner.classList.add('spinning');
    wheel.style.animation = 'none';
    
    // First phase: Fast spin for 6 seconds
    wheel.style.transition = `transform 6s cubic-bezier(0.33, 0.02, 0.67, 0.98)`;
    wheel.style.transform = `rotate(${fastDegrees}deg)`;

    // Show anticipation text near the end of fast spin (at 5s)
    setTimeout(() => {
        anticipateText.textContent = '✨ Anticipate... ✨';
        anticipateText.classList.remove('hidden');
    }, 5000);

    // Get the spin result from server
    try {
        const response = await fetch(`${API_URL}/spin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId: currentStaff._id })
        });

        const data = await response.json();

        if (data.success) {
            // After 6 seconds of fast spin, add 4 seconds of slow spin
            setTimeout(() => {
                // Add more rotations for the slow final phase
                const slowRotations = 20; // Just a few rotations in the slow phase
                const slowDegrees = fastDegrees + (slowRotations * 360);
                
                // Slow spin for 4 seconds with easing in
                wheel.style.transition = `transform 4s cubic-bezier(0.17, 0.67, 0.83, 0.67)`;
                wheel.style.transform = `rotate(${slowDegrees}deg)`;
                
                statusText.textContent = 'Almost there... 🎁';
            }, 6000);

            // Use computed total spin time (6s fast + 4s slow)
            const totalSpinTime = 10000;

            // Show suspense overlay 2 seconds after spinning has completed
            setTimeout(() => {
                spinner.classList.remove('spinning');
                wheel.style.transition = '';
                anticipateText.classList.add('hidden');

                // Show suspense overlay with Santa and "Guess Who You Spun"
                const suspenseOverlay = document.getElementById('suspenseOverlay');
                suspenseOverlay.classList.remove('hidden');
            }, totalSpinTime + 2000);

            // After 3 more seconds (15s total from spin start), show final result
            setTimeout(() => {
                const suspenseOverlay = document.getElementById('suspenseOverlay');
                suspenseOverlay.classList.add('hidden');
                showResult(data.spinResult);
            }, totalSpinTime + 5000);
        } else {
            alert(data.message);
            isSpinning = false;
            spinner.classList.remove('spinning');
            anticipateText.classList.add('hidden');
        }
    } catch (error) {
        alert('Connection error. Please try again.');
        isSpinning = false;
        spinner.classList.remove('spinning');
        anticipateText.classList.add('hidden');
        console.error('Spin error:', error);
    }
}

function showResult(spinResult) {
    document.getElementById('resultName').textContent = spinResult.name;
    document.getElementById('resultDepartment').textContent = `Department: ${spinResult.department}`;
    document.getElementById('resultGroup').textContent = `Group: ${spinResult.group}`;
    const resultOverlay = document.getElementById('resultOverlay');
    resultOverlay.classList.remove('hidden');
    const resultCard = resultOverlay.querySelector('.result-card');
    resultCard.classList.add('zoom-in');
    isSpinning = false; // Reset spinning flag
}
