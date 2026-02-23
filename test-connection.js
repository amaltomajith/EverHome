import 'dotenv/config'; // Loads your .env file
import clientPromise from './lib/mongodb.js';

async function test() {
  console.log("🚀 Starting Local Test...");

  try {
    // 1. Test MongoDB
    console.log("Testing MongoDB Connection...");
    const client = await clientPromise;
    // NOTE: Change 'PortfolioDB' to 'EverhomeDB' if you are testing the new orphanage database!
    const db = client.db('PortfolioDB'); 
    await db.command({ ping: 1 });
    console.log("✅ MongoDB Connected Successfully!");

    // 2. Test Groq API
    console.log("Testing Groq API...");
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Say hello!' }],
      })
    });

    const data = await response.json();
    if (data.choices) {
      console.log("✅ Groq Responded:", data.choices[0].message.content);
    } else {
      console.log("❌ Groq Error:", data);
    }

  } catch (err) {
    console.error("❌ TEST FAILED:");
    console.error(err);
  } finally {
    process.exit();
  }
}

test();