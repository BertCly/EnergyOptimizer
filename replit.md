# Battery Energy Management System

## Overview

This is a battery energy management system simulator built with React and Express. The application provides a real-time battery optimization simulation with price-based charging/discharging strategies, PV generation integration, and comprehensive data visualization.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (2025-01-15)

✓ Updated default configuration values: battery capacity 200kWh, charge/discharge rate 200kW, min SoC 5%, max SoC 95%
✓ Removed forecasting panel and current status display for cleaner interface
✓ Changed simulation to run immediately without delays - all results shown instantly
✓ Updated PV curtailment logic: only when EPEX price is negative
✓ Updated relay control logic: activates when PV surplus + battery full OR price ≤ 0
✓ Added matching tooltip colors for better chart readability
✓ Fixed NODE_ENV requirement by setting default value in server
✓ Replaced timed simulation with instant full optimization calculation

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React hooks with TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Charts**: Chart.js for real-time data visualization

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple

### Key Components

#### Battery Simulator (`client/src/components/battery-simulator.tsx`)
- Main simulation controller with real-time updates
- Manages battery state, pricing, and energy flow
- Integrates optimization algorithm for charge/discharge decisions
- Provides start/stop simulation controls

#### Configuration Panel (`client/src/components/configuration-panel.tsx`)
- Battery capacity and rate settings
- State of charge (SoC) limits configuration
- Price threshold controls
- Real-time status display

#### Charts Section (`client/src/components/charts-section.tsx`)
- Real-time visualization of energy prices, consumption, and PV generation
- Battery power and SoC monitoring
- Historical data tracking with Chart.js

#### Data Table (`client/src/components/data-table.tsx`)
- Tabular view of simulation data
- Export functionality for analysis
- Real-time data logging

#### Optimization Algorithm (`client/src/lib/optimization-algorithm.ts`)
- Price-based battery charging/discharging strategy
- Peak shaving and valley filling optimization
- 12-slot lookahead prediction horizon
- Considers SoC constraints and rate limits

### Data Flow

1. **Configuration**: User sets battery parameters through Configuration Panel
2. **Simulation Start**: Battery Simulator generates 48 time slots of mock data (prices, consumption, PV)
3. **Optimization**: Control algorithm analyzes current state and price forecast
4. **Decision Making**: System determines optimal battery power for each time slot
5. **Visualization**: Charts and tables update in real-time showing energy flows and costs
6. **Data Export**: Users can export simulation results for further analysis

### Database Schema

The system uses Drizzle ORM with PostgreSQL, configured for:
- User management (basic user table structure in `shared/schema.ts`)
- Battery configuration persistence
- Simulation data storage
- Session management

### External Dependencies

#### UI Components
- **shadcn/ui**: Comprehensive React component library built on Radix UI
- **Radix UI**: Unstyled, accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Chart.js**: Canvas-based charting library

#### Data Management
- **TanStack Query**: Server state management and caching
- **Zod**: Runtime type validation and schema definition
- **date-fns**: Date utility functions

#### Development Tools
- **Vite**: Fast build tool with HMR
- **TypeScript**: Static type checking
- **ESLint**: Code linting (implied by TSConfig)

### Deployment Strategy

#### Development
- **Dev Server**: `npm run dev` starts both frontend (Vite) and backend (tsx)
- **Hot Reload**: Vite provides instant updates for frontend changes
- **API Proxy**: Vite dev server proxies API requests to Express backend

#### Production Build
- **Frontend**: `vite build` creates optimized static assets
- **Backend**: `esbuild` bundles server code for Node.js deployment
- **Static Serving**: Express serves built frontend assets in production

#### Database Migration
- **Drizzle Kit**: Handles database schema migrations
- **Push Command**: `npm run db:push` applies schema changes
- **Environment**: DATABASE_URL required for database connection

### Key Design Decisions

#### Monorepo Structure
- **Problem**: Shared types and schemas between frontend and backend
- **Solution**: Unified TypeScript project with shared folder
- **Benefits**: Type safety across full stack, reduced code duplication

#### Real-time Simulation
- **Problem**: Demonstrate battery optimization in action
- **Solution**: Interval-based simulation with 500ms updates
- **Benefits**: Visual feedback, educational value, testing optimization logic

#### Client-side Optimization
- **Problem**: Complex battery control algorithm
- **Solution**: Implement optimization logic in frontend
- **Benefits**: Responsive UI, no server load, easier debugging

#### Mock Data Generation
- **Problem**: Realistic energy patterns for demonstration
- **Solution**: Algorithmic generation of prices, consumption, and PV data
- **Benefits**: Consistent testing, no external API dependencies

The system is designed for educational and demonstration purposes, showing how battery energy storage systems can optimize costs through intelligent charging and discharging strategies based on dynamic electricity pricing and energy demand patterns.