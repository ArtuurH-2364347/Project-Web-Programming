import express from 'express';
import db, {
  getTripById,
  isGroupMember,
  checkActivityOverlap,
  createActivitySuggestion,
  getTripActivities,
  getGroupById,
  getTripSuggestions,
  getSuggestionVotes,
  getUserVote,
  getGroupMembers,
  castVote,
  approveSuggestion,
  deleteSuggestion,
  deleteActivity,
  getActivityAttachments
} from '../db.js';

const router = express.Router();

// Create activity (as suggestion)
router.post("/trips/:id/activities", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const tripId = parseInt(req.params.id);
  const { title, description, location, latitude, longitude, date, startTime, endTime } = req.body;

  const trip = getTripById(tripId);
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  if (!startTime || !endTime) {
    return res.status(400).send("Start and end times are required");
  }

  if (startTime >= endTime) {
    return res.status(400).send("End time must be after start time");
  }

  const overlapCheck = checkActivityOverlap(tripId, date, startTime, endTime);
  if (overlapCheck.hasOverlap) {
    const conflict = overlapCheck.conflictingActivity;
    
    const suggestions = getTripSuggestions(tripId);
    const activities = getTripActivities(tripId);
    const group = getGroupById(trip.group_id);
    const isAdmin = membership.role === 'admin';
    const groupMembers = getGroupMembers(trip.group_id);
    const totalMembers = groupMembers.length;
    const votesNeeded = Math.ceil(totalMembers / 2);

    suggestions.forEach(suggestion => {
      const votes = getSuggestionVotes(suggestion.id);
      suggestion.yesVotes = votes.filter(v => v.vote === 'yes').length;
      suggestion.noVotes = votes.filter(v => v.vote === 'no').length;
      suggestion.totalVotes = votes.length;
      suggestion.votesNeeded = votesNeeded;
      const userVote = getUserVote(suggestion.id, req.session.user.id);
      suggestion.userVote = userVote ? userVote.vote : null;
    });

    const activitiesByDate = {};
    activities.forEach(activity => {
      if (!activitiesByDate[activity.date]) {
        activitiesByDate[activity.date] = [];
      }
      activitiesByDate[activity.date].push(activity);
    });

    return res.render("trip-schedule", {
      user: req.session.user,
      trip: trip,
      group: group,
      activities: activities,
      activitiesByDate: activitiesByDate,
      isAdmin: isAdmin,
      suggestions: suggestions,
      totalMembers: totalMembers,
      votesNeeded: votesNeeded,
      message: `Time conflict! This overlaps with "${conflict.title}" (${conflict.start_time} - ${conflict.end_time})`
    });
  }

  createActivitySuggestion(
    tripId, 
    title, 
    description, 
    location, 
    latitude || null, 
    longitude || null, 
    date, 
    startTime, 
    endTime, 
    req.session.user.id
  );
  
  res.redirect(`/trips/${tripId}`);
});

// Vote on suggestion
router.post("/suggestions/:id/vote", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const suggestionId = parseInt(req.params.id);
  const vote = req.body.vote;

  const suggestion = db.prepare("SELECT * FROM activity_suggestions WHERE id = ?").get(suggestionId);
  if (!suggestion) {
    return res.status(404).send("Suggestion not found");
  }

  const trip = getTripById(suggestion.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  castVote(suggestionId, req.session.user.id, vote);

  const votes = getSuggestionVotes(suggestionId);
  const yesVotes = votes.filter(v => v.vote === 'yes').length;
  const groupMembers = getGroupMembers(trip.group_id);
  const votesNeeded = Math.ceil(groupMembers.length / 2);

  if (yesVotes >= votesNeeded) {
    approveSuggestion(suggestionId);
  }

  res.redirect(`/trips/${suggestion.trip_id}`);
});

// Delete suggestion
router.post("/suggestions/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const suggestionId = parseInt(req.params.id);
  const suggestion = db.prepare("SELECT * FROM activity_suggestions WHERE id = ?").get(suggestionId);
  
  if (!suggestion) {
    return res.status(404).send("Suggestion not found");
  }

  const trip = getTripById(suggestion.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);

  if (!membership || (membership.role !== 'admin' && suggestion.suggested_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this suggestion");
  }

  deleteSuggestion(suggestionId);
  res.redirect(`/trips/${suggestion.trip_id}`);
});

// Delete activity
router.post("/activities/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const activityId = parseInt(req.params.id);
  
  const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(activityId);
  if (!activity) {
    return res.status(404).send("Activity not found");
  }

  const trip = getTripById(activity.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  if (!membership || (membership.role !== 'admin' && activity.created_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this activity");
  }

  deleteActivity(activityId);
  res.redirect(`/trips/${activity.trip_id}`);
});

export default router;