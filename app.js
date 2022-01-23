const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors()); // Use this after the variable declaration

const databasePath = path.join(__dirname, "financePeer.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(process.env.PORT || 3002, () => {
      console.log("Server Running at http://localhost:3002/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertJsonDataToObject = (data) => {
  return {
    userId: data.userId,
    id: data.id,
    title: data.title,
    body: data.body,
  };
};

app.get("/", async (request, response) => {
  try {
    response.send("App is working");
  } catch (error) {
    response.send(error.message);
  }
});

app.get("/users", async (req, res) => {
  try {
    const query = `SELECT * FROM user`;
    const response = await db.all(query);
    res.send(response);
  } catch (error) {
    console.log(error.message);
  }
});

app.post("/register/", async (request, response) => {
  try {
    const { username, password } = request.body;
    // check if user already exists with the same username
    const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser) {
      response.status(400);
      response.send("User already exists");
    } else if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      // Create a new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const addNewUserQuery = `
        INSERT INTO user ( username, password) 
        VALUES ( '${username}', '${hashedPassword}')
        `;
      await db.run(addNewUserQuery);
      response.send("User created successfully");
    }
  } catch (error) {
    response.status(400);
    response.send(error.message);
  }
});

app.post("/login/", async (request, response) => {
  try {
    const { username, password } = request.body;
    // check if the username exists
    console.log(username, password);
    const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
    const dbUser = await db.get(selectUserQuery);
    if (!dbUser) {
      response.status(400);
      response.send("Invalid user");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (!isPasswordMatched) {
        response.status(400);
        response.send("Invalid password");
      } else {
        const payload = { username };
        const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
        response.send({ jwtToken });
      }
    }
  } catch (error) {
    response.status(400);
    response.send(error.message);
  }
});

// Authentication Middleware
const authenticateUser = (request, response, next) => {
  try {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (!authHeader) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwtToken = authHeader.split(" ")[1];
      jwt.verify(jwtToken, "MY_SECRET_KEY", (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  } catch (error) {
    response.send(error.message);
  }
};

app.post("/add/", authenticateUser, async (request, response) => {
  try {
    const values = request.body.map(
      (each) =>
        `('${each.userId}', '${each.id}', '${each.title}', '${each.body}')`
    );

    const valuesString = values.join(",");

    const addData = `
    INSERT INTO
      user_data (user_id, id, title ,body)
    VALUES
       ${valuesString};`;

    const dbResponse = await db.run(addData);
    const bookId = dbResponse.lastID;
    response.send({ Id: bookId });
  } catch (error) {
    response.send(error.message);
  }
});

app.get("/data/", authenticateUser, async (request, response) => {
  try {
    const getDataQuery = `
            SELECT * FROM user_data`;

    const dbResponse = await db.all(getDataQuery);
    response.send(dbResponse);
  } catch (error) {
    response.send(error.message);
  }
});
