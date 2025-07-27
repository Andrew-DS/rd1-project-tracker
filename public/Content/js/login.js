const form = document.getElementById('login-form');
const btn = document.getElementById('login-btn');
const spinner = document.getElementById('login-spinner');
const messageEl = document.getElementById('login-message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        alert('Please enter both username and password.');
        return;
    }

    // UI: start loading
    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    setMessage('');

    // If it’s taking a bit, hint that SQL might be warming up
    const warmupTimer = setTimeout(() => {
        setMessage('Warming up the database… this can take a few seconds.');
    }, 2000);

    try {
        const response = await fetch('/Login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            sessionStorage.setItem('username', data.user.username);
            sessionStorage.setItem('role', data.user.role || 'user');

            // Small delay so sessionStorage is persisted before redirect
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 100);
        } else {
            const msg = data.error || 'Login failed.';
            setMessage(msg);
            alert(msg);
        }
    } catch (err) {
        console.error('Login error:', err);
        setMessage('An error occurred. Please try again.');
        alert('An error occurred. Please try again.');
    } finally {
        clearTimeout(warmupTimer);
        if (btn) btn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
    }
});

document.getElementById('toggle-password').addEventListener('click', () => {
    const pwd = document.getElementById('password');
    const toggle = document.getElementById('toggle-password');

    const isVisible = pwd.type === 'text';
    pwd.type = isVisible ? 'password' : 'text';
    toggle.textContent = isVisible ? '👁️' : '🙈';
});

function setMessage(msg) {
    if (messageEl) {
        messageEl.textContent = msg || '';
    }
}
