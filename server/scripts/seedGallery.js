// Seeds demo content for the hall photo galleries and the "Previous Events"
// gallery. Safe to run repeatedly:
//   - gallery entries are matched by title and only created if missing;
//   - extra photos are only added to halls that have fewer than 2 images,
//     and existing images are always kept (new ones are appended).
// Run from the server/ folder:  npm run seed:gallery
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { getMongoUri } from "../src/config/db.js";
import Hall from "../src/models/Hall.js";
import EventGallery from "../src/models/EventGallery.js";

const photo = (seed) => `https://picsum.photos/seed/${seed}/1200/800`;

const HALL_PHOTOS = {
  "Grand Ballroom": ["bmh-ballroom-stage", "bmh-ballroom-tables", "bmh-ballroom-lights", "bmh-ballroom-entrance"],
  "Emerald Hall": ["bmh-emerald-interior", "bmh-emerald-stage", "bmh-emerald-bridal"],
  "Rosewood Banquet": ["bmh-rosewood-dining", "bmh-rosewood-decor", "bmh-rosewood-lounge"],
  "Skyline Terrace": ["bmh-skyline-sunset", "bmh-skyline-night", "bmh-skyline-seating"],
  "Executive Conference Hall": ["bmh-exec-boardroom", "bmh-exec-projector", "bmh-exec-breakout"],
};

const GALLERY_ENTRIES = [
  {
    title: "Ayesha & Bilal's Grand Walima",
    eventType: "Wedding",
    hallName: "Grand Ballroom",
    eventDate: "2026-03-14",
    guestCount: 420,
    description:
      "A 420-guest walima with a floral stage, warm fairy-light canopy and a five-course dinner. Live photography and valet parking kept the evening running smoothly.",
    photos: ["bmh-walima-stage", "bmh-walima-couple", "bmh-walima-dinner", "bmh-walima-lights", "bmh-walima-guests"],
  },
  {
    title: "Hassan Family Mehndi Night",
    eventType: "Wedding",
    hallName: "Emerald Hall",
    eventDate: "2026-02-21",
    guestCount: 180,
    description:
      "A colourful mehndi with traditional décor, a dhol performance and marigold garlands throughout the hall.",
    photos: ["bmh-mehndi-decor", "bmh-mehndi-dance", "bmh-mehndi-colors", "bmh-mehndi-table"],
  },
  {
    title: "Zara's 7th Birthday Party",
    eventType: "Birthday",
    hallName: "Rosewood Banquet",
    eventDate: "2026-05-02",
    guestCount: 60,
    description: "A themed kids' party with balloon arches, a cake table and games for the little ones.",
    photos: ["bmh-bday-balloons", "bmh-bday-cake", "bmh-bday-kids"],
  },
  {
    title: "TechNova Annual Strategy Summit",
    eventType: "Corporate Event",
    hallName: "Executive Conference Hall",
    eventDate: "2026-06-18",
    guestCount: 55,
    description:
      "A full-day leadership summit with projector setup, breakout sessions, and tea/coffee service between talks.",
    photos: ["bmh-summit-keynote", "bmh-summit-audience", "bmh-summit-networking"],
  },
  {
    title: "Rahman Silver Anniversary Dinner",
    eventType: "Anniversary",
    hallName: "Skyline Terrace",
    eventDate: "2026-07-09",
    guestCount: 80,
    description: "An intimate rooftop dinner under string lights celebrating 25 years together, with a live acoustic set.",
    photos: ["bmh-anniv-rooftop", "bmh-anniv-table", "bmh-anniv-cake", "bmh-anniv-toast"],
  },
  {
    title: "Sana & Omar Engagement Ceremony",
    eventType: "Engagement",
    hallName: "Emerald Hall",
    eventDate: "2026-08-23",
    guestCount: 150,
    description: "A pastel-themed ring ceremony with a floral arch backdrop and a photo corner for guests.",
    photos: ["bmh-engage-arch", "bmh-engage-rings", "bmh-engage-family"],
  },
];

const run = async () => {
  await mongoose.connect(getMongoUri());

  const halls = await Hall.find({});
  const hallByName = new Map(halls.map((h) => [h.name, h]));

  let hallsUpdated = 0;
  for (const hall of halls) {
    const extra = HALL_PHOTOS[hall.name];
    if (!extra || (hall.images || []).length >= 2) continue;
    hall.images = [...(hall.images || []), ...extra.map(photo).filter((url) => !hall.images.includes(url))];
    await hall.save();
    hallsUpdated += 1;
  }

  let created = 0;
  for (const entry of GALLERY_ENTRIES) {
    const exists = await EventGallery.exists({ title: entry.title });
    if (exists) continue;
    await EventGallery.create({
      title: entry.title,
      eventType: entry.eventType,
      hall: hallByName.get(entry.hallName)?._id || null,
      eventDate: new Date(entry.eventDate),
      guestCount: entry.guestCount,
      description: entry.description,
      images: entry.photos.map(photo),
      isPublished: true,
    });
    created += 1;
  }

  console.log(`Halls given extra photos: ${hallsUpdated}. Gallery entries created: ${created}.`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Seeding failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
