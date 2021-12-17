const db = require('../models/database.js');
const livy = require('../models/livy.js');
const bcrypt = require('bcrypt');
const { data } = require('jquery');
const { response } = require('express');
var app = require('../app');
const { Template } = require('ejs');

const saltRounds = 10;

// Main login page
var getMain = function(req, res) {
    var fullName = "";
	var username = "";
	var password = "";
	req.session.loggedIn = false;
    res.render('login.ejs', {username: "", password : "", message: null});
};

// Authenticate a user
var auth = function(req, res) {
    var username = req.body.username;
    var password = req.body.password;

    db.userLookup(username, password, function(err, data) {
        if (err) {
            res.render("loginCheck.ejs", {message : err});
        } else {
            // TODO: Add any additional cookies information.
            if (data === null) {
                res.render("loginCheck.ejs", {message : err});
            } else {
                req.session.loggedIn = true; 
                req.session.username = username;
                res.redirect("/Home");
            }  
        }
    });    
};

// Create an account (add account to DynanoDB)
var create = function(req, res) {
    // uname, pword, fName, lName, email, affil, bday, cat, callback

    var categories = ['CRIME','ENTERTAINMENT','WORLD NEWS','IMPACT','POLITICS','WEIRD NEWS','BLACK VOICES',
        'WOMEN','COMEDY','QUEER VOICES','SPORTS','BUSINESS','TRAVEL','MEDIA','TECH',
        'RELIGION','SCIENCE','LATINO VOICES','EDUCATION','COLLEGE','PARENTS','ARTS & CULTURE',
        'STYLE','GREEN','TASTE','HEALTHY LIVING','THE WORLDPOST','GOOD NEWS','WORLDPOST',
        'FIFTY','ARTS','WELLNESS','PARENTING','HOME & LIVING','STYLE & BEAUTY', 'DIVORCE',
        'WEDDINGS','FOOD & DRINK','MONEY','ENVIRONMENT','CULTURE & ARTS'];
	var username = req.body.username;
	var password = req.body.password;
    var first = req.body.firstName;
    var last = req.body.lastName;
    var email = req.body.email;
    var affil = req.body.affiliation;
    var bday = req.body.date;
    var filledInCats = [];
    for (i = 0; i < categories.length; i++){
        var nameInput = 'check' + (i + 1)
        if (req.body[nameInput]) {
            filledInCats.push({S : categories[i]});
        }
    }
    
    db.userInput(username, password, first, last, email, affil, bday, filledInCats, function (err, data) {
        if (err) {
            res.render("signupErr.ejs", {message:err});
        } else {
            // TODO: Add any additional cookies information.
			req.session.loggedIn = true; 
            req.session.username = username;
            res.redirect("/Home");
        }
    });
    
};

/*
 * Home page views, gets posts from all friends and a user's details
 * NOTE: FETCHES 100 most recent posts from all friends, change this in getCombinedPosts function.
 */
