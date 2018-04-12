/*!
 * q - http
 * Copyright (c) 2011 LearnBoost <tj@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

const Koa = require("koa");
const router = require("koa-route");
const koaStatic = require("koa-static");

const routes = require("./routes");
const json = require("./routes/json");

const path = require("path");

const koakue = () => {
  const server = new Koa();

  server.use(koaStatic(path.join(__dirname, "public")));

  server.use(
    router.get("/job/search", async ctx => {
      ctx.body = await json.search(ctx.query.q);
    })
  );

  const jsonApiGet = [
    ["/stats", json.stats],
    ["/jobs/:from..:to/:order?", json.jobRange],
    ["/jobs/:type/:state/:from..:to/:order?", json.jobTypeRange],
    ["/jobs/:type/:state/stats", json.jobTypeStateStats],
    ["/jobs/:state/:from..:to/:order?", json.jobStateRange],
    ["/job/types", json.types],
    ["/job/:id", json.job],
    ["/job/:id/log", json.log],
    ["/inactive/:id", json.inactive]
  ];

  for (const route of jsonApiGet) {
    server.use(
      router.get(route[0], async (ctx, ...args) => {
        ctx.body = await route[1](...args);
      })
    );
  }

  server.use(
    router.put("/job/:id/state/:state", async (ctx, ...args) => {
      ctx.body = await json.updateState(...args);
    })
  );

  server.use(
    router.put("/job/:id/priority/:priority", async (ctx, ...args) => {
      ctx.body = await json.updatePriority(...args);
    })
  );

  server.use(
    router.del("/job/:id", async (ctx, ...args) => {
      ctx.body = await json.remove(...args);
    })
  );

  server.use(
    router.post("/job", async (ctx, ...args) => {
      //use bodyparser
      ctx.body = await json.createJob(...args);
    })
  );

  const jobRoutes = [
    ["/", routes.jobs("active")],

    ["/active", routes.jobs("active")],
    ["/inactive", routes.jobs("inactive")],
    ["/failed", routes.jobs("failed")],
    ["/complete", routes.jobs("complete")],
    ["/delayed", routes.jobs("delayed")]
  ];

  for (const route of jobRoutes) {
    server.use(
      router.get(route[0], async ctx => {
        ctx.body = await route[1]();
      })
    );
  }

  return server;
};
// expose the app

module.exports = koakue;
