// Framework-free self-checks for the non-trivial business rules in API.md.
// Run: npx ts-node src/checks.ts
import assert from "assert";
import { profileCompletionPoints } from "./modules/tutors/tutors.service";
import { median } from "./modules/reveal/reveal.controller";

// --- Profile completion (API.md §3) — empty profile = base 20 -----------------
assert.strictEqual(profileCompletionPoints({}, 0, 0), 20);

// Each contribution lands the documented points.
assert.strictEqual(profileCompletionPoints({ display_name: "x" }, 0, 0), 25);
assert.strictEqual(profileCompletionPoints({ bio: "x" }, 0, 0), 30);
assert.strictEqual(
  profileCompletionPoints({ hourly_rate_min: "10" as any, hourly_rate_max: "20" as any }, 0, 0),
  30,
);
// Only one rate set → no +10.
assert.strictEqual(profileCompletionPoints({ hourly_rate_min: "10" as any }, 0, 0), 20);
assert.strictEqual(profileCompletionPoints({}, 1, 0), 30); // ≥1 language
assert.strictEqual(profileCompletionPoints({}, 0, 1), 35); // ≥1 credential

// Fully complete clamps to 100 (20+5+5+10+10+10+5+10+10+15 = 100).
assert.strictEqual(
  profileCompletionPoints(
    {
      display_name: "x",
      tagline: "x",
      bio: "x",
      avatar_url: "x",
      hourly_rate_min: "10" as any,
      hourly_rate_max: "20" as any,
      specialisations: ["a"],
      is_identity_verified: true,
    },
    2,
    3,
  ),
  100,
);

// go-live gate is 40% — a profile with display_name+language sits below it.
assert.ok(profileCompletionPoints({ display_name: "x" }, 1, 0) < 40);

// --- Reveal competitor median -------------------------------------------------
assert.strictEqual(median([]), null);
assert.strictEqual(median([30]), 30);
assert.strictEqual(median([20, 40, 30]), 30); // odd → middle
assert.strictEqual(median([20, 40]), 30); // even → mean of two middles
assert.strictEqual(median([25, 30]), 27.5); // even → rounded to cents

console.log("checks ok");
process.exit(0); // knex/redis clients keep the loop alive; we only needed the asserts.
