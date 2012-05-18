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
	
	var api = function(req, res, next) {
		var method = req.method.toLowerCase(),
			path = url.parse(req.url),
			split = path.pathname.substr(1).split('/'),
			collection = split[0],
			model = collection.charAt(0).toUpperCase()
				+ collection.substring(1, collection.length - 1),
			id = split[1],
			query = querystring.parse(path.query);
			
		api.connection.collection(collection).count(function(err, count) {
			var callback = function(err, docs) {
				if(err) {
					throw new Error(err);
				} else {
					res.docs = docs;
					var i = api.middlewares[method].length - 1;
					while(i >= 0) {
						var next = false;
						api.middlewares[method][i](req, res, function() { next = true; });
						if(!next) break;
						i--;
					}
				}
			};
					
			if(count) {
				try {
					res.collectionName = collection;
					res.docId = id;
					res.model = api.connection.models[model];
					res.queryOptions = {
						skip: query.skip || 0,
						limit: query.limit || null,
						query: query.query || null
					};
					
					if(id || typeof id === 'number') {
						res.spec = {'_id': mongodb.ObjectID(id)};
					} else if(req.body) {
						res.spec = req.body;
					}
					
					if(req.method !== 'POST') {
						if(res.model) {
							res.model.find(res.spec, [], res.queryOptions, callback);
						} else {
							res.collection = api.connection.collection(collection);
							res.collection.find(res.spec, [], res.queryOptions,
								function(err, cursor) {
									if(err) {
										throw new Error(err);
									} else {
										cursor.toArray(callback);
									}
								});
						}
					} else {
						callback();
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
	
	api.mongodb = mongodb;
	api.mongoose = mongoose;
	
	mongoose.connect(options.uri);
	api.connection = mongoose.connection;
	api.model = api.connection.model;
	api.Schema = mongoose.Schema;
	
	api.middlewares = {
		'get': [function(req, res) {
			res.header('Content-Type', 'application/json');
			res.json(res.docs || [], 200);
		}],
		'post': [function(req, res) {
			var callback = function(err, numAffected) {
				if(typeof numAffected === 'object') numAffected = numAffected.length;
				
				if(err) {
					throw new Error(err);
				} else {
					res.header('Content-Type', 'application/json');
					res.header('Location', '/' + res.collectionName + '/'); //TODO
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

	api.on = function(method, handler) {
		(api.middlewares[method]).push(handler);
		return api;
	};

	api.get = function(handler) { return api.on('get', handler); };
	api.post = function(handler) { return api.on('post', handler); };
	api.put = function(handler) { return api.on('put', handler); };
	api.delete = function(handler) { return api.on('delete', handler); };
	
	if(options.readOnly) {
		var unauthorized = function(req, res) {
			res.json({'error': 'unauthorized'}, 401);
		};
		
		api.post(unauthorized)
			.put(unauthorized)
			.delete(unauthorized);
	}
	
	return api;
};

module.exports = rest;