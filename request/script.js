const params = new URLSearchParams(window.location.search);
const email = params.get('email');
if (email) {
    document.getElementById('email-field').value = email;
}

const form = document.querySelector('form');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Submitting...';

    // Convert FormData to a standard object
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

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
            alert('Error: ' + (result.error || 'Something went wrong'));
            button.disabled = false;
            button.textContent = 'Submit Request';
        }
    } catch (error) {
        alert('Connection Error. Please check your internet or try again.');
        button.disabled = false;
        button.textContent = 'Submit Request';
    }
});
