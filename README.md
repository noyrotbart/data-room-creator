# Data Room Platform

A multi-tenant document sharing platform. Each organization gets their own branded data room with Google Drive integration, analytics, and AI-powered document chat.

## Features

- **Multi-tenant**: Each org gets a subdomain (e.g., `acme.yourdomain.com`)
- **Google Drive sync**: Connect a Drive folder, documents sync automatically
- **View analytics**: Track who viewed what, for how long
- **AI Chat**: Users can ask questions about documents (powered by Claude)
- **Access control**: Invite users via email, with Google or password auth
- **Download permissions**: Control who can download files
- **Custom branding**: Each org sets their own name, logo, and colors

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnoyrotbart%2Fdata-room-platform&env=DATABASE_URL,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,NEXTAUTH_SECRET,NEXTAUTH_URL,PLATFORM_DOMAIN,RESEND_API_KEY,EMAIL_FROM&envDescription=Required%20environment%20variables%20for%20the%20data%20room%20platform&envLink=https%3A%2F%2Fgithub.com%2Fnoyrotbart%2Fdata-room-platform%2Fblob%2Fmain%2F.env.local.example)

### Prerequisites

1. **Neon PostgreSQL** — [neon.tech](https://neon.tech) (free tier works)
2. **Google Cloud project** — OAuth credentials for sign-in + Drive access
3. **Resend** — [resend.com](https://resend.com) for invite emails
4. **Cloudflare** (or similar) — Wildcard DNS: `*.yourdomain.com` → Vercel
5. **Anthropic API key** (optional) — For AI document chat

### Setup Steps

1. Click "Deploy with Vercel" above
2. Fill in the environment variables (see `.env.local.example` for details)
3. Set up wildcard DNS: `*.yourdomain.com` → your Vercel deployment
4. Configure Google OAuth redirect URIs:
   - `https://yourdomain.com/api/auth/callback/google`
   - `https://yourdomain.com/api/admin/drive-callback`
5. Visit your domain — you'll see the landing page
6. Click "Create your Data Room" to set up the first organization

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Yes | Random secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | Your root domain URL |
| `PLATFORM_DOMAIN` | Yes | Root domain (e.g., `dataroom.io`) |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `EMAIL_FROM` | Yes | Sender email (e.g., `Data Room <noreply@yourdomain.com>`) |
| `ANTHROPIC_API_KEY` | No | For AI chat feature |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | No | Client-side domain display |

## Architecture

- **Next.js 14** App Router
- **Neon PostgreSQL** via `@neondatabase/serverless`
- **NextAuth.js** with Google + Credentials providers
- **Resend** for transactional emails
- **Google Drive API** for document storage
- **Anthropic Claude** for AI chat
- **Tailwind CSS** for styling

## How It Works

1. **Middleware** extracts the subdomain from the request host
2. Each org's data is isolated by `org_id` in all database tables
3. Admins connect their Google Drive folder through an OAuth flow
4. Documents are synced, chunked, and indexed for full-text search
5. Users are invited by email with Google sign-in or password access
6. Every document view is logged with duration tracking

## Local Development

```bash
npm install
cp .env.local.example .env.local
# Fill in your environment variables
npm run dev
# Use ?org=your-slug to test org context on localhost
```
