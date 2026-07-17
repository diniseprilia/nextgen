import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);

  const maxRetries = 5;
  const retryDelayMs = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(config.mongoUri);
      console.log(`MongoDB connected: ${config.mongoUri}`);
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => { setTimeout(resolve, retryDelayMs); });
    }
  }
}
