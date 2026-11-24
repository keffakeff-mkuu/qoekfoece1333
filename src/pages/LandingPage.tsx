import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Layers, Lock, Shield, Smartphone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FOUR_CATEGORIES, PRODUCT_RICH_META } from '../lib/catalogMeta';
import { ProductIcon } from '../components/ProductIcon';
import { Button, Card, StatusLabel } from '../components/ui';

export const LandingPage: React.FC = () => {
  const { catalog, enterDemoWorkspace } = useApp();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_development' | 'planned_next' | 'planned'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [deskImgFailed, setDeskImgFailed] = useState(false);

  const handleDemo = async () => {
    setLaunching(true);
    const res = await enterDemoWorkspace('owner');
    setLaunching(false);
    if (!res.error) {
      navigate('/app/fieldforce/dashboard');
    }
  };

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of FOUR_CATEGORIES) map.set(c, 0);
    for (const item of catalog) {
      map.set(item.category, (map.get(item.category) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [catalog]);

  const fieldforce = catalog.find((p) => p.slug === 'fieldforce');
  const biashara = catalog.find((p) => p.slug === 'biashara-os');

  const filteredCatalog = catalog.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesStatus && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="text-lg font-bold tracking-tight text-[#0B132B] whitespace-nowrap shrink-0 flex items-center gap-2">
            <span className="h-7 w-7 rounded-md bg-[#059669] flex items-center justify-center text-white">
              <Shield className="h-4 w-4" />
            </span>
            AI Africa
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#flagship" className="hover:text-[#0B132B] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              FieldForce AI
            </a>
            <a href="#architecture" className="hover:text-[#0B132B] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Architecture
            </a>
            <a href="#categories" className="hover:text-[#0B132B] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Categories
            </a>
            <a href="#suite" className="hover:text-[#0B132B] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              20 Solutions
            </a>
            <Link to="/auth/login" className="hover:text-[#0B132B] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Sign In
            </Link>
          </nav>

          <div className="shrink-0">
            <Button onClick={handleDemo} disabled={launching}>
              {launching ? 'Launching...' : 'Open Demo Workspace'}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-[#0B132B] text-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 lg:py-20 grid lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="text-xs font-semibold text-emerald-400">
              One Account · 5-Layer Shared Core · 20 African Business Solutions
            </div>
            <h1 className="text-[clamp(2rem,3.6vw,3.25rem)] font-bold leading-[1.12] tracking-tight mt-3 text-balance">
              One Platform for East African Field &amp; Business Operations
            </h1>
            <p className="text-slate-300 mt-4 text-base leading-relaxed max-w-xl">
              Register one organisation account and activate modular vertical applications as they launch—starting
              with FieldForce AI (Security Edition), followed by BiasharaOS for SME ledgers and TradePilot AI.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button onClick={handleDemo} disabled={launching} size="lg">
                {launching ? 'Opening...' : 'Launch FieldForce Demo'} <ArrowRight className="h-4 w-4" />
              </Button>
              <Link
                to="/auth/register"
                className="tap-target inline-flex items-center text-sm font-medium text-slate-200 hover:text-white underline underline-offset-4 px-2"
              >
                Create Organisation Account
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="w-full rounded-xl overflow-hidden border border-[#1C2541] bg-[#1C2541] min-h-[260px] lg:h-full">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_nairobi_operations_1795482555548.jpg"
                  alt="Modern commercial tower entrance and security reception in Nairobi at golden hour"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                  <Shield className="h-12 w-12 text-emerald-400 mb-3" />
                  <div className="font-semibold text-base">FieldForce AI — Security Edition</div>
                  <div className="text-xs text-slate-300 mt-1">Nairobi · Westlands · Kilimani Site Command</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Flagship Product 01 & Next Product 02 Highlight */}
      <section id="flagship" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-5 flex">
            <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[250px] lg:h-full">
              {!deskImgFailed ? (
                <img
                  src="/src/assets/images/fieldforce_command_desk_1795482556519.jpg"
                  alt="Operations coordinators monitoring site coverage and guard attendance in Nairobi"
                  referrerPolicy="no-referrer"
                  onError={() => setDeskImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                  <Smartphone className="h-10 w-10 text-[#059669] mb-2" />
                  <div className="font-semibold text-slate-800">Operations &amp; Mobile Guard Control</div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between gap-6">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-[#0B132B] tracking-tight">
                Wave 1: FieldForce AI · Wave 2: BiasharaOS
              </h2>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                Built as a modular monolith: one shared authentication, RBAC, audit, and AI orchestrator foundation
                backing independent business modules with zero cross-tenant exposure.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {fieldforce && (
                <Card className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono tabular-nums">01 · {fieldforce.category}</span>
                      <StatusLabel label="Building now" tone="emerald" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0B132B] mt-2">{fieldforce.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{fieldforce.short_description}</p>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                      <li>• Shift conflict &amp; double-booking protection</li>
                      <li>• Mobile 44px clock-in/out &amp; immutable overrides</li>
                      <li>• PII-redacted AI incident drafts with human approval</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <Button onClick={handleDemo} disabled={launching} size="sm" className="w-full">
                      Open FieldForce Workspace
                    </Button>
                  </div>
                </Card>
              )}

              {biashara && (
                <Card className="p-5 flex flex-col justify-between bg-slate-50/70">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono tabular-nums">02 · {biashara.category}</span>
                      <StatusLabel label="Next · Coming soon" tone="amber" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0B132B] mt-2">{biashara.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{biashara.short_description}</p>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <li>• SME invoicing &amp; KES ledger controls</li>
                      <li>• M-Pesa payment reconciliation workflows</li>
                      <li>• Activates inside your existing organisation account</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/70">
                    <Button variant="secondary" onClick={handleDemo} disabled={launching} size="sm" className="w-full">
                      Join Roadmap Waitlist
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5-Layer Architecture Summary */}
      <section id="architecture" className="border-t border-slate-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#059669]">
            <Layers className="h-4 w-4" /> SHARED TECHNOLOGY ARCHITECTURE
          </div>
          <h2 className="text-xl font-bold text-[#0B132B] mt-1">
            Built Once at the Core, Activated Module by Module
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
            {[
              { step: 'Layer 1', title: 'Platform Foundation', desc: 'Single sign-in, organisations, RBAC permissions, and entitlements.' },
              { step: 'Layer 2', title: 'AI Intelligence', desc: 'Main Assistant + Orchestrator routing strictly to active agents.' },
              { step: 'Layer 3', title: 'Shared Services', desc: 'Notifications, combined CSV reporting, and immutable audit logs.' },
              { step: 'Layer 4', title: '20 App Modules', desc: 'FieldForce active now; BiasharaOS & 18 verticals gated by 6 launch checks.' },
              { step: 'Layer 5', title: 'Field Interfaces', desc: 'Desktop command portal and Android-friendly 44px mobile web.' },
            ].map((l) => (
              <div key={l.step} className="p-4 rounded-lg border border-slate-200 bg-[#F8FAFC]">
                <div className="text-[11px] font-mono text-[#059669] font-semibold">{l.step}</div>
                <div className="text-sm font-bold text-[#0B132B] mt-1">{l.title}</div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 Product Categories Summary */}
      <section id="categories" className="border-t border-slate-200 bg-[#F8FAFC]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-xl font-bold text-[#0B132B]">Four Suite Categories</h2>
          <p className="text-sm text-slate-600 mt-1">
            All 20 solutions are organised into four clear business pillars. Select any category to filter below.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {categories.map(([cat, count]) => {
              const selected = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(selected ? 'all' : cat)}
                  className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#059669] bg-emerald-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="text-sm font-semibold text-[#0B132B]">{cat}</div>
                  <div className="text-xs font-mono tabular-nums text-slate-500 mt-1">
                    {count} {count === 1 ? 'solution' : 'solutions'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Full 20-Product Suite Directory */}
      <section id="suite" className="border-t border-slate-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#0B132B]">Complete 20-Solution Catalogue</h2>
              <p className="text-sm text-slate-600 mt-1">
                Upcoming applications are clearly marked Coming soon until they pass all 6 launch gates.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: `All (${catalog.length})` },
                  { id: 'in_development', label: 'Building now' },
                  { id: 'planned_next', label: 'Next (BiasharaOS)' },
                  { id: 'planned', label: 'Coming soon' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStatusFilter(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCatalog.map((item) => {
              const rich = PRODUCT_RICH_META[item.slug];
              const tone =
                item.status === 'in_development'
                  ? 'emerald'
                  : item.status === 'planned_next'
                    ? 'amber'
                    : 'slate';
              const statusText =
                rich?.badgeText ||
                (item.status === 'in_development'
                  ? 'Building now'
                  : item.status === 'planned_next'
                    ? 'Next · Coming soon'
                    : 'Coming soon');

              return (
                <Card key={item.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 text-[#0B132B] flex items-center justify-center shrink-0">
                        <ProductIcon name={rich?.icon} className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        Wave {String(rich?.wave ?? item.display_order).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-3">{item.category}</div>
                    <h3 className="font-bold text-base text-slate-900 mt-0.5">{item.name}</h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-snug">
                      {rich?.problemSolved || item.short_description}
                    </p>
                    {rich?.whoItServes && (
                      <div className="text-[11px] text-slate-500 mt-2">
                        <span className="font-semibold text-slate-700">For:</span> {rich.whoItServes}
                      </div>
                    )}
                    {rich?.features && (
                      <ul className="mt-2.5 space-y-1 text-[11px] text-slate-600">
                        {rich.features.slice(0, 2).map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <StatusLabel label={statusText} tone={tone} />
                    <button
                      onClick={handleDemo}
                      className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      {item.slug === 'fieldforce' ? 'Explore →' : 'Waitlist →'}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            <span>AI Africa Platform · FieldForce AI Security Edition · Nairobi, Kenya</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/auth/login" className="hover:text-slate-900">Sign In</Link>
            <Link to="/auth/register" className="hover:text-slate-900">Register Organisation</Link>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" /> Kenya DPA 2019 Data Minimisation
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
