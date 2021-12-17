var AWS = require('aws-sdk');
const bcrypt = require('bcrypt');

// Configure DynamoDB
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();

const saltRounds = 10;

/** Looks up a user in the database */
var myDB_userLookup = function(username, password, callback) {
	//console.log('Validating: ' + username);
	if (username === null || username.length === 0) {
		// Output username error
		callback("username empty", null);
	}
	
	else if (password=== null || password.length === 0) {
		// Output username error
		callback("password empty", null);
    }
    else {
	var params = {
		KeyConditions: {
			Username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: username}]
			}
		},
		TableName: "Accounts"
	};
  db.query(params, function(err, data) {
        if (err) {
          callback(err, null);
        } else if (data.Items.length == 0) {
          callback('Invalid username', null);
        } else {
          var user = data.Items[0];
          bcrypt.compare(password, data.Items[0].Password.S, function(err, res) {
            // res is true as the original password is the same
            // res == true
            if (err) {
              callback(err, null);
            }
            else if (res) {
              callback(err, user);
            } else {
              callback('Invalid Password', null);
            }
          });
        }
    });

  }
}

  /** Looks up a user in the database */
var myDB_userExists = function(username, callback) {
	if (username === null || username.length === 0) {
		// Output username error
		callback("username empty", null);
	}

  else {
	var params = {
		KeyConditions: {
			Username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: username}]
			}
		},
		TableName: "Accounts"
	};
  db.query(params, function(err, data) {
        if (err) {
          callback(err, null);
        } else if (data.Items.length == 0) {
          callback('Invalid username', null);
        } else {
          callback(null, "present");
        }
        });
  }
}
/** Adds a user to the database if they don't exist already. If they exist already, it returns an error' */
var myDB_userInput = function(uname, pword, fName, lName, email, affil, bday, cat, callback) {
	if (uname === null || uname.length === 0) {
		// Output username error
		callback("username empty", null);
	}
	
	else if (pword=== null || pword.length === 0) {
		// Output username error
		callback("password empty", null);
    }
    else if (fName === null || fName.length === 0) {
		// Output username error
		callback("first name empty", null);
    }
    else if (lName === null || lName.length === 0) {
		// Output username error
		callback("last name empty", null);
    }
    else if (email === null || email.length === 0) {
		// Output username error
		callback("email empty", null);
    }
    else if (affil === null || affil.length === 0) {
		// Output username error
		callback("affiliation empty", null);
    }
    else if (bday === null || bday.length === 0) {
		// Output username error
		callback("birthday empty", null);
    }
    else if (cat === null || cat.length < 2) {
		// Output username error
		callback("Please enter at least 2 categories", null);
    }
    else {
    bcrypt.genSalt(saltRounds, function(err, salt) {
        bcrypt.hash(pword, salt, function(err, hash) {
            var params = {
                Item: {
                  "Username": {
                    S: uname
                  },
                  "Affiliation": {
                    S: affil
                  },
                  "Birthday": {
                      S: bday
                  },
                  "Categories": {
                      L: cat
                  },
                  "Email": {
                      S: email
                  },
                  "First Name": {
                      S: fName
                  }, 
                  "Last Name": {
                      S: lName
                  },
                  "Password": {
                      S: hash
                  },
          
                },
                TableName: "Accounts",
                ConditionExpression: "attribute_not_exists(Username)",
                ReturnValues: 'NONE'
            };
          
            db.putItem(params, function(err, data){
              if (err){
                console.log(err);
                callback(err, null) }
              else {
                callback(null, true) }
            });
        });
    });
	
    }
}

