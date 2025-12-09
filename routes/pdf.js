import express from "express";
import PDFDocument from "pdfkit";

import {
  getTripById,
  getTripActivities,
  getGroupById,
  isGroupMember
} from "../db.js";

const router = express.Router();

router.get("/trips/:id/pdf", (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");

  try {
    const tripId = parseInt(req.params.id);
    const trip = getTripById(tripId);

    if (!trip) return res.status(404).send("Trip not found");

    const membership = isGroupMember(req.session.user.id, trip.group_id);
    if (!membership) return res.status(403).send("Not a member");

    const activities = getTripActivities(tripId);
    const group = getGroupById(trip.group_id);

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    const safeFileName = trip.name.replace(/[^a-z0-9_\-\. ]/gi, "_");
    res.setHeader(
      "Content-disposition",
      `attachment; filename="${safeFileName}.pdf"`
    );
    res.setHeader("Content-type", "application/pdf");

    doc.pipe(res);

    doc.fontSize(20).text(trip.name);
    doc.fontSize(12).text(`${group.name} — ${trip.destination}`);
    doc.moveDown();

    activities.forEach((a) => {
      doc.fontSize(14).text(a.date, { underline: true });
      doc.fontSize(12).text(a.title);

      if (a.location) {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          a.location
        )}`;
        doc
          .fillColor("blue")
          .text("View on Google Maps", { link: url, underline: true });
        doc.fillColor("black");
      }

      doc.moveDown();
    });

    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;