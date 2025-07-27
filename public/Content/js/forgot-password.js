document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    const messageDiv = document.getElementById('forgot-password-message');

    messageDiv.textContent = '';

    if (!username || !newPassword) {
        messageDiv.textContent = 'Please enter both username and new password.';
        messageDiv.style.color = 'red';
        return;
    }

    try {
        const response = await fetch('/ResetPassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, newPassword })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            messageDiv.style.color = 'green';
            messageDiv.textContent = 'Password reset successfully. You can now log in.';
        } else {
            messageDiv.style.color = 'red';
            messageDiv.textContent = result.error || 'Password reset failed.';
        }
    } catch (err) {
        console.error('Error:', err);
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'An error occurred. Please try again.';
    }
});

document.getElementById('toggle-password').addEventListener('click', () => {
    const pwd = document.getElementById('new-password');
    const toggle = document.getElementById('toggle-password');
    const isVisible = pwd.type === 'text';
    pwd.type = isVisible ? 'password' : 'text';
    toggle.textContent = isVisible ? '👁️' : '🙈';
});
