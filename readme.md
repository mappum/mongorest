## mongorest

mongorest is Connect/Express middleware that lets you easily provide a REST API for your MongoDB data. It provides built-in CRUD functionality, and is extendable to add custom access validation (such as auth). It uses Mongoose as a MongoDB driver, and supports mapping to/from schemas.

### Usage
#### Basic Usage
Require mongorest, give it your MongoDB URI, and tell Express to use it. Make sure to use `express.bodyParser()` if you want to be able to use `POST` and `PUT`.
```js
var rest = require('mongorest')('mongodb://host/db');
app.use(express.bodyParser());
app.use(rest);
```
That's it! Now `GET`, `POST`, `PUT`, and `DELETE` requests to `/collection` or `/collection/id` will use the data in the database you provided. For `GET` requests, you may optionally use the parameters `query`, `limit`, and `skip`, like so:
```
GET /users/1234?limit=25&skip=50
```

#### Schemas
Mongoose uses schemas for accessing/inserting/modifying documents in the database. If you want mongorest to use your Mongoose schemas, you can set them with `rest.model('MyModel', mySchema)`.
```js
var User = rest.model('User', new rest.Schema({
	username: {type: String, unique: true},
	email: String,
	score: Number
});
```

This means you can also access or save this kind of model outside of the REST requests:
```js
new User({username: 'mappum', email: 'mappum@gmail.com', score: 1337}).save();

User.findOne({username: 'mappum'}, function(err, doc) {
	//code goes here
});
```

#### Middleware
This all works fine, but it's super unsecure. Anyone who can connect to the server may delete or modify whatever data they feel like. To solve this, we can add middleware for requests with `rest.<method>(callback)` and decide whether or not to go on with the request. For example, if we were using sessions we could do this:
```js
rest.delete(req, res, next) {
	// the mongodb document(s) this request deals with are at res.docs
	if(req.session.username === res.docs.username) {
		next(); // call next() if you want the request to succeed
	} else {
		res.send('Unauthorized - That was not your post! :(', 401);
	}
}
```