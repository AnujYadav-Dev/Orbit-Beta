# Hosting the Bot: Complete Guide

This guide walks you through deploying the Orbit entirely in the cloud. You will never need to leave your computer running.

Our architecture uses three completely free-tier services:
1. **Neon Postgres**: For storing session cookies and run logs.
2. **GitHub Actions**: For executing the bot automatically every day.
3. **Render**: For hosting the standalone web dashboard.

---

## Part 1: Setting up the Database (Neon)

Neon provides a generous free tier for Serverless Postgres. We use it to store browser sessions so you stay logged in across GitHub Actions runs, and to store logs for the dashboard.

1. Go to [neon.tech](https://neon.tech) and sign up for a free account.
2. Click **Create a new project**.
3. Once created, go to the **Dashboard** and look for the "Connection string".
4. Copy the connection string. It will look like this:
   `postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
5. **That's it!** You don't need to run any SQL commands. The bot will automatically create the `sessions` and `run_logs` tables the first time it runs.

---

## Part 2: Setting up the Bot (GitHub Actions)

The bot runs on GitHub Actions. It reads your accounts and config from GitHub Secrets so they remain secure and private.

### 1. Prepare your JSON files
Create your `accounts.json` and `config.json` files locally. Make sure they are valid JSON!

**Crucial settings for `config.json`:**
- `"headless": true` (Required for cloud)
- `"clusters": 1` (Required for free-tier runner RAM limits)
- `"scheduler": { "enabled": false }` (GitHub Actions handles the schedule)
- `"safetyAdvisory": { "blockedBehavior": "continue" }` (Prevents interactive prompts from freezing the workflow)

### 2. Add Repository Secrets
1. Go to your GitHub repository.
2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret** and add the following three secrets:

| Secret Name | Value |
|-------------|-------|
| `DATABASE_URL` | The Neon connection string you copied in Part 1. |
| `ACCOUNTS_JSON` | The full, raw JSON text of your `accounts.json` file. |
| `CONFIG_JSON` | The full, raw JSON text of your `config.json` file. |

### 3. Adjust the Schedule (Optional)
By default, the bot runs at `12:15 PM UTC` every day.
If you want to change this, edit the `.github/workflows/rewards.yml` file in your repository and change the cron string:
```yaml
  schedule:
    - cron: '15 12 * * *'  # Change this standard cron string
```

### 4. Run the Bot!
1. Go to the **Actions** tab in your repository.
2. Select **Orbit — Scheduled Run** on the left.
3. Click the **Run workflow** dropdown on the right and click **Run workflow**.
4. You can click into the workflow run to watch the live console logs.

---

## Part 3: Deploying the Dashboard (Render)

The dashboard gives you a beautiful web UI to view your accounts, points collected, and live logs from anywhere on your phone or PC.

1. Go to [render.com](https://render.com) and sign up for a free account.
2. Click **New** and select **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub account.
4. Select your Orbit fork repository.
5. Fill out the deployment details:
   - **Name**: `rewards-dashboard` (or whatever you like)
   - **Root Directory**: `dashboard-server` *(Critical!)*
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
6. Scroll down to **Environment Variables** and add two:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | The EXACT SAME Neon connection string from Part 1. |
| `ACCESS_TOKEN` | Create a secure password here (e.g. `MySecurePassword123!`). You will type this to log into the dashboard. |

7. Click **Create Web Service**.
8. Wait a few minutes for Render to build and deploy the app. Once it says "Live", click the URL at the top left of the screen!

### Using the Dashboard
When you open your Render URL, you will be greeted by a login screen. Type the password you set as `ACCESS_TOKEN`. 
Once logged in, the dashboard will automatically pull the latest run logs, session status, and total points collected directly from your Neon database!
