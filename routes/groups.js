import express from 'express';
import db, {
  getFriends,
  createGroup,
  getUserGroups,
  getGroupById,
  getGroupMembers,
  isGroupMember,
  updateMemberRole,
  removeGroupMember,
  addGroupMember,
  updateGroup,
  deleteGroup,
  getGroupTrips,
  getUserByEmail
} from '../db.js';

const router = express.Router();

// View all groups
router.get("/groups", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groups = getUserGroups(req.session.user.id);
  const enrichedGroups = groups.map(group => {
    const membersWithPics = group.members.map(member => {
      const fullMember = db.prepare("SELECT id, name, profile_picture FROM users WHERE id = ?").get(member.id);

      if (!fullMember.profile_picture) {
        fullMember.profile_picture = "/uploads/Placeholder_pfp.png";
      }

      fullMember.role = member.role;
      return fullMember;
    });

    return {
      ...group,
      members: membersWithPics,
    };
  });

  res.render("groups", { user: req.session.user, groups: enrichedGroups, message: null });
});

// Create new group page
router.get("/groups/new", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const friends = getFriends(req.session.user.id);

  res.render("new-group", {
    user: req.session.user,
    message: null,
    friends: friends
  });
});

// Create group
router.post("/groups", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const { name, description, members } = req.body;

  const groupId = createGroup(name, description, req.session.user.id);
  if (members && members.length > 0) {
    const memberIds = Array.isArray(members) ? members : [members];
    memberIds.forEach(friendId => {
      db.prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, 'member')").run(friendId, groupId);
    });
  }

  res.redirect("/groups");
});

// View specific group
router.get("/groups/:id", (req, res) => {
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

  const members = getGroupMembers(groupId);
  const isAdmin = membership.role === 'admin';
  const trips = getGroupTrips(groupId);

  res.render("view-group", {
    user: req.session.user,
    group: group,
    members: members,
    isAdmin: isAdmin,
    trips: trips,
    message: null
  });
});

// Edit group page
router.get("/groups/:id/edit", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can edit group details");
  }

  res.render("edit-group", {
    user: req.session.user,
    group: group
  });
});

// Update group
router.post("/groups/:id/edit", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const { name, description } = req.body;

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can edit group details");
  }

  updateGroup(groupId, name, description);
  res.redirect(`/groups/${groupId}?success=Group details updated successfully`);
});

// Promote member to admin
router.post("/groups/:id/promote/:userId", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const membership = isGroupMember(req.session.user.id, groupId);
  
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can promote members");
  }

  updateMemberRole(groupId, userId, 'admin');
  res.redirect(`/groups/${groupId}`);
});

// Demote admin to member
router.post("/groups/:id/demote/:userId", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const membership = isGroupMember(req.session.user.id, groupId);
  
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can demote members");
  }

  updateMemberRole(groupId, userId, 'member');
  res.redirect(`/groups/${groupId}`);
});

// Remove member
router.post("/groups/:id/remove/:userId", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const membership = isGroupMember(req.session.user.id, groupId);
  
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can remove members");
  }

  removeGroupMember(groupId, userId);
  res.redirect(`/groups/${groupId}`);
});

// Add member to group
router.post("/groups/:id/add-member", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const memberEmail = req.body.memberEmail;
  
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can add members");
  }

  const newMember = getUserByEmail(memberEmail);
  if (!newMember) {
    return res.redirect(`/groups/${groupId}?error=User not found`);
  }

  const existingMembership = isGroupMember(newMember.id, groupId);
  if (existingMembership) {
    return res.redirect(`/groups/${groupId}?error=User is already a member`);
  }
  
  addGroupMember(groupId, newMember.id, 'member');
  res.redirect(`/groups/${groupId}?success=Member added successfully`);
});

// Delete group
router.post("/groups/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can delete groups");
  }

  deleteGroup(groupId);
  res.redirect("/groups");
});

export default router;