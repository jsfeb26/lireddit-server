import { __prod__ } from "./constants";
import { Post } from "./entities/Post";
import { MikroORM } from "@mikro-orm/core";
import path from "path";

export default {
  migrations: {
    path: path.join(__dirname, "./migrations"),
    pattern: /^[\w-]+\d+\.[tj]s$/,
  },
  entities: [Post],
  dbName: "lireddit",
  type: "postgresql",
  // user: "arlo",
  // password: "arlo2020",
  debug: !__prod__,
} as Parameters<typeof MikroORM.init>[0];
// Parameters is a special type that gets the parameters of a function
// it returns an array so we need to get the first one

// export default {
//   entities: [Post],
//   dbName: "lireddit",
//   type: "postgresql",
//   debug: !__prod__,
// } as const;
// Casting this to const will make types of dbName and type the actual type rather then type string
// This makes it more specific
