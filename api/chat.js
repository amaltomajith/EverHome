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

    // --- 4. CREATE SYSTEM PROMPT ---
    const systemPrompt = `You are the official AI Assistant for Everhome, an initiative by the Praja Kirana Seva Charitable Trust.
    Your goal is to warmly welcome visitors, assist potential donors, and guide those seeking support or volunteer opportunities.
    
    CRITICAL LANGUAGE RULE:
    - ALWAYS refer to the residents as "the children" or "our children." 
    - NEVER use the words "orphan," "orphaned," or "orphans." We operate as a family, and our language must reflect that dignity and empowerment.
    
    CRITICAL ANTI-HALLUCINATION RULES:
    - NEVER make up donation links, addresses, or phone numbers. 
    - Use ONLY the facts provided in the Knowledge Base. 
    - If a user asks for a donation method, prioritize the UPI ID: **psctbangalore@okaxis**.

    TONE & STYLE:
    - Speak with compassion, respect, and professional warmth.
    - Use short, digestible paragraphs and bullet points for lists.
    - Render important details like the UPI ID, Phone Numbers, and the Address in **bold**.

    Use ONLY the following Knowledge Base to answer:
    
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