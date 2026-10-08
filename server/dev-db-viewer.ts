import type { Express, Request, Response } from "express";
import mongoose from "mongoose";
import { isMongoEnabled } from "../db/mongo";

export function registerDevDbViewer(app: Express): void {
  // JSON endpoint to list all collections and document counts
  app.get("/api/dev/tables", async (_req: Request, res: Response) => {
    try {
      if (!isMongoEnabled()) {
        return res.json({ adapter: "postgres", message: "MongoDB is not active." });
      }

      const db = mongoose.connection.db;
      if (!db) {
        return res.status(503).json({ error: "Database not connected yet" });
      }

      const collections = await db.listCollections().toArray();
      const stats = await Promise.all(
        collections.map(async (c) => {
          const count = await db.collection(c.name).countDocuments();
          return { name: c.name, count };
        })
      );

      stats.sort((a, b) => b.count - a.count);

      return res.json({
        adapter: "mongodb",
        databaseName: db.databaseName,
        totalCollections: stats.length,
        collections: stats,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // JSON endpoint to fetch rows from a specific collection
  app.get("/api/dev/tables/:name", async (req: Request, res: Response) => {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        return res.status(503).json({ error: "Database not connected yet" });
      }

      const colName = req.params.name;
      const limit = Math.min(100, parseInt(String(req.query.limit || "50"), 10) || 50);
      const docs = await db.collection(colName).find({}).limit(limit).toArray();

      return res.json({
        collection: colName,
        count: docs.length,
        documents: docs,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Visual Interactive Web UI to browse all DB tables & data
  app.get("/dev-db", async (_req: Request, res: Response) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DigitaleBuzz - Local MongoDB Viewer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; height: 100vh; overflow: hidden; }
    #sidebar { width: 300px; background: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; }
    #header { padding: 18px 20px; border-bottom: 1px solid #334155; background: #0f172a; }
    #header h2 { font-size: 17px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    #header p { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    #collections-list { flex: 1; overflow-y: auto; padding: 10px; }
    .col-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; cursor: pointer; color: #cbd5e1; font-size: 13.5px; transition: all 0.15s; margin-bottom: 4px; }
    .col-item:hover { background: #334155; color: #fff; }
    .col-item.active { background: #0284c7; color: #fff; font-weight: 600; }
    .badge { background: #0f172a; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #38bdf8; }
    .col-item.active .badge { background: rgba(255,255,255,0.25); color: #fff; }
    #main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #0b1120; }
    #main-header { padding: 16px 24px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; background: #0f172a; }
    #main-title { font-size: 16px; font-weight: 600; color: #f1f5f9; }
    #content { flex: 1; overflow: auto; padding: 20px; }
    pre { background: #020617; border: 1px solid #1e293b; padding: 18px; border-radius: 8px; font-family: "Cascadia Code", Consolas, monospace; font-size: 12.5px; color: #38bdf8; overflow-x: auto; line-height: 1.5; }
    .empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 15px; }
  </style>
</head>
<body>
  <div id="sidebar">
    <div id="header">
      <h2>🍃 MongoDB Tables</h2>
      <p id="db-info">Connecting to local database...</p>
    </div>
    <div id="collections-list">Loading tables...</div>
  </div>
  <div id="main">
    <div id="main-header">
      <div id="main-title">Select a table / collection to inspect records</div>
      <button onclick="refresh()" style="background:#0284c7; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">🔄 Refresh</button>
    </div>
    <div id="content">
      <div class="empty-state">Select a collection from the sidebar to inspect its JSON documents.</div>
    </div>
  </div>

  <script>
    let activeCol = "";

    async function loadCollections() {
      try {
        const res = await fetch("/api/dev/tables");
        const data = await res.json();
        document.getElementById("db-info").innerText = "Database: " + (data.databaseName || "digitalebuzz") + " (" + data.totalCollections + " tables)";
        const listEl = document.getElementById("collections-list");
        listEl.innerHTML = "";
        if (!data.collections || data.collections.length === 0) {
          listEl.innerHTML = "<div style='padding:12px; color:#64748b; font-size:13px;'>No collections found yet.</div>";
          return;
        }
        data.collections.forEach(c => {
          const div = document.createElement("div");
          div.className = "col-item" + (c.name === activeCol ? " active" : "");
          div.innerHTML = "<span>" + c.name + "</span><span class='badge'>" + c.count + "</span>";
          div.onclick = () => selectCollection(c.name);
          listEl.appendChild(div);
        });
      } catch (err) {
        document.getElementById("collections-list").innerHTML = "<div style='color:#ef4444; padding:10px;'>Failed to load tables</div>";
      }
    }

    async function selectCollection(name) {
      activeCol = name;
      document.querySelectorAll(".col-item").forEach(el => {
        el.classList.toggle("active", el.querySelector("span").innerText === name);
      });
      document.getElementById("main-title").innerText = "Table / Collection: " + name;
      const contentEl = document.getElementById("content");
      contentEl.innerHTML = "<div class='empty-state'>Loading records...</div>";
      try {
        const res = await fetch("/api/dev/tables/" + encodeURIComponent(name));
        const data = await res.json();
        if (!data.documents || data.documents.length === 0) {
          contentEl.innerHTML = "<div class='empty-state'>No documents in collection \\"" + name + "\\".</div>";
          return;
        }
        contentEl.innerHTML = "<pre>" + escapeHtml(JSON.stringify(data.documents, null, 2)) + "</pre>";
      } catch (err) {
        contentEl.innerHTML = "<div style='color:#ef4444; padding:20px;'>Failed to load documents: " + err.message + "</div>";
      }
    }

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function refresh() {
      loadCollections();
      if (activeCol) selectCollection(activeCol);
    }

    loadCollections();
  </script>
</body>
</html>`;
    return res.type("html").send(html);
  });
}