var myDB_createPost = function(author, host, post, timeStamp, comments, callback) {
	if (author === null || author.replace(/\s+/g, '').length === 0) {
		// Output username error
		callback("user empty", null);
	} 
	
	else if (post === null || post.replace(/\s+/g, '').length === 0) {
		// Output post error
		callback("post empty", null);
  }
  
  else {
    var params = {
      Item: {
        "user": {
          S: host
        },
        "Time Stamp": {
          N: timeStamp.toString()
        },
        "Comments": {
          L: comments
        },
        "Post": {
          S: post
        },
        "Author" : {
          S : author
        }, 
        "id" : {
          S: host + timeStamp.toString()
        }
      },
      TableName: "Posts",
      ReturnValues: 'NONE'
    };
    db.putItem(params, function(err, data){
      if (err){
        console.log(err);
        callback(err, null) 
      } else {
        callback(err, true) 
      }
    });
  }
}

var myDB_getUserPosts = function(username, callback) {
  if (username === null || username.replace(/\s+/g, '').length === 0) {
		// Output username error
		callback("user empty", null);
	} 

  const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
  ];

  var params = {
		KeyConditions: {
			user: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: username }]
			}
		},
		TableName: "Posts",
    ScanIndexForward: false,
	};

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      var outputArray = [];
			data.Items.forEach(function(item) {
				var object = {};
				object['user'] = item.user.S;
        var date = new Date(Number(item['Time Stamp'].N))
        var dateString = monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear() + " at " + date.getHours() + ":" + date.getMinutes()
				object['time'] = item['Time Stamp'].N
        object['dateTime'] = dateString;
        object['Comments'] = item.Comments.L;
				object['Post'] = item.Post.S;
        object['Author'] = item.Author.S;
        object['id'] = item.id.S;
				outputArray.push(object);
			})
			callback(err, outputArray);
    }
  });
}


var myDB_getUser = function(username, callback) {
  var params = {
    KeyConditions: {
      Username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: username }]
      }
    },
    TableName: "Accounts",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      callback(err, data);
    }
  })
}

var myDB_getFriends = function(username, callback) {
  var params = {
    KeyConditions: {
      Username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: username }]
      }
    },
    TableName: "Friends",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      var outputArray = [];
			data.Items.forEach(function(item) {
        outputArray.push(item['Friend Name'].S)
			})
			callback(err, outputArray);
    }
  });
  
}


var myDB_getFriendsJSON = function(username, fullName, callback) {
  var obj = new Object();
  obj.id = username;
  obj.name = fullName;
  obj.data = {};

  var params = {
    KeyConditions: {
      Username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: username }]
      }
    },
    TableName: "Friends",
    ProjectionExpression: "#FFN, #FN",
    ExpressionAttributeNames: {
      "#FFN": "Friend Full Name",
      "#FN": "Friend Name",
    }
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log("query failed");
      callback(err, null);
    } else {
      childrenArray = [];
      data.Items.forEach(function(item) {
        var obj2 = new Object();
        obj2.id = item['Friend Name'].S;
        obj2.name = item['Friend Full Name'].S;
        obj2.children = [];
        obj2.data = {};
        childrenArray.push(obj2);
      })
      obj.children = childrenArray;
      console.log("query in progress");
      console.log(obj);
			callback(null, obj);
    }
  });
  
}

var myDB_getAffiliatedFriends = function(user, fName, affil, friends, callback) {
  var obj = new Object();
  obj.id = user;
  obj.name = fName;
  obj.data = {};
  
  var childrenArray = [];
  var counter = friends.length;
  friends.forEach(function(friend) {
    var params = {
      KeyConditions: {
        Username: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [{ S: friend }]
        }
      },
      TableName: "Accounts",
      };
    db.query(params, function(err, data) {
      if (err) {
        callback(err, null);
      } else {
        counter--;
        if (data.Items[0]['Affiliation'].S === affil) {
          obj2 = new Object();
          obj2.id = friend;
          obj2.name = data.Items[0]['First Name'].S + ' ' + data.Items[0]['Last Name'].S;
          obj2.data = {};
          obj2.children = [];
          childrenArray.push(obj2);
          if (counter === 0) {
            obj.children = childrenArray;
            callback(null, obj);
          }
        }
      }
    })
  });
}

