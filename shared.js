// shared.js - Common functions used across all pages

let config = { githubToken: '', gistId: '' };
let spiders = [];
let users = [];
let tradeRequests = [];
let gameBalance = {
    battleWinCoins: 25,
    battleWinXP: 50,
    spiderSubmitCoins: 50,
    xpPerLevel: 100
};
let currentUser = '';

function loadConfig() {
    const saved = localStorage.getItem('spiderConfig');
    if (saved) {
        config = JSON.parse(saved);
        if (document.getElementById('githubToken')) {
            document.getElementById('githubToken').value = config.githubToken;
        }
        if (document.getElementById('gistId')) {
            document.getElementById('gistId').value = config.gistId;
        }
    }

    const savedUser = localStorage.getItem('spiderUser');
    if (savedUser) {
        currentUser = savedUser;
        showUserInfo();
        if (currentUser === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.classList.remove('hidden');
        }
    }
}

function saveConfig() {
    config.githubToken = document.getElementById('githubToken').value.trim();
    config.gistId = document.getElementById('gistId').value.trim();
    localStorage.setItem('spiderConfig', JSON.stringify(config));
    showStatus('configStatus', 'Configuration saved!', 'success');
    if (config.gistId) loadData();
}

function showStatus(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `status ${type}`;
    setTimeout(() => el.className = 'status hidden', 4000);
}

function showUserInfo() {
    const loginForm = document.getElementById('loginForm');
    const userInfo = document.getElementById('userInfo');
    const displayUsername = document.getElementById('displayUsername');
    
    if (loginForm) loginForm.classList.add('hidden');
    if (userInfo) userInfo.classList.remove('hidden');
    if (displayUsername) displayUsername.textContent = currentUser;
    
    updateCoins();
}

function updateCoins() {
    const user = users.find(u => u.username === currentUser);
    const coins = user ? user.coins || 0 : 0;
    const coinsEl = document.getElementById('userCoins');
    if (coinsEl) coinsEl.textContent = `💰 ${coins} coins`;
}

function getUserCoins() {
    const user = users.find(u => u.username === currentUser);
    return user ? user.coins || 0 : 0;
}

function setUserCoins(amount) {
    const user = users.find(u => u.username === currentUser);
    if (user) {
        user.coins = amount;
        updateCoins();
    }
}

async function register() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showStatus('loginStatus', 'Enter username and password', 'error');
        return;
    }

    if (username.length < 3) {
        showStatus('loginStatus', 'Username must be at least 3 characters', 'error');
        return;
    }

    await loadData();

    if (users.find(u => u.username === username)) {
        showStatus('loginStatus', 'Username already taken!', 'error');
        return;
    }

    users.push({
        username,
        password,
        coins: 100,
        createdAt: new Date().toISOString()
    });

    if (await saveData()) {
        currentUser = username;
        localStorage.setItem('spiderUser', username);
        showUserInfo();
        showStatus('loginStatus', 'Registration successful! You start with 100 coins!', 'success');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showStatus('loginStatus', 'Enter username and password', 'error');
        return;
    }

    await loadData();

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        currentUser = username;
        localStorage.setItem('spiderUser', username);
        showUserInfo();
        showStatus('loginStatus', 'Logged in successfully!', 'success');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        
        if (currentUser === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.classList.remove('hidden');
        }
        
        if (typeof renderSpiders === 'function') renderSpiders();
    } else {
        showStatus('loginStatus', 'Invalid username or password', 'error');
    }
}

function logout() {
    if (!confirm('Are you sure you want to logout?')) return;
    
    currentUser = '';
    localStorage.removeItem('spiderUser');
    
    const loginForm = document.getElementById('loginForm');
    const userInfo = document.getElementById('userInfo');
    const adminLink = document.getElementById('adminLink');
    
    if (loginForm) loginForm.classList.remove('hidden');
    if (userInfo) userInfo.classList.add('hidden');
    if (adminLink) adminLink.classList.add('hidden');
    
    if (typeof renderSpiders === 'function') renderSpiders();
}

async function loadData() {
    if (!config.githubToken || !config.gistId) {
        console.log('No config yet');
        return;
    }

    try {
        const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
            headers: {
                'Authorization': `token ${config.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error(`Failed to load (${response.status})`);

        const data = await response.json();
        const content = JSON.parse(data.files['spider-league.json'].content);
        
        spiders = content.spiders || [];
        users = content.users || [];
        tradeRequests = content.tradeRequests || [];
        gameBalance = content.gameBalance || gameBalance;
        
        if (typeof renderSpiders === 'function') renderSpiders();
        if (typeof renderBattleList === 'function') renderBattleList();
        if (typeof updateAdminPanel === 'function') updateAdminPanel();
        
        updateCoins();
        
        console.log('Data loaded successfully');
    } catch (error) {
        console.error('Load error:', error);
    }
}

async function saveData() {
    if (!config.githubToken || !config.gistId) {
        alert('Please configure GitHub token and Gist ID first!');
        return false;
    }

    const data = {
        spiders,
        users,
        tradeRequests,
        gameBalance
    };

    try {
        const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${config.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'spider-league.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });

        if (!response.ok) throw new Error(`Failed to save (${response.status})`);
        
        return true;
    } catch (error) {
        console.error('Save error:', error);
        alert('Error saving: ' + error.message);
        return false;
    }
}
```

Now save this as `shared.js` in the same folder as your HTML files.

**Next, here are the instructions to create the other pages:**

## 📁 File Structure:
```
spider-league/
├── index.html (already created above)
├── shared.js (save the code above)
├── battle.html (I'll create this next)
├── shop.html (I'll create this next)
└── admin.html (I'll create this next)