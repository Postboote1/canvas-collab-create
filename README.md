# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/364d1d78-e7a4-4dd7-8181-98048e9f3d4a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/364d1d78-e7a4-4dd7-8181-98048e9f3d4a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Mobile Support

This project has been optimized for mobile devices with:
- Responsive layouts for all screen sizes
- Touch-friendly controls for the canvas editor
- Mobile-optimized navigation with a hamburger menu on small screens
- Larger touch targets for better usability
- Simplified UI on small screens to focus on essential features

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/364d1d78-e7a4-4dd7-8181-98048e9f3d4a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes it is!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

### To does:
1. presentation no other objekts like circle get displayed
2. frames für slides
3. delete drawings
4. menu on item/card not working
6. pocketbase for users and cloud storage
7. Canvas can be saved to account limit max. 5 / 25Mb (maybe compression?)
7. optimize for touchscreens
8. new tool eraser to erase drawings and arrows
9. Admin Page with admin login for me with statistics
10. Different roles (viewer, editor)
12. Item/icon for card is missleading
13. No rectangle objekt
14. Notification on canvas only at the bottom not at the top
15. Export as PDF and Image 
17. Only can save canvas when an objekt is added and then an image. A canvas can not be saved when only a image is uploaded

### Pocketbase:
## Canvases Collection:

Create a collection named "canvases"
Add fields:
- name (text, required)
- data (json, required)
- size (number, default 0)
- joinCode (text)
- isPublic (boolean, default false)
- user (relation to pb_users_auth, required)

## AppSettings Collection:

Create a collection named "appSettings"
Add fields:
- allowRegistration (boolean, default true)
- maxCanvasesPerUser (number, default 5)
- maxStoragePerUser (number, default 26214400)

## Modify Users Collection:

Add fields to existing users collection:
- role (select with options "user" and "admin", default "user")
- canvasLimit (number, default 5)
- storageLimit (number, default 26214400)
- currentStorage (number, default 0)

## ServerMetrics:
Create a new collection named serverMetrics
Add the following fields:
    - timestamp (DateTime)
    - cpu (Number)
    - memory (Number)
    - storage (Number)
    - activeUsers (Number)
    - apiRequests (Number)
    "listRule": "@request.auth.role = 'admin'",
    "viewRule": "@request.auth.role = 'admin'",
    "createRule": "@request.auth.role = 'admin'",
    "updateRule": "@request.auth.role = 'admin'",
    "deleteRule": "@request.auth.role = 'admin'"

## Canvases Collection Rules
# List rule (lets users see their own canvases)
@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")

# View rule (same as list rule)
@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")

# Create rule (allows users to create canvases owned by themselves) 
@request.auth.id != ""

# Update rule (allows users to edit their own canvases)
@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")

# Delete rule (allows users to delete their own canvases)
@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")

## Users Collection Permissions
# Create rule (to allow registration)
true

# Profile rule (allow users to see their own profiles)
@request.auth.id = id || @request.auth.role = "admin"

## Appsettings rules:
# List rule (allow all authenticated users to view settings)
@request.auth.id != ""

# View rule (allow all authenticated users to view settings)
@request.auth.id != ""

# Create rule (only admins can create settings)
@request.auth.role = "admin"

# Update rule (only admins can update settings) 
@request.auth.role = "admin"

# Delete rule (only admins can delete settings)
@request.auth.role = "admin"



### Email Server Configuration for PocketBase
If you have a domain from Porkbun, you have a few options:

## Option A: Use Porkbun Email Services
If Porkbun provides email hosting with your domain, you can use their SMTP server. Look in your Porkbun account for email configuration details.

## Option B: Use a Transactional Email Service (Recommended)
This is more reliable for application emails:

SendGrid: Free tier (100 emails/day), great deliverability
Mailgun: Similar to SendGrid
Resend.com: Developer-friendly, easy to configure
AWS SES: Cost-effective for higher volumes
To configure in PocketBase:

Go to http://localhost:8090/_/:
    Navigate to Settings → Mail Settings
    Enter the SMTP details:
    SMTP server (e.g., smtp.sendgrid.net)
    Port (usually 587 or 465)
    Username (provided by service)
    Password (provided by service)
    Default sender (noreply@yourdomain.com)