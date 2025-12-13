const locationInput = document.getElementById('location');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const suggestionsDiv = document.getElementById('location-suggestions');
let debounceTimer;
let map;

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

// Map initialization
function initializeMap(activities) {
  const locatedActivities = activities.filter(a => a.latitude && a.longitude);
  
  if (locatedActivities.length > 0) {
    map = L.map('trip-map').setView([locatedActivities[0].latitude, locatedActivities[0].longitude], 12);
    
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

let selectedRating = null;

async function loadReviews() {
  if (!window.reviewTripEnded) return;

  try {
    const response = await fetch(`/api/reviews/trips/${window.reviewTripId}/reviews`);
    const data = await response.json();

    const reviewsContainer = document.getElementById('existing-reviews-container');
    
    if (data.reviews && data.reviews.length > 0) {
      let html = '';
      
      // Average rating banner
      if (data.avgRating && data.avgRating.avg_rating) {
        const avgRating = parseFloat(data.avgRating.avg_rating).toFixed(1);
        const stars = '⭐'.repeat(Math.round(avgRating / 2));
        html += '<div class="average-rating-banner">';
        html += '<div class="big-rating">' + avgRating + ' / 10</div>';
        html += '<div>' + stars + '</div>';
        html += '<div class="review-count">Based on ' + data.avgRating.review_count + ' ' + (data.avgRating.review_count === 1 ? 'review' : 'reviews') + '</div>';
        html += '</div>';
      }
      
      html += '<div class="existing-reviews"><h5>All Reviews</h5>';
      
      // Individual reviews
      data.reviews.forEach(review => {
        const stars = '⭐'.repeat(Math.round(review.rating / 2));
        const reviewDate = new Date(review.created_at).toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        const isOwnReview = window.reviewUserId && review.user_id === window.reviewUserId;
        const escapedText = escapeForAttribute(review.review_text);
        
        html += '<div class="trip-review-card">';
        html += '<div class="trip-review-header">';
        html += '<img src="' + (review.reviewer_picture || '/images/default-avatar.png') + '" alt="' + review.reviewer_name + '">';
        html += '<div>';
        html += '<h6 class="mb-0">' + review.reviewer_name + '</h6>';
        html += '<small class="text-muted">' + reviewDate + '</small>';
        html += '</div>';
        
        if (isOwnReview) {
          html += '<div class="ms-auto">';
          html += '<button class="btn btn-sm btn-outline-success" onclick="openEditReviewModal(' + review.id + ', ' + review.rating + ', \'' + escapedText + '\')" style="border-color: #8b9d77; color: #8b9d77;">';
          html += '<i class="bi bi-pencil"></i> Edit';
          html += '</button>';
          html += '<button class="btn btn-sm btn-outline-danger" onclick="openDeleteReviewModal(' + review.id + ')">';
          html += '<i class="bi bi-trash"></i>';
          html += '</button>';
          html += '</div>';
        }
        
        html += '</div>';
        html += '<div class="trip-review-rating">';
        html += '<span class="rating-badge">' + review.rating + ' / 10</span>';
        html += '<span class="stars">' + stars + '</span>';
        html += '</div>';
        html += '<p class="trip-review-text">"' + escapeHtml(review.review_text) + '"</p>';
        html += '</div>';
      });
      
      html += '</div>';
      reviewsContainer.innerHTML = html;
    } else {
      reviewsContainer.innerHTML = '<div class="text-center py-5 bg-light rounded"><i class="bi bi-star" style="font-size: 3rem; color: #ccc;"></i><p class="text-muted mt-3">No reviews yet. Be the first to review this trip!</p></div>';
    }

    await checkReviewEligibility();
  } catch (error) {
    console.error('Error loading reviews:', error);
  }
}

async function checkReviewEligibility() {
  if (!window.reviewUserId) return;

  try {
    const response = await fetch(`/api/reviews/trips/${window.reviewTripId}/reviews`);
    const data = await response.json();
    
    const hasReviewed = data.reviews.some(review => review.user_id === window.reviewUserId);
    
    const formContainer = document.getElementById('review-form-container');
    
    if (!hasReviewed) {
      let formHtml = '<div class="review-form-card">';
      formHtml += '<h5><i class="bi bi-pencil-square"></i> Share Your Experience</h5>';
      formHtml += '<form id="review-form" onsubmit="submitReview(event)">';
      formHtml += '<div class="mb-3">';
      formHtml += '<label class="form-label">Rating (1-10) *</label>';
      formHtml += '<div class="rating-input-group">';
      
      for (let i = 1; i <= 10; i++) {
        formHtml += '<button type="button" class="rating-btn" onclick="selectRating(' + i + ')" id="rating-' + i + '">' + i + '</button>';
      }
      
      formHtml += '</div>';
      formHtml += '<input type="hidden" id="rating-value" required />';
      formHtml += '</div>';
      formHtml += '<div class="mb-3">';
      formHtml += '<label for="review-text" class="form-label">Your Review *</label>';
      formHtml += '<textarea id="review-text" class="form-control" rows="4" placeholder="Share your thoughts about this trip..." required maxlength="500"></textarea>';
      formHtml += '<small class="text-white-50">Maximum 500 characters</small>';
      formHtml += '</div>';
      formHtml += '<button type="submit" class="btn btn-light btn-lg"><i class="bi bi-send"></i> Submit Review</button>';
      formHtml += '</form>';
      formHtml += '</div>';
      
      formContainer.innerHTML = formHtml;
    }
  } catch (error) {
    console.error('Error checking review eligibility:', error);
  }
}

function selectRating(rating) {
  selectedRating = rating;
  document.getElementById('rating-value').value = rating;
  
  for (let i = 1; i <= 10; i++) {
    const btn = document.getElementById('rating-' + i);
    if (btn) {
      if (i === rating) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }
}

async function submitReview(event) {
  event.preventDefault();
  
  const rating = selectedRating;
  const reviewText = document.getElementById('review-text').value;
  
  if (!rating) {
    showErrorModal('Please select a rating before submitting.');
    return;
  }
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';
  
  try {
    const response = await fetch(`/api/reviews/trips/${window.reviewTripId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rating: rating,
        review_text: reviewText
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showSuccessModal('Review Submitted Successfully!', 'Thank you for sharing your experience. Your review has been posted and will help others plan their trips.');
    } else {
      showErrorModal(data.error || 'Failed to submit review');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  } catch (error) {
    console.error('Error submitting review:', error);
    showErrorModal('An error occurred while submitting your review. Please try again.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

// EDIT REVIEW MODAL FUNCTIONALITY
let currentEditReviewId = null;

function openEditReviewModal(reviewId, currentRating, currentText) {
  currentEditReviewId = reviewId;
  
  // Set current rating
  document.getElementById('editRatingValue').value = currentRating;
  
  // Update rating buttons
  document.querySelectorAll('#editRatingGroup .rating-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.rating) === currentRating);
  });
  
  // Set current text (unescape HTML entities)
  const textarea = document.getElementById('editReviewText');
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = currentText;
  textarea.value = tempDiv.textContent;
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('editReviewModal'));
  modal.show();
}

// Initialize rating button handlers for edit modal after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#editRatingGroup .rating-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const rating = parseInt(this.dataset.rating);
      document.getElementById('editRatingValue').value = rating;
      
      document.querySelectorAll('#editRatingGroup .rating-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.rating) === rating);
      });
    });
  });
});

async function submitEditReview() {
  const rating = document.getElementById('editRatingValue').value;
  const text = document.getElementById('editReviewText').value.trim();
  
  if (!rating || !text) {
    showErrorModal('Please provide both rating and review text');
    return;
  }

  try {
    const response = await fetch(`/api/reviews/${currentEditReviewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: parseInt(rating), review_text: text })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update review');
    }

    // Close edit modal
    const editModal = bootstrap.Modal.getInstance(document.getElementById('editReviewModal'));
    if (editModal) editModal.hide();
    
    // Show success modal
    showSuccessModal('Review Updated Successfully!', 'Your review has been updated.');
  } catch (error) {
    console.error('Error updating review:', error);
    showErrorModal(error.message || 'Failed to update review. Please try again.');
  }
}

// DELETE REVIEW MODAL FUNCTIONALITY
let currentDeleteReviewId = null;

function openDeleteReviewModal(reviewId) {
  currentDeleteReviewId = reviewId;
  const modal = new bootstrap.Modal(document.getElementById('deleteReviewModal'));
  modal.show();
}

async function confirmDeleteReview() {
  try {
    const response = await fetch(`/api/reviews/${currentDeleteReviewId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Close delete modal
      const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteReviewModal'));
      if (deleteModal) deleteModal.hide();
      
      showSuccessModal('Review Deleted', 'Your review has been successfully removed.');
      setTimeout(() => location.reload(), 1500);
    } else {
      const data = await response.json();
      showErrorModal(data.error || 'Failed to delete review');
    }
  } catch (error) {
    console.error('Error deleting review:', error);
    showErrorModal('An error occurred while deleting your review');
  }
}

function showSuccessModal(title, message) {
  document.getElementById('successTitle').textContent = title;
  document.getElementById('successMessage').textContent = message;
  const modal = new bootstrap.Modal(document.getElementById('reviewSuccessModal'));
  modal.show();
}

function showErrorModal(message) {
  document.getElementById('errorMessage').textContent = message;
  const modal = new bootstrap.Modal(document.getElementById('reviewErrorModal'));
  modal.show();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeForAttribute(text) {
  return text.replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/\\/g, '\\\\');
}

// Load reviews on page load
if (window.reviewTripEnded) {
  document.addEventListener('DOMContentLoaded', loadReviews);
}