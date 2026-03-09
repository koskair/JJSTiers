import express from "express";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import Database from "better-sqlite3";

const db = new Database("rankings.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    robloxUsername TEXT,
    avatarUrl TEXT
  );

  CREATE TABLE IF NOT EXISTS tier_assignments (
    tierId TEXT NOT NULL,
    playerId TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (tierId, playerId),
    FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Admin Login
  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123"; // Fallback for dev
    if (password === adminPassword) {
      res.json({ success: true, token: adminPassword });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  // Middleware to check admin status
  const checkAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers["x-admin-token"];
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    if (token === adminPassword) {
      next();
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  };

  // Get all rankings
  app.get("/api/rankings", (req, res) => {
    const players = db.prepare("SELECT * FROM players").all();
    const assignments = db.prepare("SELECT * FROM tier_assignments ORDER BY position ASC").all();
    res.json({ players, assignments });
  });

  // Add/Update Player (Protected)
  app.post("/api/players", checkAdmin, async (req, res) => {
    const { username, region, tierId } = req.body;
    
    try {
      // 1. Fetch Roblox Data
      const userResponse = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
      });

      const userData = await userResponse.json() as any;
      let robloxId = null;
      let avatarUrl = null;
      let finalName = username;

      if (userData.data && userData.data.length > 0) {
        robloxId = userData.data[0].id;
        finalName = userData.data[0].name;
        
        const thumbResponse = await fetch(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`
        );
        const thumbData = await thumbResponse.json() as any;
        if (thumbData.data && thumbData.data.length > 0) {
          avatarUrl = thumbData.data[0].imageUrl;
        }
      }

      const playerId = `p_${Date.now()}`;

      // 2. Save to DB
      const insertPlayer = db.prepare("INSERT INTO players (id, name, region, robloxUsername, avatarUrl) VALUES (?, ?, ?, ?, ?)");
      insertPlayer.run(playerId, finalName, region, username, avatarUrl);

      const insertAssignment = db.prepare("INSERT INTO tier_assignments (tierId, playerId, position) VALUES (?, ?, ?)");
      const count = db.prepare("SELECT COUNT(*) as count FROM tier_assignments WHERE tierId = ?").get(tierId) as any;
      insertAssignment.run(tierId, playerId, count.count);

      res.json({ 
        id: playerId, 
        name: finalName, 
        region, 
        robloxUsername: username, 
        avatarUrl,
        tierId
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add player" });
    }
  });

  // Delete Player (Protected)
  app.delete("/api/players/:id", checkAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM players WHERE id = ?").run(id);
    db.prepare("DELETE FROM tier_assignments WHERE playerId = ?").run(id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
