import { Connection, EntityManager, IDatabaseDriver } from "@mikro-orm/core";
import { Response, Request } from "express";
import { Session } from "express-session";

// This addresses issue with express-session having an immutable type
// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/49941#issuecomment-748513261
declare module "express-session" {
  interface Session {
    userId: number;
  }
}

export type MyContext = {
  em: EntityManager<IDatabaseDriver<Connection>>;
  req: Request & { session?: Session };
  res: Response;
};
