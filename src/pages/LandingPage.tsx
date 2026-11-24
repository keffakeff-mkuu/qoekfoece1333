import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock, Shield, Smartphone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, Card, StatusLabel } from '../components/ui';

export const LandingPage: React.FC = () => {
  const { catalog, enterDemoWorkspace } = useApp();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_development' | 'planned_next' | 'planned'>('all');
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
    for (const item of catalog) {
      map.set(item.category, (map.get(item.category) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [catalog]);

  const fieldforce = catalog.find((p) => p.slug === 'fieldforce');
  const biashara = catalog.find((p) => p.slug === 'biashara-os');

  const filteredCatalog =
    statusFilter === 'all' ? catalog : catalog.filter((p) => p.status === statusFilter);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="text-lg font-bold tracking-tight text-[#0B132B] whitespace-nowrap shrink-0">
            AI Africa
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#flagship" className="hover:text-[#0B132B] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Flagship
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
              East African Operations Infrastructure · Nairobi, Kenya
            </div>
            <h1 className="text-[clamp(2rem,3.6vw,3.25rem)] font-bold leading-[1.12] tracking-tight mt-3 text-balance">
              Modular Enterprise Software for African Operations
            </h1>
            <p className="text-slate-300 mt-4 text-base leading-relaxed max-w-xl">
              One multi-tenant organisation account across 20 vertical business solutions—starting
              with FieldForce AI for deterministic security rostering, verifiable guard attendance,
              and supervisor-approved incident reporting.
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
                Launching With FieldForce AI, Followed by BiasharaOS
              </h2>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                Each product in the 20-solution catalogue shares one unified organisation directory,
                KES currency &amp; Africa/Nairobi locale, RBAC matrix, and append-only audit log.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {fieldforce && (
                <Card className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono tabular-nums">01 · {fieldforce.category}</span>
                      <StatusLabel label="In Development" tone="emerald" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0B132B] mt-2">{fieldforce.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{fieldforce.short_description}</p>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                      <li>• Shift conflict &amp; double-booking guard</li>
                      <li>• Mobile 44px clock-in/out &amp; override logs</li>
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
                      <StatusLabel label="Planned Next" tone="amber" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0B132B] mt-2">{biashara.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{biashara.short_description}</p>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <li>• SME invoicing &amp; KES ledger controls</li>
                      <li>• M-Pesa reconciliation workflows</li>
                      <li>• Multi-branch operational bookkeeping</li>
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

      {/* Product Categories Summary */}
      <section id="categories" className="border-t border-slate-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-xl font-bold text-[#0B132B]">Industry &amp; Functional Categories</h2>
          <p className="text-sm text-slate-600 mt-1">
            20 structured vertical modules organized across East African operational sectors.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
            {categories.map(([cat, count]) => (
              <div key={cat} className="p-3.5 rounded-lg border border-slate-200 bg-[#F8FAFC]">
                <div className="text-xs font-semibold text-slate-900 truncate">{cat}</div>
                <div className="text-xs font-mono tabular-nums text-slate-500 mt-1">
                  {count} {count === 1 ? 'solution' : 'solutions'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full 20-Product Suite Directory */}
      <section id="suite" className="border-t border-slate-200 bg-[#F8FAFC]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#0B132B]">Complete 20-Solution Catalogue</h2>
              <p className="text-sm text-slate-600 mt-1">
                Authentic product statuses directly from the platform catalogue.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(
                [
                  { id: 'all', label: `All (${catalog.length})` },
                  { id: 'in_development', label: 'In Development' },
                  { id: 'planned_next', label: 'Planned Next' },
                  { id: 'planned', label: 'Planned' },
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
              const tone =
                item.status === 'in_development'
                  ? 'emerald'
                  : item.status === 'planned_next'
                    ? 'amber'
                    : 'slate';
              const statusText =
                item.status === 'in_development'
                  ? 'In Development'
                  : item.status === 'planned_next'
                    ? 'Planned Next'
                    : 'Planned';

              return (
                <Card key={item.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono tabular-nums text-slate-500">
                      {String(item.display_order).padStart(2, '0')} · {item.category}
                    </div>
                    <h3 className="font-semibold text-base text-slate-900 mt-2">{item.name}</h3>
                    <p className="text-sm text-slate-600 mt-1.5 leading-snug">{item.short_description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <StatusLabel label={statusText} tone={tone} />
                    <button
                      onClick={handleDemo}
                      className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      {item.slug === 'fieldforce' ? 'Open →' : 'Waitlist →'}
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