var home = function(req, res) {
    if (!req.session.loggedIn) {
        return res.redirect("./");
    }

    var user = req.session.username;
    // First Promise: recommended, Second Promise: toRecommend
    var recommendArticlePromiseArray = []
    
    recommendArticlePromiseArray.push(
        new Promise(function(resolve, reject) {
            db.getUserRecommendedArticles(user, function(err, data) {
                if (err) {
                    resolve({articles: null, err: true})
                } else {
                    resolve({articles: data, err: false})
                }
            })
        })
    );
    recommendArticlePromiseArray.push(
        new Promise(function(resolve, reject) {
            db.getUserArticlesToRecommend(user, function(err, data) {
                if (err) {
                    resolve({articles: null, err: true})
                } else {
                    resolve({articles: data, err: false})
                }
            })
        })
    )

    var recommendArticle = function(arr) {
        var toRecommend = arr[1].articles;
        var recommended = arr[0].articles;

        var filteredRecommend = toRecommend.filter(article => !(recommended.has(article['article'])));
        var totalWeights = filteredRecommend.reduce((total, cur) => total + parseFloat(cur['score']), 0);
        const random = Math.random();
        var aggregated_probability = 0;

        var randomArticle = filteredRecommend.map((article) => {
            aggregated_probability += (article['score'] / totalWeights);
            return {'article': article['article'], 'score': aggregated_probability};
        }).find((article) => (article['score'] / aggregated_probability) >= random);

        return randomArticle
    }

    var getCombinedPosts = function(friendPosts) {
        var combinedPosts = []
        if (friendPosts.length === 0) {
            return []
        }

        // Change number below to change maximum number of posts displayed
        var postsToDisplay = 100;

        var indices = new Array(friendPosts.length).fill(0);
        for (var i = 0; i < postsToDisplay; i++) {
            var mostRecentPost = null;
            var mostRecentIndex = -1;
            for (var j = 0; j < indices.length; j++) {
                if (indices[j] === friendPosts[j].length) {
                    continue;
                }

                if (mostRecentPost === null || mostRecentPost['time'] < friendPosts[j][indices[j]]['time']) {
                    mostRecentPost = friendPosts[j][indices[j]]
                    mostRecentIndex = j;
                }
            }

            if (mostRecentPost !== null) {
                combinedPosts.push(mostRecentPost);
                indices[mostRecentIndex] += 1;
                continue;
            }

            break;
        }

        return combinedPosts;
    }

    var getFriendsPromise = new Promise(function(resolve, reject) {
        db.getUserFriends(user, function(err, data) {
            if (err) {
                reject("error in querying for friends");
            } else {
                data.push(user);
                data = data.map(username => {
                    return {'username': username, 'isonline': activeUsers.has(username)};
                })
                resolve(data);
            }
        });
    });

    var getUserDetailsPromise = new Promise(function(resolve, reject) {
        db.getUserDetails(user, function(err, data) {
            if (err) {
                resolve({data: null, err: true})
            } else {
                if (data === null) {
                    resolve({data: null, err: true})
                } else {
                    resolve({Email : data.Email, categories: data.categories, err: false, message: null})
                }  
            }
        });   
    });

    var getUserLikesPromise = new Promise(function(resolve, reject) {
        db.getUserArticleLikes(user, function (err, data) {
            if (err) {
                resolve(new Set());
            } else {
                resolve(data);
            }
        }) 
    })

    getFriendsPromise
        .then(friends => {
            var promiseArray = []
            for (var friend of friends) {
                var promise = new Promise(function(resolve, reject) {
                    db.getUserPosts(friend.username, function (err, data) {
                        if (err) {
                            resolve([])
                        } else {
                            if (data.length === 0) {
                                resolve([])
                            } else {
                                resolve(data)
                            }
                        }
                    });
                })
                promiseArray.push(promise)
            }

            Promise.all(promiseArray)
                .then(friendPosts => {
                    var combinedPosts = getCombinedPosts(friendPosts);
                    getUserDetailsPromise.then(details => {
                        Promise.all(recommendArticlePromiseArray)
                            .then(array => {
                                getUserLikesPromise.then(set => {
                                    var isArticleRandom = false
                                    var article = recommendArticle(array);
                                    if (article == null ) {
                                        isArticleRandom = "true"
                                        article = `{"category": "FOOD & DRINK", "headline": "Christopher Walken's Scallop Recipe Has Arrived", "authors": "", "link": "https://www.huffingtonpost.com/entry/christopher-walken-scallop-recipe_us_5b9c68a7e4b03a1dcc7e6bff", "short_description": "Please do this recipe justice by reading it in Christopher Walken's voice.", "date": "2012-10-15"}`;
                                    } else {
                                        article = article['article']
                                    }
                                    var articleJSON = JSON.parse(article);
                                    articleJSON['article'] = encodeURIComponent(article);
                                    if (set.has(article)) {
                                        articleJSON['isLiked'] = true;
                                    } else {
                                        articleJSON['isLiked'] = false;
                                    }
                                    db.addRecommendedArticle(user, article, function(err, data) {
                                        return res.render("home.ejs", {user : encodeURIComponent(JSON.stringify(req.session.username)), posts: combinedPosts, 
                                            friends: friends, userDetails: details, article: articleJSON, isArticleRandom: isArticleRandom}); 
                                    })
                                })          
                            })
                    });
                })
        })
}

