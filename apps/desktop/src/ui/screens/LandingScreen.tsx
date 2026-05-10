import React from 'react';
import { Play, ArrowRight, Cloud, Smartphone, Monitor, Shield, Server, Key, Layout, Users, FileText, Calendar, Lock, CheckCircle, Clock, BookOpen, Settings, Bell, Search, Plus } from 'lucide-react';

interface LandingScreenProps {
  onStart: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onStart }) => {
  return (
    <div className="landing-container">
      {/* NAVBAR */}
      <nav className="landing-navbar">
        <div className="landing-nav-left">
          <div className="landing-logo">
            <span className="landing-logo-text">Briefly</span>
          </div>
          <div className="landing-nav-links">
            <a href="#hero">Inicio</a>
            <a href="#features">Funciones</a>
            <a href="#mobile">Mobile</a>
            <a href="#security">Seguridad</a>
            <a href="#footer">Equipo</a>
          </div>
        </div>
        <div className="landing-nav-right">
          <button className="landing-btn-outline" onClick={onStart}>
            Iniciar sesión
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section id="hero" className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">Una ruta clara<br />para estudiar mejor.</h1>
          <p className="landing-hero-subtitle">
            Briefly conecta tus grupos, hojas, tareas y calendario en una experiencia web y móvil.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-btn-primary" onClick={onStart}>
              Probar ahora <ArrowRight size={18} />
            </button>
            <a href="#how-it-works" className="landing-btn-secondary">
              Ver demo <Play size={18} />
            </a>
          </div>
          <div className="landing-hero-badges">
            <span className="landing-badge"><Cloud size={14} /> Cloud-first</span>
            <span className="landing-badge"><Smartphone size={14} /> APK Android</span>
            <span className="landing-badge"><Monitor size={14} /> Web + Mobile</span>
          </div>
        </div>
        
        {/* HERO VISUAL MOCKUPS */}
        <div className="landing-hero-visuals">
          <div className="landing-mockup-laptop">
            <div className="landing-mockup-screen">
              <div className="landing-mockup-header">
                 <div className="mockup-header-dots">
                   <span></span><span></span><span></span>
                 </div>
                 <div className="mockup-header-url">briefly.ddns.net</div>
              </div>
              <div className="landing-mockup-body">
                <div className="landing-mockup-sidebar">
                  <div className="sidebar-brand">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> 
                    <span>Briefly</span>
                  </div>
                  <div className="sidebar-menu">
                    <div className="sm-item active"><Layout size={14}/> Dashboard</div>
                    <div className="sm-item"><FileText size={14}/> Notas</div>
                    <div className="sm-item"><Calendar size={14}/> Calendario</div>
                    <div className="sm-item"><CheckCircle size={14}/> Tareas</div>
                    <div className="sm-item"><Clock size={14}/> Horario</div>
                    <div className="sm-item"><Users size={14}/> Tableros</div>
                  </div>
                  <div className="sidebar-bottom">
                    <div className="sm-item"><Settings size={14}/> Ajustes</div>
                  </div>
                </div>
                <div className="landing-mockup-main">
                  <div className="mockup-main-header">
                     <h2>Dashboard</h2>
                     <div className="mockup-main-actions">
                        <Search size={14} color="#a1a1aa"/>
                        <Bell size={14} color="#a1a1aa"/>
                        <div className="mockup-avatar">J</div>
                     </div>
                  </div>
                  <div className="mockup-kpis">
                    <div className="kpi-card">
                      <Users size={16} color="#a78bfa" />
                      <div className="kpi-info">
                        <div className="kpi-val">5</div>
                        <div className="kpi-lbl">Total de Grupos</div>
                      </div>
                    </div>
                    <div className="kpi-card">
                      <CheckCircle size={16} color="#10b981" />
                      <div className="kpi-info">
                        <div className="kpi-val">2</div>
                        <div className="kpi-lbl">Tareas Pendientes</div>
                      </div>
                    </div>
                    <div className="kpi-card">
                      <Calendar size={16} color="#f59e0b" />
                      <div className="kpi-info">
                        <div className="kpi-val">1</div>
                        <div className="kpi-lbl">Eventos Hoy</div>
                      </div>
                    </div>
                  </div>
                  <div className="mockup-grid-main">
                     <div className="mockup-col">
                       <div className="mockup-section-title"><Users size={14}/> Mis grupos</div>
                       <div className="mockup-list">
                         <div className="ml-item">
                           <div className="ml-icon bg-purple">PW</div> 
                           <span>Personal Workspace</span>
                         </div>
                         <div className="ml-item">
                           <div className="ml-icon bg-blue">P2</div> 
                           <span>prueba2</span>
                         </div>
                         <div className="ml-item">
                           <div className="ml-icon bg-green">PT</div> 
                           <span>pm_tst_txt</span>
                         </div>
                         <div className="ml-item">
                           <div className="ml-icon bg-orange">DB</div> 
                           <span>db_final</span>
                         </div>
                       </div>
                     </div>
                     <div className="mockup-col">
                       <div className="mockup-section-title"><Clock size={14}/> Horario de hoy</div>
                       <div className="mockup-event-card">
                         <div className="mec-time">10:00 AM</div>
                         <div className="mec-details">
                           <div className="mec-title">Revisión de avances</div>
                           <div className="mec-sub">Sala de estudio virtual</div>
                         </div>
                       </div>
                       
                       <div className="mockup-section-title" style={{marginTop: 20}}><FileText size={14}/> Notas recientes</div>
                       <div className="mockup-note-card">
                         <div className="mnc-header">
                            <div className="mnc-title">Briefly-Cliente V.02</div>
                            <span className="mnc-badge">Hace 2h</span>
                         </div>
                         <div className="mnc-sub">Briefly Cloud / Workspace...</div>
                       </div>
                       <div className="mockup-note-card">
                         <div className="mnc-header">
                            <div className="mnc-title">Resumen de Biología</div>
                            <span className="mnc-badge">Ayer</span>
                         </div>
                         <div className="mnc-sub">Capítulo 4 y 5...</div>
                       </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="laptop-base">
               <div className="laptop-notch"></div>
            </div>
          </div>
          
          <div className="landing-mockup-mobile">
            <div className="landing-mockup-screen-mobile">
              <div className="mobile-notch"></div>
              <div className="mobile-header">
                <div className="mh-top">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  <Bell size={16} color="#a1a1aa" />
                </div>
                <div className="mh-title">Hola, Jhovanny</div>
                <div className="mh-sub">Miércoles, 5 de Mayo 2026</div>
              </div>
              <div className="mobile-body">
                <div className="mobile-search">
                  <Search size={14} color="#71717a" />
                  <span>Buscar en Briefly...</span>
                </div>
                
                <div className="mobile-section-title">Tareas pendientes <span className="ms-badge">2</span></div>
                <div className="mobile-task-list">
                  <div className="mt-item">
                    <div className="mt-check"></div> 
                    <div className="mt-text">
                      <div className="mt-name">Leer capítulo 5 - Biología</div>
                      <div className="mt-meta">Hoy • Personal Workspace</div>
                    </div>
                  </div>
                  <div className="mt-item">
                    <div className="mt-check"></div> 
                    <div className="mt-text">
                      <div className="mt-name">Ejercicios de derivadas</div>
                      <div className="mt-meta">Mañana • Cálculo Diferencial</div>
                    </div>
                  </div>
                </div>
                
                <div className="mobile-section-title">Próximo evento</div>
                <div className="mobile-event-card">
                  <div className="me-icon"><Calendar size={14} color="#a78bfa" /></div>
                  <div className="me-text">
                    <div className="me-title">Cálculo Diferencial</div>
                    <div className="me-time">Aula 13 • 12:00 - 13:30</div>
                  </div>
                </div>
              </div>
              <div className="mobile-tabbar">
                <div className="mt-tab active"><Layout size={20}/></div>
                <div className="mt-tab"><Calendar size={20}/></div>
                <div className="mt-tab-fab"><Plus size={20}/></div>
                <div className="mt-tab"><CheckCircle size={20}/></div>
                <div className="mt-tab"><Users size={20}/></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="landing-section">
        <div className="landing-section-header">
          <h2 className="landing-section-title">Cómo funciona</h2>
          <div className="title-underline"></div>
        </div>
        <div className="landing-steps-container">
          <div className="landing-step-line"></div>
          <div className="landing-grid-3 relative-z">
            <div className="landing-feature-card">
              <div className="landing-feature-icon-lg">
                <Users size={32} />
                <div className="icon-plus">+</div>
              </div>
              <h3>1. Crea un grupo</h3>
              <p>Invita a tus compañeros y crea espacios de estudio privados en segundos.</p>
              <div className="card-illustration">
                <svg viewBox="0 0 100 60" width="100" height="60">
                  {/* Hikers/people illustration */}
                  <path d="M10,50 L30,30 L50,45 L80,10" fill="none" stroke="#d5cebc" strokeWidth="2" strokeLinejoin="round"/>
                  <circle cx="20" cy="40" r="3" fill="#777"/>
                  <circle cx="60" cy="35" r="3" fill="#777"/>
                  <path d="M5,55 L95,55" fill="none" stroke="#e0dbcf" strokeWidth="1" strokeDasharray="4 4" />
                </svg>
              </div>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon-lg">
                <CheckCircle size={32} />
              </div>
              <h3>2. Organiza hojas y tareas</h3>
              <p>Comparte hojas, asigna tareas y define fechas para mantener todo en orden.</p>
              <div className="card-illustration">
                <svg viewBox="0 0 100 60" width="100" height="60">
                  {/* Books illustration */}
                  <rect x="25" y="35" width="50" height="8" rx="1" fill="#fdfcf8" stroke="#777" strokeWidth="1.5" />
                  <rect x="30" y="27" width="40" height="8" rx="1" fill="#fdfcf8" stroke="#777" strokeWidth="1.5" />
                  <rect x="20" y="43" width="60" height="8" rx="1" fill="#fdfcf8" stroke="#777" strokeWidth="1.5" />
                  <line x1="10" y1="55" x2="90" y2="55" stroke="#e0dbcf" strokeWidth="1" strokeDasharray="4 4" />
                </svg>
              </div>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon-lg">
                <Smartphone size={32} />
              </div>
              <h3>3. Continúa desde web o móvil</h3>
              <p>Tu información siempre sincronizada. Continúa donde lo dejaste.</p>
              <div className="card-illustration">
                 <svg viewBox="0 0 100 60" width="100" height="60">
                  {/* Mountains illustration */}
                  <path d="M10,55 L40,25 L60,45 L90,15 L100,25" fill="none" stroke="#777" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M30,55 L50,35 L70,55" fill="none" stroke="#aaa" strokeWidth="1" strokeLinejoin="round"/>
                  <line x1="5" y1="55" x2="95" y2="55" stroke="#e0dbcf" strokeWidth="1" strokeDasharray="4 4" />
                 </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ALL CONNECTED */}
      <section className="landing-section">
        <div className="landing-connected-wrapper">
          <div className="landing-connected-content">
            <span className="landing-section-overline">TODO CONECTADO</span>
            <h2 className="landing-section-title" style={{textAlign: 'left'}}>Tus espacios se sincronizan entre dispositivos.</h2>
            <p className="landing-section-desc" style={{margin: 0, textAlign: 'left'}}>Lo que creas en la web, lo tienes en tu móvil. Sincronización en tiempo real para que nada se quede atrás.</p>
            
            <div className="landing-dotted-path">
              <svg width="250" height="120" viewBox="0 0 250 120">
                <path d="M0,100 C80,100 120,20 250,20" fill="none" stroke="#d5cebc" strokeWidth="2" strokeDasharray="6 6" />
                {/* little tree detailed */}
                <g transform="translate(30, 95)">
                  <path d="M0,0 L5,-15 L10,0 Z" fill="#777" />
                  <path d="M2,-5 L5,-20 L8,-5 Z" fill="#555" />
                  <rect x="4" y="0" width="2" height="5" fill="#8b7355" />
                </g>
              </svg>
            </div>
          </div>
          <div className="landing-connected-visual">
             <div className="lc-laptop">
               <div className="lc-screen">
                 <div className="lc-header">
                   <div className="lc-header-left">
                     <div className="lc-icon-box"><BookOpen size={14} color="#a78bfa" /></div>
                     <span>Cálculo Diferencial</span>
                   </div>
                   <div className="lc-header-right">
                     <span className="lc-pill">Syncing...</span>
                   </div>
                 </div>
                 <div className="lc-tabs">
                   <span className="active">Resumen</span>
                   <span>Hojas</span>
                   <span>Tareas</span>
                   <span>Miembros</span>
                 </div>
                 <div className="lc-list-header">
                   <span className="lh-name">Nombre</span>
                   <span className="lh-pages">Páginas</span>
                   <span className="lh-date">Actualizado</span>
                 </div>
                 <div className="lc-list">
                   <div className="lc-item">
                     <span className="li-name"><FileText size={12}/> Límites y continuidad</span>
                     <span className="li-pages">15</span>
                     <span className="li-date">10h 2m</span>
                   </div>
                   <div className="lc-item">
                     <span className="li-name"><FileText size={12}/> Derivadas e interpretaciones</span>
                     <span className="li-pages">8</span>
                     <span className="li-date">10h 5m</span>
                   </div>
                   <div className="lc-item">
                     <span className="li-name"><FileText size={12}/> Reglas de derivación</span>
                     <span className="li-pages">12</span>
                     <span className="li-date">10h 12m</span>
                   </div>
                 </div>
               </div>
             </div>
             <div className="lc-mobile">
               <div className="lc-mobile-screen">
                 <div className="lc-m-header">
                   <div className="lc-icon-box-sm"><BookOpen size={10} color="#a78bfa" /></div>
                   <span>Cálculo Diferencial</span>
                 </div>
                 <div className="lc-m-tabs"><span className="active">Resumen</span><span>Hojas</span></div>
                 <div className="lc-m-list">
                   <div className="lc-m-item"><FileText size={10}/> Límites y...</div>
                   <div className="lc-m-item"><FileText size={10}/> Derivadas...</div>
                   <div className="lc-m-item"><FileText size={10}/> Reglas...</div>
                 </div>
               </div>
               <div className="lc-sync-badge">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* MAIN FEATURES */}
      <section id="features" className="landing-section">
        <div className="landing-features-wrapper">
          <div className="landing-features-grid-container">
            <span className="landing-section-overline">FUNCIONES PRINCIPALES</span>
            <h2 className="landing-section-title" style={{textAlign: 'left', marginBottom: 40}}>Todo lo que necesitas,<br/>en un solo lugar.</h2>
            
            <div className="landing-grid-2x3">
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Users size={24} color="#7c5cbf" />
                </div>
                <h3>Grupos de estudio</h3>
                <p>Crea grupos cerrados, invita compañeros y colabora de forma organizada.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <FileText size={24} color="#7c5cbf" />
                </div>
                <h3>Hojas compartidas</h3>
                <p>Comparte apuntes, documentos y recursos con tu grupo en un mismo espacio.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Calendar size={24} color="#7c5cbf" />
                </div>
                <h3>Tareas y calendario</h3>
                <p>Asigna tareas, establece fechas y visualiza todo en tu calendario integrado.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Cloud size={24} color="#7c5cbf" />
                </div>
                <h3>Sincronización cloud</h3>
                <p>Tus datos siempre disponibles y actualizados entre web y móvil.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Smartphone size={24} color="#7c5cbf" />
                </div>
                <h3>APK standalone</h3>
                <p>Usa Briefly en Android sin necesidad de Google Play. Ligero y seguro.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Shield size={24} color="#7c5cbf" />
                </div>
                <h3>Seguridad con JWT y HTTPS</h3>
                <p>Autenticación segura y conexión protegida en todo momento.</p>
              </div>
            </div>
          </div>
          <div className="landing-features-art">
             {/* Detailed cliff/mountain art mimicking the mockup */}
             <svg viewBox="0 0 300 800" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" className="cliff-svg">
                {/* Winding path up the cliff */}
                <path d="M0,800 C150,750 200,600 180,450 C160,300 250,150 220,50" fill="none" stroke="#e0dbcf" strokeWidth="40" strokeLinecap="round" />
                <path d="M0,800 C150,750 200,600 180,450 C160,300 250,150 220,50" fill="none" stroke="#fdfcf8" strokeWidth="38" strokeLinecap="round" />
                <path d="M0,800 C150,750 200,600 180,450 C160,300 250,150 220,50" fill="none" stroke="#d5cebc" strokeWidth="2" strokeDasharray="8 8" />
                
                {/* Cliff edges */}
                <path d="M0,800 L120,800 L200,600 L160,450 L220,300 L240,150 L200,50 L300,50 L300,800 Z" fill="url(#cliff-grad)" opacity="0.1" />
                <path d="M0,800 L120,800 L200,600 L160,450 L220,300 L240,150 L200,50" fill="none" stroke="#c4bfae" strokeWidth="2" strokeLinejoin="round" />
                
                {/* Trees on the cliff */}
                <g transform="translate(180, 580)"><path d="M0,0 L8,-25 L16,0 Z" fill="#555" /><path d="M4,-10 L8,-30 L12,-10 Z" fill="#333" /></g>
                <g transform="translate(130, 480)"><path d="M0,0 L6,-20 L12,0 Z" fill="#666" /></g>
                <g transform="translate(200, 280)"><path d="M0,0 L10,-30 L20,0 Z" fill="#444" /></g>
                <g transform="translate(180, 100)"><path d="M0,0 L5,-15 L10,0 Z" fill="#555" /></g>
                <g transform="translate(230, 80)"><path d="M0,0 L7,-20 L14,0 Z" fill="#333" /></g>
                
                {/* Pin */}
                <g transform="translate(220, 40)">
                  <circle cx="0" cy="0" r="12" fill="#ef4444" />
                  <path d="M-12,0 C-12,10 0,25 0,25 C0,25 12,10 12,0 Z" fill="#ef4444" />
                  <circle cx="0" cy="0" r="4" fill="white" />
                </g>
                
                <defs>
                  <linearGradient id="cliff-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d5cebc" />
                    <stop offset="100%" stopColor="#fdfcf8" />
                  </linearGradient>
                </defs>
             </svg>
          </div>
        </div>
      </section>

      {/* EDITORIAL - DESIGNED FOR STUDENTS */}
      <section className="landing-section">
        <div className="landing-section-editorial-rich">
          <div className="editorial-illustration">
             <svg viewBox="0 0 300 300" width="100%" height="100%">
                {/* Soft landscape background */}
                <circle cx="150" cy="150" r="140" fill="#f5f3fa" />
                <path d="M30,220 C80,180 150,230 270,170 L270,290 L30,290 Z" fill="#ede9f5" />
                
                {/* Abstract student/reader figure (line art style) */}
                <path d="M100,220 C100,180 130,150 150,150 C170,150 200,180 200,220" fill="none" stroke="#7c5cbf" strokeWidth="4" strokeLinecap="round" />
                <circle cx="150" cy="120" r="25" fill="none" stroke="#7c5cbf" strokeWidth="4" />
                <path d="M120,190 L180,190 L170,220 L130,220 Z" fill="#fdfcf8" stroke="#7c5cbf" strokeWidth="3" strokeLinejoin="round" />
                {/* Book lines */}
                <line x1="135" y1="200" x2="165" y2="200" stroke="#7c5cbf" strokeWidth="2" strokeLinecap="round" />
                <line x1="135" y1="210" x2="160" y2="210" stroke="#7c5cbf" strokeWidth="2" strokeLinecap="round" />
             </svg>
          </div>
          <div className="editorial-content">
            <span className="landing-section-overline">DISEÑADO PARA ESTUDIANTES</span>
            <h2 className="landing-editorial-title">Briefly reduce el desorden entre apuntes, pendientes y colaboración.</h2>
            <p className="landing-editorial-subtitle">Menos caos, más enfoque. Dedica tu energía a aprender, no a buscar información.</p>
            <div className="landing-editorial-stats">
              <div className="landing-stat">
                <div className="landing-stat-icon"><Layout size={20} /></div>
                <p>Enfócate en lo importante</p>
              </div>
              <div className="landing-stat-line"></div>
              <div className="landing-stat">
                <div className="landing-stat-icon"><Play size={20} /></div>
                <p>Menos distracciones, más productividad</p>
              </div>
              <div className="landing-stat-line"></div>
              <div className="landing-stat">
                <div className="landing-stat-icon"><Users size={20} /></div>
                <p>Colabora con tu equipo fácilmente</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY AND AVAILABILITY */}
      <section id="security" className="landing-section-dark">
        <div className="landing-section" style={{paddingBottom: 0, paddingTop: 60}}>
          <div className="landing-section-header">
            <span className="landing-section-overline" style={{color: '#a78bfa'}}>SEGURIDAD Y DISPONIBILIDAD</span>
            <h2 className="landing-section-title">Tu información está protegida<br/>y siempre disponible.</h2>
            <p className="landing-section-desc">Infraestructura moderna, protocolos seguros y arquitectura escalable para que estudies con tranquilidad.</p>
          </div>
          <div className="landing-security-grid">
            <div className="landing-security-item">
              <Lock size={32} />
              <h4>HTTPS</h4>
              <p>Conexiones cifradas para proteger tus datos en tránsito.</p>
            </div>
            <div className="landing-security-item">
              <Key size={32} />
              <h4>JWT</h4>
              <p>Autenticación segura con tokens para acceso confiable.</p>
            </div>
            <div className="landing-security-item">
              <Server size={32} />
              <h4>AWS EC2</h4>
              <p>Servidores en la nube escalables y de alta disponibilidad.</p>
            </div>
            <div className="landing-security-item">
              <div className="security-icon-n">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <h4>NGINX</h4>
              <p>Reverse proxy para rendimiento, seguridad y balanceo.</p>
            </div>
            <div className="landing-security-item">
              <Cloud size={32} />
              <h4>Datos centralizados en servicios cloud</h4>
              <p>Respaldo y redundancia para que nada se pierda.</p>
            </div>
          </div>
        </div>
        
        {/* Mountain silhouettes at bottom of dark section */}
        <div className="landing-dark-mountains">
           <svg width="100%" height="150" viewBox="0 0 1440 150" preserveAspectRatio="none">
             <path d="M0,150 L0,80 L150,40 L300,90 L450,20 L600,100 L750,50 L900,110 L1100,30 L1300,80 L1440,50 L1440,150 Z" fill="#0c0c12" />
             <path d="M0,150 L0,120 L200,70 L350,110 L500,60 L650,130 L800,90 L1000,140 L1200,80 L1440,110 L1440,150 Z" fill="#050508" />
             {/* Trees silhouette */}
             <path d="M100,120 L105,90 L110,120 Z M120,130 L123,100 L126,130 Z" fill="#030305" />
             <path d="M1300,110 L1305,70 L1310,110 Z M1320,120 L1324,80 L1328,120 Z" fill="#030305" />
           </svg>
        </div>
      </section>

      {/* CTA FINAL */}
      <section id="mobile" className="landing-section-cta">
        <div className="landing-cta-inner">
          <div className="landing-cta-content">
            <span className="landing-section-overline" style={{color: '#7c5cbf'}}>DISPONIBLE EN WEB Y ANDROID</span>
            <h2 className="landing-section-title" style={{color: '#111'}}>Lleva Briefly a todas partes.</h2>
            <p className="landing-section-desc" style={{color: '#555', marginBottom: 32}}>Accede desde tu navegador o desde tu Android.<br/>La misma experiencia, siempre contigo.</p>
            <div className="landing-cta-actions">
              <button className="landing-btn-primary" onClick={onStart}>
                <Monitor size={18} /> Abrir web
              </button>
              {/* TODO: replace with GitHub Releases APK URL before production release */}
              <a href="/downloads/briefly.apk" download className="landing-btn-secondary">
                <Smartphone size={18} /> Descargar APK
              </a>
              <a href="https://github.com/JhovaYu/Briefly_Cloud_First_Always_Online.git" target="_blank" rel="noreferrer" className="landing-btn-outline cta-github-btn">
                <img src="/github-mark.svg" alt="" width="18" onError={(e) => e.currentTarget.style.display='none'} /> Ver repositorio
              </a>
            </div>
          </div>
          <div className="cta-device-bg"></div>
          <div className="landing-cta-visual">
             <div className="cta-mockup-laptop">
               <div className="cta-ml-screen">
                 <div className="cta-ml-header"></div>
                 <div className="cta-ml-body">
                   <div className="cta-ml-sidebar"></div>
                   <div className="cta-ml-main">
                     <div className="cta-ml-cards"><div></div><div></div><div></div></div>
                     <div className="cta-ml-grid"><div></div><div></div></div>
                   </div>
                 </div>
               </div>
             </div>
             <div className="cta-mockup-mobile">
               <div className="cta-mm-screen">
                 <div className="cta-mm-header"></div>
                 <div className="cta-mm-body">
                   <div className="cta-mm-item"></div>
                   <div className="cta-mm-item"></div>
                   <div className="cta-mm-item"></div>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="footer" className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <div className="landing-logo">
              <span className="landing-logo-text">Briefly</span>
            </div>
            <p>Plataforma de colaboración<br/>para grupos de estudio.<br/>Hecha para estudiantes.</p>
          </div>
            <div className="landing-footer-col">
              <h4>Producto</h4>
              <a href="#hero">Inicio</a>
              <a href="#features">Funciones</a>
              <a href="#mobile">Mobile</a>
              <a href="#security">Seguridad</a>
            </div>
            <div className="landing-footer-col">
              <h4>Recursos</h4>
              <a href="#">Documentación</a>
              <a href="https://github.com/JhovaYu/Briefly_Cloud_First_Always_Online.git">Repositorio</a>
              <a href="#">Reportar un issue</a>
              <a href="#">Roadmap</a>
            </div>
            <div className="landing-footer-col">
              <h4>Proyecto Académico</h4>
              <span>Universidad Autónoma<br/>de Chiapas</span>
              <span>Taller de Desarrollo 4</span>
              <img src="/unach-logo.png" alt="UNACH" width="80" style={{marginTop: '16px', opacity: 0.8}} onError={(e) => e.currentTarget.style.display='none'} />
            </div>
            <div className="landing-footer-col">
              <h4>Equipo</h4>
              <span>David Levet Ramírez</span>
              <span>Elmar Enrique Maldonado de paz</span>
              <span>Isaac Hernández Molina</span>
              <span>Alfredo Emiliano Pinto Velasco</span>
              <span>Jhovanny Yuca Hernández</span>
            </div>
        </div>
        <div className="landing-footer-bottom">
          <p>© 2026 Briefly. Todos los derechos reservados.</p>
          <span>briefly.ddns.net</span>
        </div>
      </footer>
    </div>
  );
};
