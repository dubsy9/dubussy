let csrfToken = null;

// Fetch CSRF token on page load
async function fetchCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }
}

// Get email from URL parameter
const params = new URLSearchParams(window.location.search);
const email = params.get('email');
if (email && email.length <= 254) {
    document.getElementById('email-field').value = email;
}

// Fetch CSRF token when page loads
fetchCsrfToken();

const form = document.querySelector('form');

// Input validation constants
const MAX_EMAIL_LENGTH = 254;
const MIN_EMAIL_LENGTH = 5;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate CSRF token is available
    if (!csrfToken) {
        alert('Security token not loaded. Please refresh the page.');
        return;
    }

    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Submitting...';

    // Get email from form
    const email = document.getElementById('email-field').value.trim();
    
    // Length validation
    if (email.length < MIN_EMAIL_LENGTH || email.length > MAX_EMAIL_LENGTH) {
        alert(`Email must be between ${MIN_EMAIL_LENGTH} and ${MAX_EMAIL_LENGTH} characters.`);
        button.disabled = false;
        button.textContent = 'Submit Request';
        return;
    }
    
    // Basic client-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        button.disabled = false;
        button.textContent = 'Submit Request';
        return;
    }

    const data = {
        email: email,
        csrfToken: csrfToken
    };

    try {
        const response = await fetch(form.action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            window.location.href = '/thanks';
        } else {
            // Handle specific errors
            let errorMessage = 'Something went wrong';
            
            if (result.error === 'invalid_csrf_token') {
                errorMessage = 'Security validation failed. Please refresh and try again.';
                // Refresh CSRF token on failure
                await fetchCsrfToken();
            } else if (result.error === 'rate_limit_exceeded') {
                errorMessage = `Too many requests. Please wait ${result.retryAfter || 60} seconds.`;
            } else if (result.error === 'email_required' || result.error === 'invalid_email_format') {
                errorMessage = 'Please enter a valid email address.';
            } else if (result.error === 'service_not_configured') {
                errorMessage = 'Service temporarily unavailable. Please try again later.';
            }
            
            alert('Error: ' + errorMessage);
            button.disabled = false;
            button.textContent = 'Submit Request';
        }
    } catch (error) {
        alert('Connection Error. Please check your internet or try again.');
        button.disabled = false;
        button.textContent = 'Submit Request';
    }
});