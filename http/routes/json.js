/*!
 * kue - http - routes - json
 * Copyright (c) 2011 LearnBoost <tj@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Queue = require("kue"),
  Job = Queue.Job,
  lodash = require("lodash"),
  queue = Queue.createQueue();

// TODO: create Job function is not transformed

/**
 * Search instance.
 */

var search;
function getSearch() {
  if (search) return search;
  var reds = require("reds");
  reds.createClient = Queue.redis.createClient;
  return (search = reds.createSearch(queue.client.getKey("search")));
}

/**
 * Get statistics including:
 *
 *   - inactive count
 *   - active count
 *   - complete count
 *   - failed count
 *   - delayed count
 *
 */

exports.stats = () =>
  new Promise((res, rej) => {
    get(queue)("inactiveCount")("completeCount")("activeCount")("failedCount")(
      "delayedCount"
    )("workTime")(function(err, obj) {
      if (err) rej(err);
      res(obj);
    });
  });

/**
 * Get job types.
 */

exports.types = () =>
  new Promise((res, rej) => {
    queue.types(function(err, types) {
      if (err) rej(err);
      res(types);
    });
  });

/**
 * Get jobs by range :from..:to.
 */

exports.jobRange = (from, to, order) =>
  new Promise((res, rej) => {
    Job.range(parseInt(from, 10), parseInt(to, 10), order, function(err, jobs) {
      if (err) rej(err);
      res(jobs);
    });
  });

/**
 * Get jobs by :state, and range :from..:to.
 */

exports.jobStateRange = (state, from, to, order) =>
  new Promise((res, rej) => {
    Job.rangeByState(
      state,
      parseInt(from, 10),
      parseInt(to, 10),
      order,
      function(err, jobs) {
        if (err) rej(err);
        res(jobs);
      }
    );
  });

/**
 * Get jobs by :type, :state, and range :from..:to.
 */

exports.jobTypeRange = (type, state, from, to, order) =>
  new Promise((res, rej) => {
    Job.rangeByType(
      type,
      state,
      parseInt(from, 10),
      parseInt(to, 10),
      order,
      function(err, jobs) {
        if (err) rej(err);
        res(jobs);
      }
    );
  });

/**
 * Get jobs stats by :type and :state
 */

exports.jobTypeStateStats = (type, state) =>
  new Promise((res, rej) => {
    queue.cardByType(type, state, function(err, count) {
      if (err) rej(err);
      res({ count: count });
    });
  });

/**
 * Get job by :id.
 */

exports.job = id =>
  new Promise((res, rej) => {
    Job.get(id, function(err, job) {
      if (err) rej(err);
      res(job);
    });
  });

/**
 * Restart job by :id.
 */

exports.inactive = id =>
  new Promise((res, rej) => {
    Job.get(id, function(err, job) {
      if (err) rej(err);
      job.inactive();
      res({ message: "job " + id + " inactive" });
    });
  });

/**
 * Create a job.
 */

exports.createJob = body =>
  new Promise((res, rej) => {
    if (lodash.isEmpty(body)) {
      res();
    }

    const jobs = Array.isArray(body) ? body : [body];

    async function _create(args, next) {
      if (!args.type) {
        return { err: "Must provide job type", status: null, errCode: 400};
      }

      var job = new Job(args.type, args.data || {});
      var options = args.options || {};
      if (options.attempts) job.attempts(parseInt(options.attempts));
      if (options.priority) job.priority(options.priority);
      if (options.delay) job.delay(options.delay);
      if (options.searchKeys) job.searchKeys(options.searchKeys);
      if (options.backoff) job.backoff(options.backoff);
      if (options.removeOnComplete)
        job.removeOnComplete(options.removeOnComplete);
      if (options.ttl) job.ttl(options.ttl);

      return await new Promise((res, rej) => {
        job.save(function(err) {
          if (err) {
            res({ err: err.message , status: null, errCode: 500});
          } else {
            res({ err: null, status: { message: "job created", id: job.id }, errCode: null});
          }
        });
      });      
    }

    var i = 0,
      len = body.length;
    var result = [];

    for(const job of jobs) {
      const { err, status, errCode}  = await _create(job);
          
      if (err) {
        throw new { code: errCode, message: err};
      }

      result.push(status); 
    }

    return result;
  
  });

/**
 * Remove job :id.
 */

exports.remove = id =>
  new Promise((res, rej) => {
    Job.remove(id, function(err) {
      if (err) rej(err);
      res({ message: "job " + id + " removed" });
    });
  });

/**
 * Update job :id :priority.
 */

exports.updatePriority = (id, priority_str) =>
  new Promise((res, rej) => {
    var priority = parseInt(priority_str, 10);

    if (isNaN(priority)) return res.json({ error: "invalid priority" });
    Job.get(id, function(err, job) {
      if (err) return res.json({ error: err.message });
      job.priority(priority);
      job.save(function(err) {
        if (err) rej({ error: err.message });
        res({ message: "updated priority" });
      });
    });
  });

/**
 * Update job :id :state.
 */

exports.updateState = (id, state) =>
  new Promise((res, rej) => {
    Job.get(id, function(err, job) {
      if (err) return res.json({ error: err.message });
      job.state(state);
      job.save(function(err) {
        if (err) rej({ error: err.message });
        res({ message: "updated state" });
      });
    });
  });

/**
 * Search and respond with ids.
 */

exports.search = query =>
  new Promise((res, rej) => {
    getSearch()
      .query(query)
      .end(function(err, ids) {
        if (err) rej(err);
        res(ids);
      });
  });

/**
 * Get log for job :id.
 */

exports.log = id =>
  new Promise((res, rej) => {
    Job.log(id, function(err, log) {
      if (err) rej(err);
      res(log);
    });
  });

/**
 * Data fetching helper.
 */

function get(obj) {
  var pending = 0,
    res = {},
    callback,
    done;

  return function _(arg) {
    switch (typeof arg) {
      case "function":
        callback = arg;
        break;
      case "string":
        ++pending;
        obj[arg](function(err, val) {
          if (done) return;
          if (err) return (done = true), callback(err);
          res[arg] = val;
          --pending || callback(null, res);
        });
        break;
    }
    return _;
  };
}
