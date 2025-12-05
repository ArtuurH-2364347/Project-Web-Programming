document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const success = urlParams.get('success');
  const overlay = document.querySelector('.overlay');
  
  if (error) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show';
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
      ${error}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    overlay.insertBefore(alert, overlay.firstChild);
  }
  
  if (success) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show';
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
      ${success}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    overlay.insertBefore(alert, overlay.firstChild);
  }

  if (error || success) {
    const cleanUrl = window.location.pathname + (window.location.search.includes('search=') ? window.location.search : '');
    window.history.replaceState({}, document.title, cleanUrl);
  }
});