var myDB_addFriend = function(username, friend, ownName, fName, callback) {
  var params = {
    RequestItems: {
      "Friends": [
        { PutRequest: { Item: {
              "Username": { "S" : username},
              "Friend Name": { "S" : friend},
              "Friend Full Name": {"S" : fName},
              "Full Name": {"S": ownName}
            }}
        },
        { PutRequest: { Item: {
              "Username": { "S" : friend},
              "Friend Name": { "S" : username},
              "Friend Full Name": {"S" : ownName},
              "Full Name": {"S": fName}
            }}
        }
      ]
    }
  }

  db.batchWriteItem(params, function(err, data) {
    if (err) {
      callback("failed to add friendship", null)
    } else {
      callback(null, data);
    }
  });
}

var myDB_removeFriend = function(username, friend, callback) {
  var params = {
    "RequestItems": {
      "Friends": [
        { "DeleteRequest": { Key: {
              "Username": { "S" : username},
              "Friend Name": { "S" : friend}
            }}
        },
        { "DeleteRequest": { Key: {
              "Username": { "S" : friend},
              "Friend Name": { "S" : username}
            }}
        }
      ]
    }
  }

  db.batchWriteItem(params, function(err, data) {
    if (err) {
      callback("Friendship not found", null);
      console.log("FAILURE");
    } else {
      callback(null, data);
    }
  });
}

var myDB_getPost = function(post, user, timeStamp, callback) {
  if (post === null || post.replace(/\s+/g, '').length === 0) {
		// Output post error
		callback("post empty", null);
	} 

  const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
  ];

  var params = {
    KeyConditionExpression: "#user = :user AND #timeStamp = :timeStamp",
    ExpressionAttributeNames:{
        "#user": "user",
        "#timeStamp" : "Time Stamp"
    },
    ExpressionAttributeValues: {
        ":user": {'S': user },
        ":timeStamp": {'N': timeStamp}
    },
		TableName: "Posts",
    ScanIndexForward: false,
	};

  db.query(params, function(err, data) {
    if (err) {
      console.log(err)
      callback(err, null);
    } else {
      if (data.Items.length === 0) {
        callback("No such post", null)
      }
      var outputArray = [];
			data.Items.forEach(function(item) {
				var object = {};
				object['user'] = item.user.S;
        var date = new Date(Number(item['Time Stamp'].N))
        var dateString = monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear() + " at " + date.getHours() + ":" + date.getMinutes()
				object['dateTime'] = dateString;
        object['Comments'] = item.Comments.L;
				object['Post'] = item.Post.S;
        object['Author'] = item.Author.S;
        object['id'] = item.id.S;
        object['time'] = item['Time Stamp'].N;
				outputArray.push(object);
			})
			callback(err, outputArray[0]);
    }
  });
}

var myDB_getComments = function(postID, callback) {
    const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
    ];

    var params = {
      KeyConditions: {
        id: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [{ S: postID }]
        }
      },
      TableName: "Comments",
      ScanIndexForward: false,
    };

    db.query(params, function(err, data) {
      if (err) {
        callback(err, null);
      } else {
        var outputArray = [];
        data.Items.forEach(function(item) {
          var object = {};
          var date = new Date(Number(item['Time Stamp'].N))
          var dateString = monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear() + " at " + date.getHours() + ":" + date.getMinutes()
          object['dateTime'] = dateString;
          object['Comment'] = item.Comment.S;
          object['Author'] = item.Author.S;
          outputArray.push(object);
        })
        callback(err, outputArray);
      }
    });
}

