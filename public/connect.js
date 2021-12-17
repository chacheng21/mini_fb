var socket = io();

socket.on('invite', function(msg) {
  console.log("invited");
  if (confirm(`${msg.host} invites you to chat. Join?`)) {
    location.href = '/chat';
  }
});