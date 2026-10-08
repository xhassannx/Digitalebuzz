/**
 * One-off: simulate contact update automation dispatch.
 */
import "dotenv/config";
import { storage } from "../server/storage";

const contactId = "a2932410-49f9-4bb3-9990-c3081cac424b";
const userId = "cd37ccfe-a6ca-4d86-872a-30afefbd48e5";
const orgId = "9a7fbe83-d32b-4ccc-83b3-7c9d8bcc98d2";

const before = await storage.getManagedContact(contactId, userId, orgId);
console.log("Before name:", before?.name);

const updated = await storage.updateManagedContact(contactId, userId, orgId, {
  name: `${before?.name || "test"} x`,
});
console.log("Updated name:", updated?.name);

await new Promise((r) => setTimeout(r, 8000));
console.log("Done waiting for async automation");

process.exit(0);
