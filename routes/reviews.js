import express from "express";
import {
  createTripReview,
  getTripReviews,
  getTripAverageRating,
  getRecentReviews,
  updateTripReview,
  deleteTripReview
} from "../db.js";

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.get("/api/reviews/recent", (req, res) => {
  try {
    const reviews = getRecentReviews(4);
    res.json({ reviews });
  } catch (error) {
    console.error("Error fetching recent reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get reviews for a trip
router.get("/api/reviews/trips/:tripId/reviews", (req, res) => {
  try {
    const { tripId } = req.params;
    const reviews = getTripReviews(tripId);
    const avgRating = getTripAverageRating(tripId);
    
    res.json({ reviews, avgRating });
  } catch (error) {
    console.error("Error fetching trip reviews:", error);
    res.status(500).json({ error: "Failed to fetch trip reviews" });
  }
});

// Create a review
router.post("/api/reviews/trips/:tripId/reviews", requireAuth, (req, res) => {
  try {
    const { tripId } = req.params;
    const { rating, review_text } = req.body;
    const userId = req.session.user.id;
    
    if (!rating || !review_text) {
      return res.status(400).json({ error: "Rating and review text are required" });
    }
    
    if (rating < 1 || rating > 10) {
      return res.status(400).json({ error: "Rating must be between 1 and 10" });
    }
    
    const result = createTripReview(tripId, userId, rating, review_text);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json({ message: "Review created successfully", reviewId: result.reviewId });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Failed to create review" });
  }
});

// Update a review
router.put("/api/reviews/:reviewId", requireAuth, (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, review_text } = req.body;
    const userId = req.session.user.id;
    
    if (!rating || !review_text) {
      return res.status(400).json({ error: "Rating and review text are required" });
    }
    
    if (rating < 1 || rating > 10) {
      return res.status(400).json({ error: "Rating must be between 1 and 10" });
    }
    
    const result = updateTripReview(reviewId, userId, rating, review_text);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json({ message: "Review updated successfully" });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ error: "Failed to update review" });
  }
});

// Delete a review
router.delete("/api/reviews/:reviewId", requireAuth, (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.session.user.id;
    
    const result = deleteTripReview(reviewId, userId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

export default router;