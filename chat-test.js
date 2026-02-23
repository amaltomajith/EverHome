import 'dotenv/config';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("💬 Everhome Local Test Live! (Type 'exit' to quit)");

const ask = () => {
  rl.question("You: ", async (msg) => {
    if (msg.toLowerCase() === 'exit') return rl.close();

    // Changed to hit your LOCAL server instead of Vercel
    const response = await fetch('http://localhost:3000/api/chat', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });

    const data = await response.json();
    console.log(`🤖 Bot: ${data.reply || data.error}\n`);
    ask();
  });
};

ask();