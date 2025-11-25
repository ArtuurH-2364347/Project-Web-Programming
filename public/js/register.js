(function(){
  const togglePassword = document.querySelector('#togglePassword');
  const password = document.querySelector('#password');
  const confirmPassword = document.querySelector('#confirmPassword');
  const eyeIcon = document.querySelector('#eyeIcon');
  const form = document.querySelector('#registerForm');

  // Toggle password zichtbaarheid
  if (togglePassword && password && eyeIcon) {
    togglePassword.addEventListener('click', () => {
      const type = password.type === 'password' ? 'text' : 'password';
      password.type = type;
      if (confirmPassword) confirmPassword.type = type;

      eyeIcon.classList.toggle('bi-eye');
      eyeIcon.classList.toggle('bi-eye-slash');
    });
  }

  // password validate
  if (form && password && confirmPassword) {
    form.addEventListener('submit', (e) => {
      if (password.value !== confirmPassword.value) {
        e.preventDefault();
        alert("Passwords do not match!");
        confirmPassword.focus();
      }
    });
  }
})();