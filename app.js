const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
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
      response.send("user created successfully");
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
      const jwtToken = jwt.sign(payload, "My_Secrete_Token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});
