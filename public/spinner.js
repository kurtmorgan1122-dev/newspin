// Detect if running on 0.0.0.0 or production
const API_URL = window.location.hostname === '0.0.0.0' || window.location.hostname === '127.0.0.1'
    ? 'http://0.0.0.0:3000/api'
    : `${window.location.origin}/api`;

let currentStaff = null;

// Load departments on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadDepartments();
    setupEventListeners();
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
    const nameInput = document.getElementById('nameInput');
    const loginBtn = document.getElementById('loginBtn');
    const readyBtn = document.getElementById('readyBtn');
    const spinner = document.getElementById('spinner');
    const logoutBtn = document.getElementById('logoutBtn');

    // Name input with suggestions
    nameInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            document.getElementById('nameSuggestions').style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`${API_URL}/search-names?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            const suggestionsDiv = document.getElementById('nameSuggestions');
            suggestionsDiv.innerHTML = '';
            
            if (data.names.length > 0) {
                data.names.forEach(name => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.textContent = name;
                    div.onclick = () => {
                        nameInput.value = name;
                        suggestionsDiv.style.display = 'none';
                    };
                    suggestionsDiv.appendChild(div);
                });
                suggestionsDiv.style.display = 'block';
            } else {
                suggestionsDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Error searching names:', error);
        }
    });

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.form-group')) {
            document.getElementById('nameSuggestions').style.display = 'none';
        }
    });

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
    const name = document.getElementById('nameInput').value.trim();
    const department = document.getElementById('departmentSelect').value;
    const errorElement = document.getElementById('loginError');

    if (!name || !department) {
        errorElement.textContent = 'Please enter your name and select your department';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, department })
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
    
    // Calculate random rotations (total spin will now be 10 seconds)
    // Make it "super super fast" by increasing base rotations
    const baseRotations = 300; // Much faster base rotations
    const randomExtra = Math.floor(Math.random() * 200); // Extra random rotations for variety
    const totalRotations = baseRotations + randomExtra;
    const degrees = totalRotations * 360;

    spinner.classList.add('spinning');
    // Use a transform transition so we rotate by many degrees (multiple revolutions)
    // This ensures the wheel actually spins `totalRotations` times over 10s.
    wheel.style.animation = 'none';
    wheel.style.transition = `transform 10s cubic-bezier(0.33, 0.02, 0.67, 0.98)`;
    // Apply the large rotation target (many revolutions)
    wheel.style.transform = `rotate(${degrees}deg)`;

    // Show anticipation text near the end (3s before finish)
    setTimeout(() => {
        anticipateText.textContent = '✨ Anticipate... ✨';
        anticipateText.classList.remove('hidden');
    }, 7000);

    // Get the spin result from server
    try {
        const response = await fetch(`${API_URL}/spin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId: currentStaff._id })
        });

        const data = await response.json();

        if (data.success) {
            // Wait for spin to complete (10s), then show result
            setTimeout(() => {
                spinner.classList.remove('spinning');
                // clear transition so subsequent spins start clean
                wheel.style.transition = '';
                anticipateText.classList.add('hidden');
                showResult(data.spinResult);
            }, 10000);
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

function showResult(name) {
    document.getElementById('resultName').textContent = name;
    document.getElementById('resultOverlay').classList.remove('hidden');
}