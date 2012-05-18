var url = require('url'),
	querystring = require('querystring'),
	mongodb = require('mongodb'),
	mongoose = require('mongoose');

var rest = function(options) {
	if(typeof options === 'string') {
		var mongoUri = options;
		options = {};
		options.uri = mongoUri;
	}
	
	rest.mongodb = mongodb;
	rest.mongoose = mongoose;
	
	mongoose.connect(options.uri);
	rest.connection = mongoose.connection;
	rest.model = rest.connection.model;
	rest.Schema = mongoose.Schema;
	
	return function(req, res, next) {
		var method = req.method.toLowerCase(),
			path = url.parse(req.url),
			split = path.pathname.substr(1).split('/'),
			collection = split[0],
			model = collection.charAt(0).toUpperCase()
				+ collection.substring(1, collection.length - 1),
			id = split[1],
			query = querystring.parse(path.query);
			
		rest.connection.collection(collection).count(function(err, count) {
			var callback = function(err, docs) {
				if(err) {
					throw new Error(err);
				} else {
					res.docs = docs;
					var middleware = middlewares[method];
					var i = middleware.length - 1;
					while(i >= 0) {
						var next = false;
						middleware[i](req, res, function() { next = true; });
						if(!next) break;
						i--;
					}
				}
			};
					
			if(count) {
				try {
					res.collectionName = collection;
					res.docId = id;
					res.model = rest.connection.models[model];
					res.queryOptions = {skip: query.skip || 0, limit: query.limit || 25, query: query.query};
					
					if(res.model) {
						res.spec = (id ? {'_id': mongoose.Schema.Types.ObjectID(id)} : {});
						res.model.find(res.spec, [],
							res.queryOptions, callback);
					} else {
						res.spec = (id ? {'_id': mongodb.ObjectID(id)} : {});
						res.collection = rest.connection.collection(collection);
						res.collection.find(res.spec, [],
							res.queryOptions, function(err, cursor) {
								if(err) {
									throw new Error(err);
								} else {
									cursor.toArray(callback);
								}
							});
					}
				} catch(e) {
									res.header('Content-Type', 'application/json');
					res.json({'error': e.message}, 500);
				}
			} else {
				next();
			}
		});
	};
};

var middlewares = {
	'get': [function(req, res) {
		res.header('Content-Type', 'application/json');
		res.json(res.docs || {}, 200);
	}],
	'post': [function(req, res) {
		var callback = function(err, numAffected) {
			if(typeof numAffected === 'object') numAffected = numAffected.length;
			
			if(err) {
				throw new Error(err);
			} else {
				res.header('Content-Type', 'application/json');
				res.header('Location', res.collectionName + ''); //TODO
				res.json({'ok': numAffected || 1}, 201);
			}
		};
		
		if(res.model) {
			new res.model(req.body).save(callback);
		} else {
			res.collection.insert(req.body, callback);
		}
	}],
	'put': [function(req, res) {
		var callback = function(err, numAffected) {
			if(typeof numAffected === 'object') numAffected = numAffected.length;
			
			if(err) {
				throw new Error(err);
			} else {
				res.header('Content-Type', 'application/json');
				res.json({'ok': numAffected});
			}
		};
		
		if(res.model) {
			res.model.update({'_id': res.docs['_id']}, res.docs, {}, callback);
		} else {
			res.collection.update(res.spec, req.body, true, callback);
		}
	}],
	'delete': [function(req, res) {
		var callback = function(err, numAffected) {
			if(typeof numAffected === 'object') numAffected = numAffected.length;
			
			if(err) {
				throw new Error(err);
			} else {
				res.header('Content-Type', 'application/json');
				res.json({'ok': numAffected || 1});
			};
		}
				
		if(res.model) {
			res.docs.remove(callback);
		} else {
			res.collection.remove(res.spec, callback);
		}
	}]
};
module.exports = rest;