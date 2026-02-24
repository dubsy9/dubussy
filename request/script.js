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

        const result = await response.json();

        if (response.ok && result.success) {
            // Manually move the user to the thanks page
            window.location.href = '/thanks'; 
        } else {
            alert('Error: ' + (result.error || 'Something went wrong'));
            button.disabled = false;
            button.textContent = 'Submit Request';
        }
    } catch (error) {
        alert('Network Error: ' + error.message);
        button.disabled = false;
        button.textContent = 'Submit Request';
    }
});
