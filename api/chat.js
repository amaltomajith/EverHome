import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  // --- 1. CORS HEADERS (The Bouncer VIP List) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); // The '*' allows Lovable's preview URL to connect
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // If the browser sends a quick "pre-flight" check, say everything is okay!
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 2. REQUIRE POST METHOD ---
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;

  try {
    const client = await clientPromise;
    const db = client.db('PortfolioDB');
    
    // --- 3. FETCH KNOWLEDGE BASE ---
    const kbData = await db.collection('kb').find({}).toArray();
    const context = kbData.map(doc => doc.content).join("\n");

// --- 4. CONSTRUCT SYSTEM PROMPT ---
    // --- 4. CONSTRUCT SYSTEM PROMPT ---
    const systemPrompt = `You are the official AI Assistant for Everhome, an initiative by the Praja Kirana Seva Charitable Trust.
    Your goal is to warmly welcome visitors, assist potential donors, and guide those seeking support or volunteer opportunities.
    Speak in a compassionate, respectful, and professional tone. You represent an orphanage and charitable trust, so empathy and trustworthiness are your top priorities.

    CRITICAL ANTI-HALLUCINATION RULES:
    - NEVER make up information, donation links, addresses, phone numbers, or staff names.
    - If a user asks a question about a program, person, or detail NOT explicitly mentioned in the Knowledge Base below, politely explain that you don't have that specific information right now.
    - Do not invent ways to donate or volunteer. Stick STRICTLY to the facts provided.

    FORMATTING RULES:
    - Keep your responses warm but concise. Avoid long walls of text.
    - Use short, digestible paragraphs.
    - Use bullet points when listing ways to donate, volunteer roles, or available resources.
    - Use **bold text** to highlight key programs, urgent needs, or important instructions.

    Use ONLY the following Knowledge Base to answer the user's question naturally and warmly:
    
    ${context}`;

    // --- 5. CALL GROQ ---
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
      })
    });

    const data = await response.json();
    
    // SAFETY NET: Check if Groq sent an error instead of a response
    if (!data.choices || data.choices.length === 0) {
      console.error("Groq API Error:", JSON.stringify(data, null, 2));
      return res.status(500).json({ error: "Groq failed to respond", details: data });
    }

    const botReply = data.choices[0].message.content;

    // --- 6. SAVE CHAT TO HISTORY ---
    await db.collection('messages').insertOne({
      role: 'user', 
      content: message, 
      timestamp: new Date() 
    });
    await db.collection('messages').insertOne({
      role: 'assistant', 
      content: botReply, 
      timestamp: new Date() 
    });

    res.status(200).json({ reply: botReply });
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}