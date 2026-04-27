CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  niche TEXT,
  location TEXT,
  keywords TEXT,
  max_leads INTEGER,
  language TEXT DEFAULT 'auto',
  service_offered TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  platform TEXT NOT NULL,
  name TEXT,
  company TEXT,
  profile_url TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  raw_data TEXT,
  score INTEGER,
  score_reason TEXT,
  suggested_message TEXT,
  status TEXT DEFAULT 'por_contactar',
  contacted_at DATETIME,
  last_followup_at DATETIME,
  followup_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);

-- v2: Copiloto comercial tables
CREATE TABLE IF NOT EXISTS lead_strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  angle TEXT,
  non_obvious_problem TEXT,
  commercial_implication TEXT,
  hook TEXT,
  message_goal TEXT,
  recommended_tone TEXT,
  why_this_angle TEXT,
  full_strategy TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_strategies_lead ON lead_strategies(lead_id);

CREATE TABLE IF NOT EXISTS conversation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT,
  direction TEXT,
  content TEXT,
  metadata TEXT,
  status_before TEXT,
  status_after TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conv_events_lead ON conversation_events(lead_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  channel TEXT,
  lead_status TEXT,
  response_type TEXT,
  objection TEXT,
  intent_level TEXT,
  recommended_action TEXT,
  suggested_reply TEXT,
  recommended_timing TEXT,
  strategic_reason TEXT,
  full_analysis TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conv_analyses_lead ON conversation_analyses(lead_id);

CREATE TABLE IF NOT EXISTS follow_up_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  followup_type TEXT,
  suggested_date DATETIME,
  message TEXT,
  objective TEXT,
  strategic_reason TEXT,
  copied INTEGER DEFAULT 0,
  marked_as_sent INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON follow_up_recommendations(lead_id, status);
