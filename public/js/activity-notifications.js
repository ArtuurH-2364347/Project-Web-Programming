// BROWSER API: Notification API
// Stuurt notifications 15 minuten voor elke activiteit

document.addEventListener('DOMContentLoaded', () => {
  const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
  
  if (notificationsEnabled && Notification.permission === 'granted') {
    initActivityNotifications();
  }
});

function initActivityNotifications() {
  if (typeof window.tripActivities === 'undefined') {
    console.log('No activities found');
    return;
  }

  console.log('Activity notifications initialized');
  
  checkUpcomingActivities();
  
  setInterval(checkUpcomingActivities, 60 * 1000);
}

function checkUpcomingActivities() {
  const now = new Date();
  const activities = window.tripActivities || [];
  
  activities.forEach(activity => {
    try {
      const activityDateTime = new Date(`${activity.date}T${activity.start_time}`);
      
      if (isNaN(activityDateTime.getTime())) {
        console.log('Invalid date for activity:', activity.title);
        return;
      }
      
      const timeUntilActivity = activityDateTime - now;
      const minutesUntil = Math.floor(timeUntilActivity / (60 * 1000));
      
      if (minutesUntil === 15) {
        sendActivityNotification(activity, '15 minutes');
      }
      
      if (minutesUntil === 5) {
        sendActivityNotification(activity, '5 minutes');
      }
      
      if (minutesUntil === 0 || minutesUntil === 1) {
        sendActivityStartNotification(activity);
      }
      
    } catch (error) {
      console.error('Error checking activity:', activity.title, error);
    }
  });
}

function sendActivityNotification(activity, timeUntil) {
  const notificationKey = `notif_${activity.id}_${timeUntil}`;
  if (localStorage.getItem(notificationKey)) {
    return;
  }
  
  localStorage.setItem(notificationKey, Date.now());
  cleanupOldNotificationFlags();
  
  const notification = new Notification(`Reminder: ${activity.title}`, {
    body: `Starting in ${timeUntil} at ${activity.location || 'the scheduled location'}`,
    icon: '/uploads/Placeholder_pfp.png',
    badge: '/uploads/Placeholder_pfp.png',
    tag: `activity-${activity.id}-reminder`,
    requireInteraction: false,
    silent: false
  });
  
  notification.onclick = () => {
    window.focus();
    scrollToActivity(activity.id);
    notification.close();
  };
  
  setTimeout(() => notification.close(), 30000);
  
  console.log(`Sent ${timeUntil} reminder for: ${activity.title}`);
}

function sendActivityStartNotification(activity) {
  const notificationKey = `notif_${activity.id}_starting`;
  if (localStorage.getItem(notificationKey)) {
    return;
  }
  
  localStorage.setItem(notificationKey, Date.now());
  cleanupOldNotificationFlags();
  
  const notification = new Notification(`Starting Now: ${activity.title}`, {
    body: `Your activity is starting! ${activity.location ? '📍 ' + activity.location : ''}`,
    icon: '/uploads/Placeholder_pfp.png',
    badge: '/uploads/Placeholder_pfp.png',
    tag: `activity-${activity.id}-start`,
    requireInteraction: true,
    silent: false
  });
  
  notification.onclick = () => {
    window.focus();
    scrollToActivity(activity.id);
    notification.close();
  };
  

  setTimeout(() => notification.close(), 120000);
  
  console.log(`Sent start notification for: ${activity.title}`);
}

function scrollToActivity(activityId) {
  const activityCards = document.querySelectorAll('.activity-card');
  activityCards.forEach(card => {
    const deleteBtn = card.querySelector(`form[action*="/activities/${activityId}/delete"]`);
    if (deleteBtn) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.border = '2px solid #007bff';
      setTimeout(() => {
        card.style.border = '';
      }, 3000);
    }
  });
}

function cleanupOldNotificationFlags() {
  const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('notif_')) {
      const timestamp = parseInt(localStorage.getItem(key));
      if (timestamp < twoHoursAgo) {
        localStorage.removeItem(key);
      }
    }
  });
}

window.testActivityNotifications = function() {
  if (typeof window.tripActivities === 'undefined' || window.tripActivities.length === 0) {
    console.log('No activities to test');
    return;
  }
  
  const activity = window.tripActivities[0];
  console.log('Sending test notification for:', activity.title);
  
  const notification = new Notification(`TEST: ${activity.title}`, {
    body: 'This is a test notification for activity reminders',
    icon: '/uploads/Placeholder_pfp.png'
  });
  
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
  
  setTimeout(() => notification.close(), 5000);
};