// Signup page for creating new account
var signup = function(req,res) {
    res.render("signup.ejs", {categories : ['CRIME','ENTERTAINMENT','WORLD NEWS',
    'IMPACT','POLITICS','WEIRD NEWS', 'BLACK VOICES','WOMEN','COMEDY','QUEER VOICES',
    'SPORTS','BUSINESS','TRAVEL','MEDIA','TECH','RELIGION','SCIENCE','LATINO VOICES','EDUCATION',
    'COLLEGE','PARENTS','ARTS & CULTURE','STYLE','GREEN','TASTE','HEALTHY LIVING','THE WORLDPOST',
    'GOOD NEWS','WORLDPOST','FIFTY','ARTS','WELLNESS','PARENTING','HOME & LIVING','STYLE & BEAUTY',
    'DIVORCE','WEDDINGS','FOOD & DRINK','MONEY','ENVIRONMENT','CULTURE & ARTS']});
}

// Page to view user's personal wall
var walls = function(req, res) {
    if (req.session.loggedIn) {
        var loggedInUser = req.session.username;
        var user = req.query.user.replace(/[^\w\s]/gi, '');
        db.getUserPosts(user, function (err, data) {
            if (err) {
                res.render("walls.ejs", {loggedInUser: loggedInUser, message : err, posts : false, user : encodeURIComponent(JSON.stringify(user))})
            } else {
                res.render("walls.ejs", {loggedInUser: loggedInUser, message : null, posts : data, user : encodeURIComponent(JSON.stringify(user))})
            }
        });
    }
    else {
        res.redirect("./");
    }   
}

/*
 * Create a post for a given either on their own wall or another user's wall
 * Function is called in updateAccount() for status updates
 */
var createPost = function(req, res) {
    var user = req.session.username;
    var post = req.body.post;
    var host = req.query.host.replace(/[^\w\s]/gi, '');
    var timeStamp = Date.now();
    var comments = [];


    // TODO: Load this asynchronously
    db.createPost(user, host, post, timeStamp, comments, function (err, data) {
        if (err) {
            return res.redirect("back");
            res.redirect("/walls?user=" + encodeURIComponent(JSON.stringify(host)));
        } else {
            return res.redirect("back");
            res.redirect("/walls?user=" + encodeURIComponent(JSON.stringify(host)));
        }
    });
}

var displayVisualizer = function(req, res) {
    res.render('friendvisualizer.ejs');
}

var friendVisualizer = function(req, res) {
    db.getUser(req.session.username, function(fail, succeed) {
        if (fail) {
            console.log(fail);
        }
        else {
            var fName = succeed.Items[0]['First Name'].S + ' ' + succeed.Items[0]['Last Name'].S;
            db.getUserFriendsJSON(req.session.username, fName, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    var json = data;
                    res.send(json);
                } 
            });
        }
    });
}

var getFriendVisualizer = function(req, res) {
    console.log(req.params.user);
    db.getUserFriends(req.params.user, function(err, friends) {
        if (err) {
            console.log(err);
        } else {
            db.getUser(req.session.username, function(err2, info) {
                if (err2) {
                    console.log(err2);
                }
                else {
                    db.getUser(req.params.user, function(err3, info2) {
                        var fName = info2.Items[0]['First Name'].S + ' ' + info2.Items[0]['Last Name'].S;
                        var affil = info.Items[0]['Affiliation'].S
                        db.getAffiliatedFriends(req.params.user, fName, affil, friends, function(err3, newFriends) {
                            if (err3) {
                                console.log(err3);
                            } else {
                                res.send(newFriends);
                            }
                        })
                    })
                }
            });
        }
    })
}

