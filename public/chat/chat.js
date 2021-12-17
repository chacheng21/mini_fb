/**
 * Global State
 */
var socket = io();
var chatsHTML; // Stores List of available chats temporarily 
var activeChat = null; // id of chat currently selected
var friends = [];

/******************************************************
 * Dynamic HTML functions (functions that return HTML)*
 ******************************************************/
const makeMessage= function(message, sender, isloved, id) {
  const loved = (isloved)? "<span class='heart'>&#10084;</span>" : "";
  return `<div class="row">
            <div id="${id}" class="message" ondblclick="loveMessage(${id})" >${message}${loved}</div>
            <div class="sender">${sender}</div>
          </div>`
}

const makeChat = function(chatname, chatid) {
  return `<div class="row chatbox" id=${chatid}>${chatname}</div>`;
}

const makeParticipant = function(user) {
  return `<div class="row participant">${user}</div>`;
}

const makePotentialParticipant = function(user) {
  return `<div class="row potentialParticipant" onclick='addMember("${user}")'>Add ${user}</div>`;
}

const makeChatCreator = function(friends) {
  res = `<form id="createChatForm">
  <label>Chat Name</label>
  <input type = "text" name="chatname" id="form-chatname"><br>`;

  // For each friend add checkbos
  friends.forEach(friend => {
    var friendStatus = (friend.online)? "<span class='online'>Online</span>" : "Offline";
    res += `<input class="form-friendbox" type="checkbox" data-username="${friend.username}" name="${friend.username}">`
    res += `<label for="${friend.username}">${friend.username} (${friendStatus})</label><br>`
  });

  res += `<input type="submit" value="Create">
  </form>
  <div>
  <button onclick="showChats()">Cancel</button>
  </div>`

  return res;
}

const leaveButton = '<button class="row" id="leavebutton" onclick="leaveChat()">Leave Chat</button>';

const sendForm = `<form id="form-message">
<input type="text" id='messageinput' name="Message">
<input type="submit" id='sendbutton' value="Send">
</form>`

/******************************************************
 * Helper Functions                                   *
 ******************************************************/

/**
 * Load Chats
 */
const loadChats = function(data) {
  $("#chatcontainer").html('');
  data.forEach(element => {
    var chat_id = element.chat_id.S;
    $("#chatcontainer").append(makeChat(element.name.S, chat_id));
    $(`#${chat_id}`).attr("onclick", `selectChat("${chat_id}")`);
  })
}

/**
 * Fetch Chats, messages of top chat.
 */
 const createChat = function(chatname, users) {
  // Fetch Chats
  //console.log("Form Submitted");

  data = {'chatname': chatname, 'users': users}

  $.post('/chat/createChat', data)
  .done(data => loadChats(JSON.parse(data)))
  .catch(error => alert(error));
}

/**
 * Bound to button NEW
 */
 const showChatCreator = function() {
  // Backup previous HTML
  chatsHTML = $("#chatcontainer").html();

  // Fetch List of friends
  // Replace with Chat Creation Interface
  $("#chatcontainer").html(makeChatCreator(friends));
  $("#createChatForm").submit(e => {
    e.preventDefault();
    var chatname = $("#form-chatname").val();
    var users = $(".form-friendbox").toArray()
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.name);
    createChat(chatname, users);
  });
}

/**
 * Bound to button Cancel
 */
 const showChats = function() {
  $("#chatcontainer").html(chatsHTML);
}

/** 
 * Show Partcipants
 */
const showParticipants = function(members) {
  $("#infocontainer").html('');
  data = JSON.parse(members);
  // Add Members
  data.forEach(user => {
    $("#infocontainer").append(makeParticipant(user));
  })
  // Add potential members
  potentials = friends.filter(friend => !data.includes(friend.username));
  potentials.forEach(user => {
    $("#infocontainer").append(makePotentialParticipant(user.username));
  })

  // Add Leave Button
  $("#infocontainer").append(leaveButton);
}

/**
 * Select New Chat
 */
 const selectChat = function(chat_id) {
  // Unselect old
  $(`#${activeChat}`).css("border-right", "");
  // Select New
  activeChat = chat_id;
  $(`#${chat_id}`).css("border-right", "10px solid cyan");
  // Clear Right Section
  $("#messagecontainer").html('');
  // Bind Send Buton
  $("#form-message").remove();
  $("#column2").append(sendForm);
  $("#form-message").on("submit", e => sendMessage(e));
  // Fill with Messages
  $.post('/chat/getMessages', {'chat_id': chat_id})
  .done(data => {
    data = JSON.parse(data);
    data.forEach(message => {
      $("#messagecontainer").append(makeMessage(message.text.S, message.autor.S, false, message.message_id.S));
    })
  })
  .catch(error => {alert("ERROR: See logs"); console.log(error)});
  
  // Load Particiapnts
  $("#infocontainer").html('');
  $.post('/chat/getMembers', {'chat_id': chat_id})
 .done(data => showParticipants(data))
 .catch(error => {alert("ERROR: See logs"); console.log(error)});

  // Enter Socket.io Room
  socket.emit('enter', {'chat_id': chat_id});
}

/**
 * Chat Write
 */
const sendMessage = function(e) {
  e.preventDefault();
  var message = $("#messageinput").val();
  socket.emit('message', {'message': message, 'chat_id': activeChat});
};

const loveMessage = function(message_id) {
  const chat_id = activeChat;
  console.log(`Loved Message ${message_id}!`);
  // Locally Change Heart
  const elem = $(`#${message_id}`);
  const num_children = elem.children().length;
  if (num_children == 0) {
    elem.append("<span class='heart'>&#10084;</span>")
  }
  else {
    elem.children().last().remove();
  }
  //$.post('/chat/addMember', {'chat_id': activeChat, 'user': user})
  //.done(data => showParticipants(data))
  //.catch(error => {alert("ERROR: See logs"); console.log(error)});
};

/******************************************************
 * Binded Finctions                                   *
 ******************************************************/

// Bounded to each potential member in members column
const addMember = function(user) {
  console.log("Adding " + user);
  $.post('/chat/addMember', {'chat_id': activeChat, 'user': user})
  .done(data => showParticipants(data))
  .catch(error => {alert("ERROR: See logs"); console.log(error)});
}

// Asynchronous Chat Message
socket.on('message', function(msg) {
  console.log(msg);
  $("#messagecontainer").append(makeMessage(msg.message, msg.autor, false, msg.id));
});

socket.on('invite', function(msg) {
  console.log("invited");
  if (confirm(`${msg.host} invites you to chat. Refresh to Join?`)) {
    location.reload();
  }
});

// Bounded to Leave Chat Button
const leaveChat = function() {
  $.post('/chat/exit', {'chat_id': activeChat})
  .then(() => location.reload())
  .catch(error => {alert("ERROR: See logs"); console.log(error)});
}

const fetchFriends = function() {
  $.getJSON('/getFriends')
  .done(data => {
    friends = data;
  })
  .catch(error => console.log(error));
}

const initPage = function() {
  fetchFriends();
  setInterval(fetchFriends, 5*1000);

  $.getJSON('/chat/getChats')
  .done(data => {
    // Show All Participating Chats
    loadChats(data);
    // Select First Chat, if Chat Exists
    if (data.length > 0) 
      selectChat(data[0].chat_id.S);
  })
  .catch(error => console.log(error));
}
window.onload = initPage();