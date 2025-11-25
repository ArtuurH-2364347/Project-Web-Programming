// Locatie autocomplete
const locationInput = document.getElementById('location');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const suggestionsDiv = document.getElementById('location-suggestions');
let debounceTimer;

locationInput.addEventListener('input', function(e) {
  const query = e.target.value.trim();
  clearTimeout(debounceTimer);
  
  if (query.length < 3) {
    suggestionsDiv.style.display = 'none';
    return;
  }
  
  debounceTimer = setTimeout(() => fetchLocations(query), 300);
});

async function fetchLocations(query) {
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
    const data = await response.json();
    displaySuggestions(data.features);
  } catch (error) {
    console.error('Error fetching locations:', error);
    suggestionsDiv.style.display = 'none';
  }
}

function displaySuggestions(features) {
  if (!features || features.length === 0) {
    suggestionsDiv.style.display = 'none';
    return;
  }
  
  suggestionsDiv.innerHTML = '';
  
  features.forEach(feature => {
    const props = feature.properties;
    const coords = feature.geometry.coordinates;
    const item = document.createElement('div');
    item.className = 'list-group-item';
    
    let locationName = props.name || '';
    let locationDetails = [];
    
    if (props.city) locationDetails.push(props.city);
    if (props.state) locationDetails.push(props.state);
    if (props.country) locationDetails.push(props.country);
    
    item.innerHTML = `
      <div class="location-name">${locationName}</div>
      <div class="location-details">${locationDetails.join(', ')}</div>
    `;
    
    item.addEventListener('click', () => {
      const fullLocation = locationName + (locationDetails.length > 0 ? ', ' + locationDetails.join(', ') : '');
      locationInput.value = fullLocation;
      longitudeInput.value = coords[0];
      latitudeInput.value = coords[1];
      suggestionsDiv.style.display = 'none';
    });
    
    suggestionsDiv.appendChild(item);
  });
  
  suggestionsDiv.style.display = 'block';
}

document.addEventListener('click', function(e) {
  if (!locationInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
    suggestionsDiv.style.display = 'none';
  }
});

document.querySelector('.add-activity-form form').addEventListener('submit', function() {
  suggestionsDiv.style.display = 'none';
});

// Map initieren
function initializeMap(activities) {
  const locatedActivities = activities.filter(a => a.latitude && a.longitude);
  
  if (locatedActivities.length > 0) {
    const map = L.map('trip-map').setView([locatedActivities[0].latitude, locatedActivities[0].longitude], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    
    const bounds = [];
    locatedActivities.forEach(activity => {
      const marker = L.marker([activity.latitude, activity.longitude]).addTo(map);
      
      const popupContent = `
        <strong>${activity.title}</strong><br>
        ${activity.location ? activity.location + '<br>' : ''}
        ${new Date(activity.date).toLocaleDateString()}<br>
        ${activity.start_time} - ${activity.end_time}
      `;
      
      marker.bindPopup(popupContent);
      bounds.push([activity.latitude, activity.longitude]);
    });
    
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  } else {
    document.getElementById('trip-map').innerHTML = '<div class="text-center p-5 text-muted">No activities with locations yet. Add activities with locations to see them on the map!</div>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.tripActivities) {
    initializeMap(window.tripActivities);
  }
});
