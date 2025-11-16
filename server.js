import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: "*", // important for APK + WebView
  })
);

app.use(express.json());

console.log("Groq Key Loaded:", process.env.GROQ_API_KEY ? "YES" : "NO");

// ---------------------- CHAT ENDPOINT ----------------------
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are QuizMate AI created by Karunya." },
          { role: "user", content: userMessage },
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

// ---------------------- QUIZ ENDPOINT ----------------------
app.post("/quiz", async (req, res) => {
  try {
    const topic = req.body.topic;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Generate 5 MCQs with 4 options each + correct answer. Format clearly.",
          },
          { role: "user", content: `Create a quiz on: ${topic}` },
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

app.listen(5000, () => console.log("✅ Backend running on port 5000"));