// Page to view friends
var friends = function(req, res) {
    if (!req.session.loggedIn) {
        res.redirect("./");
        return;
    }
    var user = req.session.username;
    db.getUserFriends(user, function (err, data) {
        if (err) {
            res.render("friends.ejs", {user: user, message: "Something went wrong", loggedIn : loggedIn, friends : []})
        }
        else {
            var friendStatus = [];
            for (var datum of data) {
                if (activeUsers.has(datum)) {
                    const {fName, fStatus} = {fName: datum, fStatus: "true"};
                    friendStatus.push({fName, fStatus});
                }
                else {
                    const {fName, fStatus} = {fName: datum, fStatus: "false"};
                    friendStatus.push({fName, fStatus});
                }
            }
            db.searchUsers(function(err, ubase) {
                console.log("rendering friends.ejs");
                if (req.query.error == "noUser") {
                    res.render("friends.ejs", {user : user, message : "Cannot find user", friends : friendStatus, userbase: ubase})
                } else if (req.query.error == "notFriend") {
                    res.render("friends.ejs", {user: user, message: "Friend not found", friends : friendStatus, userbase: ubase})
                } else {  
                    res.render("friends.ejs", {user : user, friends: friendStatus, userbase: ubase})
                }
            })
        }
    });
}

var addFriend = function(req, res) {
    var user = req.session.username;
    var friend = req.body.addFriend;
    friend = friend.replace(/:.*/i, "");
    db.userExists(friend, function(err, exist) {
        if (err) {
            res.redirect("/friends?error=noUser");
        } else {
            db.getUser(user, function (err2, userInfo) {
                if (err2) {console.log(err2)}
                else{
                    db.getUser(friend, function(err3, friendInfo) {
                        if (err3) {console.log(err3)}
                        else {
                            userName = userInfo.Items[0]['First Name'].S + ' ' + userInfo.Items[0]['Last Name'].S;
                            friendName = friendInfo.Items[0]['First Name'].S + ' ' + friendInfo.Items[0]['Last Name'].S;
                            db.addFriend(user, friend, userName, friendName, function (err4, data) {
                                if (err4) {
                                    res.redirect("/friends?error=noUser");
                                } else {
                                    res.redirect("/friends");
                                }
                        });
                        }
                    })
                }
            })
    }});
}

var removeFriend = function(req, res) {
    var user = req.session.username;
    var friend = req.body.removeFriend;
    friend = friend.replace(/:.*/i, "");
    db.userExists(friend, function(err, data) {
        if (err) {
            res.redirect("/friends?error=noUser");
        } else {
            db.removeFriend(user, friend, function(err, data) {
                if (err) {
                    console.log("user: " + user + "not found");
                    console.log("friend: " + friend + "not found");
                    res.redirect("/friends?error=notFriend");
                } else {
                    res.redirect("/friends");
                }
            })
        }
    })
}

/**
 * @returns Array of of {username: string, online: bool}
 */
var getFriends = function(req, res) {
    if (!req.session.loggedIn) {
        return res.redirect("./");
    }
    db.getUserFriends(req.session.username, function (err, data) {
        if (err)
            res.send(JSON.stringify(err));
        else {
            friends = data.map(friend => {
                var isonline = activeUsers.has(friend);
                return {username: friend, online: isonline}
            });
            res.send(JSON.stringify(friends));
        }
    });
}

// Page to view a particular post and its comments
var viewPosts = function(req, res) {
    if (req.session.loggedIn) {
        var loggedInUser = req.session.username;
        var post = req.query.post.replace(/[^\w\s]/gi, '');
        var user = req.query.user;
        var id = req.query.timeStamp;
        db.getPost(post, user, id, function (err, data) {
            if (err) {
                res.render("post.ejs", {user : loggedInUser, message : err, postContent: false, comments : false, post : encodeURIComponent(JSON.stringify(post))})
            } else if (data === null) {
                res.render("post.ejs", {user : loggedInUser, message : err, postContent: false, comments : false, post : encodeURIComponent(JSON.stringify(post))})
            } else {
                var postContent = data;
                db.getComments(post, function (err2, data2) {
                    if (err) {
                        res.render("post.ejs", {user : loggedInUser, message : err2, postContent: postContent, comments : false, post : encodeURIComponent(JSON.stringify(post))})
                    } else {
                        res.render("post.ejs", {user : loggedInUser, message : null, postContent: postContent, comments : data2, post : encodeURIComponent(JSON.stringify(post))})
                    }
                })
            }
        });
    }
    else {
        res.redirect("./");
    }   
}

