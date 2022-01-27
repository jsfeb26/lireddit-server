import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { getConnection } from "typeorm";

import { Post } from "../entities/Post";
import { Updoot } from "../entities/Updoot";
import { User } from "../entities/User";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  // This allows us to not have to query or join to get creator for post
  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId);
  }

  @FieldResolver(() => String)
  textSnippet(@Root() post: Post) {
    return post.text.slice(0, 50);
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null;
    }

    const updoot = await updootLoader.load({
      postId: post.id,
      userId: req.session.userId,
    });

    return updoot ? updoot.value : null;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;

    const updoot = await Updoot.findOne({ where: { postId, userId } });

    if (updoot && updoot.value !== realValue) {
      // User has already voted on the post before
      // and they are changin their vote
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
            update updoot
            set value = $1
            where "postId" = $2 and "userId" = $3
          `,
          [realValue, postId, userId]
        );

        await tm.query(
          `
            update post
            set points = points + $1
            where id = $2
          `,
          [2 * realValue, postId] // Need to do twice the realValue because we are negating the original vote and then adding on the next vote
        );
      });
    } else if (!updoot) {
      // has never voted before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
            insert into updoot ("userId", "postId", value)
            values ($1, $2, $3);
          `,
          [userId, postId, realValue]
        );

        await tm.query(
          `
            update post
            set points = points + $1
            where id = $2
          `,
          [realValue, postId]
        );
      });
    }

    // await getConnection().query(
    //   `
    //     START TRANSACTION;

    //       insert into updoot ("userId", "postId", value)
    //       values (${userId}, ${postId}, ${realValue});

    //       update post
    //       set points = points + ${realValue}
    //       where id = ${postId};

    //     COMMIT;
    //   `
    // );

    return true;
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;

    const replacements: any[] = [realLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    // Underrated way to fetch data in GraphQL
    // Do one big query with a join
    // Advantages
    //   - Simple
    //   - Good for Performance
    // Disadvantages
    //   - Always fetching creator
    //   - Duplicating logic for fetching creator
    const posts = await getConnection().query(
      `
        select p.*
        from post p
        ${cursor ? `where p."createdAt" < $${2}` : ""}
        order by p."createdAt" DESC
        limit $1
      `,
      replacements
    );

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    return Post.create({ ...input, creatorId: req.session.userId }).save();
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

    return result.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    // Not Cascade Way
    const post = await Post.findOne(id);
    if (!post) {
      return false;
    }

    if (post.creatorId !== req.session.userId) {
      throw new Error("Not authorized");
    }

    await Updoot.delete({ postId: id });
    await Post.delete({ id, creatorId: req.session.userId });

    // Cascade Way
    // await Post.delete({ id, creatorId: req.session.userId });

    return true;
  }
}
