import { readFile } from "node:fs/promises";
const token = (
  await readFile(".cutaway/config/controller-token", "utf8")
).trim();
const response = await fetch("http://127.0.0.1:4310/reset", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-cutaway-controller-token": token,
  },
  body: "{}",
});
if (!response.ok) throw new Error(`Reset failed: HTTP ${response.status}`);
console.log("Synthetic baseline restored with a fresh repair session.");