// Add a comment to a post
var commentPost = function(req, res) {
    var user = req.session.username;
    var redirectUser = req.query.user;
    var redirectTimeStamp = req.query.timeStamp;
    var postID = (req.query.post.replace(/[^\w\s]/gi, ''));
    var comment = req.body[postID];
    var timeStamp = Date.now();

    // TODO: Load this asynchronously
    db.commentPost(user, postID, comment, timeStamp, function (err, data) {
        if (err) {
            res.redirect("/post?post=" + redirectUser + redirectTimeStamp  + "&user=" + redirectUser + "&timeStamp=" + redirectTimeStamp);
        } else {
            res.redirect("/post?post=" + redirectUser + redirectTimeStamp  + "&user=" + redirectUser + "&timeStamp=" + redirectTimeStamp);
        }
    });
}

var editAccount = function(req, res) {
    var user = req.session.username;
    
    db.getUserDetails(user, function(err, data) {
        if (err) {
            res.render("updateAccount.ejs", {data: null, err: true});
        } else {
            if (data === null) {
                res.render("updateAccount.ejs", {data: null, err: true});
            } else {
                res.render("updateAccount.ejs", {Email : data.Email, categories: data.categories, err: false, message: null})
            }  
        }
    });    
} 


// Change a user's account details (password or email or categories)
var updateAccount = function(req, res) {
    var categories = ['CRIME','ENTERTAINMENT','WORLD NEWS','IMPACT','POLITICS','WEIRD NEWS','BLACK VOICES',
    'WOMEN','COMEDY','QUEER VOICES','SPORTS','BUSINESS','TRAVEL','MEDIA','TECH',
    'RELIGION','SCIENCE','LATINO VOICES','EDUCATION','COLLEGE','PARENTS','ARTS & CULTURE',
    'STYLE','GREEN','TASTE','HEALTHY LIVING','THE WORLDPOST','GOOD NEWS','WORLDPOST',
    'FIFTY','ARTS','WELLNESS','PARENTING','HOME & LIVING','STYLE & BEAUTY', 'DIVORCE',
    'WEDDINGS','FOOD & DRINK','MONEY','ENVIRONMENT','CULTURE & ARTS'];

    var user = req.session.username;
    var password = req.body.password;
    var email = req.body.email;
    var filledInCats = [];
    var regularFilledInCats = [];
    for (i = 0; i < categories.length; i++){
        var nameInput = 'check' + (i + 1)
        if (req.body[nameInput]) {
            filledInCats.push({S : categories[i]});
            regularFilledInCats.push(categories[i])
        }
    }

    db.getUserDetails(user, function(err, data) {
        if (err) {
            return res.redirect("back");
            // return res.render("updateAccount.ejs", {data: null, err: true});
        } else {
            if (data === null) {
                return res.redirect("back");
                // return res.render("updateAccount.ejs", {data: null, err: true});
            } else {
                var oldCategories = [...data.categories]
                var newCategories = regularFilledInCats

                var categoriesAdded = newCategories.filter(x => !oldCategories.includes(x))
                var categoriesRemoved = oldCategories.filter(x => !newCategories.includes(x))

                var messageNewCategories = user + " is now interested in " + categoriesAdded.toString() + ". " 
                var messageOldCategories = user + " is not interested in " + categoriesRemoved.toString() + " anymore."

                if (password == null || password.length == 0) {
                    return res.redirect("back");
                    // return res.render("updateAccount.ejs", {data: null, err: true, Email: email, categories: data.categories})
                }

                db.updateUserDetails(user, password, email, filledInCats, function(err, data2) {
                    if (err) {
                        return res.redirect("back");
                        // return res.render("updateAccount.ejs", {data: null, err: true, Email: email, categories: data.categories});
                    } else {
                        if (!data2) {
                            console.log('DID NOT WORK')
                            return res.redirect("back");
                            // return res.render("updateAccount.ejs", {data: null, err: true, Email: email, categories: data.categories});
                        } else {
                            if (categoriesRemoved.length == 0 && categoriesAdded.length == 0) {

                            } else if (categoriesRemoved.length == 0) {
                                db.createPost(user, user, messageNewCategories, Date.now(), [], function (err, data) {});
                                livy.postLivyJob();
                            } else if (categoriesAdded.length == 0) {
                                db.createPost(user, user, messageOldCategories, Date.now(), [], function (err, data) {});
                                livy.postLivyJob();
                            } else {
                                db.createPost(user, user, messageNewCategories + messageOldCategories, Date.now(), [], function (err, data) {});
                                livy.postLivyJob();
                            }

                            return res.redirect("back");
                            // return res.render("updateAccount.ejs", {Email : data.Email, categories: new Set(newCategories), 
                            //    err: false, message : 'account updated successfully'})
                            
                        }  
                    }
                });    
            }  
        }
    }) 
} 

