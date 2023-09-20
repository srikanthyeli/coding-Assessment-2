const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const db_path = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: db_path,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Worked at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DbError ${e.massage}`);
    process.exit(1);
  }
};
initializeDbAndServer();
module.exports = app;
const authenticateToken = (request, response, next) => {
  const { tweet } = request.body;
  const { tweetId } = request.params;
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRETE_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.payload = payload;
        request.tweet = tweet;
        request.tweetId = tweetId;
        next();
      }
    });
  }
};
//API -1
app.post("/register/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectQuery);
  if (dbUser === undefined) {
    if (password.length > 5) {
      const userAddedQuery = `
    INSERT INTO 
    user(name,username,password,gender)
     VALUES
      ('${name}','${username}','${hashedPassword}','${gender}');`;
      const DbResponse = await db.run(userAddedQuery);
      const newUserId = DbResponse.last.ID;
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(dbUser, "My_Secrete_Token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//API 3
app.get("/user/tweets/feed/", authenticateToken, async (response, request) => {
  const { payload } = request;
  const { user_id, username, name, password, gender, location } = payload;
  const getUserFeedQuery = `SELECT username,tweet,date_time as dateTime FROM follower inner join tweet on follower.following_user_id=tweet.user
    _id AS T INNER JOIN user on follower.following_user_id=user.user_id where follower.follower_user_id=${user_id} order by date_time LIMIT 4;`;
  const tweeFeedArray = await db.all(getUserFeedQuery);
  response.send(tweeFeedArray);
});
//API  4
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, username, name, password, gender, location } = payload;
  const getUserFollowersQuery = `SELECT name from follower inner join user on follower.follower_user_id=user.user_id where user_id=${user_id};`;
  const DbResponse = await db.all(getUserFollowersQuery);
  response.send(DbResponse);
});
//API-5
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, username, name, password, gender, location } = payload;
  const getUserFollowingQuery = `SELECT name FROM follower inner join user on follower.following_user_id=user.user_id where user_id=${user_id};`;
  const DbUserFollowing = await db.all(getUserFollowingQuery);
  response.send(DbUserFollowing);
});
//API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { payload } = request;
  const { user_id, name, username, password, gender } = payload;
  const tweetQuery = `SELECT * FROM tweet where tweet_id=${tweetId};`;
  const tweetObject = await db.get(tweetQuery);

  const followingQuery = `SELECT * FROM follower inner join user on follower.follower_user_id=user.user_id where user_id=${user_id};`;
  const UserFollowers = await db.all(followingQuery);
  if (
    UserFollowers.some((item) => (item.following_user_id = tweetObject.user_id))
  ) {
    const tweetDetailsQuery = `SELECT tweet,COUNT(DISTINCT(like.like_id)) as like,COUNT(DISTINCT(reply.reply_id)) as replies,date_time as dateTime FROM like inner join tweet on like.tweet_id=tweet.tweet_id inner join reply on tweet.tweet_id=reply.tweet_id WHERE tweet.tweet_id = ${tweetId} AND tweet.user_id=${userFollowers[0].user_id};`;
    const tweetDetails = await db.get(tweetDetailsQuery);
    response.send(tweetDetails);
  } else {
    response.status(400);
    response.send("Invalid Request");
  }
});
