//64c6e52eae99e4c652edb655c51bf65a-191fb7b6-8dfed828api key for mailgun

const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const cors = require("cors");
const mailgun = require("mailgun-js");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); 

// PostgreSQL setup
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "alumini_network",
  password: "root",
  port: 5432,
});

// Mailgun setup
const mg = mailgun({
  apiKey: "64c6e52eae99e4c652edb655c51bf65a-191fb7b6-8dfed828", // Replace with your Mailgun API key
  domain: "sandboxe71947a89f184cc2845fe778c50cbf56.mailgun.org", // Replace with your Mailgun domain
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Invalid username or password" });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid username or password" });

    res.json({ message: "Login successful" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Register
app.post("/register", async (req, res) => {
  const { username, password, securityQuestion, securityAnswer } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer, 10);
    await pool.query(
      "INSERT INTO users (username, password, security_question, security_answer) VALUES ($1, $2, $3, $4)",
      [username, hashedPassword, securityQuestion, hashedAnswer]
    );
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    if (error.code === "23505") {
      res.status(400).json({ error: "Username already exists" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Forgot Password
app.post("/forgot-password", async (req, res) => {
  const { username, securityAnswer } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Invalid username" });
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(securityAnswer, user.security_answer);
    if (!isMatch) return res.status(400).json({ error: "Incorrect answer to security question" });
    // Generate a new random password
    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Update the password in the database
    await pool.query("UPDATE users SET password = $1 WHERE username = $2", [hashedPassword, username]);
    // Send the new password to the user's email
    const data = {
      from: "Your App <no-reply@your-domain>", // Replace with a valid "from" email
      to: username, // Assuming username is the email address
      subject: "Your New Password",
      text: `Your new password is: ${newPassword}\n\nPlease change it after logging in for better security.`,
    };
    mg.messages().send(data, (error, body) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: "Error sending email" });
      }
      res.json({ message: "Your new password has been sent to your registered email address" });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Fetch Security Question
app.get("/security-question/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query("SELECT security_question FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Invalid username" });

    res.json({ securityQuestion: result.rows[0].security_question });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Feedback Submission
app.post("/submit-feedback", async (req, res) => {
  const { subject, feedback } = req.body;

  if (!subject || !feedback) {
    return res.status(400).json({ error: "Subject and feedback are required" });
  }

  try {
    const query = "INSERT INTO feedback (subject, feedback, timestamp) VALUES ($1, $2, NOW())";
    await pool.query(query, [subject, feedback]);
    res.status(200).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    console.error("Error saving feedback:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
