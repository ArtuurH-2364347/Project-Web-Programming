import express from "express";
import { getAllUsers, promoteUserToAdmin, demoteUserToUser, deleteUserHard } from "../db.js";

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("You are not an admin.");
  }
  next();
}

router.get("/admin/users", requireAdmin, (req, res) => {
  const users = getAllUsers();
  res.render("adminUsers", { user: req.session.user, users });
});

router.post("/admin/promote/:id", requireAdmin, (req, res) => {
  promoteUserToAdmin(req.params.id);
  res.redirect("/admin/users");
});

router.post("/admin/demote/:id", requireAdmin, (req, res) => {
  demoteUserToUser(req.params.id);
  res.redirect("/admin/users");
});

router.post("/admin/delete/:id", requireAdmin, (req, res) => {
  if (req.params.id == req.session.user.id) {
    return res.send("Admins cannot delete themselves.");
  }
  deleteUserHard(req.params.id);
  res.redirect("/admin/users");
});

export default router;
