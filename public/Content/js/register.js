document.addEventListener('DOMContentLoaded', () => {
    const firstNameInput = document.getElementById('first-name');
    const lastNameInput = document.getElementById('last-name');
    const usernameInput = document.getElementById('username');

    function generateUsername() {
        const rawFirst = firstNameInput.value.trim().toLowerCase();
        const rawLast = lastNameInput.value.trim().toLowerCase();

        // Remove special characters before slicing
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
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = firstNameInput.value.trim();
            const lastName = lastNameInput.value.trim();
            const email = document.getElementById('email').value.trim();
            const username = usernameInput.value.trim();
            const password = document.getElementById('password').value;

            if (!firstName || !lastName || !email || !username || !password) {
                alert('Please fill out all fields.');
                return;
            }

            // Check for existing username/email
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

            try {
                const res = await fetch('/Register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, firstName, lastName, email })
                });

                const data = await res.json();
                if (!data.success) {
                    alert(data.message || 'Registration failed.');
                    return;
                }

                // Auto-login
                const loginRes = await fetch('/Login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })

                });

                const loginData = await loginRes.json();
                if (loginData.success) {
                    window.location.href = 'index.html';
                } else {
                    alert('Registration successful but auto-login failed. Please login manually.');
                }

            } catch (err) {
                console.error('Registration error:', err);
                alert('Error occurred during registration.');
            }
        });
    } else {
        console.error('register-form not found in the DOM.');
    }
});
document.getElementById('toggle-password').addEventListener('click', () => {
    const pwd = document.getElementById('password');
    const toggle = document.getElementById('toggle-password');

    const isVisible = pwd.type === 'text';
    pwd.type = isVisible ? 'password' : 'text';
    toggle.textContent = isVisible ? '👁️' : '🙈'; // optional: change icon
});