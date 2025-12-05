import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// =========================
// ⭐ CONNECT TO MONGODB
// =========================
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// =========================
// ⭐ USER MEMORY MODEL
// =========================
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  class: String,
  history: [
    {
      sender: String, // "user" or "ai"
      text: String,
      time: Number,
    },
  ],
  quizzesTaken: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

// =========================
// ⭐ CHAT ENDPOINT
// =========================
app.post("/chat", async (req, res) => {
  try {
    const { message, username, userClass } = req.body;

    // Load or create user
    let user = await User.findOne({ username });

    if (!user) {
      user = new User({
        username,
        class: userClass,
        history: [],
        quizzesTaken: 0,
      });
    }

    // Save user message
    user.history.push({
      sender: "user",
      text: message,
      time: Date.now(),
    });

    await user.save();

    // Build system prompt with last 10 messages
    const systemPrompt = `
You are QuizMate AI, built by Karunya.
Your ONLY job:
- Generate quizzes
- Explain concepts
- Answer study questions
- Help with learning
Do NOT respond to unrelated topics.

User Name: ${username}
Class: ${user.class}

Conversation history (last 10 messages):
${user.history
        .slice(-10)
        .map((h) => `${h.sender.toUpperCase()}: ${h.text}`)
        .join("\n")}
`;

    // Send to Groq AI
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiReply = response.data.choices[0].message.content;

    // Save AI reply
    user.history.push({
      sender: "ai",
      text: aiReply,
      time: Date.now(),
    });

    await user.save();

    res.json({ reply: aiReply });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      reply: "⚠️ AI server error.",
    });
  }
});

// =========================
// ⭐ QUIZ ENDPOINT
// =========================
app.post("/quiz", async (req, res) => {
  try {
    const { topic, username } = req.body;

    // Load user
    let user = await User.findOne({ username });
    if (user) {
      user.quizzesTaken += 1;
      await user.save();
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

Make *exactly* 5 questions.
Topic: ${topic}`,
          },
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

// =========================
// ⭐ START SERVER
// =========================
app.listen(5000, () =>
  console.log("🚀 QuizMate Backend Running with Permanent Memory")
);
