/**
 * password.ts — turning passwords into something safe to store.
 *
 * The rule this file exists to enforce: the database never sees a password.
 * It sees a hash, and a hash cannot be turned back into the original.
 *
 * So when someone logs in we don't "look up their password." We hash what they
 * typed and check whether it matches the stored hash. And if this database is
 * ever stolen, the attacker gets a table of hashes they cannot reverse.
 */

import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

/**
 * Why argon2id specifically.
 *
 * Any old hash function won't do. SHA-256 is designed to be *fast*, which is a
 * virtue in most contexts and a disaster here: fast hashing means an attacker
 * with a stolen database can try billions of candidate passwords per second on
 * a GPU. Real human passwords don't survive that.
 *
 * Password hashes are therefore deliberately slow and, more importantly,
 * deliberately *memory-hungry*. GPUs get their speed from running thousands of
 * tiny cores in parallel, and those cores have very little memory each. A
 * function that demands a big chunk of RAM per guess doesn't parallelise onto
 * them — which is precisely the point.
 *
 * argon2id is the current standard recommendation for this. bcrypt is the older
 * option you'll see in most tutorials; it's still acceptable, but it's much less
 * memory-hard, so argon2id is the better default for new code.
 *
 * We use the library's defaults (visible in the hash string as m=19456 KiB,
 * t=2, p=1) because they track current guidance. Tuning these by hand is a good
 * way to accidentally make things weaker.
 */

/**
 * Hash a plaintext password for storage.
 *
 * The returned string looks like:
 *   $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
 *
 * Notice the salt is embedded in the output. A salt is random data mixed into
 * each hash so that two users with the same password get different hashes.
 * Without salts, identical hashes would reveal identical passwords, and
 * attackers could precompute one giant lookup table to crack every account at
 * once. With them, every password must be attacked individually.
 *
 * You don't manage the salt yourself — argon2 generates a fresh random one per
 * call and stores it in the string, so `verify` can find it later. That's why
 * hashing the same password twice gives two different results, and why you can
 * never compare password hashes with `===`.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext);
}

/**
 * Check a submitted password against a stored hash.
 *
 * Returns true on a match. Never throws for a wrong password — a wrong password
 * is an expected, ordinary event, not an error condition.
 *
 * A malformed or corrupted hash *would* throw, so we catch that and treat it as
 * a failed login. Refusing entry is the safe direction to fail.
 */
export async function verifyPassword(
  storedHash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext);
  } catch {
    return false;
  }
}

/**
 * A throwaway hash used to waste time deliberately. See the comment in
 * routes/auth.ts where it's used — it closes a subtle information leak.
 *
 * It must be a *genuine* argon2id hash. A hand-written fake would fail to parse
 * and return almost instantly, which would defeat the entire purpose: the point
 * is to spend the same time as a real verification.
 *
 * It's computed once, lazily, from random bytes that are immediately discarded,
 * so no password on earth matches it. The promise is cached, so the cost is
 * paid on the first failed login and never again.
 */
let dummyHashPromise: Promise<string> | null = null;

export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hash(randomBytes(32).toString("hex"));
  }
  return dummyHashPromise;
}
