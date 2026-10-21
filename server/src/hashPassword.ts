import { hashPassword } from "./accounts.js";

// Prints the hash to put in DASHBOARD_USERS for one account's password.
// Run it anywhere the server is built — including the Northflank shell:
//   node server/dist/hashPassword.js 'het-wachtwoord'
const password = process.argv[2];
if (!password) {
  console.error("Gebruik: node server/dist/hashPassword.js '<wachtwoord>'");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Kies een wachtwoord van minstens 8 tekens.");
  process.exit(1);
}
console.log(hashPassword(password));
