import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// 1. Initialize environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/horse_racing';

// 2. Middleware Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN, // Limits access to your specified frontend
  credentials: true
}));
app.use(express.json()); // Allows your server to parse JSON request bodies

// 3. Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log(' Successfully connected to MongoDB'))
  .catch((err) => console.error(' MongoDB connection error:', err));

// 4. Quick Example Routes showing Bcrypt and JWT usage
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Horse Racing API!' });
});

// Mock Register Route (Bcrypt Example)
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Hash the password cleanly using bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Normally you would save username and hashedPassword to a Mongoose model here
    res.status(201).json({ message: 'User registered successfully!', user: { username, password: hashedPassword } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Mock Login Route (JWT Generation Example)
app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  const secret = process.env.JWT_SECRET || 'fallback_secret';

  // Create a payload and sign a token that expires in 1 hour
  const token = jwt.sign({ user: username }, secret, { expiresIn: '1h' });

  res.json({ message: 'Logged in!', token });
});

// 5. Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});