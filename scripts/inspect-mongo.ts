import "dotenv/config";
import mongoose from "mongoose";
import { initMongo, waitForMongo } from "../db/mongo";

async function inspect() {
  await initMongo();
  await waitForMongo();

  const db = mongoose.connection.db;
  if (!db) {
    console.error("Database connection not established.");
    process.exit(1);
  }

  const collections = await db.listCollections().toArray();
  console.log("\n=======================================================");
  console.log(`📦 MongoDB Database: "${db.databaseName}"`);
  console.log(`📊 Total Tables/Collections: ${collections.length}`);
  console.log("=======================================================\n");

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(` • Collection: ${col.name.padEnd(30)} -> ${count} record(s)`);
  }

  console.log("\n=======================================================");
  process.exit(0);
}

inspect().catch((err) => {
  console.error("Inspect failed:", err);
  process.exit(1);
});
