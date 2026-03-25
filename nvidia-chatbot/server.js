const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure API key is present
if (!process.env.NVIDIA_API_KEY) {
  console.warn("WARNING: NVIDIA_API_KEY is not set in the environment variables.");
}

// Initialize OpenAI client pointing to NVIDIA API
const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || 'dummy_key_to_prevent_crash',
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages: messages,
      temperature: 0.7,
      top_p: 1,
      max_tokens: 1024,
      stream: false,
    });

    res.json(completion.choices[0].message);
  } catch (error) {
    console.error('Error calling NVIDIA API:', error);
    res.status(500).json({ error: 'Failed to generate response from NVIDIA API.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
