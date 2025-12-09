import express from 'express';
import db, { getUserTrips, getActivityAttachments } from '../db.js';

const router = express.Router();

// View schedule (legacy route)
router.get("/schedule", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const trips = getUserTrips(req.session.user.id);
  
  res.render("schedule", {
    user: req.session.user,
    trips: trips
  });
});

// Personal schedule page
router.get("/personal-schedule", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const activities = db.prepare(`
    SELECT 
      a.*,
      t.name as trip_name,
      t.destination as trip_destination,
      g.name as group_name,
      g.id as group_id
    FROM activities a
    JOIN trips t ON a.trip_id = t.id
    JOIN groups g ON t.group_id = g.id
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY a.date ASC, a.start_time ASC
  `).all(req.session.user.id);

  activities.forEach(activity => {
    activity.attachments = getActivityAttachments(activity.id);
  });

  const activitiesByDate = {};
  activities.forEach(activity => {
    if (!activitiesByDate[activity.date]) {
      activitiesByDate[activity.date] = [];
    }
    activitiesByDate[activity.date].push(activity);
  });

  const today = new Date().toISOString().split('T')[0];
  const upcomingActivities = activities.filter(a => a.date >= today);
  const pastActivities = activities.filter(a => a.date < today);

  res.render("personal-schedule", {
    user: req.session.user,
    activities: activities,
    activitiesByDate: activitiesByDate,
    upcomingActivities: upcomingActivities,
    pastActivities: pastActivities,
    today: today
  });
});

export default router;