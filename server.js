import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());

// =============== MEMORY SYSTEM ===============
// Render allows writing only to /tmp
const memoryFile = "/tmp/memory.json";

function loadMemory() {
  if (!fs.existsSync(memoryFile)) {
    fs.writeFileSync(memoryFile, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(memoryFile));
}

function saveMemory(data) {
  fs.writeFileSync(memoryFile, JSON.stringify(data, null, 2));
}

console.log("Groq Key Loaded:", process.env.GROQ_API_KEY ? "YES" : "NO");


// ====================== CHAT ENDPOINT ======================
app.post("/chat", async (req, res) => {
  try {
    const { message, username, userClass } = req.body;

    const memory = loadMemory();

    // Create a user profile if missing
    if (!memory.users[username]) {
      memory.users[username] = {
        class: userClass,
        history: [],
        quizzesTaken: 0
      };
    }

    const userData = memory.users[username];

    // Save USER message
    userData.history.push({
      sender: "user",
      text: message,
      time: Date.now()
    });

    saveMemory(memory);

    // Build system prompt with memory of last 10 messages
    const systemPrompt = `
You are QuizMate AI, created by Karunya.
Your ONLY tasks:
- Help with quizzes
- Generate questions
- Explain concepts
- Clarify doubts for school subjects

DO NOT answer unrelated topics.

User Name: ${username}
Class: ${userData.class}

Conversation History (last 10 messages):
${userData.history
      .slice(-10)
      .map(h => `${h.sender.toUpperCase()}: ${h.text}`)
      .join("\n")}
`;

    // Call Groq API
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    // Save AI message
    userData.history.push({
      sender: "ai",
      text: aiReply,
      time: Date.now()
    });

    saveMemory(memory);

    res.json({ reply: aiReply });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      reply: "⚠️ Error: Something went wrong with the AI server.",
    });
  }
});


// ====================== QUIZ ENDPOINT ======================
app.post("/quiz", async (req, res) => {
  try {
    const { topic, username } = req.body;

    const memory = loadMemory();

    if (memory.users[username]) {
      memory.users[username].quizzesTaken += 1;
      saveMemory(memory);
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Generate EXACTLY this format:

1) Question?
A) Option 1
B) Option 2
C) Option 3
D) Option 4
Answer: C

Make exactly 5 questions.
Topic: ${topic}`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ quiz: response.data.choices[0].message.content });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      quiz: "⚠️ Error generating quiz."
    });
  }
});


// ====================== START SERVER ======================
app.listen(5000, () =>
  console.log("✅ Backend running with full memory system")
);
