import "reflect-metadata";
import express from "express";
import redis from "redis";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import { MikroORM } from "@mikro-orm/core";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";

import microConfig from "./mikro-orm.config";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/Post";
import { UserResolver } from "./resolvers/user";
import { COOKIE_NAME, __prod__ } from "./constants";

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up;

  // I think you need to do this if you pass in a user in microConfig. Note that user must be SuperUser
  // UPDATE: Guess you do need this or else the new table won't get created
  const generator = orm.getSchemaGenerator();
  await generator.updateSchema();

  const app = express();

  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

  const whitelist = [
    "http://localhost:3000",
    "https://studio.apollographql.com",
  ];

  // Apply cors middleware to all routes
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow graphql-code-gen to work locally
        if (!__prod__ && origin === undefined) {
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
      store: new RedisStore({ client: redisClient, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        sameSite: "lax", // protecting against CSRF
        secure: __prod__, // cookie only works in https
        // This is needed for Apollo Studio
        // sameSite: 'none',
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
    context: ({ req, res }) => ({ em: orm.em, req, res }),
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
