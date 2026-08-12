/**
 * express.d.ts — teaching TypeScript about a property we add to Express.
 *
 * Our auth middleware attaches the signed-in user to `req.user`. Express knows
 * nothing about that property, so without this file every `req.user` would be a
 * type error.
 *
 * The technique is *declaration merging*: when you re-declare an interface that
 * already exists, TypeScript merges your fields into the original rather than
 * replacing it. So `Request` keeps everything Express gave it and gains `user`.
 *
 * This is a `.d.ts` file — a declaration file. It contains only type
 * information and produces no JavaScript. It exists purely to describe things
 * to the compiler.
 */

import type { SessionUser } from "../lib/session.js";

declare global {
  namespace Express {
    interface Request {
      /**
       * The signed-in user, set by the auth middleware.
       *
       * Optional on purpose. Most requests aren't authenticated, and marking it
       * optional forces you to check before using it — which is exactly the
       * habit you want. Inside a route wrapped in `requireAuth` it's guaranteed
       * to be present, and that route can use `req.user!` to say so.
       */
      user?: SessionUser;
    }
  }
}

// An empty export marks this file as a module, which is what makes the
// `declare global` block above legal. Without it TypeScript treats the file as
// a global script and the augmentation doesn't apply correctly.
export {};