// Page to view and search for articles
var searchArticlesPage = function(req, res) {

    if (req.session.loggedIn) {
        var search = req.query.search;
        var user = req.session.username;

        if (search == null || search.replace(/[^\w\s]/gi, '').length == 0) {
            return res.render("searchArticles.ejs", {noResults: false, articles : false, user: user});
        }

        var getUserLikesPromise = new Promise(function(resolve, reject) {
            db.getUserArticleLikes(user, function (err, data) {
                if (err) {
                    resolve(new Set());
                } else {
                    resolve(data);
                }
            }) 
        })

        var getMostRelevant = function(results, likedArticles) {
            var toReturn = []
            var object = {};
            var noResults = true;

            for (var result of results) {
                if (result.length == 0) {
                    continue;
                }

                for (var article of result) {
                    if (article in object) {
                        object[article] += 1
                    } else {
                        object[article] = 1
                    }
                }

                noResults = false;
            }

            if (noResults) {
                return []
            }

            var sortByPopularity = []
            for (var entry of Object.entries(object)) {
                sortByPopularity.push(entry)
            }

            sortByPopularity.sort(function(a, b) {
                return a[1] - b[1]
            }).reverse();

            for (var i = 0; i < sortByPopularity.length; i++) {
                var toObject = JSON.parse(sortByPopularity[i][0]);
                toObject['article'] = encodeURIComponent(sortByPopularity[i][0]);
                toObject['Number of Relevant Terms'] = sortByPopularity[i][1];
                var date = toObject['date'].substring(0,4);
                toObject['date'] = date + toObject['date'].substring(4);
                
                if (likedArticles.has(sortByPopularity[i][0])) {
                    toObject['isLiked'] = true;
                } else {
                    toObject['isLiked'] = false;
                }

                toReturn.push(toObject);
            }

            return toReturn;
        }

        var promiseArr = [];
        var natural = require('natural');
        var tokenizer = new natural.WordTokenizer();
        var searchTerms = tokenizer.tokenize(search);


        for (var i = 0; i < searchTerms.length; i++) {
            searchTerms[i] = natural.PorterStemmer.stem(searchTerms[i]);

            var promise = new Promise(function(resolve, reject) {
                db.searchArticles(searchTerms[i], function (err, data) {
                    if (err) {
                        resolve([])
                    } else {
                        resolve(data)
                    }
                });
            })
            promiseArr.push(promise)
        }

        getUserLikesPromise.then(likedArticles => {
            Promise.all(promiseArr)
            .then(results => {
                var newsArticles = getMostRelevant(results, likedArticles);
                if (newsArticles.length == 0) {
                    return res.render("searchArticles.ejs", {noResults: true, articles : false, user: user});
                }
                return res.render("searchArticles.ejs", {noResults: false, articles : newsArticles, user: user});  
            });
        });
        
    }
    else {
        res.redirect("./");
    }   
}

