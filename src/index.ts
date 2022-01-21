import "reflect-metadata";
import express from "express";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { createConnection } from "typeorm";

import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/Post";
import { UserResolver } from "./resolvers/user";
import { COOKIE_NAME, __prod__ } from "./constants";
import { User } from "./entities/User";
import { Post } from "./entities/Post";

const main = async () => {
  await createConnection({
    type: "postgres",
    database: "lireddit2",
    username: "postgres",
    password: "postgres",
    logging: true,
    synchronize: true,
    // migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Post, User],
  });

  // await conn.runMigrations();

  const app = express();

  const RedisStore = connectRedis(session);
  const redis = new Redis();

  const whitelist = [
    "http://localhost:3000",
    "https://studio.apollographql.com",
  ];

  // Apply cors middleware to all routes
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow graphql-code-gen to work locally
        if (!__prod__ && typeof origin === "undefined") {
          return callback(null, true);
        }

        if (origin && whitelist.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        sameSite: "lax", // protecting against CSRF
        secure: __prod__, // cookie only works in https
        // This is needed for Apollo Studio
        // sameSite: "none",
        // secure: true,
      },
      saveUninitialized: false,
      secret: "odsaifsodifjaposdijfiweyhghav",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ req, res, redis }),
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  // This is needed for Apollo Studio
  // const cors = {
  //   credentials: true,
  //   origin: "https://studio.apollographql.com",
  // };
  // apolloServer.applyMiddleware({ app, cors });

  app.listen(4000, () => {
    console.log("Server started on localhost:4000");
  });
};

main().catch((err) => {
  console.log(err);
});
