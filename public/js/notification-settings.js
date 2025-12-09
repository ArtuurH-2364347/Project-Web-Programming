// BROWSER API: Notification API + LocalStorage

document.addEventListener('DOMContentLoaded', () => {
  initNotificationSettings();
});

function initNotificationSettings() {
  const toggle = document.getElementById('notificationsToggle');
  const statusDiv = document.getElementById('notificationStatus');
  const statusMessage = document.getElementById('statusMessage');
  const testBtn = document.getElementById('testNotificationBtn');
  const testStatus = document.getElementById('testStatus');

  console.log('Init notification settings', {toggle, statusDiv, testBtn}); // Debug

  if (!toggle) {
    console.error('Toggle not found!');
    return;
  }

  // Check browser support
  if (!('Notification' in window)) {
    showStatus('Browser notifications not supported', 'warning');
    toggle.disabled = true;
    return;
  }

  // Load saved preference
  const savedPref = localStorage.getItem('notificationsEnabled');
  toggle.checked = savedPref === 'true';
  console.log('Loaded preference:', savedPref);

  // Toggle event
  toggle.addEventListener('change', async function() {
    console.log('Toggle changed to:', this.checked);
    
    if (this.checked) {
      // Request permission
      const permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
      
      if (permission === 'granted') {
        localStorage.setItem('notificationsEnabled', 'true');
        showStatus('✅ Notifications enabled!', 'success');
        
        // Send welcome notification
        new Notification('Notifications Enabled!', {
          body: 'You will receive reminders 15 minutes before activities',
          icon: '/uploads/Placeholder_pfp.png'
        });
      } else {
        this.checked = false;
        localStorage.setItem('notificationsEnabled', 'false');
        showStatus('Permission denied. Check browser settings.', 'danger');
      }
    } else {
      localStorage.setItem('notificationsEnabled', 'false');
      showStatus('Notifications disabled', 'info');
    }
  });

  // Test button
  if (testBtn) {
    testBtn.addEventListener('click', function() {
      console.log('Test button clicked');
      
      if (Notification.permission === 'granted') {
        new Notification('Test Notification', {
          body: 'Activity reminders are working!',
          icon: '/uploads/Placeholder_pfp.png'
        });
        testStatus.textContent = 'Sent!';
        testStatus.className = 'ms-2 small text-success';
        setTimeout(() => {
          testStatus.textContent = '';
        }, 3000);
      } else {
        testStatus.textContent = 'Enable notifications first';
        testStatus.className = 'ms-2 small text-danger';
      }
    });
  }

  function showStatus(message, type) {
    if (!statusDiv || !statusMessage) return;
    statusDiv.style.display = 'block';
    statusDiv.className = `alert alert-${type}`;
    statusMessage.textContent = message;
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 4000);
  }
}