// Like an article 
var likeArticle = function(req, res) {
    if (req.session.loggedIn) {
        var article = decodeURIComponent(req.body.article).replace(/&#39;/g, "'");
        var isLiked = (req.body.isLiked === 'true');
        var user = req.session.username;        


        if (isLiked) {
            db.unlikePost(user, article, function(err, data) {
                if (data === false) {
                    console.log('ERROR!')
                } else {
                    return res.redirect("back");
                }
            }) 
        } else {
            db.likePost(user, article, function(err, data) {
                if (data === false) {
                    console.log('ERROR!')
                } else {
                    return res.redirect("back");
                }
            }) 
        }
    }
    else {
        res.redirect("./");
    }   
}

var searchResults = function(req, res) {
    db.searchUsers(req.params.user, function(err, data) {
        res.send(data);
    })
}

var logout = function(req, res) {
    if (req.session.loggedIn) {
        req.session = null;
    }

    return res.redirect('/')
}

var onlyHomePosts = function(req, res) {
    var user = req.session.username;
    var getCombinedPosts = function(friendPosts) {
        var combinedPosts = []
        if (friendPosts.length === 0) {
            return []
        }

        // Change number below to change maximum number of posts displayed
        var postsToDisplay = 100;

        var indices = new Array(friendPosts.length).fill(0);
        for (var i = 0; i < postsToDisplay; i++) {
            var mostRecentPost = null;
            var mostRecentIndex = -1;
            for (var j = 0; j < indices.length; j++) {
                if (indices[j] === friendPosts[j].length) {
                    continue;
                }

                if (mostRecentPost === null || mostRecentPost['time'] < friendPosts[j][indices[j]]['time']) {
                    mostRecentPost = friendPosts[j][indices[j]]
                    mostRecentIndex = j;
                }
            }

            if (mostRecentPost !== null) {
                combinedPosts.push(mostRecentPost);
                indices[mostRecentIndex] += 1;
                continue;
            }

            break;
        }

        return combinedPosts;
    }

    var getFriendsPromise = new Promise(function(resolve, reject) {
        db.getUserFriends(user, function(err, data) {
            if (err) {
                reject("error in querying for friends");
            } else {
                data.push(user)
                resolve(data);
            }
        });
    });

    getFriendsPromise
        .then(friends => {
            var promiseArray = []
            for (var friend of friends) {
                var promise = new Promise(function(resolve, reject) {
                    db.getUserPosts(friend, function (err, data) {
                        if (err) {
                            resolve([])
                        } else {
                            if (data.length === 0) {
                                resolve([])
                            } else {
                                resolve(data)
                            }
                        }
                    });
                })
                promiseArray.push(promise)
            }

            Promise.all(promiseArray)
                .then(friendPosts => {
                    var combinedPosts = getCombinedPosts(friendPosts);
                    return res.send(combinedPosts);
                })
        })
};

var onlyComments = function(req, res) {
    if (req.session.loggedIn) {
        var post = req.query.post.replace(/[^\w\s]/gi, '');
        db.getComments(post, function (err2, data2) {
            if (err2) {
                res.render("post.ejs", {message : err2, postContent: postContent, comments : false, post : encodeURIComponent(JSON.stringify(post))})
            } else {
                res.send(data2);
            }
        });
    }
};

var getWallPosts = function(req, res) {
    if (req.session.loggedIn) {
        var user = req.query.user.replace(/[^\w\s]/gi, '');
        db.getUserPosts(user, function (err, data) {
            if (err) {
                res.send(false);
            } else {
                res.send(data);
            }
        });
    }
    else {
        res.redirect("./");
    }
}


var routes = { 
    get_main: getMain,
    auth : auth,
    createAccount: create,
    signup : signup,
    home : home,
    walls : walls,
    createPost : createPost,
    friends : friends,
    addFriend: addFriend,
    removeFriend: removeFriend,
    displayVisualizer: displayVisualizer,
    friendVisualizer: friendVisualizer,
    getFriendVisualizer: getFriendVisualizer,
    viewPosts: viewPosts,
    commentPost: commentPost,
    editAccount: editAccount,
    updateAccount: updateAccount,
    searchArticlesPage: searchArticlesPage,
    likeArticle: likeArticle,
    getFriends: getFriends,
    searchResults: searchResults,
    logout: logout,
    onlyHomePosts: onlyHomePosts,
    onlyComments: onlyComments,
    getWallPosts: getWallPosts,
};
  
module.exports = routes;