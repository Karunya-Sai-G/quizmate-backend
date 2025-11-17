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
const memoryFile = path.resolve("memory.json");

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

    // Load memory
    const memory = loadMemory();

    // Create memory entry if user is new
    if (!memory.users[username]) {
      memory.users[username] = {
        class: userClass,
        history: [],
        quizzesTaken: 0
      };
    }

    // Save chat history
    memory.users[username].history.push({
      time: Date.now(),
      text: message
    });

    saveMemory(memory);

    const userData = memory.users[username];

    const systemPrompt = `
You are QuizMate AI created by Karunya.  
Use the user's profile when answering.

User Name: ${username}  
Class: ${userData.class}  
Previous messages (last 5): ${userData.history.slice(-5).map(h => h.text).join("\n")}

Only help with:
- Explaining topics
- Teaching concepts
- Assisting with quizzes
Do NOT answer unrelated topics.
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ reply: response.data.choices[0].message.content });
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
            content:
              `Generate EXACTLY this format:

1) Question text?
A) Option 1
B) Option 2
C) Option 3
D) Option 4
Answer: C

Make 5 questions. Topic: ${topic}`
          }
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ quiz: response.data.choices[0].message.content });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      quiz: "⚠️ Error generating quiz.",
    });
  }
});

app.listen(5000, () => console.log("✅ Backend running with memory system"));
