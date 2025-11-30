import express from 'express';
import { 
  getFriends, 
  sendFriendRequest, 
  getPendingRequests, 
  acceptFriendRequest, 
  rejectFriendRequest, 
  removeFriend,
  searchUsers 
} from '../db.js';

const router = express.Router();

// Friends page
router.get("/friends", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const friends = getFriends(req.session.user.id);
  const requests = getPendingRequests(req.session.user.id);
  const searchQuery = req.query.search || '';
  let searchResults = [];
  
  if (searchQuery) {
    searchResults = searchUsers(searchQuery, req.session.user.id);
  }

  res.render("friends", {
    user: req.session.user,
    friends: friends,
    requests: requests,
    searchResults: searchResults,
    searchQuery: searchQuery,
    message: null
  });
});

// Search friends
router.post("/friends/search", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const searchQuery = req.body.search || '';
  res.redirect(`/friends?search=${encodeURIComponent(searchQuery)}`);
});

// Add friend
router.post("/add-friend", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const friendEmail = req.body.friendEmail;
  const result = sendFriendRequest(req.session.user.id, friendEmail);
  const referer = req.get('Referer') || '';
  const fromFriendsPage = referer.includes('/friends');
  
  if (fromFriendsPage) {
    const searchQuery = req.query.search || '';
    if (result.success) {
      return res.redirect(`/friends?success=${encodeURIComponent(result.message)}${searchQuery ? '&search=' + encodeURIComponent(searchQuery) : ''}`);
    } else {
      return res.redirect(`/friends?error=${encodeURIComponent(result.message)}${searchQuery ? '&search=' + encodeURIComponent(searchQuery) : ''}`);
    }
  }
  
  const friends = getFriends(req.session.user.id);
  const requests = getPendingRequests(req.session.user.id) || [];
  
  res.render("profile", {
    user: req.session.user,
    friends: friends,
    requests: requests,
    message: result.message
  });
});

// Accept friend request
router.post("/accept-request/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  acceptFriendRequest(req.params.id);
  res.redirect("/profile");
});

// Reject friend request
router.post("/reject-request/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  rejectFriendRequest(req.params.id);
  res.redirect("/profile");
});

// Remove friend
router.post("/remove-friend/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const friendId = parseInt(req.params.id);
  removeFriend(req.session.user.id, friendId);
  const referer = req.get('Referer') || '';
  const fromFriendsPage = referer.includes('/friends');
  
  if (fromFriendsPage) {
    const searchQuery = req.query.search || '';
    return res.redirect(`/friends?success=${encodeURIComponent('Friend removed successfully')}${searchQuery ? '&search=' + encodeURIComponent(searchQuery) : ''}`);
  }

  res.redirect("/profile");
});

export default router;