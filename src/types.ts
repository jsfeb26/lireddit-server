import { Response, Request } from "express";
import { Session } from "express-session";
import { Redis } from "ioredis";

// This addresses issue with express-session having an immutable type
// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/49941#issuecomment-748513261
declare module "express-session" {
  interface Session {
    userId: number;
  }
}

export type MyContext = {
  req: Request & { session?: Session };
  res: Response;
  redis: Redis;
};
