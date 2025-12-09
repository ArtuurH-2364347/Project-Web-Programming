// BROWSER API: Geolocation API
// Shows user location on trip map

let userLocationMarker = null;

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('showMyLocationBtn');
  
  if (!btn) {
    console.error('Show My Location button not found!');
    return;
  }

  console.log('Geolocation initialized, button found');
  
  // Check if Geolocation API is supported
  if (!navigator.geolocation) {
    btn.disabled = true;
    btn.textContent = 'Geolocation not supported';
    return;
  }

  btn.addEventListener('click', showUserLocation);
});

function showUserLocation() {
  const btn = document.getElementById('showMyLocationBtn');
  const status = document.getElementById('locationStatus');
  
  // Check if map exists
  if (typeof map === 'undefined') {
    status.textContent = '❌ Map not loaded yet';
    status.className = 'ms-2 small text-danger';
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Getting location...';
  status.textContent = 'Requesting permission...';
  status.className = 'ms-2 small text-info';

  // BROWSER API: Geolocation API
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      
      console.log('Location found:', latitude, longitude);
      
      // Remove old marker if exists
      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }

      // Create custom icon for user location
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div class="user-marker-inner"><i class="bi bi-geo-alt-fill"></i></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      // Add marker to map
      userLocationMarker = L.marker([latitude, longitude], { 
        icon: userIcon,
        zIndexOffset: 1000 
      }).addTo(map);

      userLocationMarker.bindPopup(`
        <strong><i class="bi bi-person-circle"></i> Your Location</strong><br>
        <small>Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}</small>
      `).openPopup();

      // Center map on user location
      map.setView([latitude, longitude], 13);

      // Update button
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Update My Location';
      status.textContent = '✓ Location found!';
      status.className = 'ms-2 small text-success';

      // Save location to localStorage
      localStorage.setItem('lastUserLocation', JSON.stringify({
        lat: latitude,
        lng: longitude,
        timestamp: Date.now()
      }));

      // Calculate distances to activities
      calculateDistancesToActivities(latitude, longitude);
    },
    (error) => {
      console.error('Geolocation error:', error);
      
      let errorMessage = '';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location unavailable';
          break;
        case error.TIMEOUT:
          errorMessage = 'Request timeout';
          break;
        default:
          errorMessage = 'Unknown error';
      }

      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Show My Location';
      status.textContent = `✗ ${errorMessage}`;
      status.className = 'ms-2 small text-danger';
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

function calculateDistancesToActivities(userLat, userLng) {
  if (typeof window.tripActivities === 'undefined') return;

  console.log('Calculating distances to', window.tripActivities.length, 'activities');

  window.tripActivities.forEach(activity => {
    if (activity.latitude && activity.longitude) {
      const distance = calculateDistance(
        userLat, userLng, 
        activity.latitude, activity.longitude
      );
      
      // Find activity card and add distance badge
      const activityCards = document.querySelectorAll('.activity-card h6');
      activityCards.forEach(card => {
        if (card.textContent.trim().includes(activity.title)) {
          // Remove old badge if exists
          const oldBadge = card.querySelector('.distance-badge');
          if (oldBadge) oldBadge.remove();

          // Add new badge
          const badge = document.createElement('span');
          badge.className = 'badge bg-info ms-2 distance-badge';
          badge.innerHTML = `<i class="bi bi-signpost"></i> ${distance.toFixed(1)} km away`;
          card.appendChild(badge);
        }
      });
    }
  });
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Add CSS for user location marker
const style = document.createElement('style');
style.textContent = `
  .user-location-marker {
    background: transparent;
    border: none;
  }
  
  .user-marker-inner {
    position: relative;
    width: 30px;
    height: 30px;
    background: #007bff;
    border: 3px solid white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .user-marker-inner i {
    transform: rotate(45deg);
    color: white;
    font-size: 16px;
  }
  
  .user-marker-inner::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: rgba(0, 123, 255, 0.2);
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }
  
  .distance-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
`;
document.head.appendChild(style);