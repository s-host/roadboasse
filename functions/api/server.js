const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const serverless = require("serverless-http");
const app = express();
const multer = require("multer");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "audio"));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Middleware
router.use(express.json());
router.use(express.static(path.join(__dirname, "public")));
router.use("/audio", express.static(path.join(__dirname, "audio")));
router.use(express.urlencoded({ extended: true }));
router.use(
  session({
    secret: "34867n36%3s23y8s63qw01",
    resave: false,
    saveUninitialized: false,
  })
);

function ensureAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
}

// Load existing track data
const tracksFile = path.join(__dirname, "..", "..", "data", "tracks.json");
let tracks = [];

if (fs.existsSync(tracksFile)) {
  tracks = JSON.parse(fs.readFileSync(tracksFile, "utf-8"));
}

// Routes
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "public", "index.html"));
});

router.get("/tracks", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) {
    return res.json(tracks);
  }

  const filtered = tracks.filter(
    (track) =>
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q)
  );

  res.json(filtered);
});

router.post("/tracks", ensureAdmin, (req, res) => {
  const track = req.body;
  track.createdAt = new Date().toISOString();
  tracks.unshift(track);

  fs.writeFileSync(tracksFile, JSON.stringify(tracks, null, 2));
  res.json({ track });
});

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const tracksFilePath = path.join(__dirname, "..", "..", "data", "tracks.json");

router.delete("/tracks/:artistSlug/:songSlug", (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).send("Not authorized");
  }
  const { artistSlug, songSlug } = req.params;
  console.log("DELETE request:", artistSlug, songSlug);

  fs.readFile(tracksFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading tracks.json:", err);
      return res
        .status(500)
        .send("Internal Server Error: reading file failed");
    }

    let tracks;
    try {
      tracks = JSON.parse(data);
    } catch (parseErr) {
      console.error("Error parsing tracks.json:", parseErr);
      return res
        .status(500)
        .send("Internal Server Error: parsing JSON failed");
    }

    const index = tracks.findIndex((track) => {
      const aSlug = slugify(track.artist);
      const sSlug = slugify(track.title);
      return aSlug === artistSlug && sSlug === songSlug;
    });

    if (index === -1) {
      console.warn("Track not found to delete");
      return res.status(404).send("Track not found");
    }

    tracks.splice(index, 1);

    fs.writeFile(
      tracksFilePath,
      JSON.stringify(tracks, null, 2),
      "utf8",
      (writeErr) => {
        if (writeErr) {
          console.error("Error writing tracks.json:", writeErr);
          return res
            .status(500)
            .send("Internal Server Error: writing file failed");
        }

        console.log("Track deleted successfully");
        res.status(200).send("Track deleted");
      }
    );
  });
});

// Hardcoded login
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "iHATEtomatoes1$ff",
};

// Login endpoint
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === ADMIN_CREDENTIALS.username &&
    password === ADMIN_CREDENTIALS.password
  ) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Check login status
router.get("/is-admin", (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

router.post("/upload-song", upload.single("audioFile"), (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).send("Not authorized");
  }

  const { title, artist, album, cover, category, releaseDate, albumNumber } =
    req.body;
  const audioFile = req.file;

  if (!title || !artist || !audioFile) {
    return res.status(400).send("Missing required fields or audio file");
  }

  // Create track object
  const newTrack = {
    title,
    artist,
    album: album || "",
    cover: cover || "",
    file: `/audio/${audioFile.filename}`,
    isNew: category === "isNew",
    isPopular: category === "isPopular",
    createdAt: releaseDate
      ? new Date(releaseDate).toISOString()
      : new Date().toISOString(),
    albumNumber,
  };

  // Add to tracks array & save
  tracks.unshift(newTrack);
  fs.writeFile(tracksFile, JSON.stringify(tracks, null, 2), (err) => {
    if (err) {
      console.error("Error saving tracks.json:", err);
      return res.status(500).send("Error saving track data");
    }
    res.status(200).send("Track uploaded and saved successfully");
  });
});

app.use("/.netlify/functions/api", router);

module.exports.handler = serverless(app);