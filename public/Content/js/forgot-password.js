document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const messageDiv = document.getElementById('forgot-password-message');

    messageDiv.textContent = ''; // Clear previous message

    if (!email) {
        messageDiv.textContent = 'Please enter a valid email address.';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (response.ok) {
            messageDiv.style.color = 'green';
            messageDiv.textContent = result.message || 'If your email exists, a reset link has been sent.';
        } else {
            messageDiv.style.color = 'red';
            messageDiv.textContent = result.error || 'Error processing request.';
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Something went wrong. Please try again later.';
    }
});