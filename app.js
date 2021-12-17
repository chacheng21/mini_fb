var express = require('express');
var session = require('express-session');
var routes = require('./routes/routes.js');
var chatRoutes = require('./routes/chatRoutes.js');

var app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Session Logic
app.use(express.urlencoded());
const sessionMiddleware = session({ secret: 'loginSecret' });
// register middleware in Express
app.use(sessionMiddleware);
// register middleware in Socket.IO
io.use((socket, next) => {  
   sessionMiddleware(socket.request, {}, next);  
});
global.activeUsers = new Map();

// Expose io to handlers
app.use(function(req, res, next) {
   req.io = io;
   next();
});

// Static Files
app.use(express.static(__dirname + '/public'));

/**********
 * ROUTES *
 **********/

app.get('/', routes.get_main);
app.get('/Home', routes.home);
app.get('/Walls', routes.walls);

app.post('/LoginAuth', routes.auth);
app.post('/signup', routes.signup);
app.post('/createAccount', routes.createAccount);
app.post('/Home', routes.home);

app.post('/createPost', routes.createPost);

app.get('/chat', chatRoutes.get);
app.get('/chat/getChats', chatRoutes.getChats); // returns json
app.post('/chat/createChat', chatRoutes.createChat); // returns json
app.post('/chat/getMessages', chatRoutes.getMessages); // returns json
app.post('/chat/getMembers', chatRoutes.getMembers); // returns json
app.post('/chat/addMember', chatRoutes.addMember); // returns json
app.post('/chat/exit', chatRoutes.exit);

app.get('/getFriends', routes.getFriends); // returns json
app.get('/friends', routes.friends);
app.get('/friendVisualizer', routes.displayVisualizer);
app.get('/friendvisualization', routes.friendVisualizer);
app.get('/getFriends/:user', routes.getFriendVisualizer);
app.post('/addFriend', routes.addFriend);
app.post('/removeFriend', routes.removeFriend);

app.get('/post', routes.viewPosts);
app.post('/commentPost', routes.commentPost);

app.get('/editAccount', routes.editAccount);
app.post('/updateAccount', routes.updateAccount);

app.get('/searchArticlesPage', routes.searchArticlesPage);
app.post('/likeArticle', routes.likeArticle);

app.get('/search/:user', routes.searchResults); 

app.get('/logout', routes.logout);

// app.post('/onlyGetComments', routes.onlyComments);
// app.post('/onlyHomePosts', routes.onlyHomePosts);
// app.post('/getWallPosts', routes.getWallPosts);

/*************
 * Socket.io *
 *************/
io.on('connection', (socket) => { 
   // Establish Connection 
   activeUsers.set(socket.request.session.username, socket.id);

   // Sent Message
   socket.on('message', chatRoutes.message(io, socket));

   // Enter Chat Group
   socket.on('enter', req => {
      const chat_id = req.chat_id;
      for (let item of socket.rooms)
         socket.leave(item);
      socket.join(chat_id);
   });

   // Quit
   socket.on('disconnect', (reason) => {
      activeUsers.delete(socket.request.session.username);
   });
});


/* Run the server */
const port = 8080
console.log('NETS 212 Final Project');
server.listen(port, () => console.log('Listening on port ' + port));
   