var myDB_commentPost = function(author, postID, comment, timeStamp, callback) {
  if (author === null || author.replace(/\s+/g, '').length === 0) {
		// Output username error
		callback("user empty", null);
	} 
	
	if (postID === null || postID.replace(/\s+/g, '').length === 0) {
		// Output post error
		callback("post nonexistent", null);
  }

  if (comment === null || postID.replace(/\s+/g, '').length === 0) {
    callback("comment invalid")
  }

  else {
    var params = {
      Item: {
        "id": {
          S: postID
        },
        "Time Stamp": {
          N: timeStamp.toString()
        },
        "Author" : {
          S : author
        }, 
        "Comment" : {
          S: comment
        }
      },
      TableName: "Comments",
      ReturnValues: 'NONE'
    };
    db.putItem(params, function(err, data){
      if (err){
        callback(err, null) 
      } else {
        callback(err, true) 
      }
    });
  }
}

var myDB_getUserDetails = function(author, callback) {
  if (author === null || author.length === 0) {
		// Output username error
		callback("username empty", null);
	}

  var params = {
		KeyConditions: {
			Username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: author}]
			}
		},
		TableName: "Accounts"
	};

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else if (data.Items.length == 0) {
      callback('Invalid username', null);
    } else {
      var user = data.Items[0];
      var obj = {}
      obj.Email = user.Email.S
      var cats = user.Categories.L
      var categories = new Set()
      for (var cat of cats) {
        categories.add(cat.S)
      }
      obj.categories = categories
      callback(err, obj);
    }
  });
}

var myDB_updateUserDetails = function(author, password, email, categories, callback) {
  if (author === null || author.replace(/\s+/g, '').length === 0) {
		// Output username error
		callback("username empty", null);
	}

  if (password === null || password.replace(/\s+/g, '').length === 0) {
		// Output password error
		callback("password empty", null);
	}

  if (email === null || email.replace(/\s+/g, '').length === 0) {
		// Output email error
		callback("email empty", null);
	}

  bcrypt.genSalt(saltRounds, function(err, salt) {
    bcrypt.hash(password, salt, function(err, hash) {
        var params = {
            Key: {
              "Username": { "S": author }
            },
            UpdateExpression: "SET Email = :r, Categories= :c, Password= :p",
            ExpressionAttributeValues:{
              ":r": { "S" : email },
              ":p": { "S" : hash },
              ":c": { "L" : categories}
            },
            TableName: "Accounts",
            ReturnValues: 'UPDATED_NEW'
        };
      
        db.updateItem(params, function(err, data){
          if (err){
            callback(err, false) 
          } else {
            callback(err, true) 
          }
        });
    });
});
}

var myDB_searchArticles = function(searchTerm, callback) {
  var params = {
    KeyConditions: {
      keyword: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: searchTerm }]
      }
    },
    TableName: "ArticleKeywords",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      var outputArray = [];
			data.Items.forEach(function(item) {
        outputArray.push(item['article'].S)
			})

			callback(err, outputArray);
    }
  });
  
}

var myDB_getUserArticleLikes = function(username, callback) {
  var params = {
    KeyConditions: {
      user: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: username }]
      }
    },
    TableName: "ArticleLikes",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      var outputSet = new Set();
			data.Items.forEach(function(item) {
        outputSet.add(item['article'].S)
			})

			callback(err, outputSet);
    }
  });
}

var myDB_likePost = function(user, article, callback) {
	var params = {
    Item: {
      "user": {
        S: user
      },
      "article": {
        S: article
      },
    },
    TableName: "ArticleLikes",
    ReturnValues: 'NONE'
  }
  
  db.putItem(params, function(err, data){
    if (err){
      console.log(err);
      callback(err, false) 
    } else {
      callback(err, true) 
    }
  });
}

var myDB_unlikePost = function(user, article, callback) {
	var params = {
    Key: {
      user: {
        S: user
      },
      article: {
        S: article
      }
    },
    TableName: "ArticleLikes",
  }

  db.deleteItem(params, function(err, data){
    if (err){
      console.log(err);
      callback(err, false) 
    } else {
      callback(err, true) 
    }
  });
}

var myDB_addRecommendedArticle = function(user, article, callback) {
	var params = {
    Item: {
      "user": {
        S: user
      },
      "article": {
        S: article
      },
    },
    TableName: "RecommendedArticles",
    ReturnValues: 'NONE'
  }
  
  db.putItem(params, function(err, data){
    if (err){
      console.log(err);
      callback(err, false) 
    } else {
      callback(err, true) 
    }
  });
}

