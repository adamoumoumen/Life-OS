import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { db } from './src/db/index.js';
import { taskEvents, agentActionLogs, users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const app = express();
app.use(express.json({limit: '50mb'})); // Increased for base64 images

const PORT = 3000;
const TEST_USER_ID = "test-user-id";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    try {
      const existingUser = await db.select().from(users).where(eq(users.id, TEST_USER_ID));
      if (existingUser.length === 0) {
        await db.insert(users).values({ id: TEST_USER_ID, email: "test@family.com", name: "Test User" });
      }
      (req as any).userId = TEST_USER_ID;
    } catch (error) {
      console.error("Failed to setup test user:", error);
    }
  }
  next();
});

// Chatbot Endpoint (Multi-turn)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, model = "gemini-2.5-flash" } = req.body;
    let response;
    try {
      response = await ai.models.generateContent({
        model,
        contents: messages,
        config: {
          systemInstruction: "You are a helpful and proactive AI assistant for Life OS.",
        }
      });
    } catch (e: any) {
      if (e.status === 429 || e.status === 503 || e.status === 404) {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: messages,
          config: {
            systemInstruction: "You are a helpful and proactive AI assistant for Life OS.",
          }
        });
      } else {
        throw e;
      }
    }
    res.json({ text: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// High Thinking Endpoint
app.post('/api/ai/think', async (req, res) => {
  try {
    const { prompt } = req.body;
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: "HIGH" }
        }
      });
    } catch (e: any) {
      if (e.status === 429 || e.status === 503 || e.status === 404) {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
      } else {
        throw e;
      }
    }
    res.json({ text: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Grounding (Search/Maps) Endpoint
app.post('/api/ai/grounded', async (req, res) => {
  try {
    const { prompt, useMaps } = req.body;
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: useMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }],
        }
      });
    } catch (e: any) {
      if (e.status === 429 || e.status === 503 || e.status === 404) {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            tools: useMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }],
          }
        });
      } else {
        throw e;
      }
    }
    res.json({ text: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Image Analysis Endpoint
app.post('/api/ai/analyze-image', async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;
    let response;
    // imageBase64 should be just the base64 string without data:image/xxx;base64,
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          { role: 'user', parts: [
            { text: prompt || "Analyze this image in detail." },
            { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
          ]}
        ]
      });
    } catch (e: any) {
      if (e.status === 429 || e.status === 503 || e.status === 404) {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: 'user', parts: [
              { text: prompt || "Analyze this image in detail." },
              { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
            ]}
          ]
        });
      } else {
        throw e;
      }
    }
    res.json({ text: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Document Analysis Endpoint
app.post('/api/ai/analyze-document', async (req, res) => {
  try {
    const { prompt, documentBase64, mimeType, fileName } = req.body;
    let extractedText = "";

    const buffer = Buffer.from(documentBase64, 'base64');
    
    if (mimeType === 'application/pdf') {
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (mimeType.includes('word') || fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mimeType.includes('text') || fileName.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: "Unsupported file type. Please upload PDF, DOCX or TXT." });
    }

    const combinedPrompt = `${prompt || "Analyze this document and add relevant information to my planning."}\n\nDocument Name: ${fileName}\n\nDocument Context:\n${extractedText.substring(0, 50000)}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: combinedPrompt
      });
    } catch (e: any) {
      if (e.status === 429 || e.status === 503 || e.status === 404) {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: combinedPrompt
        });
      } else {
        throw e;
      }
    }
    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Document analysis error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Seed some data endpoint for testing UI
app.post('/api/seed', async (req, res) => {
  try {
    await db.insert(taskEvents).values([
      {
        userId: TEST_USER_ID,
        title: "Morning Routine & Meditation",
        description: "Personal • 45 mins",
        isTask: false,
        isMovable: false,
        status: "pending",
        startTime: new Date(new Date().setHours(8, 0, 0, 0)),
      },
      {
        userId: TEST_USER_ID,
        title: "Weekly Family Standup",
        description: "Family Shared • 30 mins",
        isTask: false,
        isMovable: true,
        status: "pending",
        startTime: new Date(new Date().setHours(9, 30, 0, 0)),
      },
      {
        userId: TEST_USER_ID,
        title: "Pick up Sarah from School",
        description: "Family • 60 mins",
        isTask: false,
        isMovable: false,
        status: "pending",
        startTime: new Date(new Date().setHours(14, 0, 0, 0)),
      }
    ]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// The AI modify-schedule endpoint
app.post('/api/ai/modify-schedule', async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = (req as any).userId;

    // Fetch current tasks
    const currentTasks = await db.select().from(taskEvents).where(eq(taskEvents.userId, userId));
    
    // Define the schema for the agent's plan
    const planSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        actions: {
          type: Type.ARRAY,
          description: "List of actions to modify the schedule based on the prompt",
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "Type of action",
                enum: ["reschedule", "create", "delete"]
              },
              taskId: {
                type: Type.INTEGER,
                description: "ID of the task to modify (if applicable)",
                nullable: true,
              },
              newTitle: {
                type: Type.STRING,
                description: "New title for the task (if applicable)",
                nullable: true,
              },
              newStartTime: {
                type: Type.STRING,
                description: "New start time in ISO 8601 format (if rescheduling)",
                nullable: true,
              },
              reasoning: {
                type: Type.STRING,
                description: "Why this action is proposed",
              }
            },
            required: ["type", "reasoning"]
          }
        }
      },
      required: ["actions"]
    };

    // Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Using flash for cheap/high-volume
      contents: [
        {
          role: "user",
          parts: [{
            text: `You are the proactive AI agent for Life OS.
Current tasks: ${JSON.stringify(currentTasks)}
User request: ${prompt}
Propose a plan to modify the schedule. Remember, immovable tasks cannot be moved.`
          }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: planSchema,
      }
    });

    const planPayload = JSON.parse(response.text || "{}");

    // Log the proposed action
    const log = await db.insert(agentActionLogs).values({
      userId,
      actionType: "modify_schedule",
      planPayload,
      beforeState: { tasks: currentTasks },
      status: "proposed"
    }).returning();

    res.json({ success: true, plan: planPayload, logId: log[0].id });
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to confirm and execute the plan
app.post('/api/ai/confirm', async (req, res) => {
  try {
    const { logId } = req.body;
    
    const logs = await db.select().from(agentActionLogs).where(eq(agentActionLogs.id, logId));
    if (logs.length === 0) return res.status(404).json({ error: "Log not found" });
    
    const planPayload = logs[0].planPayload as any;
    
    if (planPayload && planPayload.actions) {
      for (const action of planPayload.actions) {
        if (action.type === 'reschedule' && action.taskId && action.newStartTime) {
          await db.update(taskEvents)
            .set({ startTime: new Date(action.newStartTime), updatedAt: new Date() })
            .where(eq(taskEvents.id, action.taskId));
        } else if (action.type === 'delete' && action.taskId) {
          await db.delete(taskEvents).where(eq(taskEvents.id, action.taskId));
        }
      }
    }

    // Update the log status
    await db.update(agentActionLogs)
      .set({ status: 'executed', executedAt: new Date() })
      .where(eq(agentActionLogs.id, logId));
      
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch tasks for the UI
app.get('/api/tasks', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const tasks = await db.select().from(taskEvents).where(eq(taskEvents.userId, userId));
    res.json({ tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch logs for the UI
app.get('/api/logs', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const logs = await db.select().from(agentActionLogs).where(eq(agentActionLogs.userId, userId));
    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
