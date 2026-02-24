const params = new URLSearchParams(window.location.search);
const email = params.get('email');
if (email) {
    document.getElementById('email-field').value = email;
}

const form = document.querySelector('form');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button');
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = 'Submitting...';

    try {
        const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form)
        });

        const result = await response.json();

        if (result.success && result.redirect) {
            window.location.href = result.redirect;
        } else {
            alert('Error: ' + (result.error || 'Unknown error occurred'));
            button.disabled = false;
            button.textContent = originalText;
        }
    } catch (error) {
        alert('Network Error: ' + error.message);
        button.disabled = false;
        button.textContent = originalText;
    }
});