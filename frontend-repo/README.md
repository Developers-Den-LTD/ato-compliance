# ATO Compliance Frontend

Frontend application for the ATO Compliance Agent.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI)
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form + Zod

## Project Structure

```
ato-compliance-frontend/
├── src/
│   ├── components/      # React components
│   │   ├── ui/         # shadcn/ui components
│   │   └── ...         # Feature components
│   ├── pages/          # Page components
│   ├── contexts/       # React contexts
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilities and API clients
│   ├── types/          # TypeScript types
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
├── tailwind.config.js  # Tailwind configuration
└── tsconfig.json       # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- Backend API running on `http://localhost:3000`

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your backend URL:
   ```env
   VITE_API_URL=http://localhost:3000
   ```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

Build the application:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

The build output will be in the `dist/` directory.

## Features

- 🔐 **Authentication** - JWT-based login/register
- 📊 **Dashboard** - Compliance overview and metrics
- 🏢 **System Management** - Register and manage IT systems
- 🛡️ **Control Library** - Browse NIST 800-53 controls
- 📋 **STIG Compliance** - Track STIG/JSIG requirements
- 📄 **Document Generation** - Generate SSP, SAR, POA&M
- 📈 **Analytics** - Compliance reports and visualizations
- 🎨 **Dark Mode** - Light/dark theme support
- 📱 **Responsive** - Mobile-friendly design

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |

## API Integration

The frontend communicates with the backend via REST API:

- **Base URL**: Configured in `.env` as `VITE_API_URL`
- **Authentication**: JWT tokens stored in localStorage
- **Refresh Tokens**: HTTP-only cookies
- **API Client**: Located in `src/lib/authApi.ts` and `src/lib/queryClient.ts`

### API Endpoints Used

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET /api/systems` - List systems
- `GET /api/controls` - List controls
- And more...

## Docker Deployment

Build and run with Docker:

```bash
docker build -t ato-frontend .
docker run -p 80:80 ato-frontend
```

The Dockerfile uses Nginx to serve the static files.

## Development Tips

### Adding New Components

Use shadcn/ui CLI to add components:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
```

### API Calls

Use TanStack Query for data fetching:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

function MyComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/systems'],
  });
  
  // ...
}
```

### Routing

Use Wouter for routing:

```typescript
import { Route, Switch } from 'wouter';

<Switch>
  <Route path="/" component={Dashboard} />
  <Route path="/systems" component={Systems} />
</Switch>
```

### Forms

Use React Hook Form with Zod validation:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

## Styling

- **Tailwind CSS** for utility-first styling
- **CSS Variables** for theming
- **shadcn/ui** for pre-built components
- **Responsive** design with mobile-first approach

## Testing

The project includes test setup with:
- React Testing Library
- Vitest (configured but not extensively used)

Run tests:
```bash
npm run test
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Private - All rights reserved
