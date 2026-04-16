

# Enterprise-Grade Login Page for DLAX

## Design

A split-screen layout with a branded left panel and login form on the right:

```text
┌─────────────────────┬──────────────────────┐
│                     │                      │
│   DLAX BRANDING     │    Login Form        │
│   HardHat Icon      │    Email / Password  │
│   Tagline           │    Sign In Button    │
│   Key Stats         │    Toggle Sign Up    │
│   (workforce,       │    Forgot Password   │
│    projects, etc.)  │                      │
│                     │                      │
│   Dark gradient     │    Light background  │
│   background        │                      │
└─────────────────────┴──────────────────────┘
```

On mobile, the left panel collapses to a compact header above the form.

## Features
- **Split-screen layout**: Left panel with dark gradient, brand logo, tagline, and animated stats/features; right panel with the login form
- **Password visibility toggle** (Eye/EyeOff icon)
- **Forgot password link** (placeholder for now)
- **Loading spinner** on submit button
- **Professional footer** with "Powered by KPC Infrastructure" and copyright
- **Responsive**: stacks vertically on mobile with compact branding header
- **Subtle animations**: fade-in on mount

## Technical Steps
1. Rewrite `src/routes/login.tsx` with the new split-screen design
2. Uses only existing dependencies (lucide-react icons, shadcn components, Tailwind classes)
3. No new packages needed

