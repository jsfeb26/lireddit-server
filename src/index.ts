import { MikroORM } from "@mikro-orm/core";

import { Post } from "./entities/Post";
import microConfig from "./mikro-orm.config";

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up;

  // I think you need to do this if you pass in a user in microConfig. Note that user must be SuperUser
  // const generator = orm.getSchemaGenerator();
  // await generator.updateSchema();

  const post = orm.em.create(Post, { title: "my first post" });
  await orm.em.persistAndFlush(post);
};

main().catch((err) => {
  console.log(err);
});
