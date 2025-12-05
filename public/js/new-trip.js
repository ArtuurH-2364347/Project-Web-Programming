const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');

startDateInput.addEventListener('change', () => {
  endDateInput.min = startDateInput.value;
  if (endDateInput.value && endDateInput.value < startDateInput.value) {
    endDateInput.value = startDateInput.value;
  }
});