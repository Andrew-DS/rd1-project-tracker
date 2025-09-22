document.addEventListener('DOMContentLoaded', () => {
    const firstNameInput = document.getElementById('first-name');
    const lastNameInput = document.getElementById('last-name');
    const usernameInput = document.getElementById('username');

    function generateUsername() {
        const rawFirst = firstNameInput.value.trim().toLowerCase();
        const rawLast = lastNameInput.value.trim().toLowerCase();
        const cleanFirst = rawFirst.replace(/[^a-z0-9]/g, '');
        const cleanLast = rawLast.replace(/[^a-z0-9]/g, '');
        if (cleanFirst && cleanLast) {
            const baseUsername = cleanLast.slice(0, 6) + cleanFirst.slice(0, 2);
            usernameInput.value = baseUsername;
        }
    }

    firstNameInput.addEventListener('input', generateUsername);
    lastNameInput.addEventListener('input', generateUsername);

    const form = document.getElementById('register-form');

    if (form) {
        const btn = form.querySelector('button[type="submit"]');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('first-name').value.trim();
            const lastName = document.getElementById('last-name').value.trim();
            const email = document.getElementById('email').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!firstName || !lastName || !email || !username || !password) {
                alert('Please fill out all fields.');
                return;
            }

            const originalBtnText = btn ? btn.textContent : '';
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Registering...';
            }

            const warmupTimer = setTimeout(() => {
                if (btn && btn.textContent === 'Registering...') {
                    btn.textContent = 'Registering... (warming up database)';
                }
            }, 2000);

            try {
                const checkRes = await fetch('/CheckUserExists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email })
                });
                const checkData = await checkRes.json();
                if (checkData.exists) {
                    alert(`The ${checkData.conflict} is already in use. Please choose a different one.`);
                    return;
                }

                const res = await fetch('/Register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, firstName, lastName, email })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    alert(data.message || 'Registration failed.');
                    return;
                }

                const loginRes = await fetch('/Login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const loginData = await loginRes.json();

                if (loginRes.ok && loginData.success) {
                    const u = loginData.user || {};
                    if (u.username) sessionStorage.setItem('username', u.username);
                    sessionStorage.setItem('role', u.role || 'user');
                    if (u.email) sessionStorage.setItem('useremail', String(u.email).trim().toLowerCase());
                    setTimeout(() => { window.location.href = 'index.html'; }, 100);
                } else {
                    alert('Registration successful but auto-login failed. Please login manually.');
                }
            } catch (err) {
                console.error('Registration error:', err);
                alert('Error occurred during registration.');
            } finally {
                clearTimeout(warmupTimer);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = originalBtnText;
                }
            }
        });
    } else {
        console.error('register-form not found in the DOM.');
    }
});

document.getElementById('toggle-password')?.addEventListener('click', () => {
    const pwd = document.getElementById('password');
    const toggle = document.getElementById('toggle-password');
    const isVisible = pwd.type === 'text';
    pwd.type = isVisible ? 'password' : 'text';
    toggle.textContent = isVisible ? '👁️' : '🙈';
});