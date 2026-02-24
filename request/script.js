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

    try {
        const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form)
        });

        if (response.redirected) {
            window.location.href = response.url;
        } else {
            alert('Success, but no redirect set');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Submit Request';
    }
});