import mongoose, { Schema, Document, Model } from 'mongoose';

// OAuth 2.1 storage for the MCP endpoint: registered clients (e.g. ChatGPT, claude.ai),
// one-time authorization codes, and refresh tokens. Secrets are stored as SHA-256 hashes.

export interface IOAuthClient extends Document {
  clientId: string;
  clientSecretHash?: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: 'none' | 'client_secret_post' | 'client_secret_basic';
  createdAt: Date;
  updatedAt: Date;
}

const OAuthClientSchema = new Schema<IOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    clientSecretHash: { type: String },
    clientName: { type: String, required: true, trim: true },
    redirectUris: { type: [String], required: true },
    tokenEndpointAuthMethod: {
      type: String,
      enum: ['none', 'client_secret_post', 'client_secret_basic'],
      default: 'none',
    },
  },
  { timestamps: true }
);

export interface IOAuthCode extends Document {
  codeHash: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
  expiresAt: Date;
}

const OAuthCodeSchema = new Schema<IOAuthCode>({
  codeHash: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  userId: { type: String, required: true },
  redirectUri: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  scope: { type: String, required: true },
  resource: { type: String, required: true },
  // MongoDB removes expired codes automatically
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export interface IOAuthRefreshToken extends Document {
  tokenHash: string;
  clientId: string;
  userId: string;
  scope: string;
  resource: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const OAuthRefreshTokenSchema = new Schema<IOAuthRefreshToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    clientId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    scope: { type: String, required: true },
    resource: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

export const OAuthClient: Model<IOAuthClient> =
  mongoose.models.OAuthClient || mongoose.model<IOAuthClient>('OAuthClient', OAuthClientSchema);

export const OAuthCode: Model<IOAuthCode> =
  mongoose.models.OAuthCode || mongoose.model<IOAuthCode>('OAuthCode', OAuthCodeSchema);

export const OAuthRefreshToken: Model<IOAuthRefreshToken> =
  mongoose.models.OAuthRefreshToken ||
  mongoose.model<IOAuthRefreshToken>('OAuthRefreshToken', OAuthRefreshTokenSchema);
