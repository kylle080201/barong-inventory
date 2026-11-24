import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Usage: npm run mcp-token <email> [expiry, e.g. 90d]
// Prints a Bearer token for connecting an MCP client to /api/mcp as that user.
// It must be signed with the same NEXTAUTH_SECRET as the deployed app.

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) config({ path: envPath });

async function main() {
  const email = process.argv[2];
  const expiresIn = process.argv[3] || '90d';
  if (!email) {
    console.error('Usage: npm run mcp-token <email> [expiry, e.g. 90d]');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI || !process.env.NEXTAUTH_SECRET) {
    console.error('Error: MONGODB_URI and NEXTAUTH_SECRET must be set in .env.local');
    process.exit(1);
  }

  // Imported after env is loaded, since these read env vars at import time
  const { default: connectDB } = await import('../lib/mongodb');
  const { default: User } = await import('../models/User');
  const { generateToken } = await import('../lib/jwt');
  const mongoose = (await import('mongoose')).default;

  await connectDB();
  const user: any = await User.findOne({ email: email.toLowerCase().trim() }).lean();
  if (!user) {
    console.error(`No user found with email ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const token = generateToken(
    { id: String(user._id), email: user.email, name: user.name, role: user.role },
    expiresIn as any
  );
  await mongoose.disconnect();

  console.log(`MCP token for ${user.email} (expires in ${expiresIn}):\n`);
  console.log(token);
  console.log('\nKeep it secret: anyone with it can record and edit sales and stock as this user.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