var myDB_getUserRecommendedArticles = function(username, callback) {
  var params = {
    KeyConditions: {
      user: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: username }]
      }
    },
    TableName: "RecommendedArticles",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      var outputSet = new Set();
			data.Items.forEach(function(item) {
        outputSet.add(item['article'].S)
			})

			callback(err, outputSet);
    }
  });
}

var myDB_getUserArticlesToRecommend = function(username, callback) {
  var params = {
    KeyConditions: {
      Label: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: username }]
      }
    },
    TableName: "Livvy",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      var outputArr = [];
			data.Items.forEach(function(item) {
        if (item['Node'].S.substring(0, 1) === "{") {
          var obj = {};
          obj['article'] = item['Node'].S
          obj['score'] = item['Value'].N

          outputArr.push(obj);
        }
			})

			callback(err, outputArr);
    }
  });
}

var myDB_searchUsers = function(callback) {
  var userArr = [];
  var params = { 
    TableName: "Accounts",
  }

  db.scan(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      data.Items.forEach(function (item) {
        var info = item['Username'].S + ": " + item['First Name'].S + " " + item['Last Name'].S;
        userArr.push(info);
      });
      callback(null, userArr);
    }
  });
}

/***********
*   CHAT   *
***********/

/** Fetch List of chats the user is part of.
 * @param username
 * @return Promise: On Success it returns array of chatids, on error it forwards the aws error.
*/
var myDB_getChatIDs = function(username) {
  var params = {
		KeyConditions: {
			user_id: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: username }]
			}
		},
		TableName: "ChatUsers",
	};
  return db.query(params).promise().then(data => {
    return data.Items.map(item => item.chat_id.S);
  });
}

/** Fetch Chatnames and metadata for multiple chatids.
 * @param ids: array of chatids
 * @return Promise: On Success it returns array of metadata, on error it forwards the aws error.
*/
var myDB_getChats = function(ids) {
  // Get Chat Info for each ID
  var requests = ids.map(id => {
    var params = {
      KeyConditions: {
        chat_id: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [{ S: id }]
        }
      },
      TableName: "Chats",
    };
    return db.query(params).promise();
  })
  return Promise.all(requests).then(answers => {
    return answers.map(answer => answer.Items[0]);
  })
}

/** Create a Chat
 * @param chatid: unique identifer
 * @param chatname: Name of Chat (ignored if not groupchat)
 * @param isGroup: Wether chat is groupchat or not
 * @return Promise: AWS promise unmodified
*/
var myDB_createChat = function(chatid, chatname, creator) {
  // Get Chat Info for each ID
  var params = {
    Item: {
      "chat_id": {S:chatid},
      "creator": {S:creator},
      "name": {S:chatname}
    },
    TableName: "Chats"
  };
  return db.putItem(params).promise();
}

/** Add Users to chat
 * @param chatid: unique identifer
 * @param users: array of users to add
 * @return Promise: AWS promise unmodified
*/
var myDB_addChatUsers = function(chatid, users) {
  var params = {
    RequestItems: {
      "ChatUsers": []
    }
  }
  users.forEach(user => {
    params.RequestItems.ChatUsers.push(
      { PutRequest: { Item: {
      "user_id": { "S" : user},
      "chat_id": { "S" : chatid}
      }}
    });
  });

  return db.batchWriteItem(params).promise();
}

/** Get Users to chat
 * @param chatid: unique identifer
 * @param users: array of users to add
 * @return Promise: AWS promise unmodified
*/
var myDB_getChatUsers = function(chatid) {
  var params = {
    KeyConditions: {
      'chat_id': {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: chatid }]
      }
    },
    TableName: "ChatUsers",
    IndexName: "chat_id-index"
  };
  return db.query(params).promise().then(answer => {
    return answer.Items.map(item => item.user_id.S);
  });
}

