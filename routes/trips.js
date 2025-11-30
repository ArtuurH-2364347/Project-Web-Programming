import express from 'express';
import db, {
  getGroupById,
  isGroupMember,
  createTrip,
  getTripById,
  getTripActivities,
  getGroupMembers,
  getTripSuggestions,
  getSuggestionVotes,
  getUserVote,
  deleteTrip,
  getActivityAttachments
} from '../db.js';

const router = express.Router();

// New trip page
router.get("/groups/:id/trips/new", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  res.render("new-trip", {
    user: req.session.user,
    group: group
  });
});

// Create trip
router.post("/groups/:id/trips", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const { name, destination, startDate, endDate } = req.body;

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can create trips");
  }

  const tripId = createTrip(groupId, name, destination, startDate, endDate);
  res.redirect(`/trips/${tripId}`);
});

// View specific trip
router.get("/trips/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const tripId = parseInt(req.params.id);
  const trip = getTripById(tripId);
  
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  const activities = getTripActivities(tripId);
  const group = getGroupById(trip.group_id);
  const isAdmin = membership.role === 'admin';
  const suggestions = getTripSuggestions(tripId);
  const groupMembers = getGroupMembers(trip.group_id);
  const totalMembers = groupMembers.length;
  const votesNeeded = Math.ceil(totalMembers / 2);

  activities.forEach(activity => {
    activity.attachments = getActivityAttachments(activity.id);
  });

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

  res.render("trip-schedule", {
    user: req.session.user,
    trip: trip,
    group: group,
    activities: activities,
    activitiesByDate: activitiesByDate,
    isAdmin: isAdmin,
    suggestions: suggestions,
    totalMembers: totalMembers,
    votesNeeded: votesNeeded,
    message: null
  });
});

// Delete trip
router.post("/trips/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const tripId = parseInt(req.params.id);
  const trip = getTripById(tripId);
  
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can delete trips");
  }

  const groupId = trip.group_id;
  deleteTrip(tripId);
  res.redirect(`/groups/${groupId}`);
});

export default router;