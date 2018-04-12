/*!
 * kue - http - routes
 * Copyright (c) 2011 LearnBoost <tj@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Queue = require('kue')
  , Job   = Queue.Job
  , queue = Queue.createQueue()
  , pug = require('pug');

/**
 * Serve the index page.
 */

exports.jobs = function( state ) {
  return () => new Promise((res, rej) => {
    queue.types(function( err, types ) {
      if( err ) rej(err);
      res(pug.renderFile(__dirname + '/../views/job/list.pug', {
        state: state, types: types, title: 'Kue'
      }));
    });
  });
};