/** Fetch All message in Chat
 * @param chatid: unique identifer
 * @return Promise: On success return array of messages
*/
var myDB_getMessages = function(chat_id) {
  // Get Chat Info for each ID
  var params = {
    KeyConditions: {
      'chat_id': {
        ComparisonOperator: 'EQ',
        AttributeValueList: [{ S: chat_id }]
      }
    },
    TableName: "ChatMessages",
  };
  return db.query(params).promise().then(answer => {
    return answer.Items;
  });
}


/** Add message to chat
 * @param chat_id:
 * @param message_id: timestamp
 * @param message: content
 * @return AWS promise
*/
var myDB_addMessage = function(chat_id, message_id, message, autor) {
  var params = {
    Item: {
      "chat_id": {
        S: chat_id
      },
      "message_id": {
        S: message_id
      },
      "text": {
        S: message
      },
      "autor": {
        S: autor
      }
    },
    TableName: "ChatMessages",
    ReturnValues: 'NONE'
  };
  return db.putItem(params).promise();
}

/** Add message to chat
 * @param chat_id:
 * @param message_id: timestamp
 * @param message: content
 * @return AWS promise
*/
var myDB_removeMessages = function(chat_id, messages) {
  // Get Chat Info for each ID
  promises = messages.map(id => {
    var params = {
      Key: {
        'chat_id': { S: chat_id },
        'message_id': { S: id },
      },
      TableName: "ChatMessages"
    };
    return db.deleteItem(params).promise();
  });
  return Promise.all(promises);
}

var myDB_removeChatUser = function(chat_id, username) {
  // Get Chat Info for each ID
  var params = {
    Key: {
      'chat_id': { S: chat_id },
      'user_id': { S: username }
    },
    TableName: "ChatUsers"
  };
  return db.deleteItem(params).promise();
}

/** Removes the Chat from the Chat Table
 * @param chat_id:
 * @param message_id: timestamp
 * @param message: content
 * @return AWS promise
*/
var myDB_removeChat = function(chat_id) {
  // Get Chat Info for each ID
  var params = {
    Key: {
      'chat_id': { S: chat_id },
    },
    TableName: "Chats"
  };
  return db.deleteItem(params).promise();
}


var database = { 
  userLookup: myDB_userLookup,
  userExists: myDB_userExists,
  userInput: myDB_userInput,
  createPost: myDB_createPost,
  getUserPosts: myDB_getUserPosts,
  getUser: myDB_getUser,
  getUserFriends: myDB_getFriends,
  getUserFriendsJSON: myDB_getFriendsJSON,
  getAffiliatedFriends: myDB_getAffiliatedFriends,
  addFriend: myDB_addFriend,  
  removeFriend: myDB_removeFriend,
  getPost: myDB_getPost,
  getComments: myDB_getComments,
  commentPost: myDB_commentPost,
  getUserDetails: myDB_getUserDetails,
  updateUserDetails : myDB_updateUserDetails,
  searchArticles : myDB_searchArticles,
  getUserArticleLikes : myDB_getUserArticleLikes,
  likePost: myDB_likePost,
  unlikePost: myDB_unlikePost,
  getUserArticlesToRecommend: myDB_getUserArticlesToRecommend,
  getUserRecommendedArticles: myDB_getUserRecommendedArticles,
  addRecommendedArticle: myDB_addRecommendedArticle,
  searchUsers: myDB_searchUsers,


  getChatIDs: myDB_getChatIDs,
  getChats: myDB_getChats,
  createChat: myDB_createChat,
  addChatUsers: myDB_addChatUsers,
  getChatUsers: myDB_getChatUsers,
  getMessages: myDB_getMessages,
  addMessage: myDB_addMessage,
  removeMessages: myDB_removeMessages,
  removeChat: myDB_removeChat,
  removeChatUser: myDB_removeChatUser
};

module.exports = database;