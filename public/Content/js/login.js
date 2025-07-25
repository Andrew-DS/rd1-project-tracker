﻿document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        alert('Please enter both username and password.');
        return;
    }

    try {
        const response = await fetch('/Login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            sessionStorage.setItem('username', data.user.username);
            sessionStorage.setItem('role', data.user.role || 'user');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 100); // let sessionStorage flush
        } else {
            alert(data.error || 'Login failed.');
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('An error occurred. Please try again.');
    }
});
document.getElementById('toggle-password').addEventListener('click', () => {
    const pwd = document.getElementById('password');
    const toggle = document.getElementById('toggle-password');

    const isVisible = pwd.type === 'text';
    pwd.type = isVisible ? 'password' : 'text';
    toggle.textContent = isVisible ? '👁️' : '🙈'; // optional: change icon
});