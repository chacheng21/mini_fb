const path = require('path');
const db = require('../models/database.js');

/********************
 * Helper Functions *
 ********************/

var authenticate = function(req, res) {
  if (req.session.username == undefined) {
    res.redirect('/')
    return false;
  }
  else
    return true;
}

const destroyChat = function(chat_id) {
  db.getMessages(chat_id)
  .then(messages => {
    ids = messages.map(message => message.message_id.S);
    return db.removeMessages(chat_id, ids);
  })
  .then(() => db.removeChat(chat_id))
  .then(() => console.log(`Removed Chat ${chat_id}`))
  .catch((error) => console.log(error));
}

const getRandomInt = function(max) {
  return Math.floor(Math.random() * max);
}

const sendInvite = function(users, host, io) {
  var online = Array.from(activeUsers.keys());
  var onlineAndInvited = online.filter(username => users.includes(username));
  onlineAndInvited.forEach(user => {
    var socketid = activeUsers.get(user);
    console.log(`Sending Invite to user ${user}, id ${socketid}`)
    io.to(socketid).emit('invite', {'host': host})
  })
}

/******************
 * Route Handlers *
 ******************/

/**
 * GET /chat 
 * The Chat Page
 */
var get = function(req, res) {
  if (!authenticate(req, res))
    return;
  res.sendFile(path.join(__dirname, '../views/chat.html'));
}

/**
 * GET /getChats
 * @returns list of participating chats.
 */
 var getChats = function(req, res) {
  if (!authenticate(req, res))
    return;
  db.getChatIDs(req.session.username) // get Ids of chats user particpates in
  .then(ids => db.getChats(ids)) // get name of those chats
  .then(chats => { // render page
    //console.log(chats);
    res.send(JSON.stringify(chats));
  })
  .catch(error => {
    console.log(error);
    return;
  })
}

/**
 * POST /createChat
 * @returns new list of participating chats on success.
 */
 var createChat = function(req, res) {
  if (!authenticate(req, res))
    return;
  if (req.body.chatname == '') {
    res.send("Invalid Chat Name");
    return;
  }

  var chatid = getRandomInt(10**6).toString()+'-'+Date.now();
  var users = req.body.users;
  sendInvite(users, req.session.username, req.io); // Notify Users Online
  users.push(req.session.username);

  db.createChat(chatid, req.body.chatname, req.session.username)
  .then(() => db.addChatUsers(chatid, req.body.users))
  .then(() => getChats(req,res))
  .catch(err => res.send(err));
}

/**
 * GET /getMessages
 * @returns list of all Messages
 */
 var getMessages = function(req, res) {
  if (!authenticate(req, res))
    return;
  var chat_id = req.body.chat_id;
  db.getMessages(chat_id)
  .then(messages => {
    //console.log(messages);
    res.send(JSON.stringify(messages));
  })
  .catch(error => {
    console.log(error);
    return;
  })
}

/**
 * GET /getMembers
 * @returns list of all Members with
 */
 var getMembers = function(req, res) {
  if (!authenticate(req, res))
    return;
  const chat_id = req.body.chat_id;
  db.getChatUsers(chat_id)
  .then(users => {
    res.send(JSON.stringify(users));
  })
  .catch(error => {
    console.log(error);
    return;
  })
}

/**
 * GET /addMember
 * @returns list of all Members with
 */
 var addMember = function(req, res) {
  if (!authenticate(req, res))
    return;
  const chat_id = req.body.chat_id;
  const user = req.body.user;
  db.addChatUsers(chat_id, [user])
  .then(() => getMembers(req, res))
  .catch((error) => console.log(error));
}

/**
 * POST /exit
 * Exit a Chat
 * @returns reloads page
 */
 var exit = function(req, res) {
  if (!authenticate(req, res))
    return;
  const chat_id = req.body.chat_id;
  const user = req.session.username;
  db.removeChatUser(chat_id, user)
  .then(() => {
    res.sendStatus(200);
    db.getChatUsers(chat_id)
    .then((data) => {
      if (data.length == 0)
        destroyChat(chat_id);
    })
    .catch((error) => console.log(error));
  })
  .catch((error) => console.log(error));
}



var message = function(io, socket) { 
  return function(msg) {
    // Save Message
    const chat_id = msg.chat_id;
    const message = msg.message;
    const message_id = Date.now().toString();
    const autor = socket.request.session.username;
    db.addMessage(chat_id, message_id, message, autor)
    .then(() => {
      // Send Message to Room
      console.log("Save Messsage");
      io.to(chat_id).emit('message', {'message': message, 'autor': autor});
    })
    .catch(err => console.log(err));
  }
}

var enterRoom = function(req) {
  const chat_id = req.chat_id;
  socket.join
}


var chatRoutes = { 
  get: get,
  getChats: getChats,
  createChat: createChat,
  getMessages: getMessages,
  getMembers: getMembers,
  addMember: addMember,
  message: message,
  enterRoom: enterRoom,
  exit: exit
};  
module.exports = chatRoutes;