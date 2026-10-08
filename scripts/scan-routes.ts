import fs from "fs";

const text = fs.readFileSync("server/routes.ts", "utf8");
const lines = text.split("\n");
lines.forEach((l, idx) => {
  if (/\bdb\s*\./.test(l) || /^\s*db\s*$/.test(l)) {
    console.log(idx + 1, l.trim());
  }
});
