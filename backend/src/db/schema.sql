-- Database Schema for AI Ad Manager

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Dealerships Table
CREATE TABLE IF NOT EXISTS dealerships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'owner' NOT NULL, -- owner | staff
  dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Ad Accounts Table (OAuth credentials for platforms)
CREATE TABLE IF NOT EXISTS ad_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL, -- 'google' | 'meta'
  platform_account_id TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT NOT NULL, -- Encrypted or plain for sandbox
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(dealership_id, platform)
);

-- 4. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  template_type TEXT, -- 'model_launch' | 'test_drive' | 'exchange' | 'festive' | 'clearance' | 'custom'
  car_model TEXT,
  offer_text TEXT,
  budget DECIMAL(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_location TEXT,
  status TEXT DEFAULT 'active' NOT NULL, -- 'active' | 'paused' | 'completed' | 'failed'
  google_campaign_id TEXT,
  meta_campaign_id TEXT,
  platforms TEXT[] NOT NULL, -- ['google', 'meta']
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Leads Table (Ingested leads)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  platform TEXT NOT NULL, -- 'google' | 'meta'
  platform_lead_id TEXT UNIQUE,
  name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'new' NOT NULL, -- 'new' | 'contacted' | 'qualified' | 'lost'
  notes TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Budget Settings Table
CREATE TABLE IF NOT EXISTS budget_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL, -- 'google' | 'meta'
  monthly_cap DECIMAL(12, 2) NOT NULL,
  alert_75_email BOOLEAN DEFAULT TRUE NOT NULL,
  alert_95_email BOOLEAN DEFAULT TRUE NOT NULL,
  alert_95_sms BOOLEAN DEFAULT TRUE NOT NULL,
  phone_for_sms TEXT,
  UNIQUE(dealership_id, platform)
);

-- 7. Weekly Reports Table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_spend DECIMAL(12, 2) NOT NULL,
  total_leads INTEGER NOT NULL,
  cpl DECIMAL(12, 2) NOT NULL,
  top_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  insight_text TEXT,
  pdf_url TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Metrics Cache Table (Fast reading of aggregated stats)
CREATE TABLE IF NOT EXISTS metrics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL, -- 'google' | 'meta' | 'aggregated'
  date DATE NOT NULL,
  spend DECIMAL(12, 2) NOT NULL,
  impressions INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  leads INTEGER NOT NULL,
  cpl DECIMAL(12, 2) NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(dealership_id, platform, date)
);
