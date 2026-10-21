import { randomInt } from "node:crypto";
import { createInterface } from "node:readline";
import { hashPassword } from "./accounts.js";

// Makes the value for one DASHBOARD_USER_<NAAM> variable (see accounts.ts).
// Run it in the Northflank shell (or anywhere the server is built):
//
//   node server/dist/hashPassword.js            type a password (hidden), twice
//   node server/dist/hashPassword.js --nieuw    generate a strong password
//   node server/dist/hashPassword.js "$BETA_PASSWORD"   hash a given password
//
// Then append ":" and the rights (reply, ai, or nothing for view-only).

const MIN_LENGTH = 10;
// No look-alikes (0/O, 1/l/I) so a generated password can be read out or
// copied by hand without mistakes.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(): string {
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""),
  );
  return groups.join("-");
}

/** Asks each question in turn without echoing what's typed. One reader
 * for all of them: a second reader would miss input the first had
 * already buffered (e.g. when lines are pasted in quick succession). */
function askHidden(questions: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let current = "";
    const muted = rl as unknown as { _writeToOutput: (s: string) => void };
    muted._writeToOutput = (s: string) => {
      if (s.includes(current)) process.stdout.write(current);
    };
    const answers: string[] = [];
    const next = () => {
      if (answers.length === questions.length) {
        rl.close();
        resolve(answers);
        return;
      }
      current = questions[answers.length];
      rl.question(current, (answer) => {
        process.stdout.write("\n");
        answers.push(answer);
        next();
      });
    };
    next();
  });
}

function printResult(password: string, generated: boolean) {
  const hash = hashPassword(password);
  console.log("");
  if (generated) {
    console.log(`Wachtwoord (geef dit aan de gebruiker):  ${password}`);
  }
  console.log(`Waarde voor DASHBOARD_USER_<NAAM>:       ${hash}:<rechten>`);
  console.log("");
  console.log("Vervang <rechten> door: reply  |  reply,ai  |  niets (alleen bekijken)");
}

async function main() {
  const arg = process.argv[2];

  if (arg === "--nieuw") {
    printResult(generatePassword(), true);
    return;
  }

  let password = arg;
  if (!password) {
    const [typed, again] = await askHidden(["Wachtwoord: ", "Nog een keer: "]);
    password = typed;
    if (password !== again) {
      console.error("De twee wachtwoorden zijn niet gelijk. Probeer het opnieuw.");
      process.exit(1);
    }
  }
  if (password.length < MIN_LENGTH) {
    // A password passed in directly is usually an existing one being
    // carried over (e.g. "$BETA_PASSWORD") — warn, don't block that.
    if (arg) {
      console.warn(`Let op: dit wachtwoord is korter dan ${MIN_LENGTH} tekens.`);
    } else {
      console.error(`Kies een wachtwoord van minstens ${MIN_LENGTH} tekens.`);
      process.exit(1);
    }
  }
  printResult(password, false);
}

void main();
